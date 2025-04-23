// pages/api/dashboard/summary.ts
import type { NextApiRequest, NextApiResponse } from 'next';
// Import PrismaClient and generated types
import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

// --- Type Definitions (using schema names) ---

type LowStockItem = {
  assetTypeId: number;
  assetTypeName: string;
  categoryName: string;
  minimumStockLevel: number | null; // Use schema field type (Int is non-nullable, use Int?)
  currentStock: number;
};

type RecentActivity = {
  activityType: 'assigned' | 'returned' | 'written_off'; // Keep activity types logical
  date: Date;
  employeeFullName: string | null; // From related Employee
  assetTypeName: string | null;    // From related AssetType
  inventoryNumber: string | null;  // From related AssetInstance
  assetInstanceId: number;
};

type ApiResponseData = {
  lowStockItems: LowStockItem[];
  recentActivities: RecentActivity[];
};

type ApiErrorData = {
  message: string;
};

// --- Helper Function (using schema names) ---

async function getCurrentStock(assetTypeId: number): Promise<number> {
  // Use AssetInstance model and schema fields
  return prisma.assetInstance.count({
    where: {
      assetTypeId: assetTypeId, // Use schema field name
      status: 'on_stock',
    },
  });
}

// --- API Handler (using schema names) ---

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponseData | ApiErrorData>
) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ message: `Method ${req.method} Not Allowed` });
  }

  const { activityLimit = '5' } = req.query;
  const limitNum = parseInt(activityLimit as string);
  if (isNaN(limitNum) || limitNum < 1) {
      return res.status(400).json({ message: 'Invalid activity limit parameter.' });
  }

  try {
    // --- 1. Fetch Low Stock Items (using AssetType model) ---
    const assetTypes = await prisma.assetType.findMany({
      where: {
        // Filter based on the schema field name 'minimum_stock_level'
        minimum_stock_level: {
          // Ensure you only compare if minimum_stock_level is not null if it's optional
          // If it's mandatory (Int), gt: 0 is fine. If optional (Int?), handle null.
           gt: 0, // Assuming minimum_stock_level is mandatory (Int)
        },
      },
      include: {
        // Use relation field name 'category' from AssetType schema
        category: {
          select: { name: true }, // Use schema field name 'name'
        },
      },
    });

    const lowStockItems: LowStockItem[] = [];
    for (const type of assetTypes) {
      const currentStock = await getCurrentStock(type.id);
      // Check against schema field 'minimum_stock_level'
      // Handle null if the field is optional (Int?) in your schema
      if (type.minimum_stock_level !== null && currentStock < type.minimum_stock_level) {
         lowStockItems.push({
           assetTypeId: type.id,
           assetTypeName: type.name, // Use schema field name
           categoryName: type.category?.name ?? 'N/A', // Use relation field 'category'
           minimumStockLevel: type.minimum_stock_level, // Use schema field name
           currentStock: currentStock,
         });
      }
    }

    // --- 2. Fetch Recent Activities (using AssetAssignmentHistory) ---
    const recentHistory = await prisma.assetAssignmentHistory.findMany({
      take: limitNum,
      orderBy: [
          { assignment_date: 'desc' }, // Use schema field name
      ],
      include: {
        employee: { // Use relation field name from AssetAssignmentHistory schema
             select: { full_name: true } // Use schema field name
        },
        assetInstance: { // Use relation field name from AssetAssignmentHistory schema
          select: {
            id: true,
            inventoryNumber: true, // Use schema field name
            assetType: { // Use relation field name from AssetInstance schema
              select: { name: true }, // Use schema field name
            },
          },
        },
      },
    });

     // Fetch recent written-off instances (using AssetInstance)
     const recentWrittenOff = await prisma.assetInstance.findMany({
        where: { status: 'written_off' }, // Use schema field name
        take: limitNum,
        orderBy: { updated_at: 'desc' }, // Use schema field name
        include: {
            assetType: { select: { name: true } }, // Use relation field name
        },
     });

    // Combine and format activities
    const combinedActivities: RecentActivity[] = [];

    recentHistory.forEach(hist => {
        // Assignment Activity
        combinedActivities.push({
            activityType: 'assigned',
            date: hist.assignment_date, // Use schema field name
            employeeFullName: hist.employee?.full_name ?? null, // Use relation and schema field names
            assetTypeName: hist.assetInstance?.assetType?.name ?? null, // Use relations and schema field names
            inventoryNumber: hist.assetInstance?.inventoryNumber ?? null, // Use relation and schema field names
            assetInstanceId: hist.asset_instance_id, // Use schema field name
        });
        // Return Activity
        if (hist.return_date) { // Use schema field name
            combinedActivities.push({
                activityType: 'returned',
                date: hist.return_date, // Use schema field name
                employeeFullName: hist.employee?.full_name ?? null,
                assetTypeName: hist.assetInstance?.assetType?.name ?? null,
                inventoryNumber: hist.assetInstance?.inventoryNumber ?? null,
                assetInstanceId: hist.asset_instance_id,
            });
        }
    });

    recentWrittenOff.forEach(inst => {
         combinedActivities.push({
            activityType: 'written_off',
            date: inst.updated_at!, // Use schema field name, handle potential null if optional
            employeeFullName: null,
            assetTypeName: inst.assetType?.name ?? null, // Use relation and schema field names
            inventoryNumber: inst.inventoryNumber, // Use schema field name
            assetInstanceId: inst.id,
         });
    });

    // Sort combined activities by date and take the limit
    const sortedActivities = combinedActivities
        .sort((a, b) => b.date.getTime() - a.date.getTime())
        .slice(0, limitNum);

    // --- 3. Send Response ---
    res.status(200).json({
      lowStockItems,
      recentActivities: sortedActivities,
    });

  } catch (error) {
    console.error('Failed to fetch dashboard summary:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
    res.status(500).json({ message: errorMessage });
  } finally {
    await prisma.$disconnect();
  }
}
