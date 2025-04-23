// pages/api/asset-categories/index.ts (або pages/api/asset-categories.ts)
import type { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Тип для опції категорії у випадаючому списку
type AssetCategoryOption = {
  id: number;
  name: string;
};

// Типи для відповіді API
type ApiResponseData = AssetCategoryOption[];
type ApiErrorData = { message: string };

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponseData | ApiErrorData>
) {
  // Обробляємо тільки GET запити
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ message: `Method ${req.method} Not Allowed` });
  }

  try {
    // Отримуємо всі категорії, вибираючи тільки id та name
    const categories = await prisma.assetCategory.findMany({
      select: {
        id: true,
        name: true,
      },
      orderBy: {
        name: 'asc', // Сортуємо за назвою для зручності у списку
      },
    });

    // Перевіряємо об'єкт відповіді перед відправкою
    if (!res) {
        console.error("GET AssetCategories: Response object is undefined before sending!");
        // Не можемо відправити відповідь, якщо res не існує
        // Можливо, залогувати помилку або викинути її
        throw new Error("Response object is unavailable");
    }

    // Відправляємо масив категорій
    res.status(200).json(categories);

  } catch (error) {
    console.error('Failed to fetch asset categories:', error);
    // Відправляємо помилку тільки якщо об'єкт res існує
    if (res && !res.headersSent) {
        res.status(500).json({ message: 'Internal Server Error' });
    } else if (!res) {
         console.error("GET AssetCategories Error: Response object is undefined!");
    } else {
         console.error("GET AssetCategories Error: Headers already sent!");
    }
  } finally {
    // Гарантовано відключаємо клієнт Prisma
    await prisma.$disconnect().catch(e => console.error("Failed to disconnect Prisma Client:", e));
  }
}
