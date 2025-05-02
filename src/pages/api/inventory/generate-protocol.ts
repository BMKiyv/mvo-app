// pages/api/inventory/generate-protocol.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient, CommissionRole, Employee, AssetType, Prisma } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

const prisma = new PrismaClient();

// --- Типи Даних ---

// Тип для одного елемента у списку на списання в тілі запиту
// *** ВИПРАВЛЕНО: Очікуємо instanceId, quantity, reason ***
type WriteOffItemDto = {
  instanceId: number;
  quantity: number; // Кількість, що списується
  reason?: string | null;
  // Додаткові поля, які фронтенд може передати для зручності (не використовуються для запиту до БД тут)
  assetTypeName?: string;
  unitOfMeasure?: string;
  inventoryNumber?: string;
  unitCost?: string;
  assetTypeId?: number; // Може бути корисним для логування
};

// Тип для тіла POST запиту
type GenerateProtocolDto = {
  items: WriteOffItemDto[];
};



type ApiErrorData = { message: string; details?: any };

// --- Re-add Type Definitions ---
type SignatoryData = { full_name: string; position: string | null; role?: CommissionRole; };
type ProtocolItemData = {
    assetTypeName: string; quantity: number; reason: string | null;
    assetTypeId: number; unitOfMeasure: string; unitCost: string; // Вартість як рядок
    inventoryNumber: string; itemSum: string; instanceId: number;
};
type ProtocolDataResponse = {
  protocolDate: string; organizationName: string; organizationCode: string;
  headOfEnterprise: SignatoryData | null; chiefAccountant: SignatoryData | null;
  responsiblePerson: SignatoryData | null; commission: { chair: SignatoryData | null; members: SignatoryData[]; };
  items: ProtocolItemData[]; totalSum: string;
};


// --- Основний обробник ---
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ProtocolDataResponse | ApiErrorData>
) {
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
    const { items } = req.body as GenerateProtocolDto;

    // --- Валідація вхідних даних ---
    if (!Array.isArray(items) || items.length === 0) {
        if (!res) { console.error("POST Generate Protocol: Response undefined before sending validation error!"); return; }
        return res.status(400).json({ message: 'Масив "items" є обов\'язковим і не може бути порожнім.' });
    }

    const instanceIds = new Set<number>();
    const itemMap = new Map<number, WriteOffItemDto>(); // Зберігаємо дані запиту за instanceId

    for (const item of items) {
        // *** ВИПРАВЛЕНО: Перевіряємо item.instanceId та item.quantity ***
        if (typeof item.instanceId !== 'number' || !Number.isInteger(item.instanceId) || item.instanceId <= 0 ||
            typeof item.quantity !== 'number' || !Number.isInteger(item.quantity) || item.quantity <= 0)
        {
             if (!res) { console.error("POST Generate Protocol: Response undefined before sending validation error!"); return; }
             // Повертаємо правильне повідомлення про помилку
            return res.status(400).json({ message: `Некоректні дані для одного з елементів: instanceId=${item.instanceId}, quantity=${item.quantity}.` });
        }
        instanceIds.add(item.instanceId);
        itemMap.set(item.instanceId, item);
    }

    // --- Отримання даних паралельно ---
    const [
        commissionMembersRaw,
        headOfEnterpriseRaw,
        chiefAccountantRaw,
        responsiblePersonRaw,
        // Отримуємо дані екземплярів, що списуються
        assetInstancesData
    ] = await Promise.all([
        prisma.employee.findMany({ where: { is_active: true, commission_role: { in: [CommissionRole.member, CommissionRole.chair] } }, select: { full_name: true, position: true, commission_role: true }, orderBy: [{ commission_role: 'desc' }, { full_name: 'asc' }], }),
        prisma.employee.findFirst({ where: { is_active: true, is_head_of_enterprise: true }, select: { full_name: true, position: true } }),
        prisma.employee.findFirst({ where: { is_active: true, is_chief_accountant: true }, select: { full_name: true, position: true } }),
        prisma.employee.findFirst({ where: { is_active: true, is_responsible: true }, select: { full_name: true, position: true } }),
        // Отримуємо дані екземплярів
        prisma.assetInstance.findMany({
            where: { id: { in: Array.from(instanceIds) } },
            include: { assetType: { select: { name: true, unit_of_measure: true, id: true } } } // Включаємо потрібні дані типу
        })
    ]);

    // Перевірка, чи всі екземпляри знайдено
    if (assetInstancesData.length !== instanceIds.size) {
         // Знаходимо відсутні ID для кращого повідомлення
         const foundIds = new Set(assetInstancesData.map(inst => inst.id));
         const missingIds = Array.from(instanceIds).filter(id => !foundIds.has(id));
         return res.status(400).json({ message: `Один або декілька вказаних екземплярів активів не знайдено: ID(s) ${missingIds.join(', ')}.` });
    }

    // --- Формування даних комісії та підписантів ---
    const commission: ProtocolDataResponse['commission'] = { chair: null, members: [] };
    commissionMembersRaw.forEach((member) => { /* ... */ }); // Логіка без змін
     commissionMembersRaw.forEach((member: { full_name: string; position: string | null; commission_role: CommissionRole }) => { const memberData: SignatoryData = { full_name: member.full_name, position: member.position, role: member.commission_role, }; if (member.commission_role === CommissionRole.chair && !commission.chair) { commission.chair = memberData; } else { commission.members.push(memberData); } });

    const headOfEnterprise: SignatoryData | null = headOfEnterpriseRaw ? { ...headOfEnterpriseRaw } : null;
    const chiefAccountant: SignatoryData | null = chiefAccountantRaw ? { ...chiefAccountantRaw } : null;
    const responsiblePerson: SignatoryData | null = responsiblePersonRaw ? { ...responsiblePersonRaw } : null;


    // --- Формування даних для таблиці протоколу та розрахунок сум ---
    let totalSum = new Decimal(0);
    const protocolItems: ProtocolItemData[] = [];

    for (const instance of assetInstancesData) {
        const inputItem = itemMap.get(instance.id);
        if (!inputItem) {
            console.warn(`Could not find input data for instanceId ${instance.id}. Skipping.`);
            continue;
        }

        const quantityToWriteOff = inputItem.quantity; // Беремо quantity з DTO
        // Перевірка, чи кількість списання не перевищує доступну
        if (quantityToWriteOff > instance.quantity) {
             if (!res) { console.error("POST Generate Protocol: Response undefined before sending validation error!"); return; }
             return res.status(400).json({ message: `Кількість для списання (${quantityToWriteOff}) для інв. № ${instance.inventoryNumber} перевищує доступну (${instance.quantity}).` });
        }

        const unitCostDecimal = instance.unit_cost;
        const itemSumDecimal = unitCostDecimal.mul(quantityToWriteOff);
        totalSum = totalSum.add(itemSumDecimal);

        protocolItems.push({
            assetTypeName: instance.assetType?.name ?? 'Невідомий тип',
            inventoryNumber: instance.inventoryNumber,
            unitOfMeasure: instance.assetType?.unit_of_measure ?? 'шт.',
            quantity: quantityToWriteOff, // Кількість, що списується
            unitCost: unitCostDecimal.toFixed(2),
            itemSum: itemSumDecimal.toFixed(2),
            reason: inputItem.reason || null,
            assetTypeId: instance.assetTypeId,
            instanceId: instance.id
        });
    }

    // --- Формування фінальної відповіді ---
    const protocolData: ProtocolDataResponse = {
        protocolDate: new Date().toISOString().split('T')[0],
        organizationName: "Державне агентство розвитку туризму України",
        organizationCode: "43553128",
        headOfEnterprise: headOfEnterprise,
        chiefAccountant: chiefAccountant,
        responsiblePerson: responsiblePerson,
        commission: commission,
        items: protocolItems,
        totalSum: totalSum.toFixed(2),
    };

    if (!res) { throw new Error("Response object is unavailable"); }
    res.status(200).json(protocolData);

  } catch (error) {
    console.error('Failed to generate protocol data:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
    if (res && !res.headersSent) {
        res.status(500).json({ message: errorMessage, details: error instanceof Error ? error.stack : error });
    } else {
        console.error("Response unavailable or headers sent in generate protocol error handler.");
    }
  } finally {
    if (prisma) {
        try { await prisma.$disconnect(); }
        catch (disconnectError) { console.error("Failed to disconnect Prisma Client:", disconnectError); }
    }
  }
}
