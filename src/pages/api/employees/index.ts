import { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method === 'GET') {
    try {
      const employees = await prisma.employee.findMany({
        where: { is_active: true },
        orderBy: { full_name: 'asc' },
        select: {
          id: true,
          full_name: true,
          position: true,
          contact_info: true,
          is_responsible: true,
        },
      });

      res.status(200).json(employees);
    } catch (error) {
      console.error('Помилка при отриманні співробітників:', error);
      res.status(500).json({ error: 'Не вдалося отримати співробітників' });
    }
  } else if (req.method === 'POST') {
    try {
      const { full_name, position, contact_info } = req.body;

      // Простенька валідація
      if (!full_name || typeof full_name !== 'string') {
        return res.status(400).json({ error: 'Поле full_name є обовʼязковим і має бути рядком' });
      }

      const newEmployee = await prisma.employee.create({
        data: {
          full_name,
          position,
          contact_info,
          // is_responsible автоматично false
          // is_active автоматично true
        },
      });

      res.status(201).json(newEmployee);
    } catch (error) {
      console.error('Помилка при створенні співробітника:', error);
      res.status(500).json({ error: 'Не вдалося створити співробітника' });
    }
  } else {
    res.setHeader('Allow', ['GET', 'POST']);
    res.status(405).end(`Метод ${req.method} не дозволено`);
  }
}
