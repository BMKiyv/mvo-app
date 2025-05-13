# Облік Активів - Веб-Додаток

Веб-додаток, розроблений BMKiyv в колаборації з Gemini для матеріально-відповідальних осіб з метою обліку співробітників, матеріальних цінностей (активів), їх категорій, типів, екземплярів/партій, видачі співробітникам, списання, ведення історії операцій та масового імпорту початкових даних з Excel.

## Технологічний Стек

* **Фронтенд:** Next.js (Pages Router), React, TypeScript
* **UI Бібліотека:** Material UI (MUI)
* **Керування Станом/Запити:** SWR
* **Обробка Excel на фронтенді:** `xlsx`
* **Бекенд:** Next.js API Routes
* **База Даних:** PostgreSQL
* **ORM:** Prisma
* **Контейнеризація:** Docker, Docker Compose

## Передумови

Перед початком роботи переконайтеся, що у вас встановлено:

* [Node.js](https://nodejs.org/) (рекомендована версія LTS, наприклад, 18.x або новіша)
* [npm](https://www.npmjs.com/) (зазвичай встановлюється разом з Node.js) або [Yarn](https://yarnpkg.com/)
* [Docker Desktop](https://www.docker.com/products/docker-desktop/)
* [Docker Compose](https://docs.docker.com/compose/install/) (зазвичай встановлюється разом з Docker Desktop)

## Локальна Розробка (без Docker)

1.  **Клонуйте репозиторій (якщо він є):**
    ```bash
    git clone <URL_вашого_репозиторію>
    cd <назва_папки_проекту>
    ```

2.  **Встановіть залежності:**
    ```bash
    npm install
    # або
    # yarn install
    ```

3.  **Налаштуйте змінні середовища:**
    * Створіть файл `.env.local` у корені проекту.
    * Додайте необхідні змінні, зокрема `DATABASE_URL` для підключення до вашої локальної або хмарної бази даних PostgreSQL.
        ```env
        # .env.local (приклад)
        DATABASE_URL="postgresql://USER:PASSWORD@HOST:PORT/DATABASE_NAME?schema=public"
        # NEXTAUTH_URL=http://localhost:3000 # Якщо використовуєте NextAuth
        # NEXTAUTH_SECRET=your_strong_secret # Якщо використовуєте NextAuth
        # Інші необхідні змінні...
        ```
    * **Важливо:** Переконайтеся, що у вас запущений екземпляр PostgreSQL, доступний за вказаним `DATABASE_URL`.

4.  **Застосуйте міграції Prisma:**
    ```bash
    npx prisma migrate dev
    ```
    Ця команда створить базу даних (якщо її немає) та застосує всі міграції.

5.  **Згенеруйте Prisma Client:**
    ```bash
    npx prisma generate
    ```

6.  **Запустіть сервер для розробки:**
    ```bash
    npm run dev
    # або
    # yarn dev
    ```
    Додаток буде доступний за адресою `http://localhost:3000`.

## Локальне Розгортання з Docker Compose

Цей спосіб дозволяє запустити додаток та базу даних PostgreSQL у Docker-контейнерах.

1.  **Переконайтеся, що у вас є файли:** `Dockerfile`, `.dockerignore`, `docker-compose.yml`.
2.  **Налаштуйте змінні середовища для Docker Compose:**
    * Створіть файл `.env` у корені проекту (цей файл буде використовуватися `docker-compose.yml`).
    * Задайте змінні для PostgreSQL, які використовуються у `docker-compose.yml`:
        ```env
        # .env (приклад для docker-compose)
        POSTGRES_USER=mvo_user
        POSTGRES_PASSWORD=your_secure_password_for_docker_pg # Встановіть надійний пароль
        POSTGRES_DB=mvo_assets_db

        # Інші змінні, які можуть знадобитися вашому додатку всередині Docker,
        # наприклад, NEXTAUTH_SECRET, якщо він не заданий прямо в docker-compose.yml
        ```
3.  **Зберіть образи та запустіть контейнери:**
    ```bash
    docker-compose up --build -d
    ```
    * `--build`: Зібрати образи перед запуском (потрібно при першому запуску або після змін у `Dockerfile`).
    * `-d`: Запустити контейнери у фоновому режимі.

4.  **Застосуйте міграції Prisma до бази даних у контейнері:**
    ```bash
    docker-compose exec app npx prisma migrate deploy
    ```
    * `app` - це ім'я сервісу вашого Next.js додатку, вказане у `docker-compose.yml`.

5.  Додаток буде доступний за адресою `http://localhost:3000`. База даних PostgreSQL буде доступна на порту, вказаному в `docker-compose.yml` (наприклад, `localhost:5433`).

6.  **Зупинка контейнерів:**
    ```bash
    docker-compose down
    ```

## Збірка для Продакшену (без Docker)

1.  **Встановіть залежності:** `npm install` або `yarn install`
2.  **Згенеруйте Prisma Client:** `npx prisma generate`
3.  **Зберіть додаток:**
    ```bash
    npm run build
    ```
4.  **Запустіть сервер:**
    ```bash
    npm run start
    ```

## Створення та Завантаження Docker Образу на Docker Hub

**Важливо:** Перед цим кроком переконайтеся, що команда `npm run build` (або аналогічна для вашого менеджера пакетів) завершується успішно без помилок ESLint/TypeScript. Помилки під час збірки перервуть створення Docker-образу.

1.  **Увійдіть до Docker Hub:**
    ```bash
    docker login
    ```
2.  **Зберіть Docker-образ:**
    Замініть `ваш_логін_dockerhub` на ваш логін та `mvo-app` на бажану назву образу.
    ```bash
    docker build -t ваш_логін_dockerhub/mvo-app:latest .
    ```
3.  **Завантажте образ на Docker Hub:**
    ```bash
    docker push ваш_логін_dockerhub/mvo-app:latest
    ```

## Розгортання на Сервері (Загальні Кроки з Docker Compose)

1.  **Підготуйте сервер:** Встановіть Docker та Docker Compose.
2.  **Скопіюйте проект:** Перенесіть файли проекту (`Dockerfile`, `.dockerignore`, `docker-compose.yml` та вихідний код) на сервер.
3.  **Налаштуйте змінні середовища:** Створіть файл `.env` на сервері з **продакшен** значеннями для `POSTGRES_PASSWORD` та інших секретів. Переконайтеся, що `DATABASE_URL` у `docker-compose.yml` (або переданий через змінну середовища) вказує на правильну адресу бази даних (якщо БД запускається через compose, то `postgres:5432`; якщо зовнішня БД – її URL).
4.  **Запустіть контейнери:**
    ```bash
    docker-compose up --build -d
    ```
5.  **Застосуйте міграції:**
    ```bash
    docker-compose exec app npx prisma migrate deploy
    ```
6.  **Налаштуйте Reverse Proxy:** Використовуйте Nginx або Caddy для направлення трафіку з вашого домену (порт 80/443) на порт додатку (наприклад, 3000) та налаштуйте SSL (HTTPS).

## Важливі Примітки

* **ESLint/TypeScript Помилки:** Перед успішною збіркою Docker-образу необхідно виправити всі помилки, які виявляються ESLint та TypeScript під час виконання `npm run build`.
* **Безпека:** Ніколи не додавайте файли `.env` або `.env.local` з реальними секретами у систему контролю версій (Git). Використовуйте `.gitignore` для їх виключення.
* **Змінні середовища:** Для продакшен-розгортання завжди використовуйте надійні та унікальні паролі та секрети.

