// pages/api/archive/asset-instances.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient, AssetInstance, AssetType, AssetStatus } from '@prisma/client'; // Імпортуємо потрібні типи

// Використовуйте ваш Prisma singleton або створіть новий екземпляр
// import prisma from '../../../lib/prisma'; // Якщо використовуєте singleton
const prisma = new PrismaClient();

// Тип для вкладених даних AssetType, які ми хочемо отримати
type IncludedAssetTypeData = Pick<AssetType, 'name' | 'unit_of_measure'>;

// Тип для основного об'єкта AssetInstance в архіві
type ArchivedAssetInstanceData = Pick<
    AssetInstance,
    'id' | 'inventoryNumber' | 'quantity' | 'unit_cost' | 'purchase_date' | 'notes' | 'status'
> & {
    // Додаємо поле для пов'язаного типу активу
    assetType: IncludedAssetTypeData | null; // Тип може бути null, якщо зв'язок не гарантований
};

// Тип для успішної відповіді API (масив екземплярів)
type ApiResponseData = ArchivedAssetInstanceData[];

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
    if (!res.headersSent) {
        return res.status(405).json({ message: `Method ${req.method} Not Allowed` });
    }
    await prisma.$disconnect().catch(e => console.error("Failed to disconnect Prisma Client:", e));
    return;
  }

  try {
    // --- Отримання списаних екземплярів активів ---
    const writtenOffInstances = await prisma.assetInstance.findMany({
      where: {
        status: AssetStatus.written_off, // Ключовий фільтр: статус "списано"
      },
      select: { // Вибираємо потрібні поля з AssetInstance
        id: true,
        inventoryNumber: true,
        quantity: true, // Поточна кількість (ймовірно, 0 для повністю списаних)
        unit_cost: true,
        purchase_date: true,
        notes: true, // Нотатки можуть містити причину списання
        status: true, // Включаємо статус для підтвердження
        assetType: { // Включаємо пов'язані дані з AssetType
          select: {
            name: true, // Назва типу
            unit_of_measure: true, // Одиниця виміру
          },
        },
      },
      orderBy: {
        inventoryNumber: 'asc', // Сортуємо за інвентарним номером
      },
    });

    // Типізуємо результат для відповіді
    const responseData: ApiResponseData = writtenOffInstances as ArchivedAssetInstanceData[]; // Використовуємо as для зручності, select гарантує структуру

    if (!res.headersSent) {
      return res.status(200).json(responseData);
    }

  } catch (error) {
    console.error('Failed to fetch archived asset instances:', error);
    if (!res.headersSent) {
        return res.status(500).json({
            message: 'Internal Server Error fetching archived asset instances',
            details: error instanceof Error ? error.message : String(error),
        });
     } else {
         console.error("Response headers already sent in archived asset instances error handler.");
     }
  } finally {
    // Гарантоване відключення Prisma Client
    await prisma.$disconnect().catch(e => console.error("Failed to disconnect Prisma Client:", e));
  }
}