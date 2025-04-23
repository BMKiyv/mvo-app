// pages/api/employees/[id]/assets.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient, AssetStatus } from '@prisma/client'; // Import AssetStatus enum

const prisma = new PrismaClient();

// Define the structure for assigned asset data
type AssignedAssetData = {
  instanceId: number;
  inventoryNumber: string;
  assetTypeName: string;
  // Include assignment date from history if possible and needed
  // assignmentDate: Date | null; // Requires joining with history
  // unit_cost?: string; // Optional: include cost if needed
};

type ApiResponseData = AssignedAssetData[];
type ApiErrorData = { message: string };

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponseData | ApiErrorData>
) {
  const { id } = req.query;

  // Validate ID
  if (typeof id !== 'string' || isNaN(parseInt(id))) {
    return res.status(400).json({ message: 'Invalid employee ID format.' });
  }
  const employeeId = parseInt(id);

  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ message: `Method ${req.method} Not Allowed` });
  }

  try {
    // 1. Check if employee exists and is active
    const employee = await prisma.employee.findUnique({
        where: { id: employeeId, is_active: true } // Ensure employee exists and is active
    });
    if (!employee) {
        return res.status(404).json({ message: `Active employee with ID ${employeeId} not found.` });
    }

    // 2. Find asset instances assigned to this employee
    const assignedInstances = await prisma.assetInstance.findMany({
      where: {
        current_employee_id: employeeId,
        status: AssetStatus.issued, // Ensure we only get currently issued items
      },
      select: {
        id: true, // Renamed to instanceId later
        inventoryNumber: true,
        assetType: { // Include related asset type
          select: {
            name: true, // Get the name of the asset type
          },
        },
        // Optional: Include assignment history to get the date
        // assignmentHistory: {
        //   where: { return_date: null }, // Get the active assignment record
        //   orderBy: { assignment_date: 'desc' },
        //   take: 1,
        //   select: { assignment_date: true }
        // }
      },
      orderBy: {
        // Optional: Order by asset type name or inventory number
        assetType: { name: 'asc' },
      },
    });

    // 3. Format the response data
    const formattedAssets: AssignedAssetData[] = assignedInstances.map(inst => ({
      instanceId: inst.id,
      inventoryNumber: inst.inventoryNumber,
      assetTypeName: inst.assetType?.name ?? 'Невідомий тип', // Handle case where type might be missing
      // assignmentDate: inst.assignmentHistory?.[0]?.assignment_date ?? null, // Get date if history was included
    }));

    res.status(200).json(formattedAssets);

  } catch (error) {
    console.error(`Failed to fetch assets for employee ${employeeId}:`, error);
    res.status(500).json({ message: 'Internal Server Error' });
  } finally {
    await prisma.$disconnect();
  }
}
