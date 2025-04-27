// pages/api/asset-instances/index.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient, Prisma, AssetStatus } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library'; // Import Decimal

const prisma = new PrismaClient();

// --- Типи Даних ---

// Тип для тіла POST запиту (дані нового екземпляра/партії)
type CreateInstanceDto = {
  assetTypeId: number;
  inventoryNumber: string;
  unit_cost: string | number; // Приймаємо рядок або число, конвертуємо в Decimal
  purchase_date: string; // Приймаємо дату як рядок (ISO формат)
  quantity?: number; // Необов'язкове, за замовчуванням буде 1
  notes?: string | null;
};

// Тип для успішної відповіді POST (повертаємо створений об'єкт)
type CreateInstanceResponse = {
    id: number;
    assetTypeId: number;
    inventoryNumber: string;
    unit_cost: string; // Повертаємо як рядок
    purchase_date: Date;
    status: AssetStatus;
    notes: string | null;
    quantity: number;
    created_at: Date;
    updated_at: Date | null;
    current_employee_id: number | null;
    // Можна додати assetTypeName, якщо потрібно
    assetTypeName?: string;
};

type ApiErrorData = { message: string; details?: any };

// --- Основний обробник ---
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<CreateInstanceResponse | ApiErrorData> // Оновлюємо тип відповіді
) {
  // --- Обробка POST-запиту ---
  if (req.method === 'POST') {
    try {
      const {
        assetTypeId,
        inventoryNumber,
        unit_cost,
        purchase_date,
        quantity,
        notes,
      } = req.body as CreateInstanceDto;

      // --- Валідація вхідних даних ---
      if (typeof assetTypeId !== 'number' || !Number.isInteger(assetTypeId) || assetTypeId <= 0) {
        return res.status(400).json({ message: 'Некоректний ID типу активу.' });
      }
      if (typeof inventoryNumber !== 'string' || !inventoryNumber.trim()) {
        return res.status(400).json({ message: 'Інвентарний номер є обов\'язковим.' });
      }
      if (unit_cost === undefined || unit_cost === null || isNaN(parseFloat(String(unit_cost))) || parseFloat(String(unit_cost)) < 0) {
          return res.status(400).json({ message: 'Некоректна вартість за одиницю.' });
      }
       // Валідація дати (проста перевірка на валідність)
       let purchaseDateObj: Date;
       try {
           purchaseDateObj = new Date(purchase_date);
           if (isNaN(purchaseDateObj.getTime())) { // Перевірка на валідність дати
               throw new Error("Invalid date");
           }
       } catch (e) {
            return res.status(400).json({ message: 'Некоректний формат дати придбання.' });
       }
      // Валідація кількості
      const quantityToSave = (quantity !== undefined && typeof quantity === 'number' && Number.isInteger(quantity) && quantity >= 1) ? quantity : 1; // За замовчуванням 1

      // Перевірка існування типу активу
      const assetTypeExists = await prisma.assetType.findUnique({ where: { id: assetTypeId } });
      if (!assetTypeExists) {
        return res.status(400).json({ message: `Тип активу з ID ${assetTypeId} не знайдено.` });
      }

      // Конвертація вартості в Decimal
      let costAsDecimal: Decimal;
      try {
          costAsDecimal = new Decimal(unit_cost);
      } catch (e) {
           return res.status(400).json({ message: 'Не вдалося перетворити вартість у числовий формат.' });
      }

      // --- Створення нового екземпляра/партії ---
      const newInstance = await prisma.assetInstance.create({
        data: {
          assetTypeId: assetTypeId,
          inventoryNumber: inventoryNumber.trim(),
          unit_cost: costAsDecimal, // Зберігаємо як Decimal
          purchase_date: purchaseDateObj, // Зберігаємо як Date
          quantity: quantityToSave,
          notes: notes || null,
          status: AssetStatus.on_stock, // Нові екземпляри завжди на складі
          // current_employee_id залишається null за замовчуванням
        },
         include: { // Включаємо назву типу для відповіді
             assetType: { select: { name: true } }
         }
      });

      // Формуємо відповідь
       const responseData: CreateInstanceResponse = {
           ...newInstance,
           unit_cost: newInstance.unit_cost.toString(), // Конвертуємо Decimal назад у рядок для JSON
           assetTypeName: newInstance.assetType?.name
       };


      if (!res) { console.error("POST AssetInstance: Response object undefined!"); return; }
      res.status(201).json(responseData); // Відповідь 201 Created

    } catch (error) {
      console.error('Failed to create asset instance:', error);
      if (!res) { console.error("POST AssetInstance Error: Response object undefined!"); return; }

      // Обробка потенційної помилки унікальності inventoryNumber, якщо вона все ще є
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        return res.status(409).json({ message: `Екземпляр з інвентарним номером "${req.body.inventoryNumber}" вже існує.` });
      }

      res.status(500).json({ message: 'Internal Server Error', details: error instanceof Error ? error.message : String(error) });
    } finally {
      await prisma.$disconnect();
    }
  }
  // --- Обробка інших методів ---
  else {
    // Можна додати GET для отримання списку екземплярів пізніше
    if (!res) { console.error("AssetInstances API: Response object undefined!"); return; }
    res.setHeader('Allow', ['POST']); // Поки що дозволяємо тільки POST
    res.status(405).json({ message: `Method ${req.method} Not Allowed` });
  }
}
