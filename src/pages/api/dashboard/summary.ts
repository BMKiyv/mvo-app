// pages/api/dashboard/summary.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient, Prisma, AssetStatus } from '@prisma/client'; // Import AssetStatus if using Enum

const prisma = new PrismaClient();

// --- Type Definitions ---
type LowStockItem = {
  assetTypeId: number;
  assetTypeName: string;
  categoryName: string;
  minimumStockLevel: number | null;
  currentStock: number; // This will now be the SUM of quantities
};

type RecentActivity = {
  type: 'assigned' | 'returned' | 'written_off';
  date: Date;
  employeeFullName: string | null;
  assetTypeName: string | null;
  inventoryNumber: string | null;
  assetInstanceId: number;
  keySource: string; // Unique key for React list
};

type ApiResponseData = {
  lowStockItems: LowStockItem[];
  recentActivities: RecentActivity[];
};

type ApiErrorData = {
  message: string;
  details?: any;
};

// --- UPDATED Helper Function: Calculates SUM of quantity ---
async function getCurrentStock(assetTypeId: number): Promise<number> {
  try {
    // Use aggregate to SUM the quantity field
    const stockData = await prisma.assetInstance.aggregate({
      _sum: {
        quantity: true, // Calculate the sum of the 'quantity' field
      },
      where: {
        assetTypeId: assetTypeId,
        status: AssetStatus.on_stock, // Use Enum value 'on_stock'
      },
    });
    // Return the sum, or 0 if the sum is null (meaning no items on stock)
    return stockData._sum.quantity ?? 0;
  } catch (error) {
    console.error(`Error calculating stock sum for asset type ${assetTypeId}:`, error);
    // Re-throw the error to be caught by the main handler
    throw new Error(`Failed to calculate stock sum for asset type ${assetTypeId}`);
  }
}

// --- API Handler ---
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponseData | ApiErrorData>
) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ message: `Method ${req.method} Not Allowed` });
  }

  const { activityLimit = '7' } = req.query;
  const limitNum = parseInt(activityLimit as string);
  if (isNaN(limitNum) || limitNum < 1 || limitNum > 50) {
      return res.status(400).json({ message: 'Invalid activity limit parameter (must be 1-50).' });
  }

  try {
    // --- 1. Fetch Low Stock Items ---
    const assetTypes = await prisma.assetType.findMany({
      where: {
        minimum_stock_level: { gt: 0 },
      },
      include: {
        category: { select: { name: true } },
      },
    });

    // Use Promise.all to fetch stock counts concurrently
    const lowStockItemsPromises = assetTypes.map(async (type) => {
      try {
          // Call the UPDATED getCurrentStock function
          const currentStock = await getCurrentStock(type.id);
          if (type.minimum_stock_level !== null && currentStock < type.minimum_stock_level) {
              return {
                  assetTypeId: type.id,
                  assetTypeName: type.name,
                  categoryName: type.category?.name ?? 'N/A',
                  minimumStockLevel: type.minimum_stock_level,
                  currentStock: currentStock, // This is now the SUM
              };
          }
          return null;
      } catch (error) {
           console.error(`Skipping low stock check for type ${type.id} due to error:`, error);
           return null; // Skip this type if stock calculation failed
      }
    });

    const lowStockItems = (await Promise.all(lowStockItemsPromises)).filter(item => item !== null) as LowStockItem[];


    // --- 2. Fetch Recent Activities ---
    let combinedActivities: RecentActivity[] = [];

    // Fetch recent assignments/returns from history
    const recentHistory = await prisma.assetAssignmentHistory.findMany({
      // Fetch a bit more initially as returns create separate entries conceptually
      take: limitNum * 2, // Adjust multiplier as needed
      orderBy: [ { assignment_date: 'desc' } ], // Order by assignment first
      include: {
        employee: { select: { full_name: true } },
        assetInstance: {
          select: {
            id: true, inventoryNumber: true,
            assetType: { select: { name: true } },
          },
        },
      },
    });

    // Process history into activities
    recentHistory.forEach(hist => {
        // Add assignment activity
        combinedActivities.push({
            type: 'assigned',
            date: hist.assignment_date,
            employeeFullName: hist.employee?.full_name ?? null,
            assetTypeName: hist.assetInstance?.assetType?.name ?? null,
            inventoryNumber: hist.assetInstance?.inventoryNumber ?? null,
            assetInstanceId: hist.asset_instance_id,
            keySource: `assign-${hist.id}`
        });
        // Add return activity if applicable
        if (hist.return_date) {
            combinedActivities.push({
                type: 'returned',
                date: hist.return_date,
                employeeFullName: hist.employee?.full_name ?? null,
                assetTypeName: hist.assetInstance?.assetType?.name ?? null,
                inventoryNumber: hist.assetInstance?.inventoryNumber ?? null,
                assetInstanceId: hist.asset_instance_id,
                keySource: `return-${hist.id}`
            });
        }
    });

     // Fetch recent written-off instances
     const recentWrittenOff = await prisma.assetInstance.findMany({
        where: { status: AssetStatus.written_off }, // Use Enum
        take: limitNum,
        orderBy: { updated_at: 'desc' },
        include: {
            assetType: { select: { name: true } },
        },
     });

     // Process written-off into activities
     recentWrittenOff.forEach(inst => {
         if (inst.updated_at) {
             combinedActivities.push({
                type: 'written_off',
                date: inst.updated_at,
                employeeFullName: null,
                assetTypeName: inst.assetType?.name ?? null,
                inventoryNumber: inst.inventoryNumber,
                assetInstanceId: inst.id,
                keySource: `writeoff-${inst.id}`
             });
         }
    });

    // Sort combined activities by date and take the final limit
    const sortedActivities = combinedActivities
        .sort((a, b) => b.date.getTime() - a.date.getTime())
        .slice(0, limitNum);


    // --- 3. Send Response ---
    if (!res) {
        console.error("Response object became undefined before sending summary response!");
        throw new Error("Response object is unavailable");
    }
    res.status(200).json({
      lowStockItems,
      recentActivities: sortedActivities,
    });

  } catch (error) {
    console.error('Failed to fetch dashboard summary:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
    if (res) {
        res.status(500).json({ message: errorMessage, details: error instanceof Error ? error.stack : error });
    } else {
        console.error("Response object became undefined before sending summary error response!");
    }
  } finally {
    await prisma.$disconnect().catch(e => console.error("Failed to disconnect Prisma Client:", e));
  }
}
