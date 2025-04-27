// pages/api/asset-types/[id].ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

// Тип для тіла PUT запиту (поля необов'язкові)
type UpdateAssetTypeDto = {
  name?: string;
  categoryId?: number; // ID категорії для оновлення
  minimum_stock_level?: number | null;
  notes?: string | null;
};

// Тип для успішної відповіді PUT (updated_at може бути null)
type UpdateAssetTypeResponse = {
    id: number;
    name: string;
    categoryId: number;
    minimum_stock_level: number | null;
    notes: string | null;
    created_at: Date;
    updated_at: Date | null; // <--- Змінено на Date | null
};

type ApiErrorData = { message: string; details?: any };

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<UpdateAssetTypeResponse | ApiErrorData>
) {
  const { id } = req.query;

  // Валідація ID
  if (typeof id !== 'string' || isNaN(parseInt(id))) {
    return res.status(400).json({ message: 'Invalid asset type ID format.' });
  }
  const assetTypeId = parseInt(id);

  // Обробляємо тільки PUT запити
  if (req.method !== 'PUT') {
    res.setHeader('Allow', ['PUT']);
    return res.status(405).json({ message: `Method ${req.method} Not Allowed` });
  }

  // --- Обробка PUT-запиту ---
  try {
    const { name, categoryId, minimum_stock_level, notes } = req.body as UpdateAssetTypeDto;

    // --- Валідація вхідних даних ---
    // Використовуємо Prisma.AssetTypeUpdateInput для коректної типізації оновлення
    const updateData: Prisma.AssetTypeUpdateInput = {};

    if (name !== undefined) {
        if (typeof name !== 'string' || !name.trim()) {
            return res.status(400).json({ message: 'Назва типу активу не може бути порожньою.' });
        }
        updateData.name = name.trim();
    }
    if (categoryId !== undefined) {
        if (typeof categoryId !== 'number' || !Number.isInteger(categoryId) || categoryId <= 0) {
            return res.status(400).json({ message: 'Некоректний ID категорії.' });
        }
        const categoryExists = await prisma.assetCategory.findUnique({ where: { id: categoryId } });
        if (!categoryExists) {
            return res.status(400).json({ message: `Категорія з ID ${categoryId} не знайдена.` });
        }
        // *** ВИПРАВЛЕННЯ: Оновлюємо відношення через 'category', а не 'categoryId' ***
        updateData.category = {
            connect: { id: categoryId }
        };
    }
    if (minimum_stock_level !== undefined) {
        if (minimum_stock_level !== null && (typeof minimum_stock_level !== 'number' || !Number.isInteger(minimum_stock_level) || minimum_stock_level < 0)) {
            return res.status(400).json({ message: 'Некоректне значення мінімального залишку.' });
        }
        updateData.minimum_stock_level = minimum_stock_level === null ? 0 : minimum_stock_level;
    }
     if (notes !== undefined) {
         updateData.notes = notes === null ? null : String(notes);
     }

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ message: 'Не надано полів для оновлення.' });
    }

    // --- Перевірка на унікальність назви (якщо змінюється назва або категорія) ---
    if (updateData.name || updateData.category) { // Перевіряємо category замість categoryId
        const currentType = await prisma.assetType.findUnique({ where: { id: assetTypeId }});
        if (!currentType) {
             return res.status(404).json({ message: `Тип активу з ID ${assetTypeId} не знайдено.` });
        }
        // Отримуємо ID категорії з об'єкта connect або з поточного типу
        const checkCategoryId = updateData.category?.connect?.id ?? currentType.categoryId;
        const checkName = updateData.name ? String(updateData.name) : currentType.name;

        const existingType = await prisma.assetType.findFirst({
            where: {
                name: checkName,
                categoryId: checkCategoryId,
                id: { not: assetTypeId }
            }
        });
        if (existingType) {
            return res.status(409).json({ message: `Тип активу з назвою "${checkName}" вже існує в категорії ID ${checkCategoryId}.` });
        }
    }

    // --- Оновлення запису ---
    const updatedAssetType = await prisma.assetType.update({
      where: { id: assetTypeId },
      data: updateData,
      // Повертаємо оновлені дані
      select: {
          id: true, name: true, categoryId: true, // categoryId тепер можна вибрати
          minimum_stock_level: true, notes: true, created_at: true, updated_at: true
      }
    });

    // Перевіряємо res перед відправкою
    if (!res) { console.error("PUT AssetType: Response object undefined!"); return; }
    // Тип updatedAssetType тепер має відповідати UpdateAssetTypeResponse (з updated_at: Date | null)
    res.status(200).json(updatedAssetType);

  } catch (error) {
    console.error(`Failed to update asset type ${assetTypeId}:`, error);
    if (!res) { console.error("PUT AssetType Error: Response object undefined!"); return; }

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2025') { // Record to update not found
        return res.status(404).json({ message: `Тип активу з ID ${assetTypeId} не знайдено.` });
      }
       return res.status(400).json({ message: `Помилка бази даних: ${error.code}`, details: error.message });
    }
    res.status(500).json({ message: 'Internal Server Error', details: error instanceof Error ? error.message : String(error) });
  } finally {
    await prisma.$disconnect();
  }
}
