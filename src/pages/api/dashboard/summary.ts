// pages/api/dashboard/summary.ts
import type { NextApiRequest, NextApiResponse } from 'next';
// Import necessary types from Prisma Client
import {
    PrismaClient,
    Prisma,
    AssetStatus,
    AssetType,
    AssetCategory,
    AssetAssignmentHistory,
    Employee,
    AssetInstance // Import AssetInstance type
} from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

// Use direct instantiation as before
const prisma = new PrismaClient();

// --- Type Definitions ---
type LowStockItem = {
  assetTypeId: number;
  assetTypeName: string;
  categoryName: string;
  minimumStockLevel: number | null;
  currentStock: number;
};

type RecentActivity = {
  activityType: 'assigned' | 'returned' | 'written_off';
  date: Date;
  employeeFullName: string | null;
  assetTypeName: string | null;
  inventoryNumber: string | null;
  assetInstanceId: number;
  keySource: string;
};

type ApiResponseData = {
  lowStockItems: LowStockItem[];
  recentActivities: RecentActivity[];
};

type ApiErrorData = {
  message: string;
  details?: any;
};

// Define types for Prisma relations to help TypeScript (optional but good practice)
type AssetTypeWithCategory = AssetType & {
    category: { name: string } | null;
};

// We won't explicitly type the query results with these anymore,
// but keep them for reference or potential future use.
// type HistoryWithRelations = AssetAssignmentHistory & { ... };
// type WrittenOffInstanceWithRelations = AssetInstance & { ... };


// --- UPDATED Helper Function: Calculates current stock considering write-offs ---
async function getCurrentStock(assetTypeId: number): Promise<number> {
  try {
    const [onStockData, writeOffData] = await Promise.all([
        prisma.assetInstance.aggregate({
            _sum: { quantity: true },
            where: { assetTypeId: assetTypeId, status: AssetStatus.on_stock, },
        }),
        prisma.writeOffLog.aggregate({
            _sum: { quantity: true },
            where: { assetTypeId: assetTypeId, },
        })
    ]);
    const onStockSum = onStockData._sum.quantity ?? 0;
    const writtenOffSum = writeOffData._sum.quantity ?? 0;
    const currentStock = onStockSum - writtenOffSum;
    return Math.max(0, currentStock);
  } catch (error) {
    console.error(`Error calculating current stock for asset type ${assetTypeId}:`, error);
    throw new Error(`Failed to calculate current stock for asset type ${assetTypeId}`);
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
    const assetTypes: AssetTypeWithCategory[] = await prisma.assetType.findMany({
      where: { minimum_stock_level: { gt: 0 }, },
      include: { category: { select: { name: true } }, },
    });

    const lowStockItemsPromises = assetTypes.map(async (type: AssetTypeWithCategory) => {
        const currentStock = await getCurrentStock(type.id);
        if (type.minimum_stock_level !== null && currentStock < type.minimum_stock_level) {
            return { /* ... low stock item object ... */
                assetTypeId: type.id,
                assetTypeName: type.name,
                categoryName: type.category?.name ?? 'N/A',
                minimumStockLevel: type.minimum_stock_level,
                currentStock: currentStock,
             };
        }
        return null;
    });

    const stockResults = await Promise.allSettled(lowStockItemsPromises);
    const lowStockItems: LowStockItem[] = [];
    stockResults.forEach((result: PromiseSettledResult<LowStockItem | null>, index: number) => {
        if (result.status === 'fulfilled' && result.value !== null) {
            lowStockItems.push(result.value);
        } else if (result.status === 'rejected') {
            console.error(`Skipping low stock check for type ${assetTypes[index]?.id}:`, result.reason);
        }
    });


    // --- 2. Fetch Recent Activities ---
    let combinedActivities: RecentActivity[] = [];

    // Fetch recent assignments/returns from history
    // Let TypeScript infer the type from the Prisma query result
    const recentHistory = await prisma.assetAssignmentHistory.findMany({
      take: limitNum * 2,
      orderBy: [ { assignment_date: 'desc' } ],
      include: { // Keep the includes
        employee: { select: { full_name: true } },
        assetInstance: {
          select: { id: true, inventoryNumber: true, assetType: { select: { name: true } }, },
        },
      },
    });

    // Process history into activities
    // TypeScript will infer 'hist' type based on the query above
    recentHistory.forEach((hist) => { // Removed explicit type annotation
        combinedActivities.push({
            activityType: 'assigned',
            date: hist.assignment_date,
            employeeFullName: hist.employee?.full_name ?? null, // Safe access with ?.
            assetTypeName: hist.assetInstance?.assetType?.name ?? null, // Safe access
            inventoryNumber: hist.assetInstance?.inventoryNumber ?? null, // Safe access
            assetInstanceId: hist.asset_instance_id,
            keySource: `assign-${hist.id}`
        });
        if (hist.return_date) {
            combinedActivities.push({
                activityType: 'returned',
                date: hist.return_date,
                employeeFullName: hist.employee?.full_name ?? null, // Safe access
                assetTypeName: hist.assetInstance?.assetType?.name ?? null, // Safe access
                inventoryNumber: hist.assetInstance?.inventoryNumber ?? null, // Safe access
                assetInstanceId: hist.asset_instance_id,
                keySource: `return-${hist.id}`
            });
        }
    });

     // Fetch recent written-off instances
     // Let TypeScript infer the type
     const recentWrittenOff = await prisma.assetInstance.findMany({
        where: { status: AssetStatus.written_off },
        take: limitNum,
        orderBy: { updated_at: 'desc' },
        include: { // Keep the include
             assetType: { select: { name: true } },
        },
     });

     // Process written-off into activities
     // TypeScript will infer 'inst' type
     recentWrittenOff.forEach((inst) => { // Removed explicit type annotation
         if (inst.updated_at) {
             combinedActivities.push({
                activityType: 'written_off',
                date: inst.updated_at,
                employeeFullName: null,
                assetTypeName: inst.assetType?.name ?? null, // Safe access with ?.
                inventoryNumber: inst.inventoryNumber,
                assetInstanceId: inst.id,
                keySource: `writeoff-${inst.id}`
             });
         }
    });

    // Sort combined activities by date and take the final limit
    const sortedActivitiesFinal = combinedActivities
        .sort((a, b) => b.date.getTime() - a.date.getTime())
        .slice(0, limitNum);


    // --- 3. Send Response ---
    if (!res) { throw new Error("Response object is unavailable"); }
    res.status(200).json({ lowStockItems, recentActivities: sortedActivitiesFinal });

  } catch (error) {
    console.error('Failed to fetch dashboard summary:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
    if (res && !res.headersSent) {
        res.status(500).json({ message: errorMessage, details: error instanceof Error ? error.stack : error });
    } else {
        console.error("Response unavailable or headers sent in main error handler.");
    }
  } finally {
    await prisma.$disconnect().catch((e: unknown) => console.error("Failed to disconnect Prisma Client:", e));
  }
}
