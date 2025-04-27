// pages/api/inventory/perform-write-off.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient, Prisma } from '@prisma/client';

// Use Prisma singleton if available, otherwise create new client
// import prisma from '../../../lib/prisma'; // Adjust path if using singleton
const prisma = new PrismaClient();

// --- Типи Даних ---

// Тип для одного елемента у списку на списання в тілі запиту
type WriteOffItemDto = {
  assetTypeId: number;
  quantity: number;
  reason?: string | null;
  // Можна додати ID співробітника, що виконав списання, якщо потрібно
  // performedById?: number;
};

// Тип для тіла POST запиту
type PerformWriteOffDto = {
  items: WriteOffItemDto[];
};

// Тип для успішної відповіді
type SuccessResponse = {
  message: string;
  createdLogEntries: number; // Кількість створених записів у лозі
};

type ApiErrorData = { message: string; details?: any };

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<SuccessResponse | ApiErrorData>
) {
  // Обробляємо тільки POST запити
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ message: `Method ${req.method} Not Allowed` });
  }

  // --- Обробка POST-запиту ---
  try {
    const { items } = req.body as PerformWriteOffDto;

    // --- Валідація вхідних даних ---
    if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ message: 'Масив "items" є обов\'язковим і не може бути порожнім.' });
    }

    const writeOffLogEntries: Prisma.WriteOffLogCreateManyInput[] = [];
    const assetTypeIds = new Set<number>(); // Збираємо ID типів для перевірки

    for (const item of items) {
        // Валідація кожного елемента
        if (typeof item.assetTypeId !== 'number' || !Number.isInteger(item.assetTypeId) || item.assetTypeId <= 0) {
            return res.status(400).json({ message: `Некоректний assetTypeId (${item.assetTypeId}) в одному з елементів.` });
        }
        if (typeof item.quantity !== 'number' || !Number.isInteger(item.quantity) || item.quantity <= 0) {
            return res.status(400).json({ message: `Некоректна кількість (${item.quantity}) для assetTypeId ${item.assetTypeId}. Має бути цілим числом більше 0.` });
        }
        if (item.reason && typeof item.reason !== 'string') {
             return res.status(400).json({ message: `Некоректна причина для assetTypeId ${item.assetTypeId}.` });
        }

        assetTypeIds.add(item.assetTypeId); // Додаємо ID для перевірки існування

        // Готуємо запис для WriteOffLog
        writeOffLogEntries.push({
            assetTypeId: item.assetTypeId,
            quantity: item.quantity,
            reason: item.reason || null,
            writeOffDate: new Date(), // Поточна дата/час списання
            // performedById: item.performedById || null, // Якщо передається ID співробітника
        });
    }

    // --- Перевірка існування всіх AssetType ID ---
    const existingTypesCount = await prisma.assetType.count({
        where: { id: { in: Array.from(assetTypeIds) } }
    });
    if (existingTypesCount !== assetTypeIds.size) {
        // Можна знайти, якого саме ID не вистачає, для кращого повідомлення про помилку
         return res.status(400).json({ message: 'Один або декілька вказаних типів активів не знайдено в базі даних.' });
    }

    // --- Запис даних у WriteOffLog (в одній операції) ---
    // Використовуємо createMany для ефективного додавання кількох записів
    const creationResult = await prisma.writeOffLog.createMany({
        data: writeOffLogEntries,
        skipDuplicates: false, // Не пропускати дублікати (має викликати помилку, якщо щось піде не так)
    });

    console.log(`Created ${creationResult.count} write-off log entries.`);

    // --- Відповідь ---
    if (!res) { throw new Error("Response object is unavailable"); }
    res.status(201).json({
        message: `Списання для ${creationResult.count} позицій успішно зафіксовано.`,
        createdLogEntries: creationResult.count,
    });

  } catch (error) {
    console.error('Failed to perform write-off:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
    if (res && !res.headersSent) {
        // Обробка помилок Prisma, якщо потрібно
        if (error instanceof Prisma.PrismaClientKnownRequestError) {
             return res.status(400).json({ message: `Помилка бази даних (${error.code})`, details: error.message });
        }
        res.status(500).json({ message: errorMessage, details: error instanceof Error ? error.stack : error });
    } else {
        console.error("Response unavailable or headers sent in perform write-off error handler.");
    }
  } finally {
    // await prisma.$disconnect().catch((e: unknown) => console.error("Failed to disconnect Prisma Client:", e));
  }
}
