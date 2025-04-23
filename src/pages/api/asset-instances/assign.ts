// pages/api/asset-instances/assign.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient, Prisma, AssetStatus } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

const prisma = new PrismaClient();

// Define expected request body
type AssignAssetDto = {
  employeeId: number;
  instanceId: number;
};

// Define expected success response data
type AssignedInstanceData = {
    id: number;
    assetTypeId: number;
    inventoryNumber: string;
    unit_cost: string;
    purchase_date: Date;
    status: AssetStatus;
    notes: string | null;
    quantity: number;
    created_at: Date;
    updated_at: Date | null;
    current_employee_id: number | null;
    assetTypeName?: string;
};

type ApiErrorData = { message: string; details?: any };

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<AssignedInstanceData | ApiErrorData>
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ message: `Method ${req.method} Not Allowed` });
  }

  const { employeeId, instanceId } = req.body as AssignAssetDto;

  // --- Input Validation ---
  if (typeof employeeId !== 'number' || typeof instanceId !== 'number') {
    return res.status(400).json({ message: 'Invalid input: employeeId and instanceId must be numbers.' });
  }

  try {
    // --- Check Employee ---
    const employee = await prisma.employee.findUnique({
      where: { id: employeeId, is_active: true },
    });
    if (!employee) {
      return res.status(404).json({ message: `Active employee with ID ${employeeId} not found.` });
    }

    // --- Get Source Instance ---
    const sourceInstance = await prisma.assetInstance.findUnique({
      where: { id: instanceId },
    });

    // --- Validate Source Instance ---
    if (!sourceInstance) {
      return res.status(404).json({ message: `Asset instance with ID ${instanceId} not found.` });
    }
    if (sourceInstance.status !== AssetStatus.on_stock) {
      return res.status(400).json({ message: `Asset instance ${instanceId} is not on stock (status: ${sourceInstance.status}).` });
    }
    if (sourceInstance.quantity < 1) {
       return res.status(400).json({ message: `Asset instance ${instanceId} has insufficient quantity (${sourceInstance.quantity}).` });
    }

    // --- Assignment Logic (Transaction Recommended) ---
    let assignedInstanceData: AssignedInstanceData | null = null;

    if (sourceInstance.quantity === 1) {
      // --- Case 1: Assigning the only unit ---
      console.log(`Assigning single unit instance ${instanceId} to employee ${employeeId}`);
      const [updatedInstance, _history] = await prisma.$transaction([
          // 1. Update the instance
          prisma.assetInstance.update({
            where: { id: instanceId },
            data: {
              status: AssetStatus.issued,
              current_employee_id: employeeId,
            },
            include: { assetType: { select: { name: true } } } // Include type for response
          }),
          // 2. Create history record
          prisma.assetAssignmentHistory.create({
            data: {
              asset_instance_id: instanceId, // Use the ID of the instance being updated
              employee_id: employeeId,
              assignment_date: new Date(),
            },
          })
      ]);
      console.log(`Created history for single unit assignment: instance ${updatedInstance.id}`);

      assignedInstanceData = {
          ...updatedInstance,
          unit_cost: updatedInstance.unit_cost.toString(),
          assetTypeName: updatedInstance.assetType?.name
      };

    } else {
      // --- Case 2: Assigning one unit from a batch (quantity > 1) ---
       console.log(`Assigning 1 unit from batch instance ${instanceId} (qty: ${sourceInstance.quantity}) to employee ${employeeId}`);
      // Use transaction to ensure both operations succeed or fail together
      const newIssuedInstance = await prisma.$transaction(async (tx) => {
        // 1. Decrement quantity of the source batch instance
        const updatedSourceInstance = await tx.assetInstance.update({
          where: { id: instanceId },
          data: {
            quantity: { decrement: 1 },
          },
        });
         console.log(`Decremented source instance ${instanceId} quantity to ${updatedSourceInstance.quantity}`);

        // 2. Create a new instance record for the assigned unit
        // Prisma should automatically handle the ID generation here
        const createdInstance = await tx.assetInstance.create({
          data: {
            // DO NOT provide an 'id' field here
            assetTypeId: sourceInstance.assetTypeId,
            inventoryNumber: sourceInstance.inventoryNumber, // Or generate new if needed
            unit_cost: sourceInstance.unit_cost,
            purchase_date: sourceInstance.purchase_date,
            notes: sourceInstance.notes ? `${sourceInstance.notes} (Видано з партії ID: ${sourceInstance.id})` : `Видано з партії ID: ${sourceInstance.id}`,
            quantity: 1, // New instance has quantity 1
            status: AssetStatus.issued,
            current_employee_id: employeeId,
          },
           include: { assetType: { select: { name: true } } } // Include type for response
        });
         console.log(`Created new issued instance ${createdInstance.id} for employee ${employeeId}`);

        // 3. Create history record for the *new* instance
        await tx.assetAssignmentHistory.create({
          data: {
            asset_instance_id: createdInstance.id, // Link history to the new instance's ID
            employee_id: employeeId,
            assignment_date: new Date(),
          },
        });
         console.log(`Created history for new instance assignment: instance ${createdInstance.id}`);

        return createdInstance; // Return the newly created instance
      });

      assignedInstanceData = {
          ...newIssuedInstance,
          unit_cost: newIssuedInstance.unit_cost.toString(),
          assetTypeName: newIssuedInstance.assetType?.name
      };
    }

    // --- Send Success Response ---
     if (!assignedInstanceData) {
         throw new Error("Failed to determine assigned instance data after transaction.");
     }
    res.status(200).json(assignedInstanceData);

  } catch (error) {
    console.error('Failed to assign asset:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
    // Check if headers have already been sent before sending error response
    if (!res.headersSent) {
        res.status(500).json({ message: errorMessage, details: error instanceof Error ? error.stack : error });
    } else {
        console.error("Headers already sent, cannot send error response.");
    }
  } finally {
    // Ensure disconnect happens even if response failed
    await prisma.$disconnect().catch(e => console.error("Failed to disconnect Prisma Client:", e));
  }
}
