// pages/api/employees/index.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient, Prisma } from '@prisma/client'; // Import Prisma types

const prisma = new PrismaClient();

// Define the structure of the data we want to return (excluding timestamps)
type EmployeeSelectedData = {
  id: number;
  full_name: string;
  position: string | null;
  contact_info: string | null;
  is_active: boolean;
  is_responsible: boolean;
  // created_at and updated_at are omitted for GET list, but might be in created object
};

// Update the API response data type for GET
type GetApiResponseData = Omit<EmployeeSelectedData, 'created_at' | 'updated_at'>[]; // Omitting timestamps for GET list

// Type for POST response (might include timestamps depending on select)
type PostApiResponseData = EmployeeSelectedData; // Assuming select returns this

type ApiErrorData = { message: string; details?: any };

// Combined type for NextApiResponse
type ApiResponse = GetApiResponseData | PostApiResponseData[] | ApiErrorData; // POST returns array

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
        select: {
          id: true, full_name: true, position: true,
          contact_info: true, is_active: true, is_responsible: true,
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
      await prisma.$disconnect();
    }
  } else if (req.method === 'POST') {
      // --- Handle POST ---
      console.log("POST Request Body:", req.body); // Log received body
      try {
          const { full_name, position, contact_info } = req.body;

          // Basic validation
          if (!full_name || typeof full_name !== 'string' || !full_name.trim()) {
               if (!res) { console.error("POST Validation Error: Response object undefined!"); return; }
              return res.status(400).json({ message: 'Full name is required and must be a non-empty string.' });
          }
          // Add more specific validation if needed

          console.log("Attempting to create employee in DB...");
          const newEmployee = await prisma.employee.create({
              data: {
                  full_name: full_name.trim(), // Trim whitespace
                  position: position || null, // Ensure null if empty
                  contact_info: contact_info || null, // Ensure null if empty
                  is_active: true,
                  is_responsible: false,
              },
              // Select the fields needed by the frontend
              select: {
                  id: true,
                  full_name: true,
                  position: true,
                  contact_info: true,
                  is_active: true,
                  is_responsible: true,
                  // Include created_at if needed by EmployeeApiResponse type
                  // created_at: true,
              }
          });
          console.log("Employee created successfully in DB:", newEmployee); // Log success and data

          if (!res) { console.error("POST Success: Response object undefined before sending!"); return; }
          // Send response as an array containing the new employee object
          res.status(201).json([newEmployee]); // Ensure it's an array

      } catch (error) {
           console.error('POST Error: Failed to create employee:', error); // Log the actual error
           if (!res) { console.error("POST Error: Response object undefined!"); return; }

           if (error instanceof Prisma.PrismaClientKnownRequestError) {
               if (error.code === 'P2002') { // Unique constraint violation
                   const target = error.meta?.target ?? 'field';
                   return res.status(409).json({ message: `Employee with this ${target} already exists.` });
               }
           }
           // Provide more details in the error response if possible
           res.status(500).json({ message: 'Internal Server Error', details: error instanceof Error ? error.message : String(error) });
      } finally {
          await prisma.$disconnect();
      }

  } else {
    // Handle other methods
    console.log(`Unsupported method: ${req.method}`);
    if (!res) { console.error("Method Not Allowed: Response object undefined!"); return; }
    res.setHeader('Allow', ['GET', 'POST']);
    res.status(405).json({ message: `Method ${req.method} Not Allowed` });
  }
}
