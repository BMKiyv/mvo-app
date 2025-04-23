import { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const id = Number(req.query.id);

  if (req.method !== 'DELETE') {
    res.setHeader('Allow', ['DELETE']);
    return res.status(405).end(`Метод ${req.method} не дозволено`);
  }

  if (isNaN(id)) {
    return res.status(400).json({ error: 'Невірний ID' });
  }

  try {
    const employee = await prisma.employee.findUnique({ where: { id } });

    if (!employee || employee.is_active) {
      return res.status(400).json({ error: 'Можна видалити лише архівованого співробітника' });
    }

    await prisma.assetAssignmentHistory.deleteMany({
      where: { employee_id: id },
    });

    await prisma.employee.delete({ where: { id } });

    res.status(204).end();
  } catch (error) {
    console.error('Помилка при видаленні:', error);
    res.status(500).json({ error: 'Не вдалося видалити співробітника' });
  }
}
