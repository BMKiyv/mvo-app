// pages/api/archive/employees.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient, Employee } from '@prisma/client'; // Переконайтесь, що Employee імпортовано

// Використовуйте ваш Prisma singleton або створіть новий екземпляр
// import prisma from '../../../lib/prisma'; // Якщо використовуєте singleton
const prisma = new PrismaClient();

// Тип для даних співробітника в архіві (вибираємо потрібні поля)
type ArchivedEmployeeData = Pick<Employee, 'id' | 'full_name' | 'position' | 'contact_info'>;

// Тип для успішної відповіді API (масив співробітників)
type ApiResponseData = ArchivedEmployeeData[];

// Тип для відповіді з помилкою
type ApiErrorData = {
    message: string;
    details?: any;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponseData | ApiErrorData>
) {
  // Дозволяємо тільки GET запити
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    // Перевірка res перед використанням
    if (!res.headersSent) {
         return res.status(405).json({ message: `Method ${req.method} Not Allowed` });
    }
    // Не забуваємо відключатись у випадку раннього виходу
    await prisma.$disconnect().catch(e => console.error("Failed to disconnect Prisma Client:", e));
    return;
  }

  try {
    // --- Отримання деактивованих співробітників ---
    const deactivatedEmployees = await prisma.employee.findMany({
      where: {
        is_active: false, // Ключовий фільтр: шукаємо тільки неактивних
      },
      select: { // Вибираємо поля, які потрібні для відображення в архіві
        id: true,
        full_name: true,
        position: true,
        contact_info: true,
        // Можна додати інші поля за потреби, наприклад, дату звільнення, якщо вона є
      },
      orderBy: {
        full_name: 'asc', // Сортуємо за іменем для зручності
      },
    });

    // Перевірка res перед надсиланням відповіді
    if (!res.headersSent) {
      // Типізація результату для відповіді
      const responseData: ApiResponseData = deactivatedEmployees;
      return res.status(200).json(responseData);
    }

  } catch (error) {
    console.error('Failed to fetch archived employees:', error);
    // Перевірка res перед надсиланням помилки
    if (!res.headersSent) {
        return res.status(500).json({
            message: 'Internal Server Error fetching archived employees',
            details: error instanceof Error ? error.message : String(error),
        });
    } else {
         console.error("Response headers already sent in archived employees error handler.");
    }
  } finally {
    // Гарантоване відключення Prisma Client
    await prisma.$disconnect().catch(e => console.error("Failed to disconnect Prisma Client:", e));
  }
}