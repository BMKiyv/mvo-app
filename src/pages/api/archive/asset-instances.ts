// pages/api/archive/asset-instances.ts
// (Consider renaming to /api/archive/write-off-log.ts for clarity)

import type { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient, WriteOffLog, AssetInstance, AssetType, Employee, Prisma } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

const prisma = new PrismaClient();

// --- Define the structure for the response item ---

type IncludedEmployeeName = Pick<Employee, 'full_name'> | null;

type CommissionMembershipWithEmployee = {
    employee: { full_name: string | null } | null;
};

// Type for the main data structure returned by the API
type ArchivedWriteOffLogData = Pick<
    WriteOffLog,
    | 'id'
    | 'writeOffDate'
    | 'quantity'
    | 'unitCostAtWriteOff'
    | 'totalValueAtWriteOff' // This is the source for "Вартість"
    // 'reason' // We map this to displayNotes below
    | 'writeOffDocumentNumber'
    | 'operationType'
    // | 'notes' // We map this to logNotes below
> & {
    assetInstance: {
        inventoryNumber: string | null; // Source for "Інв. №", added fallback
    } | null;
    assetType: {
        name: string | null;
        unit_of_measure: string | null;
    } | null;
    displayNotes: string | null; // Field for frontend "Примітки", mapped from log.reason
    logNotes: string | null; // Original log.notes field, if needed separately
    responsibleEmployeeName: string | null;
    commissionChairName: string | null;
    headOfEnterpriseSignatoryName: string | null;
    chiefAccountantSignatoryName: string | null;
    commissionMemberNames: string[];
};

// Type for successful API response
type ApiResponseData = ArchivedWriteOffLogData[];

// Type for error response
type ApiErrorData = {
    message: string;
    details?: any;
};


export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse<ApiResponseData | ApiErrorData>
) {
    if (req.method !== 'GET') {
        res.setHeader('Allow', ['GET']);
        if (!res.headersSent) {
            return res.status(405).json({ message: `Method ${req.method} Not Allowed` });
        }
        await prisma.$disconnect().catch(e => console.error("Failed to disconnect Prisma Client:", e));
        return;
    }

    try {
        const writeOffLogs = await prisma.writeOffLog.findMany({
            orderBy: {
                writeOffDate: 'desc',
            },
            include: {
                assetInstance: {
                    select: { inventoryNumber: true } // Ensure inventoryNumber is selected
                },
                assetType: {
                    select: { name: true, unit_of_measure: true }
                },
                responsibleEmployee: { select: { full_name: true } },
                commissionChair: { select: { full_name: true } },
                headOfEnterpriseSignatory: { select: { full_name: true } },
                chiefAccountantSignatory: { select: { full_name: true } },
                commissionMemberships: { // Ensure relation name is correct
                    include: {
                        employee: { select: { full_name: true } }
                    }
                }
            }
        });

        // --- Map Prisma result to the desired API response structure ---
        const responseData: ApiResponseData = writeOffLogs.map(log => {
            const commissionMemberNames = (log.commissionMemberships || [])
                .map((member: CommissionMembershipWithEmployee) => member.employee?.full_name)
                .filter((name): name is string => !!name); // Simpler non-null check

            // Handle potential null for inventoryNumber explicitly
            const inventoryNumber = log.assetInstance?.inventoryNumber ?? null; // Get number or null

            return {
                id: log.id,
                writeOffDate: log.writeOffDate,
                quantity: log.quantity,
                unitCostAtWriteOff: log.unitCostAtWriteOff,
                totalValueAtWriteOff: log.totalValueAtWriteOff, // Source for "Вартість"
                writeOffDocumentNumber: log.writeOffDocumentNumber,
                operationType: log.operationType,

                // UPDATED MAPPING for Inventory Number: Return the number or null
                assetInstance: {
                     inventoryNumber: inventoryNumber
                },
                assetType: log.assetType ? { name: log.assetType.name, unit_of_measure: log.assetType.unit_of_measure } : null,

                // UPDATED MAPPING for Notes:
                displayNotes: log.reason, // Map log.reason to displayNotes (for "Примітки")
                logNotes: log.notes, // Keep original log.notes available

                responsibleEmployeeName: log.responsibleEmployee?.full_name ?? null,
                commissionChairName: log.commissionChair?.full_name ?? null,
                headOfEnterpriseSignatoryName: log.headOfEnterpriseSignatory?.full_name ?? null,
                chiefAccountantSignatoryName: log.chiefAccountantSignatory?.full_name ?? null,
                commissionMemberNames: commissionMemberNames,
            };
        });


        if (!res.headersSent) {
            return res.status(200).json(responseData);
        }

    } catch (error) {
        console.error('Failed to fetch write-off log entries:', error);
        if (!res.headersSent) {
            return res.status(500).json({
                message: 'Internal Server Error fetching write-off log entries',
                details: error instanceof Error ? error.message : String(error),
            });
        } else {
            console.error("Response headers already sent in write-off log error handler.");
        }
    } finally {
        await prisma.$disconnect().catch(e => console.error("Failed to disconnect Prisma Client:", e));
    }
}