// pages/api/inventory/perform-write-off.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient, Prisma, AssetStatus } from '@prisma/client';

// Use Prisma singleton if available, otherwise create new client
// import prisma from '../../../lib/prisma'; // Adjust path if using singleton
const prisma = new PrismaClient();

// --- Типи Даних ---

// Тип для одного елемента в тілі POST запиту (з instanceId)
type PerformWriteOffItemDto = {
  instanceId: number;
  quantityToWriteOff: number; // Кількість, що списується
  reason?: string | null;
};

// Тип для тіла POST запиту
type PerformWriteOffDto = {
  items: PerformWriteOffItemDto[];
};

// Тип для успішної відповіді
type SuccessResponse = {
  message: string;
  processedCount: number; // Кількість оновлених записів AssetInstance
};

type ApiErrorData = { message: string; details?: any };

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<SuccessResponse | ApiErrorData>
) {
  // Обробляємо тільки POST запити
  if (req.method !== 'POST') {
    if (res && !res.headersSent) {
        res.setHeader('Allow', ['POST']);
        return res.status(405).json({ message: `Method ${req.method} Not Allowed` });
    } else { console.error("Response unavailable/headers sent for non-POST method."); }
    if (prisma) { await prisma.$disconnect().catch((e: unknown) => console.error("Failed to disconnect Prisma Client:", e)); }
    return;
  }

  // --- Обробка POST-запиту ---
  try {
    const { items } = req.body as PerformWriteOffDto;

    // --- Валідація вхідних даних ---
    if (!Array.isArray(items) || items.length === 0) {
        if (!res) { console.error("POST Perform WriteOff: Response undefined before sending validation error!"); return; }
        return res.status(400).json({ message: 'Масив "items" є обов\'язковим і не може бути порожнім.' });
    }

    const instanceIdsToProcess: number[] = [];
    const itemDataMap = new Map<number, PerformWriteOffItemDto>(); // Зберігаємо дані запиту за instanceId

    for (const item of items) {
        // Перевіряємо тип та значення instanceId та quantityToWriteOff
        if (typeof item.instanceId !== 'number' || !Number.isInteger(item.instanceId) || item.instanceId <= 0 ||
            typeof item.quantityToWriteOff !== 'number' || !Number.isInteger(item.quantityToWriteOff) || item.quantityToWriteOff <= 0)
        {
             if (!res) { console.error("POST Perform WriteOff: Response undefined before sending validation error!"); return; }
             // Помилка тепер стосується instanceId або quantityToWriteOff
            return res.status(400).json({ message: `Некоректні дані для одного з елементів: instanceId=${item.instanceId}, quantityToWriteOff=${item.quantityToWriteOff}.` });
        }
         if (item.reason && typeof item.reason !== 'string') {
             if (!res) { console.error("POST Perform WriteOff: Response undefined before sending validation error!"); return; }
             return res.status(400).json({ message: `Некоректна причина для instanceId ${item.instanceId}.` });
        }
        instanceIdsToProcess.push(item.instanceId);
        itemDataMap.set(item.instanceId, item); // Зберігаємо дані запиту
    }

    // --- Оновлення в Транзакції ---
    const updateResult = await prisma.$transaction(async (tx) => {
        let processedCount = 0;
        const writeOffDate = new Date(); // Використовуємо одну дату для всіх операцій в транзакції

        // Отримуємо дані екземплярів, які будемо списувати
        const instancesToUpdate = await tx.assetInstance.findMany({
            where: {
                id: { in: instanceIdsToProcess },
                status: { not: AssetStatus.written_off } // Не списуємо вже списане
            },
            select: { id: true, status: true, current_employee_id: true, quantity: true, notes: true }
        });

        // Перевірка, чи всі знайдені та чи кількість відповідає запиту
        const updatesToPerform: Prisma.PrismaPromise<any>[] = [];
        const processedInstanceIds = new Set<number>();

        for (const instance of instancesToUpdate) {
             const inputItem = itemDataMap.get(instance.id);
             if (!inputItem) {
                 // Цього не має статися, якщо findMany відпрацював коректно
                 console.warn(`Internal error: Input data not found for instance ${instance.id}`);
                 continue;
             }

             const quantityToWriteOff = inputItem.quantityToWriteOff;

             // Перевірка кількості
             if (quantityToWriteOff > instance.quantity) {
                 throw new Error(`Кількість для списання (${quantityToWriteOff}) для інв. № ${instance.id} перевищує доступну (${instance.quantity}).`);
             }

             const reason = inputItem.reason;
             const notesUpdate = reason ? `Списано (${writeOffDate.toLocaleDateString('uk-UA')}): ${reason}` : `Списано (${writeOffDate.toLocaleDateString('uk-UA')})`;

             // --- Логіка Списання (Поки що повне) ---
             // TODO: Реалізувати часткове списання (зменшення кількості)
             // if (quantityToWriteOff < instance.quantity) {
             //     // Зменшити кількість існуючого
             //     updatesToPerform.push(tx.assetInstance.update({ ... }));
             // } else {
                 // Списуємо весь екземпляр
// --- Модифікована Логіка Списання ---

if (quantityToWriteOff === instance.quantity) {
  // --- Повне списання екземпляра ---
  const notesUpdate = reason
      ? `Повністю списано (${writeOffDate.toLocaleDateString('uk-UA')}): ${reason}`
      : `Повністю списано (${writeOffDate.toLocaleDateString('uk-UA')})`;

  updatesToPerform.push(
      tx.assetInstance.update({
          where: { id: instance.id },
          data: {
              status: AssetStatus.written_off,
              quantity: 0, // Обнуляємо кількість
              current_employee_id: null, // Завжди знімаємо власника при повному списанні
              notes: instance.notes ? `${instance.notes}\n${notesUpdate}` : notesUpdate,
          },
      })
  );

  // Оновлення історії ТІЛЬКИ при повному списанні, якщо був виданий
  if (instance.status === AssetStatus.issued && instance.current_employee_id) {
      updatesToPerform.push(
          tx.assetAssignmentHistory.updateMany({
              where: {
                  asset_instance_id: instance.id,
                  employee_id: instance.current_employee_id,
                  return_date: null,
              },
              data: { return_date: writeOffDate },
          })
      );
  }

} else if (quantityToWriteOff < instance.quantity) {
  // --- Часткове списання екземпляра ---
  const notesUpdate = reason
      ? `Частково списано ${quantityToWriteOff} од. (${writeOffDate.toLocaleDateString('uk-UA')}): ${reason}`
      : `Частково списано ${quantityToWriteOff} од. (${writeOffDate.toLocaleDateString('uk-UA')})`;

  updatesToPerform.push(
      tx.assetInstance.update({
          where: { id: instance.id },
          data: {
              quantity: {
                  decrement: quantityToWriteOff, // Зменшуємо кількість
              },
              // Статус і власник не змінюються при частковому списанні
              // Якщо потрібно змінити статус на 'damaged' або інший, додайте логіку тут
              notes: instance.notes ? `${instance.notes}\n${notesUpdate}` : notesUpdate,
          },
      })
  );
  // НЕ оновлюємо історію видачі при частковому списанні,
  // оскільки залишок активу все ще може бути у співробітника
}
// Видаляємо старий блок оновлення історії, що був поза умовою

processedCount++; // Залишаємо лічильник
processedInstanceIds.add(instance.id); // Залишаємо відстеження ID
             // }

             // Оновлення історії, якщо був виданий
             if (instance.status === AssetStatus.issued && instance.current_employee_id) {
                 updatesToPerform.push(
                     tx.assetAssignmentHistory.updateMany({
                         where: {
                             asset_instance_id: instance.id,
                             employee_id: instance.current_employee_id,
                             return_date: null,
                         },
                         data: { return_date: writeOffDate },
                     })
                 );
             }
             processedCount++;
             processedInstanceIds.add(instance.id);
        }

        // Перевіряємо, чи всі передані ID були знайдені та оброблені
        const missingOrWrittenOffIds = instanceIdsToProcess.filter(id => !processedInstanceIds.has(id));
        if (missingOrWrittenOffIds.length > 0) {
             throw new Error(`Не вдалося знайти або вже списано екземпляри з ID: ${missingOrWrittenOffIds.join(', ')}`);
        }

        // Виконуємо всі оновлення
        await Promise.all(updatesToPerform);

        return { processedCount };
    });

    if (!res) { throw new Error("Response object is unavailable after transaction"); }
    res.status(200).json({
        message: `Списання для ${updateResult.processedCount} екземплярів успішно зафіксовано.`,
        processedCount: updateResult.processedCount,
    });

  } catch (error) {
    console.error('Failed to perform write-off:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
    if (res && !res.headersSent) {
        if (error instanceof Prisma.PrismaClientKnownRequestError) {
             return res.status(400).json({ message: `Помилка бази даних (${error.code})`, details: error.message });
        }
        // Повертаємо повідомлення з помилки, якщо це згенерована нами помилка
        if (error instanceof Error && (error.message.includes("Не вдалося знайти") || error.message.includes("Кількість для списання"))) {
             return res.status(400).json({ message: error.message });
        }
        res.status(500).json({ message: errorMessage, details: error instanceof Error ? error.stack : error });
    } else {
        console.error("Response unavailable or headers sent in perform write-off error handler.");
    }
  } finally {
    if (prisma) {
        try { await prisma.$disconnect(); }
        catch (disconnectError) { console.error("Failed to disconnect Prisma Client:", disconnectError); }
    }
  }
}
