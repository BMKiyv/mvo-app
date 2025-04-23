// pages/api/employees/responsible.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Define the structure of the data we want to return
type ResponsibleEmployeeData = {
  id: number;
  full_name: string;
} | null; // Return null if not found

type ApiErrorData = { message: string };

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponsibleEmployeeData | ApiErrorData>
) {
  // Ensure this is a GET request
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ message: `Method ${req.method} Not Allowed` });
  }

  try {
    // Find the first active employee marked as responsible
    const responsibleEmployee = await prisma.employee.findFirst({
      where: {
        is_responsible: true, // Find the responsible one
        is_active: true,      // Ensure they are currently active
      },
      select: { // Select only the necessary fields for display
        id: true,
        full_name: true,
      },
    });

    // It's okay if no one is marked as responsible yet, return null
    if (!responsibleEmployee) {
      return res.status(200).json(null);
    }

    // Return the found employee data
    res.status(200).json(responsibleEmployee);

  } catch (error) {
    console.error('Failed to fetch responsible employee:', error);
    // Handle potential errors during database query
    res.status(500).json({ message: 'Internal Server Error' });
  } finally {
    // Ensure Prisma Client disconnects after the request
    await prisma.$disconnect();
  }
}
