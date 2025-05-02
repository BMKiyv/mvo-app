// pages/api/asset-instances/write-off-candidates.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient, AssetStatus, Prisma } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

const prisma = new PrismaClient();

// Тип для даних кандидата на списання
type WriteOffCandidate = {
    instanceId: number;
    inventoryNumber: string;
    assetTypeName: string;
    assetTypeId: number;
    unitOfMeasure: string;
    categoryName: string | null; // Назва категорії
    status: AssetStatus;
    employeeFullName: string | null;
    quantity: number; // Доступна кількість
    purchase_date: Date;
    unit_cost: string;
    notes?: string | null;
};

type ApiResponseData = WriteOffCandidate[];
type ApiErrorData = { message: string; details?: any };

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponseData | ApiErrorData>
) {
  if (req.method !== 'GET') {
    // ... (обробка не GET методів) ...
    if (res && !res.headersSent) {
        res.setHeader('Allow', ['GET']);
        return res.status(405).json({ message: `Method ${req.method} Not Allowed` });
    } else { console.error("Response unavailable/headers sent for non-GET method."); }
    if (prisma) { await prisma.$disconnect().catch((e: unknown) => console.error("Failed to disconnect Prisma Client:", e)); }
    return;
  }

  // --- Обробка GET-запиту ---
  try {
    const nonEligibleStatuses: AssetStatus[] = [
        AssetStatus.written_off,
        AssetStatus.reserved
    ];

    // --- Фільтри (з майбутнього кроку, якщо потрібно) ---
    const { categoryId, search } = req.query;
    const whereCondition: Prisma.AssetInstanceWhereInput = {
        status: { notIn: nonEligibleStatuses, },
        quantity: { gt: 0 }
    };
    if (categoryId && typeof categoryId === 'string' && !isNaN(parseInt(categoryId))) {
        whereCondition.assetType = { // Фільтруємо за категорією через тип
            categoryId: parseInt(categoryId, 10)
        };
    }
     if (search && typeof search === 'string' && search.trim() !== '') {
        const searchTerm = search.trim();
        whereCondition.OR = [ // Шукаємо або в інв. номері, або в назві типу
            { inventoryNumber: { contains: searchTerm, mode: 'insensitive' } },
            { assetType: { name: { contains: searchTerm, mode: 'insensitive' } } }
        ];
        // Якщо вже є фільтр за категорією, додаємо пошук до нього
        if (whereCondition.assetType) {
             whereCondition.AND = [ // Об'єднуємо умови
                 { assetType: whereCondition.assetType },
                 { OR: whereCondition.OR }
             ];
             delete whereCondition.assetType; // Видаляємо окремий фільтр за типом
             delete whereCondition.OR; // Видаляємо окремий пошук
        }
    }


    const candidates = await prisma.assetInstance.findMany({
      where: whereCondition, // Застосовуємо фільтри
      select: {
        id: true,
        inventoryNumber: true,
        quantity: true,
        status: true,
        purchase_date: true,
        unit_cost: true,
        notes: true,
        assetTypeId: true,
        assetType: {
          select: {
              name: true,
              unit_of_measure: true,
              category: { // Включаємо категорію для сортування та даних
                  select: { name: true, id: true } // Додаємо ID категорії для фільтрації, якщо потрібно
              }
            },
        },
        currentEmployee: {
          select: { full_name: true },
        },
      },
      // *** ВИПРАВЛЕНО СОРТУВАННЯ: Спочатку Категорія, потім Тип ***
      orderBy: [
        { assetType: { category: { name: 'asc' } } }, // 1. За назвою категорії
        { assetType: { name: 'asc' } },             // 2. За назвою типу
        { inventoryNumber: 'asc' },                 // 3. За інв. номером
        { purchase_date: 'asc' },                   // 4. За датою придбання
      ],
    });

    // Форматуємо відповідь
    const formattedCandidates: WriteOffCandidate[] = candidates.map(inst => ({
      instanceId: inst.id,
      inventoryNumber: inst.inventoryNumber,
      assetTypeName: inst.assetType?.name ?? 'Невідомий тип',
      assetTypeId: inst.assetTypeId,
      unitOfMeasure: inst.assetType?.unit_of_measure ?? 'шт.',
      categoryName: inst.assetType?.category?.name ?? null, // Додаємо назву категорії
      status: inst.status,
      employeeFullName: inst.currentEmployee?.full_name ?? null,
      quantity: inst.quantity,
      purchase_date: inst.purchase_date,
      unit_cost: inst.unit_cost.toString(),
      notes: inst.notes,
    }));

    if (!res) { throw new Error("Response object is unavailable"); }
    res.status(200).json(formattedCandidates);

  } catch (error) {
    console.error('Failed to fetch write-off candidates:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
    if (res && !res.headersSent) {
        res.status(500).json({ message: errorMessage, details: error instanceof Error ? error.stack : error });
    } else {
        console.error("Response unavailable or headers sent in write-off candidates fetch.");
    }
  } finally {
    if (prisma) {
        try { await prisma.$disconnect(); }
        catch (disconnectError) { console.error("Failed to disconnect Prisma Client:", disconnectError); }
    }
  }
}
