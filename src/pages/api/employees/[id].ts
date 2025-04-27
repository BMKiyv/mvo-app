// pages/api/employees/[id].ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

// --- Типи Даних ---

// Тип для відповіді GET (деталі співробітника)
type EmployeeDetailsData = {
  id: number;
  full_name: string;
  position: string | null;
  contact_info: string | null;
  is_active: boolean;
  is_responsible: boolean;
  created_at: Date;
};

// Тип для відповіді PUT (оновлені дані, без created_at)
type EmployeeUpdateResponseData = {
    id: number;
    full_name: string;
    position: string | null;
    contact_info: string | null;
    is_active: boolean;
    is_responsible: boolean;
};

// Тип для відповіді DELETE (підтвердження деактивації)
type EmployeeDeactivateResponseData = {
    id: number;
    is_active: boolean;
};

// Тип для помилки
type ApiErrorData = { message: string; details?: any }; // Додано details

// --- Оновлений тип для NextApiResponse ---
type ApiResponse =
    | EmployeeDetailsData
    | EmployeeUpdateResponseData
    | EmployeeDeactivateResponseData
    | ApiErrorData;


export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse>
) {
  const { id } = req.query;

  // Validate ID
  if (typeof id !== 'string' || isNaN(parseInt(id))) {
    if (!res) return console.error("Response object undefined before sending ID validation error!");
    return res.status(400).json({ message: 'Invalid employee ID format.' });
  }
  const employeeId = parseInt(id);

  // --- Handle GET request for employee details ---
  if (req.method === 'GET') {
    try {
      const employee = await prisma.employee.findUnique({
        where: { id: employeeId },
        select: {
          id: true, full_name: true, position: true, contact_info: true,
          is_active: true, is_responsible: true, created_at: true,
        },
      });

      if (!employee) {
        if (!res) return console.error("Response object undefined before sending GET 404 error!");
        return res.status(404).json({ message: `Employee with ID ${employeeId} not found.` });
      }

      if (!res) return console.error("Response object undefined before sending GET success response!");
      res.status(200).json(employee);

    } catch (error) {
      console.error(`Failed to fetch employee ${employeeId}:`, error);
      if (!res) return console.error("Response object undefined before sending GET error response!");
      res.status(500).json({ message: 'Internal Server Error', details: error instanceof Error ? error.message : String(error) }); // Додано details
    } finally {
      // Disconnect moved to the end
    }
  }
  // --- Handle PUT request (from EditEmployeeModal) ---
  else if (req.method === 'PUT') {
      type UpdateEmployeeDto = { full_name?: string; position?: string | null; contact_info?: string | null; };
      try {
        const { full_name, position, contact_info } = req.body as UpdateEmployeeDto;
        const updateData: Prisma.EmployeeUpdateInput = {};
        if (full_name !== undefined) {
            if (!full_name.trim()) {
                if (!res) return console.error("Response object undefined before sending PUT validation error!");
                return res.status(400).json({ message: 'Full name cannot be empty.' });
            }
            updateData.full_name = full_name;
        }
        if (position !== undefined) { updateData.position = position; }
        if (contact_info !== undefined) { updateData.contact_info = contact_info; }

        if (Object.keys(updateData).length === 0) {
             if (!res) return console.error("Response object undefined before sending PUT validation error!");
            return res.status(400).json({ message: 'No fields provided for update.' });
        }

        const updatedEmployee = await prisma.employee.update({
          where: { id: employeeId },
          data: updateData,
          select: { id: true, full_name: true, position: true, contact_info: true, is_active: true, is_responsible: true },
        });

        if (!res) return console.error("Response object undefined before sending PUT success response!");
        res.status(200).json(updatedEmployee);

      } catch (error) {
        console.error(`Failed to update employee ${employeeId}:`, error);
         if (!res) return console.error("Response object undefined before sending PUT error response!");
        if (error instanceof Prisma.PrismaClientKnownRequestError) {
          if (error.code === 'P2025') return res.status(404).json({ message: `Employee with ID ${employeeId} not found.` });
          if (error.code === 'P2002') {
            const target = error.meta?.target as string[] | undefined;
            const field = target ? target.join(', ') : 'field';
            return res.status(409).json({ message: `Update failed: An employee with this ${field} already exists.` });
          }
        }
        res.status(500).json({ message: 'Internal Server Error', details: error instanceof Error ? error.message : String(error) }); // Додано details
      } finally {
        // Disconnect moved to the end
      }
  }
  // --- Handle DELETE request (Logical Delete - ONLY Employee) ---
  else if (req.method === 'DELETE') {
       try {
            // 1. Перевіряємо, чи існує співробітник
            const employeeToDeactivate = await prisma.employee.findUnique({
                where: { id: employeeId },
                select: { id: true } // Достатньо перевірити існування
            });

            if (!employeeToDeactivate) {
                if (!res) return console.error("Response object undefined before sending DELETE 404 error!");
                return res.status(404).json({ message: `Employee with ID ${employeeId} not found.` });
            }

            // 2. Оновлюємо ТІЛЬКИ статус співробітника
            const deactivatedEmployee = await prisma.employee.update({
                where: { id: employeeId },
                data: {
                    is_active: false,
                    is_responsible: false, // Зазвичай, неактивний співробітник не може бути відповідальним
                },
                 select: { id: true, is_active: true }, // Повертаємо підтвердження
            });

            // *** ВИДАЛЕНО ЛОГІКУ ОНОВЛЕННЯ AssetInstance ***
            // const assignedAssets = await prisma.assetInstance.findMany({ where: { current_employee_id: employeeId }, select: { id: true } });
            // if (assignedAssets.length > 0) {
            //     const assetIds = assignedAssets.map(a => a.id);
            //     await prisma.assetInstance.updateMany({
            //         where: { id: { in: assetIds } },
            //         data: { current_employee_id: null, status: 'on_stock' }
            //     });
            //      console.log(`Unassigned ${assetIds.length} assets from deactivated employee ${employeeId}`);
            //      // TODO: Add logic to update/create assignment history records for returned assets
            // }

            console.log(`Deactivated employee ${employeeId}. Asset processing moved to separate step.`);

            if (!res) return console.error("Response object undefined before sending DELETE success response!");
            res.status(200).json(deactivatedEmployee);

       } catch (error) {
            console.error(`Failed to deactivate employee ${employeeId}:`, error);
             if (!res) return console.error("Response object undefined before sending DELETE error response!");
            if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
                // Ця помилка тепер може виникнути, якщо співробітника видалили між findUnique та update
                return res.status(404).json({ message: `Employee with ID ${employeeId} not found during deactivation attempt.` });
            }
            res.status(500).json({ message: 'Internal Server Error', details: error instanceof Error ? error.message : String(error) }); // Додано details
       } finally {
            // Disconnect moved to the end
       }
  }
  // --- Handle other methods ---
  else {
    if (res) {
        res.setHeader('Allow', ['GET', 'PUT', 'DELETE']);
        res.status(405).json({ message: `Method ${req.method} Not Allowed` });
    } else {
        console.error('FATAL: Response object is undefined in the final else block for [id] route!');
    }
  }

   // Disconnect Prisma Client finally after handling request
   if (prisma) {
       await prisma.$disconnect().catch((e: unknown) => console.error("Failed to disconnect Prisma Client:", e));
   }
}
