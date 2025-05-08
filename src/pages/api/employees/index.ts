// pages/api/employees/index.ts
import type { NextApiRequest, NextApiResponse } from 'next';
// Імпортуємо Enum CommissionRole разом з іншими типами
import { PrismaClient, Prisma, CommissionRole, Employee } from '@prisma/client';

const prisma = new PrismaClient();

// --- Типи Даних ---

// Тип для відповіді GET та POST (тепер включає commission_role)
type EmployeeSelectedData = {
  id: number;
  full_name: string;
  position: string | null;
  contact_info: string | null;
  is_active: boolean;
  is_responsible: boolean;
  commission_role: CommissionRole; // Додано поле
  is_head_of_enterprise?: Boolean;
  is_chief_accountant?: Boolean;
};

// Тип для відповіді GET (список)
type GetApiResponseData = EmployeeSelectedData[];

// Тип для відповіді POST (один створений об'єкт)
// Оскільки POST повертає масив з одним елементом, визначимо його так
type PostApiResponseData = EmployeeSelectedData[];

// Тип для тіла POST запиту (включає необов'язкову роль)
type CreateEmployeeDto = {
  full_name: string;
  position?: string | null;
  contact_info?: string | null;
  commission_role?: CommissionRole; // Необов'язкове поле
};

type ApiErrorData = { message: string; details?: any };

// Об'єднаний тип відповіді
type ApiResponse = GetApiResponseData | PostApiResponseData | ApiErrorData;

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse>
) {
  console.log(`API Route /api/employees - Method: ${req.method}`);

  if (req.method === 'GET') {
    // --- Handle GET ---
    try {
      const employees = await prisma.employee.findMany({
        where: { is_active: true },
        select: { // Додаємо commission_role до select
          id: true, full_name: true, position: true,
          contact_info: true, is_active: true, is_responsible: true,
          commission_role: true, // <--- Додано
          is_head_of_enterprise:true, is_chief_accountant:true
        },
        orderBy: { full_name: 'asc' },
      });
      if (!res) { console.error("GET: Response object undefined before sending!"); return; }
      res.status(200).json(employees);
    } catch (error) {
      console.error('GET Error: Failed to fetch employees:', error);
      if (!res) { console.error("GET Error: Response object undefined!"); return; }
      res.status(500).json({ message: 'Internal Server Error' });
    } finally {
      // Disconnect moved
    }
  } else if (req.method === 'POST') {
      // --- Handle POST ---
      console.log("POST Request Body:", req.body);
      try {
          // Отримуємо commission_role з тіла запиту
          const { full_name, position, contact_info, commission_role } = req.body as CreateEmployeeDto;

          // --- Валідація ---
          if (!full_name || typeof full_name !== 'string' || !full_name.trim()) {
               if (!res) { console.error("POST Validation Error: Response object undefined!"); return; }
              return res.status(400).json({ message: 'Full name is required and must be a non-empty string.' });
          }
          // Валідація commission_role (чи є воно одним із значень Enum?)
          const validRoles = Object.values(CommissionRole);
          if (commission_role && !validRoles.includes(commission_role)) {
               if (!res) { console.error("POST Validation Error: Response object undefined!"); return; }
               return res.status(400).json({ message: `Invalid commission role provided. Valid roles are: ${validRoles.join(', ')}` });
          }

          console.log("Attempting to create employee in DB...");
          const newEmployee = await prisma.employee.create({
              data: {
                  full_name: full_name.trim(),
                  position: position || null,
                  contact_info: contact_info || null,
                  is_active: true,
                  is_responsible: false,
                  // Встановлюємо роль або значення за замовчуванням (none)
                  commission_role: commission_role || CommissionRole.none, // <--- Додано поле
              },
              // Select включає нове поле
              select: {
                  id: true,
                  full_name: true,
                  position: true,
                  contact_info: true,
                  is_active: true,
                  is_responsible: true,
                  commission_role: true, // <--- Додано
              }
          });
          console.log("Employee created successfully in DB:", newEmployee);

          if (!res) { console.error("POST Success: Response object undefined before sending!"); return; }
          // Повертаємо масив з одним елементом
          res.status(201).json([newEmployee]);

      } catch (error) {
           console.error('POST Error: Failed to create employee:', error);
           if (!res) { console.error("POST Error: Response object undefined!"); return; }

           if (error instanceof Prisma.PrismaClientKnownRequestError) {
               if (error.code === 'P2002') {
                   const target = error.meta?.target ?? 'field';
                   return res.status(409).json({ message: `Employee with this ${target} already exists.` });
               }
           }
           res.status(500).json({ message: 'Internal Server Error', details: error instanceof Error ? error.message : String(error) });
      } finally {
          // Disconnect moved
      }

  } else {
    // Handle other methods
    console.log(`Unsupported method: ${req.method}`);
    if (!res) { console.error("Method Not Allowed: Response object undefined!"); return; }
    res.setHeader('Allow', ['GET', 'POST']);
    res.status(405).json({ message: `Method ${req.method} Not Allowed` });
  }

  // Disconnect Prisma Client finally after handling request
  if (prisma) {
      await prisma.$disconnect().catch((e: unknown) => console.error("Failed to disconnect Prisma Client:", e));
  }
}
