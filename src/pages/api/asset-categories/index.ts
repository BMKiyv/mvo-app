import { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    try {
      const categories = await prisma.assetCategory.findMany({
        orderBy: { name: 'asc' },
      });
      res.status(200).json(categories);
    } catch (error) {
      console.error('Помилка при отриманні категорій:', error);
      res.status(500).json({ error: 'Не вдалося отримати категорії' });
    }
  } else if (req.method === 'POST') {
    const { name } = req.body;

    if (!name || typeof name !== 'string') {
      return res.status(400).json({ error: 'Поле name обовʼязкове' });
    }

    try {
      const newCategory = await prisma.assetCategory.create({
        data: { name },
      });
      res.status(201).json(newCategory);
    } catch (error: any) {
      if (error.code === 'P2002') {
        // унікальність
        return res.status(400).json({ error: 'Категорія з такою назвою вже існує' });
      }
      console.error('Помилка створення категорії:', error);
      res.status(500).json({ error: 'Не вдалося створити категорію' });
    }
  } else {
    res.setHeader('Allow', ['GET', 'POST']);
    res.status(405).end(`Метод ${req.method} не дозволено`);
  }
}
