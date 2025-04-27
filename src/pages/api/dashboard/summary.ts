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

// Define types for Prisma relations to help TypeScript
type AssetTypeWithCategory = AssetType & {
    category: { name: string } | null;
};

type HistoryWithRelations = AssetAssignmentHistory & {
    employee: { full_name: string } | null;
    assetInstance: {
        id: number;
        inventoryNumber: string;
        assetType: { name: string } | null;
    } | null; // assetInstance relation might be null if deleted concurrently
};

type WrittenOffInstanceWithRelations = AssetInstance & {
    assetType: { name: string } | null;
};


// --- UPDATED Helper Function: Calculates SUM of quantity ---
async function getCurrentStock(assetTypeId: number): Promise<number> {
  try {
    const stockData = await prisma.assetInstance.aggregate({
      _sum: { quantity: true },
      where: {
        assetTypeId: assetTypeId,
        status: AssetStatus.on_stock,
      },
    });
    return stockData._sum.quantity ?? 0;
  } catch (error) {
    console.error(`Error calculating stock sum for asset type ${assetTypeId}:`, error);
    throw new Error(`Failed to calculate stock sum for asset type ${assetTypeId}`);
  }
}

// --- API Handler ---
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponseData | ApiErrorData>
) {
  // console.log("--- DASHBOARD SUMMARY API START ---");
  // console.log("DATABASE_URL at handler start:", process.env.DATABASE_URL);

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
      where: {
        minimum_stock_level: { gt: 0 },
      },
      include: {
        category: { select: { name: true } },
      },
    });

    const lowStockItemsPromises = assetTypes.map(async (type: AssetTypeWithCategory) => { // Add type annotation
        const currentStock = await getCurrentStock(type.id);
        if (type.minimum_stock_level !== null && currentStock < type.minimum_stock_level) {
            return {
                assetTypeId: type.id,
                assetTypeName: type.name,
                categoryName: type.category?.name ?? 'N/A',
                minimumStockLevel: type.minimum_stock_level,
                currentStock: currentStock,
            };
        }
        return null;
    });

    // Specify type for PromiseSettledResult if needed, though inference might work
    const stockResults = await Promise.allSettled(lowStockItemsPromises);
    const lowStockItems: LowStockItem[] = [];
    // Add explicit types for result and index
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
    const recentHistory: HistoryWithRelations[] = await prisma.assetAssignmentHistory.findMany({
      take: limitNum * 2,
      orderBy: [ { assignment_date: 'desc' } ],
      include: {
        employee: { select: { full_name: true } },
        assetInstance: {
          select: { id: true, inventoryNumber: true, assetType: { select: { name: true } }, },
        },
      },
    });

    // Process history into activities - Add type annotation for hist
    recentHistory.forEach((hist: HistoryWithRelations) => {
        combinedActivities.push({
            activityType: 'assigned',
            date: hist.assignment_date,
            employeeFullName: hist.employee?.full_name ?? null,
            assetTypeName: hist.assetInstance?.assetType?.name ?? null,
            inventoryNumber: hist.assetInstance?.inventoryNumber ?? null,
            assetInstanceId: hist.asset_instance_id,
            keySource: `assign-${hist.id}`
        });
        if (hist.return_date) {
            combinedActivities.push({
                activityType: 'returned',
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
     const recentWrittenOff: WrittenOffInstanceWithRelations[] = await prisma.assetInstance.findMany({
        where: { status: AssetStatus.written_off },
        take: limitNum,
        orderBy: { updated_at: 'desc' },
        include: { assetType: { select: { name: true } }, },
     });

     // Process written-off into activities - Add type annotation for inst
     recentWrittenOff.forEach((inst: WrittenOffInstanceWithRelations) => {
         if (inst.updated_at) {
             combinedActivities.push({
                activityType: 'written_off',
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
    if (!res) { throw new Error("Response object is unavailable"); }
    res.status(200).json({ lowStockItems, recentActivities: sortedActivities });

  } catch (error) {
    console.error('Failed to fetch dashboard summary:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
    if (res && !res.headersSent) {
        res.status(500).json({ message: errorMessage, details: error instanceof Error ? error.stack : error });
    } else {
        console.error("Response unavailable or headers sent in main error handler.");
    }
  } finally {
    // Add explicit type for error in catch block
    await prisma.$disconnect().catch((e: unknown) => console.error("Failed to disconnect Prisma Client:", e));
  }
}
