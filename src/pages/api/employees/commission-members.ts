// pages/api/employees/commission-members.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient, CommissionRole, Employee } from '@prisma/client';

// Use Prisma singleton if available, otherwise create new client
// import prisma from '../../../lib/prisma'; // Adjust path if using singleton
const prisma = new PrismaClient();

// Тип даних для члена комісії
type CommissionMember = {
    id: number;
    full_name: string;
    position: string | null;
    commission_role: CommissionRole; // Повертаємо роль
};

type ApiResponseData = CommissionMember[];
type ApiErrorData = { message: string; details?: any };

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponseData | ApiErrorData>
) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ message: `Method ${req.method} Not Allowed` });
  }

  try {
    // Знаходимо всіх активних співробітників, які є членами або головою комісії
    const members = await prisma.employee.findMany({
      where: {
        is_active: true, // Тільки активні співробітники
        commission_role: {
          in: [CommissionRole.member, CommissionRole.chair], // Роль 'member' або 'chair'
        },
      },
      select: {
        id: true,
        full_name: true,
        position: true,
        commission_role: true, // Вибираємо роль
      },
      orderBy: [
        // Спочатку голова, потім члени, потім за іменем
        { commission_role: 'desc' }, // chair буде першим ('c' > 'm')
        { full_name: 'asc' },
      ],
    });

    if (!res) { throw new Error("Response object is unavailable"); }
    res.status(200).json(members);

  } catch (error) {
    console.error('Failed to fetch commission members:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
    if (res && !res.headersSent) {
        res.status(500).json({ message: errorMessage, details: error instanceof Error ? error.stack : error });
    } else {
        console.error("Response unavailable or headers sent in commission members fetch.");
    }
  } finally {
    // await prisma.$disconnect().catch((e: unknown) => console.error("Failed to disconnect Prisma Client:", e));
  }
}
