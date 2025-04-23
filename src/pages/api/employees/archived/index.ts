import { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).end(`Метод ${req.method} не дозволено`);
  }

  try {
    const archivedEmployees = await prisma.employee.findMany({
      where: { is_active: false },
      orderBy: { full_name: 'asc' },
    });

    res.status(200).json(archivedEmployees);
  } catch (error) {
    console.error('Помилка при отриманні архівованих:', error);
    res.status(500).json({ error: 'Не вдалося отримати архівованих співробітників' });
  }
}
