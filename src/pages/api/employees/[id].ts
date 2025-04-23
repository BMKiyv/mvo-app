import { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const id = Number(req.query.id);

  if (isNaN(id)) {
    return res.status(400).json({ error: 'Невірний ID' });
  }

  if (req.method === 'GET') {
    try {
      const employee = await prisma.employee.findUnique({
        where: { id },
        select: {
          id: true,
          full_name: true,
          position: true,
          contact_info: true,
          is_responsible: true,
          is_active: true,
          created_at: true,
          updated_at: true,
        },
      });

      if (!employee) return res.status(404).json({ error: 'Не знайдено' });

      res.status(200).json(employee);
    } catch (error) {
      console.error('Помилка GET:', error);
      res.status(500).json({ error: 'Не вдалося отримати співробітника' });
    }
  }

  // 🛠️ Оновлення співробітника
  else if (req.method === 'PUT') {
    try {
      const data = req.body;

      const updated = await prisma.employee.update({
        where: { id },
        data: {
          full_name: data.full_name,
          position: data.position,
          contact_info: data.contact_info,
          is_responsible: data.is_responsible,
        },
      });

      res.status(200).json(updated);
    } catch (error) {
      console.error('Помилка PUT:', error);
      res.status(500).json({ error: 'Не вдалося оновити співробітника' });
    }
  }

  // 🗃️ Логічне видалення (архівування)
  else if (req.method === 'DELETE') {
    try {
      const archived = await prisma.employee.update({
        where: { id },
        data: { is_active: false },
      });

      res.status(200).json({ id: archived.id, archived: true });
    } catch (error) {
      console.error('Помилка DELETE:', error);
      res.status(500).json({ error: 'Не вдалося архівувати співробітника' });
    }
  }

  else {
    res.setHeader('Allow', ['GET', 'PUT', 'DELETE']);
    res.status(405).end(`Метод ${req.method} не дозволено`);
  }
}
