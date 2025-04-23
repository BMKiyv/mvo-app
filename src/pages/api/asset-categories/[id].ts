import { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const id = Number(req.query.id);
  if (isNaN(id)) return res.status(400).json({ error: 'Невірний ID' });

  if (req.method === 'PUT') {
    const { name } = req.body;
    if (!name || typeof name !== 'string') {
      return res.status(400).json({ error: 'Нова назва обовʼязкова' });
    }

    try {
      const updated = await prisma.assetCategory.update({
        where: { id },
        data: { name },
      });
      res.status(200).json(updated);
    } catch (error) {
      console.error('Помилка при оновленні категорії:', error);
      res.status(500).json({ error: 'Не вдалося оновити категорію' });
    }
  }

  else if (req.method === 'DELETE') {
    try {
      const relatedTypes = await prisma.assetType.findMany({
        where: { categoryId: id },
      });

      if (relatedTypes.length > 0) {
        return res.status(409).json({ error: 'Неможливо видалити: до категорії привʼязані типи активів' });
      }

      await prisma.assetCategory.delete({ where: { id } });
      res.status(204).end();
    } catch (error) {
      console.error('Помилка при видаленні категорії:', error);
      res.status(500).json({ error: 'Не вдалося видалити категорію' });
    }
  }

  else {
    res.setHeader('Allow', ['PUT', 'DELETE']);
    res.status(405).end(`Метод ${req.method} не дозволено`);
  }
}
