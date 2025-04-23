import { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const id = Number(req.query.id);

  if (req.method !== 'PUT') {
    res.setHeader('Allow', ['PUT']);
    return res.status(405).end(`Метод ${req.method} не дозволено`);
  }

  if (isNaN(id)) {
    return res.status(400).json({ error: 'Невірний ID' });
  }

  try {
    const restored = await prisma.employee.update({
      where: { id },
      data: { is_active: true },
    });

    res.status(200).json(restored);
  } catch (error) {
    console.error('Помилка при відновленні:', error);
    res.status(500).json({ error: 'Не вдалося відновити співробітника' });
  }
}
