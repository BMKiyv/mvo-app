// pages/api/asset-types/index.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient, Prisma, AssetStatus, AssetType, AssetCategory } from '@prisma/client';

const prisma = new PrismaClient();

// --- Типи Даних ---
type AssetTypeWithCounts = {
    id: number; name: string; minimum_stock_level: number | null;
    notes: string | null; categoryId: number; categoryName: string | null;
    totalQuantity: number;
    onStockQuantity: number;
    createdAt: Date;
};
type ApiResponseDataGET = AssetTypeWithCounts[];

// *** ВИПРАВЛЕНО/ДОДАНО: Повне визначення типу для тіла POST запиту ***
type CreateAssetTypeDto = {
  name: string;
  categoryId: number;
  minimum_stock_level: number | null;
  notes: string | null;
};

// Тип для успішної відповіді POST
type CreateAssetTypeResponse = {
    id: number; name: string; categoryId: number;
    minimum_stock_level: number | null; // Повертаємо те, що в БД
    notes: string | null; created_at: Date; updated_at: Date | null;
};

// Загальний тип відповіді
type ApiResponseData = ApiResponseDataGET | CreateAssetTypeResponse;
type ApiErrorData = { message: string; details?: any };

// --- Допоміжна функція для підрахунку кількості ---
async function calculateQuantities(assetTypeId: number): Promise<{ totalQuantity: number; onStockQuantity: number }> {
    try {
        const [totalInstanceData, onStockInstanceData, writeOffData] = await Promise.all([
            prisma.assetInstance.aggregate({ _sum: { quantity: true }, where: { assetTypeId: assetTypeId } }),
            prisma.assetInstance.aggregate({ _sum: { quantity: true }, where: { assetTypeId: assetTypeId, status: AssetStatus.on_stock } }),
            prisma.writeOffLog.aggregate({ _sum: { quantity: true }, where: { assetTypeId: assetTypeId, } })
        ]);
        const totalReceivedSum = totalInstanceData._sum.quantity ?? 0;
        const onStockInstanceSum = onStockInstanceData._sum.quantity ?? 0;
        const writtenOffSum = writeOffData._sum.quantity ?? 0;
        const currentStock = onStockInstanceSum - writtenOffSum;
        return {
            totalQuantity: totalReceivedSum,
            onStockQuantity: Math.max(0, currentStock),
        };
    } catch (error) {
        console.error(`Error calculating quantities for asset type ${assetTypeId}:`, error);
        return { totalQuantity: 0, onStockQuantity: 0 };
    }
}


// --- Основний обробник ---
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponseData | ApiErrorData>
) {
  // --- Обробка GET-запиту ---
  if (req.method === 'GET') {
    try {
      const { categoryId } = req.query;
      const whereCondition: Prisma.AssetTypeWhereInput = {};
      if (categoryId && typeof categoryId === 'string' && !isNaN(parseInt(categoryId))) {
        whereCondition.categoryId = parseInt(categoryId, 10);
      }
      const assetTypes: (AssetType & { category: { name: string } | null })[] = await prisma.assetType.findMany({
        where: whereCondition,
        include: { category: { select: { name: true } } },
        orderBy: { name: 'asc' },
      });
      const assetTypesWithCountsPromises = assetTypes.map(async (type) => {
        const quantities = await calculateQuantities(type.id);
        return {
          id: type.id,
          name: type.name,
          minimum_stock_level: type.minimum_stock_level,
          notes: type.notes,
          categoryId: type.categoryId,
          categoryName: type.category?.name ?? 'N/A',
          totalQuantity: quantities.totalQuantity,
          onStockQuantity: quantities.onStockQuantity,
          createdAt: type.created_at
        };
      });
      const results = await Promise.allSettled(assetTypesWithCountsPromises);
      const resultData: AssetTypeWithCounts[] = [];
       results.forEach((result, index) => {
           if (result.status === 'fulfilled') {
               resultData.push(result.value);
           } else {
               console.error(`Failed to process quantities for asset type ${assetTypes[index]?.id}:`, result.reason);
           }
       });
      if (!res) { console.error("GET AssetTypes: Response object undefined!"); return; }
      res.status(200).json(resultData);
    } catch (error) {
      console.error('Failed to fetch asset types:', error);
      if (!res) { console.error("GET AssetTypes Error: Response object undefined!"); return; }
      res.status(500).json({ message: 'Internal Server Error', details: error instanceof Error ? error.message : String(error) });
    } finally {
      // Disconnect moved
    }
  }
  // --- Обробка POST-запиту ---
  else if (req.method === 'POST') {
      try {
          // *** ВИПРАВЛЕНО: Використовуємо повний тип CreateAssetTypeDto ***
          const { name, categoryId, minimum_stock_level, notes } = req.body as CreateAssetTypeDto;

          // --- Валідація вхідних даних ---
          if (!name || typeof name !== 'string' || !name.trim()) { return res.status(400).json({ message: 'Назва типу активу є обов\'язковою.' }); }
          if (typeof categoryId !== 'number' || !Number.isInteger(categoryId) || categoryId <= 0) { return res.status(400).json({ message: 'Некоректний ID категорії.' }); }
          if (minimum_stock_level !== null && (typeof minimum_stock_level !== 'number' || !Number.isInteger(minimum_stock_level) || minimum_stock_level < 0)) { return res.status(400).json({ message: 'Некоректне значення мінімального залишку (має бути ціле невід\'ємне число або не вказано).' }); }
          const categoryExists = await prisma.assetCategory.findUnique({ where: { id: categoryId } });
          if (!categoryExists) { return res.status(400).json({ message: `Категорія з ID ${categoryId} не знайдена.` }); }
          const existingType = await prisma.assetType.findFirst({ where: { name: name.trim(), categoryId: categoryId } });
          if (existingType) { return res.status(409).json({ message: `Тип активу з назвою "${name.trim()}" вже існує в цій категорії.` }); }
          const stockLevelToSave = minimum_stock_level === null ? 0 : minimum_stock_level;

          // Створення нового типу активу
          const newAssetType = await prisma.assetType.create({
              data: {
                  name: name.trim(),
                  categoryId: categoryId,
                  minimum_stock_level: stockLevelToSave,
                  notes: notes || null,
              },
              select: { id: true, name: true, categoryId: true, minimum_stock_level: true, notes: true, created_at: true, updated_at: true }
          });
           if (!res) { console.error("POST AssetType: Response object undefined!"); return; }
          res.status(201).json(newAssetType); // Відповідь для POST - один об'єкт

      } catch (error) {
          console.error('Failed to create asset type:', error);
           if (!res) { console.error("POST AssetType Error: Response object undefined!"); return; }
           if (error instanceof Prisma.PrismaClientKnownRequestError) {
                if (error.code === 'P2002') { return res.status(409).json({ message: `Категорія з назвою "${req.body.name?.trim()}" вже існує.` }); }
                return res.status(400).json({ message: `Помилка бази даних: ${error.code}`, details: error.message });
           }
          res.status(500).json({ message: 'Internal Server Error', details: error instanceof Error ? error.message : String(error) });
      } finally {
           // Disconnect moved
      }
  }
  // --- Обробка інших методів ---
  else {
    if (!res) { console.error("AssetTypes API: Response object undefined for non-GET/POST method!"); return; }
    res.setHeader('Allow', ['GET', 'POST']);
    res.status(405).json({ message: `Method ${req.method} Not Allowed` });
  }

   // Disconnect Prisma Client finally after handling request
   if (prisma) {
       await prisma.$disconnect().catch((e: unknown) => console.error("Failed to disconnect Prisma Client:", e));
   }
}
