# === Етап 1: Встановлення залежностей ===
# Використовуємо офіційний образ Node.js версії 18 на базі Alpine Linux для меншого розміру
FROM node:18-alpine AS deps
# Встановлюємо робочу директорію всередині контейнера
WORKDIR /app

# Копіюємо файли, що описують залежності проекту
COPY package.json yarn.lock* package-lock.json* pnpm-lock.yaml* ./
# Встановлюємо залежності, використовуючи ваш менеджер пакетів
# Розкоментуйте потрібний рядок і закоментуйте інші:
# RUN yarn install --frozen-lockfile
RUN npm install --frozen-lockfile
# RUN pnpm install --frozen-lockfile

# === Етап 2: Генерація Prisma Client ===
# Цей етап потрібен, щоб Prisma Client був готовий до етапу збірки
FROM node:18-alpine AS prisma_generator
WORKDIR /app
# Копіюємо встановлені залежності з попереднього етапу
COPY --from=deps /app/node_modules ./node_modules
# Копіюємо package.json (може бути потрібен для npx)
COPY package.json ./package.json
# Копіюємо схему Prisma
COPY prisma ./prisma
# Виконуємо команду генерації Prisma Client
RUN npx prisma generate

# === Етап 3: Збірка додатку ===
# Базуємося на тому ж образі Node.js
FROM node:18-alpine AS builder
WORKDIR /app
# Копіюємо залежності з першого етапу
COPY --from=deps /app/node_modules ./node_modules
# Копіюємо згенерований Prisma Client з другого етапу
COPY --from=prisma_generator /app/node_modules/.prisma ./node_modules/.prisma
# Копіюємо весь інший код вашого додатку
COPY . .

# ВАЖЛИВО: Якщо ваша збірка потребує DATABASE_URL, розкоментуйте та встановіть його тут
# (можна використовувати фіктивне значення для самої збірки)
# ENV DATABASE_URL="postgresql://dummyuser:dummypassword@dummyhost:5432/dummydb?schema=public"

# Виконуємо команду збірки вашого Next.js додатку
# Розкоментуйте потрібний рядок:
# RUN yarn build
RUN npm run build
# RUN pnpm build

# === Етап 4: Фінальний образ для запуску ===
# Базуємося на тому ж легкому образі Node.js
FROM node:18-alpine AS runner
WORKDIR /app

# Встановлюємо середовище для production
ENV NODE_ENV=production
# Вимикаємо телеметрію Next.js (рекомендовано для серверів)
ENV NEXT_TELEMETRY_DISABLED=1

# Створюємо системну групу та користувача для запуску додатку з меншими правами
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Копіюємо необхідні файли зі збірки (етап builder)
# Копіюємо папку public
COPY --from=builder /app/public ./public
# Копіюємо оптимізовану збірку standalone
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
# Копіюємо статичні файли
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
# Копіюємо node_modules (важливо для Prisma)
COPY --from=builder --chown=nextjs:nodejs /app/node_modules ./node_modules
# Копіюємо схему Prisma (може знадобитися для виконання)
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma

# Встановлюємо користувача для запуску процесу
USER nextjs

# Відкриваємо порт, на якому буде працювати додаток всередині контейнера
EXPOSE 3000

# Встановлюємо змінну середовища PORT
ENV PORT=3000

# Команда за замовчуванням для запуску сервера Next.js (з папки standalone)
CMD ["node", "server.js"]
