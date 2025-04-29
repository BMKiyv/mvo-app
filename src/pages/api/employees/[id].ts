// pages/api/employees/[id].ts
import type { NextApiRequest, NextApiResponse } from 'next';
// Додаємо CommissionRole до імпорту
import { PrismaClient, Prisma, CommissionRole } from '@prisma/client';

const prisma = new PrismaClient();

// --- Типи Даних ---

// Тип для відповіді GET (деталі співробітника - додаємо ролі)
type EmployeeDetailsData = {
  id: number;
  full_name: string;
  position: string | null;
  contact_info: string | null;
  is_active: boolean;
  is_responsible: boolean;
  commission_role: CommissionRole; // <--- Додано
  is_head_of_enterprise: boolean; // <--- Додано
  is_chief_accountant: boolean;   // <--- Додано
  created_at: Date;
};

// Тип для відповіді PUT (оновлені дані - додаємо ролі)
type EmployeeUpdateResponseData = {
    id: number;
    full_name: string;
    position: string | null;
    contact_info: string | null;
    is_active: boolean;
    is_responsible: boolean;
    commission_role: CommissionRole; // <--- Додано
    is_head_of_enterprise: boolean; // <--- Додано
    is_chief_accountant: boolean;   // <--- Додано
};

// Тип для відповіді DELETE (підтвердження деактивації)
type EmployeeDeactivateResponseData = {
    id: number;
    is_active: boolean;
};

// Тип для помилки
type ApiErrorData = { message: string; details?: any };

// --- Оновлений тип для NextApiResponse ---
type ApiResponse =
    | EmployeeDetailsData
    | EmployeeUpdateResponseData
    | EmployeeDeactivateResponseData
    | ApiErrorData;

// --- Тип для тіла PUT запиту (додаємо необов'язкові ролі) ---
type UpdateEmployeeDto = {
    full_name?: string;
    position?: string | null;
    contact_info?: string | null;
    commission_role?: CommissionRole;
    is_head_of_enterprise?: boolean;
    is_chief_accountant?: boolean;
    // is_responsible?: boolean; // Можливо, теж треба редагувати?
};


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
        select: { // Додаємо нові поля до select
          id: true, full_name: true, position: true, contact_info: true,
          is_active: true, is_responsible: true, created_at: true,
          commission_role: true, is_head_of_enterprise: true, is_chief_accountant: true,
        },
      });

      if (!employee) {
        if (!res) return console.error("Response object undefined before sending GET 404 error!");
        return res.status(404).json({ message: `Employee with ID ${employeeId} not found.` });
      }

      if (!res) return console.error("Response object undefined before sending GET success response!");
      // Тип відповіді тепер EmployeeDetailsData
      res.status(200).json(employee);

    } catch (error) {
      console.error(`Failed to fetch employee ${employeeId}:`, error);
      if (!res) return console.error("Response object undefined before sending GET error response!");
      res.status(500).json({ message: 'Internal Server Error', details: error instanceof Error ? error.message : String(error) });
    } finally {
      // Disconnect moved
    }
  }
  // --- Handle PUT request (from EditEmployeeModal) ---
  else if (req.method === 'PUT') {
      try {
        // Отримуємо всі можливі поля з тіла запиту
        const {
            full_name,
            position,
            contact_info,
            commission_role,
            is_head_of_enterprise,
            is_chief_accountant
            // is_responsible // Якщо потрібно редагувати
        } = req.body as UpdateEmployeeDto;

        // Використовуємо Prisma.EmployeeUpdateInput для коректної типізації
        const updateData: Prisma.EmployeeUpdateInput = {};

        // Валідація та додавання полів до updateData
        if (full_name !== undefined) {
            if (!full_name.trim()) {
                if (!res) return console.error("Response object undefined before sending PUT validation error!");
                return res.status(400).json({ message: 'ПІБ не може бути порожнім.' });
            }
            updateData.full_name = full_name.trim();
        }
        if (position !== undefined) { updateData.position = position; } // Дозволяємо null
        if (contact_info !== undefined) { updateData.contact_info = contact_info; } // Дозволяємо null

        // Обробка ролі в комісії
        if (commission_role !== undefined) {
             const validRoles = Object.values(CommissionRole);
             if (!validRoles.includes(commission_role)) {
                  if (!res) return console.error("Response object undefined before sending PUT validation error!");
                  return res.status(400).json({ message: `Некоректна роль в комісії.` });
             }
             updateData.commission_role = commission_role;
        }
        // Обробка прапорця голови підприємства
        if (is_head_of_enterprise !== undefined) {
            if (typeof is_head_of_enterprise !== 'boolean') {
                 if (!res) return console.error("Response object undefined before sending PUT validation error!");
                 return res.status(400).json({ message: 'Значення для "Голова підприємства" має бути true або false.' });
            }
            updateData.is_head_of_enterprise = is_head_of_enterprise;
        }
         // Обробка прапорця головного бухгалтера
        if (is_chief_accountant !== undefined) {
             if (typeof is_chief_accountant !== 'boolean') {
                 if (!res) return console.error("Response object undefined before sending PUT validation error!");
                 return res.status(400).json({ message: 'Значення для "Головний бухгалтер" має бути true або false.' });
             }
             updateData.is_chief_accountant = is_chief_accountant;
        }
        // Обробка прапорця відповідальної особи (якщо потрібно)
        // if (is_responsible !== undefined) {
        //     if (typeof is_responsible !== 'boolean') {
        //          if (!res) return console.error("Response object undefined before sending PUT validation error!");
        //          return res.status(400).json({ message: 'Значення для "Відповідальна особа" має бути true або false.' });
        //     }
        //     updateData.is_responsible = is_responsible;
        // }


        // Перевіряємо, чи є що оновлювати
        if (Object.keys(updateData).length === 0) {
             if (!res) return console.error("Response object undefined before sending PUT validation error!");
            return res.status(400).json({ message: 'Не надано полів для оновлення.' });
        }

        // Оновлюємо запис
        const updatedEmployee = await prisma.employee.update({
          where: { id: employeeId },
          data: updateData,
          // Оновлюємо select, щоб повернути всі поля
          select: {
              id: true, full_name: true, position: true, contact_info: true,
              is_active: true, is_responsible: true,
              commission_role: true, is_head_of_enterprise: true, is_chief_accountant: true
            },
        });

        if (!res) return console.error("Response object undefined before sending PUT success response!");
        // Тип відповіді тепер EmployeeUpdateResponseData
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
        res.status(500).json({ message: 'Internal Server Error', details: error instanceof Error ? error.message : String(error) });
      } finally {
        // Disconnect moved
      }
  }
  // --- Handle DELETE request (Logical Delete - ONLY Employee) ---
  else if (req.method === 'DELETE') {
      // ... (код DELETE залишається без змін) ...
       try {
            const employeeToDeactivate = await prisma.employee.findUnique({ where: { id: employeeId }, select: { id: true } });
            if (!employeeToDeactivate) {
                if (!res) return console.error("Response object undefined before sending DELETE 404 error!");
                return res.status(404).json({ message: `Employee with ID ${employeeId} not found.` });
            }
            const deactivatedEmployee = await prisma.employee.update({
                where: { id: employeeId },
                data: { is_active: false, is_responsible: false, },
                 select: { id: true, is_active: true },
            });
            console.log(`Deactivated employee ${employeeId}. Asset processing moved to separate step.`);
            if (!res) return console.error("Response object undefined before sending DELETE success response!");
            res.status(200).json(deactivatedEmployee);
       } catch (error) {
            console.error(`Failed to deactivate employee ${employeeId}:`, error);
             if (!res) return console.error("Response object undefined before sending DELETE error response!");
            if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
                return res.status(404).json({ message: `Employee with ID ${employeeId} not found during deactivation attempt.` });
            }
            res.status(500).json({ message: 'Internal Server Error', details: error instanceof Error ? error.message : String(error) });
       } finally {
            // Disconnect moved
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
