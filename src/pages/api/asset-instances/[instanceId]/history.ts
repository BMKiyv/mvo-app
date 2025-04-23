// pages/api/asset-instances/[instanceId]/history.ts
import type { NextApiRequest, NextApiResponse } from 'next';
// Import PrismaClient and Decimal type if needed
import { PrismaClient, Prisma, AssetAssignmentHistory, Employee } from '@prisma/client';

const prisma = new PrismaClient();

// Define the expected structure of the response data using schema names
type HistoryEntry = {
  historyId: number;
  employeeId: number;
  employeeFullName: string | null; // From related Employee model
  assignment_date: Date;
  return_date: Date | null;
  notes: string | null; // Assuming notes field exists in AssetAssignmentHistory
};

type ApiResponseData = {
  data: HistoryEntry[];
  pagination?: {
    currentPage: number;
    totalPages: number;
    totalItems: number;
    limit: number;
  };
};

type ApiErrorData = {
  message: string;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponseData | ApiErrorData>
) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ message: `Method ${req.method} Not Allowed` });
  }

  const { instanceId, page = '1', limit = '10', sortBy = 'assignment_date', sortOrder = 'desc' } = req.query;

  // Validate instanceId
  if (typeof instanceId !== 'string' || isNaN(parseInt(instanceId))) {
    return res.status(400).json({ message: 'Invalid instance ID format.' });
  }
  const id = parseInt(instanceId);

  // Validate pagination parameters
  const pageNum = parseInt(page as string);
  const limitNum = parseInt(limit as string);
  if (isNaN(pageNum) || pageNum < 1 || isNaN(limitNum) || limitNum < 1) {
      return res.status(400).json({ message: 'Invalid pagination parameters.' });
  }

  // Validate sorting parameters - use schema field names
  const validSortBy: Array<keyof AssetAssignmentHistory> = ['assignment_date', 'return_date', 'id', 'employee_id', 'asset_instance_id']; // Use schema field names
  const validSortOrder = ['asc', 'desc'];
  // Type assertion for sortBy key
  const sortByField = sortBy as keyof AssetAssignmentHistory;
  if (typeof sortBy !== 'string' || !validSortBy.includes(sortByField) || typeof sortOrder !== 'string' || !validSortOrder.includes(sortOrder)) {
      return res.status(400).json({ message: 'Invalid sorting parameters.' });
  }


  try {
    // 1. Check if the asset instance exists using the schema model name 'AssetInstance'
    const assetInstance = await prisma.assetInstance.findUnique({
      where: { id: id },
    });

    if (!assetInstance) {
      return res.status(404).json({ message: `Asset instance with ID ${id} not found.` });
    }

    // 2. Fetch history records using 'AssetAssignmentHistory' and schema field names
    const skip = (pageNum - 1) * limitNum;
    const totalItems = await prisma.assetAssignmentHistory.count({
        where: { asset_instance_id: id }, // Use schema field name
    });
    const totalPages = Math.ceil(totalItems / limitNum);

    const historyRecords = await prisma.assetAssignmentHistory.findMany({
      where: { asset_instance_id: id }, // Use schema field name
      include: {
        employee: { // Use relation field name from schema
          select: {
            full_name: true, // Use schema field name
          },
        },
      },
      orderBy: {
        [sortByField]: sortOrder as Prisma.SortOrder, // Apply dynamic sorting using schema field
      },
      take: limitNum,
      skip: skip,
    });

    // 3. Format the response data
    const formattedData: HistoryEntry[] = historyRecords.map(record => ({
      historyId: record.id,
      employeeId: record.employee_id, // Use schema field name
      employeeFullName: record.employee?.full_name ?? 'N/A', // Use schema field name
      assignment_date: record.assignment_date, // Use schema field name
      return_date: record.return_date, // Use schema field name
      // Assuming 'notes' field exists in your AssetAssignmentHistory model schema
      // notes: record.notes, // Uncomment if you have a notes field in AssetAssignmentHistory
      notes: null, // Placeholder if 'notes' doesn't exist in history table
    }));

    // 4. Send the response
    res.status(200).json({
      data: formattedData,
      pagination: {
        currentPage: pageNum,
        totalPages: totalPages,
        totalItems: totalItems,
        limit: limitNum,
      }
    });

  } catch (error) {
    console.error('Failed to fetch asset history:', error);
    // Provide more specific error message if possible in development
    const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
    res.status(500).json({ message: errorMessage });
  } finally {
    await prisma.$disconnect();
  }
}
