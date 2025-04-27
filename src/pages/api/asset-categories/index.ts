// pages/api/asset-categories/index.ts (або pages/api/asset-categories.ts)
import type { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient, Prisma } from '@prisma/client'; // Import Prisma types

const prisma = new PrismaClient();

// Тип для опції категорії (для GET)
type AssetCategoryOption = {
  id: number;
  name: string;
};

// Тип для тіла POST запиту
type CreateCategoryDto = {
  name: string;
};

// Тип для успішної відповіді POST
type CreateCategoryResponse = {
    id: number;
    name: string;
    created_at: Date;
    updated_at: Date | null;
};

// Типи для відповіді API
type ApiResponseData = AssetCategoryOption[] | CreateCategoryResponse; // Може бути масив або один об'єкт
type ApiErrorData = { message: string; details?: any };

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponseData | ApiErrorData> // Оновлюємо тип відповіді
) {
  // --- Обробка GET запиту ---
  if (req.method === 'GET') {
    try {
      const categories = await prisma.assetCategory.findMany({
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
      });
      if (!res) { console.error("GET AssetCategories: Response object undefined!"); return; }
      res.status(200).json(categories); // Відповідь - масив
    } catch (error) {
      console.error('Failed to fetch asset categories:', error);
      if (res && !res.headersSent) {
          res.status(500).json({ message: 'Internal Server Error' });
      } else { console.error("GET AssetCategories Error: Response unavailable/headers sent."); }
    } finally {
      // Disconnect moved to the end
    }
  }
  // --- Обробка POST запиту ---
  else if (req.method === 'POST') {
      try {
          const { name } = req.body as CreateCategoryDto;

          // Валідація
          if (!name || typeof name !== 'string' || !name.trim()) {
               return res.status(400).json({ message: 'Назва категорії є обов\'язковою.' });
          }
          const trimmedName = name.trim();

          // Перевірка на унікальність (Prisma зробить це на рівні БД, але можна додати перевірку тут)
          // const existingCategory = await prisma.assetCategory.findUnique({ where: { name: trimmedName } });
          // if (existingCategory) {
          //     return res.status(409).json({ message: `Категорія з назвою "${trimmedName}" вже існує.` });
          // }

          // Створення категорії
          const newCategory = await prisma.assetCategory.create({
              data: {
                  name: trimmedName,
              },
              // Select fields for the response if needed, otherwise Prisma returns the full object
              // select: { id: true, name: true, created_at: true, updated_at: true }
          });

           if (!res) { console.error("POST AssetCategory: Response object undefined!"); return; }
           // Відповідь - один об'єкт
           res.status(201).json(newCategory);

      } catch (error) {
          console.error('Failed to create asset category:', error);
           if (!res) { console.error("POST AssetCategory Error: Response object undefined!"); return; }

           // Обробка помилки унікальності від Prisma
           if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
               // Поле 'name' є причиною помилки (з вашої схеми)
               return res.status(409).json({ message: `Категорія з назвою "${req.body.name?.trim()}" вже існує.` });
           }

           res.status(500).json({ message: 'Internal Server Error', details: error instanceof Error ? error.message : String(error) });
      } finally {
          // Disconnect moved to the end
      }
  }
  // --- Обробка інших методів ---
  else {
    if (!res) { console.error("AssetCategories API: Response object undefined!"); return; }
    res.setHeader('Allow', ['GET', 'POST']); // Дозволяємо GET та POST
    res.status(405).json({ message: `Method ${req.method} Not Allowed` });
  }

   // Disconnect Prisma Client finally after handling request
   if (prisma) {
       await prisma.$disconnect().catch((e: unknown) => console.error("Failed to disconnect Prisma Client:", e));
   }
}
