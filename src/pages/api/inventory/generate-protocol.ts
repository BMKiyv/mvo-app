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
  // Додаємо назву типу, яку фронтенд вже має
  assetTypeName?: string;
};

// Тип для тіла POST запиту
type GenerateProtocolDto = {
  items: WriteOffItemDto[];
};

// Тип для члена комісії у відповіді
type CommissionMemberData = {
    full_name: string;
    position: string | null;
    role: CommissionRole;
};

// Тип для елемента таблиці списання у відповіді
type ProtocolItemData = {
    assetTypeName: string;
    quantity: number;
    reason: string | null;
    // Можна додати вартість, якщо потрібно
    // unitCost?: string;
    // totalCost?: string;
};

// Тип для успішної відповіді (дані для протоколу)
type ProtocolDataResponse = {
  protocolDate: string; // Дата у форматі РРРР-ММ-ДД
  // protocolNumber?: string; // Номер протоколу (якщо потрібен)
  commission: {
      chair: CommissionMemberData | null; // Голова комісії
      members: CommissionMemberData[];    // Члени комісії
  };
  items: ProtocolItemData[]; // Таблиця списання
};

type ApiErrorData = { message: string; details?: any };

// --- Основний обробник ---
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ProtocolDataResponse | ApiErrorData>
) {
  // Обробляємо тільки POST запити
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ message: `Method ${req.method} Not Allowed` });
  }

  // --- Обробка POST-запиту ---
  try {
    const { items } = req.body as GenerateProtocolDto;

    // --- Валідація вхідних даних ---
    if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ message: 'Масив "items" є обов\'язковим і не може бути порожнім.' });
    }
    // Проста перевірка наявності основних полів
    for (const item of items) {
        if (typeof item.assetTypeId !== 'number' || typeof item.quantity !== 'number' || item.quantity <= 0) {
            return res.status(400).json({ message: 'Некоректні дані в одному з елементів списку списання (assetTypeId або quantity).' });
        }
    }

    // --- Отримання членів комісії ---
    const commissionMembersRaw = await prisma.employee.findMany({
        where: {
            is_active: true,
            commission_role: { in: [CommissionRole.member, CommissionRole.chair] },
        },
        select: { full_name: true, position: true, commission_role: true },
        orderBy: [{ commission_role: 'desc' }, { full_name: 'asc' }],
    });

    // Розділяємо голову та членів
    const commission: ProtocolDataResponse['commission'] = {
        chair: null,
        members: [],
    };
    commissionMembersRaw.forEach(member => {
        const memberData: CommissionMemberData = {
            full_name: member.full_name,
            position: member.position,
            role: member.commission_role,
        };
        if (member.commission_role === CommissionRole.chair && !commission.chair) {
            commission.chair = memberData; // Беремо першого знайденого голову
        } else {
            commission.members.push(memberData);
        }
    });

    // --- Формування даних для таблиці протоколу ---
    // Ми вже маємо назви типів з фронтенду, тому не робимо зайвий запит до БД
    const protocolItems: ProtocolItemData[] = items.map(item => ({
        assetTypeName: item.assetTypeName || `ID: ${item.assetTypeId}`, // Використовуємо назву з запиту або ID
        quantity: item.quantity,
        reason: item.reason || null,
        // TODO: Додати логіку отримання вартості, якщо потрібно
    }));

    // --- Формування фінальної відповіді ---
    const protocolData: ProtocolDataResponse = {
        protocolDate: new Date().toISOString().split('T')[0], // Поточна дата
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
    // await prisma.$disconnect().catch((e: unknown) => console.error("Failed to disconnect Prisma Client:", e));
  }
}
