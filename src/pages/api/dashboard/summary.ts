// pages/api/dashboard/summary.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import {
    PrismaClient,
    Prisma,
    AssetStatus,
    AssetType,
    // AssetCategory, // Not explicitly used in this file's logic after includes
    // AssetAssignmentHistory, // Type inferred from Prisma result
    // Employee, // Type inferred from Prisma result
    // AssetInstance, // Type inferred from Prisma result
    // WriteOffLog // Type inferred from Prisma result
} from '@prisma/client';

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
    // Ensure this ID makes sense for write-off context. It's the ID of the instance that was written off.
    assetInstanceId: number | null; // Make nullable, as WriteOffLog might not always have it? Check schema. Assuming it does.
    keySource: string; // Unique key for React list rendering
};

type ApiResponseData = {
    lowStockItems: LowStockItem[];
    recentActivities: RecentActivity[];
};

type ApiErrorData = {
    message: string;
    details?: any;
};

// Define type for Prisma relation to help TypeScript (optional but good practice)
type AssetTypeWithCategory = AssetType & {
    category: { name: string } | null;
};

// --- CORRECTED Helper Function: Calculates current stock ---
async function getCurrentStock(assetTypeId: number): Promise<number> {
    try {
        const stockData = await prisma.assetInstance.aggregate({
            _sum: { quantity: true },
            where: {
                assetTypeId: assetTypeId,
                status: AssetStatus.on_stock,
            },
        });
        // CORRECTION 1: Remove .toNumber() if Prisma returns number directly (e.g., for Int/Float fields)
        // If quantity is Decimal, .toNumber() is needed. If it's Int/Float, it's already number.
        // Assuming it's Int/Float based on the TS error. If it's Decimal, restore .toNumber().
        const currentStock = stockData._sum.quantity ?? 0;
        return currentStock;
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
    const limitNum = parseInt(activityLimit as string, 10);
    if (isNaN(limitNum) || limitNum < 1 || limitNum > 50) {
        return res.status(400).json({ message: 'Invalid activity limit parameter (must be 1-50).' });
    }

    try {
        // --- 1. Fetch Low Stock Items ---
        const assetTypes: AssetTypeWithCategory[] = await prisma.assetType.findMany({
            where: {
                minimum_stock_level: { gt: 0 },
            },
            include: { category: { select: { name: true } } },
        });

        const lowStockItemsPromises = assetTypes.map(async (type) => {
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

        const stockResults = await Promise.allSettled(lowStockItemsPromises);
        const lowStockItems: LowStockItem[] = [];
        stockResults.forEach((result, index) => {
            if (result.status === 'fulfilled' && result.value !== null) {
                lowStockItems.push(result.value);
            } else if (result.status === 'rejected') {
                console.error(`Skipping low stock check for type ${assetTypes[index]?.id}:`, result.reason);
            }
        });


        // --- 2. Fetch Recent Activities ---
        let combinedActivities: RecentActivity[] = [];

        // Fetch recent assignments/returns from AssetAssignmentHistory
        const recentHistory = await prisma.assetAssignmentHistory.findMany({
            take: limitNum * 2,
            orderBy: [ { assignment_date: 'desc' } ],
            include: {
                employee: { select: { full_name: true } },
                assetInstance: {
                    select: { id: true, inventoryNumber: true, assetType: { select: { name: true } } },
                },
            },
        });

        // Process history into activities
        recentHistory.forEach((hist) => {
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

        // *** CORRECTED PART: Fetch recent write-offs from WriteOffLog ***
        // CORRECTION 2: Use camelCase for field name in orderBy
        const recentWriteOffLogs = await prisma.writeOffLog.findMany({
            take: limitNum,
            orderBy: { writeOffDate: 'desc' }, // Use camelCase: writeOffDate
            include: {
                // Assuming the relation in WriteOffLog model is named 'assetInstance'
                assetInstance: {
                    select: {
                        id: true,
                        inventoryNumber: true,
                        assetType: {
                            select: {
                                name: true
                            }
                        }
                    }
                }
                // Include other relations if needed (e.g., responsibleEmployee)
            }
        });

        // Process WriteOffLog entries into activities
        recentWriteOffLogs.forEach((log) => {
             // CORRECTION 3, 5, 6: Use optional chaining for potentially missing relation data
             // CORRECTION 4: Use camelCase for date field
             // CORRECTION 7: Use camelCase for assetInstanceId field
            combinedActivities.push({
                activityType: 'written_off',
                date: log.writeOffDate, // Use camelCase: writeOffDate
                employeeFullName: null, // Keep null as before
                // Use optional chaining in case assetInstance relation data is missing
                assetTypeName: log.assetInstance?.assetType?.name ?? 'N/A',
                inventoryNumber: log.assetInstance?.inventoryNumber ?? 'N/A',
                // Use camelCase: assetInstanceId. Ensure it's correctly typed (number | null)
                assetInstanceId: log.assetInstanceId,
                keySource: `writeofflog-${log.id}`
            });
            // The explicit 'if (log.assetInstance)' check is removed; optional chaining handles it.
            // Log if crucial data is missing after fetch, potentially indicating schema/data issue
            if (!log.assetInstanceId || !log.assetInstance) {
                 console.warn(`WriteOffLog entry ${log.id} might be missing assetInstanceId or related assetInstance data.`);
            }
        });

        // Sort *all* combined activities by date and take the final limit
        const sortedActivitiesFinal = combinedActivities
            .sort((a, b) => b.date.getTime() - a.date.getTime())
            .slice(0, limitNum);


        // --- 3. Send Response ---
        res.status(200).json({ lowStockItems, recentActivities: sortedActivitiesFinal });

    } catch (error) {
        console.error('Failed to fetch dashboard summary:', error);
        const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
        if (!res.headersSent) {
            res.status(500).json({ message: errorMessage, details: error instanceof Error ? error.stack : error });
        }
    } finally {
        await prisma.$disconnect().catch((e) => console.error("Failed to disconnect Prisma Client:", e));
    }
}