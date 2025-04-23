// pages/api/employees/[id].ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

// Define the structure of the data we expect in the PUT request body
type UpdateEmployeeDto = {
  full_name?: string; // Optional fields for update
  position?: string | null;
  contact_info?: string | null;
  // is_active and is_responsible should generally not be updated directly here
  // Use DELETE for deactivation, and potentially a dedicated endpoint for responsibility change
};

// Define the structure of the data we want to return after update/delete
type EmployeeSelectedData = {
  id: number;
  full_name: string;
  position: string | null;
  contact_info: string | null;
  is_active: boolean;
  is_responsible: boolean;
};

type DeactivatedEmployeeData = {
    id: number;
    is_active: boolean;
}

type ApiErrorData = { message: string };

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<EmployeeSelectedData | DeactivatedEmployeeData | ApiErrorData>
) {
  const { id } = req.query;

  // Validate ID
  if (typeof id !== 'string' || isNaN(parseInt(id))) {
    return res.status(400).json({ message: 'Invalid employee ID format.' });
  }
  const employeeId = parseInt(id);

  // --- Handle PUT request to update an employee ---
  if (req.method === 'PUT') {
    try {
      const { full_name, position, contact_info } = req.body as UpdateEmployeeDto;

      // --- Data Validation ---
      const updateData: Prisma.EmployeeUpdateInput = {};
      if (full_name !== undefined) {
          if (!full_name.trim()) return res.status(400).json({ message: 'Full name cannot be empty.' });
          updateData.full_name = full_name;
      }
      if (position !== undefined) { // Allow setting position to null or empty string
          updateData.position = position;
      }
      if (contact_info !== undefined) { // Allow setting contact_info to null or empty string
          // Optional: Add email format validation if contact_info is always an email
          // if (contact_info && !/\S+@\S+\.\S+/.test(contact_info)) {
          //     return res.status(400).json({ message: 'Invalid email format for contact info.' });
          // }
          updateData.contact_info = contact_info;
      }

      // Check if there's anything to update
      if (Object.keys(updateData).length === 0) {
          return res.status(400).json({ message: 'No fields provided for update.' });
      }

      // --- Perform Update ---
      const updatedEmployee = await prisma.employee.update({
        where: { id: employeeId },
        data: updateData,
        select: { // Return updated data in the desired format
          id: true,
          full_name: true,
          position: true,
          contact_info: true,
          is_active: true,
          is_responsible: true,
        },
      });

      res.status(200).json(updatedEmployee);

    } catch (error) {
      console.error(`Failed to update employee ${employeeId}:`, error);
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2025') { // Record to update not found
          return res.status(404).json({ message: `Employee with ID ${employeeId} not found.` });
        }
        if (error.code === 'P2002') { // Unique constraint violation
          // Provide more specific feedback if possible
          const target = error.meta?.target as string[] | undefined;
          const field = target ? target.join(', ') : 'field';
          return res.status(409).json({ message: `Update failed: An employee with this ${field} already exists.` });
        }
      }
      res.status(500).json({ message: 'Internal Server Error' });
    } finally {
      await prisma.$disconnect();
    }
  }
  // --- Handle DELETE request (Logical Delete) ---
  else if (req.method === 'DELETE') {
       try {
            // Check if employee exists before trying to deactivate
            const employeeToDeactivate = await prisma.employee.findUnique({
                where: { id: employeeId },
                select: { is_active: true } // Only need to know if it exists/is active
            });

            if (!employeeToDeactivate) {
                 return res.status(404).json({ message: `Employee with ID ${employeeId} not found.` });
            }
            // Optional: Prevent deactivating already inactive employee?
            // if (!employeeToDeactivate.is_active) {
            //     return res.status(400).json({ message: `Employee with ID ${employeeId} is already inactive.` });
            // }

            // Perform logical delete: set is_active to false
            const deactivatedEmployee = await prisma.employee.update({
                where: { id: employeeId },
                data: {
                    is_active: false,
                    // Ensure deactivated employee is not responsible
                    is_responsible: false,
                },
                 select: { id: true, is_active: true }, // Return minimal confirmation
            });

            // --- Optional: Handle Asset Unassignment ---
            // Find assets currently assigned to this employee
            const assignedAssets = await prisma.assetInstance.findMany({
                where: { current_employee_id: employeeId },
                select: { id: true }
            });

            if (assignedAssets.length > 0) {
                const assetIds = assignedAssets.map(a => a.id);
                // Unassign assets (set back to 'on_stock' or another status)
                await prisma.assetInstance.updateMany({
                    where: { id: { in: assetIds } },
                    data: {
                        current_employee_id: null,
                        status: 'on_stock' // Or 'returned_from_deactivated' etc.
                    }
                });
                // Add records to assignment history indicating return due to deactivation
                const historyRecords = assetIds.map(assetId => ({
                    asset_instance_id: assetId,
                    employee_id: employeeId, // The employee being deactivated
                    assignment_date: new Date(), // This is actually the return date conceptually
                    return_date: new Date(),
                    // notes: "Повернуто у зв'язку з деактивацією співробітника" // Add notes if you have the field
                }));
                 // Find the latest assignment for each asset to update return_date
                 // This is more complex, might be better handled differently or skipped for simplicity
                 // For now, we just unassign the asset instance. History might need manual adjustment or separate logic.
                 console.log(`Unassigned ${assetIds.length} assets from deactivated employee ${employeeId}`);

            }


            res.status(200).json(deactivatedEmployee); // Send back confirmation

       } catch (error) {
            console.error(`Failed to deactivate employee ${employeeId}:`, error);
            // P2025 might occur if the employee is deleted between the findUnique and update calls (race condition)
            if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
                return res.status(404).json({ message: `Employee with ID ${employeeId} not found during deactivation.` });
            }
            res.status(500).json({ message: 'Internal Server Error' });
       } finally {
            await prisma.$disconnect();
       }
  }
  // --- Handle other methods ---
  else {
    if (res) {
        res.setHeader('Allow', ['PUT', 'DELETE']); // Specify allowed methods
        res.status(405).json({ message: `Method ${req.method} Not Allowed` });
    } else {
        console.error('FATAL: Response object is undefined in the final else block for [id] route!');
    }
  }
}
