// pages/api/inventory/perform-write-off.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { 
  PrismaClient, 
  Prisma, 
  AssetStatus, 
  WriteOffOperationType 
} from '@prisma/client';

// Ініціалізація Prisma Client (best practice для Next.js)
let prisma: PrismaClient;
if (process.env.NODE_ENV === 'production') {
  prisma = new PrismaClient();
} else {
  // @ts-ignore
  if (!global.prisma) {
  // @ts-ignore
    global.prisma = new PrismaClient();
  }
  // @ts-ignore
  prisma = global.prisma;
}

// --- Типи Даних (DTOs) ---
interface AffectedAssetInstanceItem {
  instanceId: number;
  quantityToWriteOff: number;
  itemSpecificReason?: string | null;
}

interface BatchInstanceWriteOffDto {
  writeOffDate?: string;
  mainReason?: string | null;
  mainNotes?: string | null;
  writeOffDocumentNumber?: string | null;
  commissionChairId?: number | null;
  headOfEnterpriseSignatoryId?: number | null;
  chiefAccountantSignatoryId?: number | null;
  commissionMemberIds?: number[];
  items: AffectedAssetInstanceItem[];
}

type SuccessResponse = {
  message: string;
  processedWriteOffLogs: number; // Кількість створених записів WriteOffLog
};

type ApiErrorData = { message: string; details?: any };

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<SuccessResponse | ApiErrorData>
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ message: `Method ${req.method} Not Allowed` });
  }

  try {
    const dto: BatchInstanceWriteOffDto = req.body;

    // --- Валідація DTO ---
    if (!Array.isArray(dto.items) || dto.items.length === 0) {
      return res.status(400).json({ message: 'Масив "items" є обов\'язковим і не може бути порожнім.' });
    }
    // Тут потрібна більш детальна валідація всіх полів dto

    const actualWriteOffDate = dto.writeOffDate ? new Date(dto.writeOffDate) : new Date();

    const results = await prisma.$transaction(async (tx) => {
      const createdLogIds: number[] = [];

      for (const item of dto.items) {
        if (typeof item.instanceId !== 'number' || item.instanceId <= 0 ||
            typeof item.quantityToWriteOff !== 'number' || item.quantityToWriteOff <= 0) {
          throw { status: 400, message: `Некоректні дані для одного з елементів: instanceId=${item.instanceId}, quantityToWriteOff=${item.quantityToWriteOff}.` };
        }

        const assetInstance = await tx.assetInstance.findUnique({
          where: { id: item.instanceId },
        });

        if (!assetInstance) {
          throw { status: 404, message: `AssetInstance з ID ${item.instanceId} не знайдено.` };
        }
        if (assetInstance.status === AssetStatus.written_off) {
          throw { status: 400, message: `AssetInstance з ID ${item.instanceId} вже списано.` };
        }
        if (item.quantityToWriteOff > assetInstance.quantity) {
          throw { status: 400, message: `Кількість для списання (${item.quantityToWriteOff}) для AssetInstance ID ${item.instanceId} перевищує доступну (${assetInstance.quantity}).` };
        }

        const operationType: WriteOffOperationType = (item.quantityToWriteOff === assetInstance.quantity)
          ? WriteOffOperationType.INSTANCE_DISPOSAL
          : WriteOffOperationType.INSTANCE_PARTIAL_REDUCTION; // Потрібно додати цей тип в Enum, якщо його немає, або вирішити як обробляти часткове списання екземпляра

        // Якщо INSTANCE_PARTIAL_REDUCTION не визначено в Enum, адаптуйте логіку
        // Наприклад, для часткового списання можна також використовувати INSTANCE_DISPOSAL,
        // але тоді логіка оновлення AssetInstance буде іншою (лише зменшення кількості).
        // Або, якщо часткове списання екземпляра завжди означає STOCK_REDUCTION з точки зору логу, тоді так і вказати.
        // Для прикладу, я припускаю, що ви хочете розрізняти повне і часткове списання *екземпляра*.
        // Якщо у вас в Enum WriteOffOperationType немає INSTANCE_PARTIAL_REDUCTION, замініть на відповідний тип.

        // Створення запису в WriteOffLog
        const writeOffLogEntry = await tx.writeOffLog.create({
          data: {
            assetTypeId: assetInstance.assetTypeId,
            assetInstanceId: assetInstance.id,
            quantity: item.quantityToWriteOff,
            unitCostAtWriteOff: assetInstance.unit_cost, // Беремо з екземпляра
            totalValueAtWriteOff: assetInstance.unit_cost.mul(new Prisma.Decimal(item.quantityToWriteOff)),
            writeOffDate: actualWriteOffDate,
            reason: item.itemSpecificReason ?? dto.mainReason,
            operationType: operationType, // Важливо!
            notes: dto.mainNotes, // Можна додати і item.itemSpecificNotes, якщо потрібно
            writeOffDocumentNumber: dto.writeOffDocumentNumber,
            responsibleEmployeeId: assetInstance.current_employee_id, // МВО на момент списання
            commissionChairId: dto.commissionChairId,
            headOfEnterpriseSignatoryId: dto.headOfEnterpriseSignatoryId,
            chiefAccountantSignatoryId: dto.chiefAccountantSignatoryId,
            // performedById: currentUserId, // Якщо є
          },
        });
        createdLogIds.push(writeOffLogEntry.id);

        // Створення записів для членів комісії (якщо є)
        if (dto.commissionMemberIds && dto.commissionMemberIds.length > 0) {
          await tx.writeOffLogCommissionMembership.createMany({
            data: dto.commissionMemberIds.map(memberId => ({
              writeOffLogId: writeOffLogEntry.id,
              employeeId: memberId,
            })),
            skipDuplicates: true, // На випадок, якщо викликається для кожного item, а комісія одна
          });
        }

        // Оновлення AssetInstance
        let newAssetInstanceNotes = assetInstance.notes || '';
        const notePrefix = item.itemSpecificReason ?? dto.mainReason ?? 'Списано';
        const noteDetail = `${operationType === WriteOffOperationType.INSTANCE_DISPOSAL ? 'Повністю' : 'Частково'} списано ${item.quantityToWriteOff} од. (${actualWriteOffDate.toLocaleDateString('uk-UA')}): ${notePrefix}`;
        newAssetInstanceNotes = newAssetInstanceNotes ? `${newAssetInstanceNotes}\n${noteDetail}` : noteDetail;

        if (operationType === WriteOffOperationType.INSTANCE_DISPOSAL) {
          await tx.assetInstance.update({
            where: { id: assetInstance.id },
            data: {
              status: AssetStatus.written_off,
              quantity: 0,
              current_employee_id: null,
              notes: newAssetInstanceNotes,
            },
          });
          if (assetInstance.status === AssetStatus.issued && assetInstance.current_employee_id) {
            await tx.assetAssignmentHistory.updateMany({
              where: {
                asset_instance_id: assetInstance.id,
                employee_id: assetInstance.current_employee_id,
                return_date: null,
              },
              data: { return_date: actualWriteOffDate },
            });
          }
        } else { // INSTANCE_PARTIAL_REDUCTION (або як ви вирішите обробляти часткове)
          await tx.assetInstance.update({
            where: { id: assetInstance.id },
            data: {
              quantity: { decrement: item.quantityToWriteOff },
              notes: newAssetInstanceNotes,
            },
          });
        }
      } // кінець циклу for
      return { processedWriteOffLogs: createdLogIds.length };
    }); // кінець транзакції

    res.status(200).json({
      message: `Операції списання для ${results.processedWriteOffLogs} екземплярів успішно зафіксовано в журналі.`,
      processedWriteOffLogs: results.processedWriteOffLogs,
    });

  } catch (error: any) {
    console.error('Failed to perform batch write-off:', error);
    if (error && typeof error.status === 'number' && typeof error.message === 'string') {
      // Кастомні помилки, кинуті з транзакції
      return res.status(error.status).json({ message: error.message });
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      return res.status(400).json({ message: `Помилка бази даних (${error.code})`, details: error.message });
    }
    res.status(500).json({ message: error.message || 'Internal Server Error', details: error.stack });
  } finally {
    // PrismaClient $disconnect не потрібен для кожного запиту в Next.js API routes при правильній ініціалізації
  }
}