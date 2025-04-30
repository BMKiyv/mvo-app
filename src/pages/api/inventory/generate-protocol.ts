// pages/api/inventory/generate-protocol.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient, CommissionRole, Employee, AssetType } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

// Use Prisma singleton if available, otherwise create new client
// import prisma from '../../../lib/prisma'; // Adjust path if using singleton
const prisma = new PrismaClient();

// --- Типи Даних ---

// Тип для одного елемента у списку на списання в тілі запиту
type WriteOffItemDto = {
  assetTypeId: number;
  quantity: number;
  reason?: string | null;
  // assetTypeName?: string; // Ім'я типу більше не потрібне з фронтенду
};

// Тип для тіла POST запиту
type GenerateProtocolDto = {
  items: WriteOffItemDto[];
};

// *** ВИЗНАЧЕННЯ ТИПУ ДЛЯ ЧЛЕНА КОМІСІЇ/ПІДПИСАНТА ***
type SignatoryData = {
    full_name: string;
    position: string | null;
    // Додаємо необов'язкову роль для членів комісії
    role?: CommissionRole;
};

// Тип для елемента таблиці списання у відповіді
type ProtocolItemData = {
    assetTypeName: string;
    quantity: number;
    reason: string | null;
    assetTypeId: number;
    unitOfMeasure: string; // <--- Додано одиницю виміру
    // unitCost?: string; // <--- Можна додати вартість пізніше
    // totalCost?: string; // <--- Можна додати суму пізніше
};

// Тип для успішної відповіді (дані для протоколу)
type ProtocolDataResponse = {
  protocolDate: string;
  organizationName: string;
  organizationCode: string;
  headOfEnterprise: SignatoryData | null;
  chiefAccountant: SignatoryData | null;
  responsiblePerson: SignatoryData | null;
  commission: {
      chair: SignatoryData | null; // Використовуємо SignatoryData
      members: SignatoryData[];    // Використовуємо SignatoryData
  };
  items: ProtocolItemData[];
};

type ApiErrorData = { message: string; details?: any };

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
    const assetTypeIds = new Set<number>();
    for (const item of items) {
        if (typeof item.assetTypeId !== 'number' || typeof item.quantity !== 'number' || item.quantity <= 0) {
             if (!res) { console.error("POST Generate Protocol: Response undefined before sending validation error!"); return; }
            return res.status(400).json({ message: 'Некоректні дані в одному з елементів списку списання (assetTypeId або quantity).' });
        }
        assetTypeIds.add(item.assetTypeId);
    }

    // --- Отримання даних паралельно ---
    const [
        commissionMembersRaw, // Тип буде визначено Prisma автоматично
        headOfEnterpriseRaw,
        chiefAccountantRaw,
        responsiblePersonRaw,
        assetTypesData
    ] = await Promise.all([
        prisma.employee.findMany({
            where: { is_active: true, commission_role: { in: [CommissionRole.member, CommissionRole.chair] } },
            select: { full_name: true, position: true, commission_role: true },
            orderBy: [{ commission_role: 'desc' }, { full_name: 'asc' }],
        }),
        prisma.employee.findFirst({ where: { is_active: true, is_head_of_enterprise: true }, select: { full_name: true, position: true } }),
        prisma.employee.findFirst({ where: { is_active: true, is_chief_accountant: true }, select: { full_name: true, position: true } }),
        prisma.employee.findFirst({ where: { is_active: true, is_responsible: true }, select: { full_name: true, position: true } }),
        prisma.assetType.findMany({
            where: { id: { in: Array.from(assetTypeIds) } },
            select: { id: true, name: true, unit_of_measure: true }
        })
    ]);

    if (assetTypesData.length !== assetTypeIds.size) {
         return res.status(400).json({ message: 'Один або декілька вказаних типів активів не знайдено.' });
    }
    const assetTypeMap = new Map(assetTypesData.map(t => [t.id, t]));

    // --- Формування даних комісії ---
    const commission: ProtocolDataResponse['commission'] = { chair: null, members: [] };
    // Явно типізуємо member тут
    commissionMembersRaw.forEach((member: { full_name: string; position: string | null; commission_role: CommissionRole }) => {
        // *** ВИПРАВЛЕНО: Використовуємо SignatoryData для memberData ***
        const memberData: SignatoryData = {
            full_name: member.full_name,
            position: member.position,
            role: member.commission_role,
        };
        if (member.commission_role === CommissionRole.chair && !commission.chair) {
            commission.chair = memberData;
        } else {
            commission.members.push(memberData);
        }
    });

    // --- Формування даних підписантів ---
    const headOfEnterprise: SignatoryData | null = headOfEnterpriseRaw ? { ...headOfEnterpriseRaw } : null;
    const chiefAccountant: SignatoryData | null = chiefAccountantRaw ? { ...chiefAccountantRaw } : null;
    const responsiblePerson: SignatoryData | null = responsiblePersonRaw ? { ...responsiblePersonRaw } : null;

    // --- Формування даних для таблиці протоколу ---
    const protocolItems: ProtocolItemData[] = items.map(item => {
        const assetTypeInfo = assetTypeMap.get(item.assetTypeId);
        return {
            assetTypeName: assetTypeInfo?.name ?? `ID: ${item.assetTypeId}`,
            quantity: item.quantity,
            reason: item.reason || null,
            assetTypeId: item.assetTypeId,
            unitOfMeasure: assetTypeInfo?.unit_of_measure ?? 'шт.',
        };
    });

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
