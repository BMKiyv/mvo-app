// pages/api/employees/[id]/process-assets.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient, Prisma, AssetStatus } from '@prisma/client';

// Use Prisma singleton if available, otherwise create new client
// import prisma from '../../../../lib/prisma'; // Adjust path if using singleton
const prisma = new PrismaClient();

// --- Типи Даних ---

// Тип для одного елемента в тілі запиту
type AssetProcessingInfo = {
  instanceId: number;
  finalStatus: AssetStatus; // Очікуємо валідний статус з Enum
  // Можна додати поле для нотаток при поверненні/списанні etc.
  // notes?: string;
};

// Тип для тіла POST запиту
type ProcessAssetsRequestDto = {
  assets: AssetProcessingInfo[];
};

// Тип для успішної відповіді
type SuccessResponse = {
  message: string;
  processedCount: number; // Кількість оброблених записів
};

type ApiErrorData = { message: string; details?: any };

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<SuccessResponse | ApiErrorData>
) {
  const { id } = req.query;

  // Валідація ID співробітника
  if (typeof id !== 'string' || isNaN(parseInt(id))) {
    return res.status(400).json({ message: 'Invalid employee ID format.' });
  }
  const employeeId = parseInt(id);

  // Обробляємо тільки POST запити
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ message: `Method ${req.method} Not Allowed` });
  }

  // --- Обробка POST-запиту ---
  try {
    const { assets } = req.body as ProcessAssetsRequestDto;

    // Валідація вхідного масиву
    if (!Array.isArray(assets)) {
        return res.status(400).json({ message: 'Invalid input: "assets" must be an array.' });
    }
    if (assets.length === 0) {
        // Якщо масив порожній, можливо, просто нічого не робимо і повертаємо успіх
        // Або повертаємо помилку, якщо очікується хоча б один актив
        return res.status(200).json({ message: 'No assets provided for processing.', processedCount: 0 });
        // return res.status(400).json({ message: 'Asset list cannot be empty.' });
    }

    // Валідація кожного елемента масиву
    const validStatuses = Object.values(AssetStatus); // Отримуємо всі валідні статуси з Enum
    for (const assetInfo of assets) {
        if (typeof assetInfo.instanceId !== 'number' || !assetInfo.finalStatus || !validStatuses.includes(assetInfo.finalStatus)) {
             return res.status(400).json({ message: `Invalid data for instanceId ${assetInfo.instanceId}. Provide instanceId and a valid finalStatus.` });
        }
        // Додаткові перевірки, якщо потрібно (напр., чи finalStatus не є 'issued')
        if (assetInfo.finalStatus === AssetStatus.issued) {
             return res.status(400).json({ message: `Cannot set final status to 'issued' during deactivation processing for instanceId ${assetInfo.instanceId}.` });
        }
    }

    // --- Оновлення в Транзакції ---
    const updateResults = await prisma.$transaction(async (tx) => {
        let processedCount = 0;
        const returnDate = new Date(); // Поточна дата для return_date

        for (const assetInfo of assets) {
            // 1. Знаходимо поточний екземпляр, щоб перевірити власника
            const currentInstance = await tx.assetInstance.findUnique({
                where: { id: assetInfo.instanceId },
                select: { current_employee_id: true, status: true } // Вибираємо поточного власника і статус
            });

            // Перевіряємо, чи актив дійсно виданий цьому співробітнику (або вже оброблений)
            if (!currentInstance) {
                 console.warn(`Instance ${assetInfo.instanceId} not found during processing.`);
                 continue; // Пропускаємо цей екземпляр
            }
            if (currentInstance.current_employee_id !== employeeId) {
                 console.warn(`Instance ${assetInfo.instanceId} is not currently assigned to employee ${employeeId}. Current owner: ${currentInstance.current_employee_id}. Skipping.`);
                 // Можливо, актив вже повернули або передали іншому - пропускаємо
                 continue;
            }
             if (currentInstance.status !== AssetStatus.issued) {
                 console.warn(`Instance ${assetInfo.instanceId} has status ${currentInstance.status}, not 'issued'. Skipping history update.`);
                 // Якщо статус вже не 'issued', історію не оновлюємо, але статус екземпляра оновимо нижче
             } else {
                 // 2. Оновлюємо історію видач: встановлюємо return_date для активного запису
                 await tx.assetAssignmentHistory.updateMany({
                    where: {
                        asset_instance_id: assetInfo.instanceId,
                        employee_id: employeeId,
                        return_date: null, // Знаходимо активний запис
                    },
                    data: {
                        return_date: returnDate,
                        // Можна додати notes або return_status сюди, якщо є в схемі
                    },
                 });
             }


            // 3. Оновлюємо сам екземпляр: новий статус та знімаємо власника
            await tx.assetInstance.update({
                where: { id: assetInfo.instanceId },
                data: {
                    status: assetInfo.finalStatus, // Встановлюємо новий статус
                    current_employee_id: null, // Знімаємо прив'язку до співробітника
                },
            });

            processedCount++;
        }
        return { processedCount }; // Повертаємо кількість оброблених з транзакції
    });

    if (!res) { throw new Error("Response object is unavailable after transaction"); }
    res.status(200).json({
        message: `Successfully processed ${updateResults.processedCount} of ${assets.length} assets.`,
        processedCount: updateResults.processedCount,
    });

  } catch (error) {
    console.error(`Failed to process assets for employee ${employeeId}:`, error);
    const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
    if (res && !res.headersSent) {
        res.status(500).json({ message: errorMessage, details: error instanceof Error ? error.stack : error });
    } else {
        console.error("Response unavailable or headers sent in process assets error handler.");
    }
  } finally {
    await prisma.$disconnect().catch((e: unknown) => console.error("Failed to disconnect Prisma Client:", e));
  }
}
