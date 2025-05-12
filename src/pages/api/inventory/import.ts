// /pages/api/inventory/import.ts

import type { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient, Prisma, AssetStatus, AssetType, AssetCategory, AssetInstance } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

const prisma = new PrismaClient();

// --- Типи Даних ---

interface AssetImportRow {
    rowIndex: number;
    assetTypeName: string | null | undefined;
    categoryName: string | null | undefined;
    unitOfMeasure: string | null | undefined;
    minimumStockLevel?: number | string | null | undefined;
    inventoryNumber: string | number | null | undefined; // Дозволяємо number з Excel
    quantity: number | string | null | undefined;
    unitCost: number | string | null | undefined;
    purchaseDate: string | Date | null | undefined;
    instanceNotes?: string | null | undefined;
}

interface SuccessResponse {
    message: string;
    importedCount: number;
}

interface ErrorResponse {
    message: string;
    error?: any;
    rowIndex?: number;
    fieldName?: string;
}

// --- Функція Валідації ---
async function validateImportData(data: AssetImportRow[]): Promise<{ isValid: boolean; error?: string; rowIndex?: number; fieldName?: string }> {
    if (!Array.isArray(data) || data.length === 0) {
        return { isValid: false, error: 'No data received or data is not an array.' };
    }

    const existingTypeNames = new Set<string>();

    for (const [index, row] of data.entries()) {
        const rowIndex = row.rowIndex ?? (index + 1);

        // --- Перевірка наявності обов'язкових полів ---
        const requiredInstanceFields: (keyof AssetImportRow)[] = ['assetTypeName', 'inventoryNumber', 'quantity', 'unitCost', 'purchaseDate'];
        for (const field of requiredInstanceFields) {
             // Дозволяємо 0 як валідне значення для inventoryNumber, якщо він числовий
             const value = row[field];
             const isMissing = value === null || value === undefined || value === '';
             if (isMissing) {
                return { isValid: false, error: `Missing required field '${field}'`, rowIndex, fieldName: field };
            }
        }

        // --- Перевірка типів та форматів ---
        const quantity = Number(row.quantity);
        if (isNaN(quantity) || quantity <= 0 || !Number.isInteger(quantity)) {
             return { isValid: false, error: `Field 'quantity' must be a positive integer`, rowIndex, fieldName: 'quantity' };
        }
        const unitCost = Number(row.unitCost);
         if (isNaN(unitCost) || unitCost < 0) {
             return { isValid: false, error: `Field 'unitCost' must be a non-negative number`, rowIndex, fieldName: 'unitCost' };
        }
        if (!row.purchaseDate || isNaN(new Date(row.purchaseDate as string | Date).getTime())) {
             return { isValid: false, error: `Field 'purchaseDate' must be a valid date`, rowIndex, fieldName: 'purchaseDate' };
        }
         if (row.minimumStockLevel !== null && row.minimumStockLevel !== undefined && row.minimumStockLevel !== '') {
             const minStock = Number(row.minimumStockLevel);
             if (isNaN(minStock) || minStock < 0 || !Number.isInteger(minStock)) {
                 return { isValid: false, error: `Field 'minimumStockLevel' must be a non-negative integer if provided`, rowIndex, fieldName: 'minimumStockLevel' };
            }
         }
         // Перевірка inventoryNumber (має бути хоча б щось, валідація рядка буде пізніше)
         if (row.inventoryNumber === null || row.inventoryNumber === undefined || String(row.inventoryNumber).trim() === '') {
              return { isValid: false, error: `Field 'inventoryNumber' cannot be empty`, rowIndex, fieldName: 'inventoryNumber' };
         }


        // --- Перевірка умов для нового типу ---
        const assetTypeName = String(row.assetTypeName).trim(); // Обрізаємо пробіли
        if (!assetTypeName) {
             return { isValid: false, error: `Field 'assetTypeName' cannot be empty`, rowIndex, fieldName: 'assetTypeName' };
        }
        let typeExists = existingTypeNames.has(assetTypeName.toLowerCase());

        if (!typeExists) {
             try {
                const existingType = await prisma.assetType.findFirst({
                    where: { name: { equals: assetTypeName /*, mode: 'insensitive'*/ } }
                });
                 if (existingType) {
                    typeExists = true;
                    existingTypeNames.add(assetTypeName.toLowerCase());
                 }
             } catch (dbError) {
                 console.error("Validation DB Check Error:", dbError);
                 return { isValid: false, error: `Database error during type validation for '${assetTypeName}'`, rowIndex };
             }
        }

        if (!typeExists) {
            if (!row.categoryName || String(row.categoryName).trim() === '') {
                 return { isValid: false, error: `Field 'categoryName' is required for new asset type '${assetTypeName}'`, rowIndex, fieldName: 'categoryName' };
            }
            if (!row.unitOfMeasure || String(row.unitOfMeasure).trim() === '') {
                 return { isValid: false, error: `Field 'unitOfMeasure' is required for new asset type '${assetTypeName}'`, rowIndex, fieldName: 'unitOfMeasure' };
            }
        }
    } // End for loop

    return { isValid: true };
} // End validateImportData

// --- Функція Виконання Транзакції ---
async function performImportTransaction(data: AssetImportRow[]): Promise<{ success: boolean; count: number; error?: any }> {
    let importedCount = 0;
    try {
        await prisma.$transaction(async (tx) => {
            for (const row of data) {
                // Отримуємо дані з рядка (вже провалідовані на базовому рівні)
                const assetTypeName = String(row.assetTypeName).trim();
                const categoryName = String(row.categoryName ?? '').trim(); // Обробка можливого null/undefined
                const unitOfMeasure = String(row.unitOfMeasure ?? '').trim(); // Обробка можливого null/undefined
                const quantity = Number(row.quantity);
                const unitCost = new Decimal(row.unitCost as string | number);
                const purchaseDate = new Date(row.purchaseDate as string | Date);
                const instanceNotes = row.instanceNotes ?? null;
                const minimumStockLevel = (row.minimumStockLevel !== null && row.minimumStockLevel !== undefined && row.minimumStockLevel !== '')
                    ? Number(row.minimumStockLevel)
                    : null;

                // *** ВИПРАВЛЕННЯ: Явне перетворення inventoryNumber на рядок ***
                const inventoryNumber = String(row.inventoryNumber ?? ''); // Перетворюємо на рядок, обробляємо null/undefined
                if (inventoryNumber === '') {
                    // Додаткова перевірка на випадок, якщо валідація пропустила
                    throw new Error(`Inventory number cannot be empty in row ${row.rowIndex}`);
                }


                let category: AssetCategory | null = null;

                let assetType: AssetType | null = await tx.assetType.findFirst({
                    where: { name: { equals: assetTypeName /*, mode: 'insensitive'*/ } }
                });

                if (!assetType) {
                    // --- Type does not exist, create it ---
                    if (!categoryName) {
                         throw new Error(`Category name missing for new asset type '${assetTypeName}' in row ${row.rowIndex}.`);
                    }
                    const existingCategory = await tx.assetCategory.findUnique({ where: { name: categoryName } });
                    if (existingCategory) {
                        category = existingCategory;
                    } else {
                        category = await tx.assetCategory.create({ data: { name: categoryName } });
                    }

                    if (!unitOfMeasure) {
                        throw new Error(`Unit of measure missing for new type ${assetTypeName} in row ${row.rowIndex}.`);
                    }

                    const newTypeData: Prisma.AssetTypeCreateInput = {
                        name: assetTypeName,
                        unit_of_measure: unitOfMeasure,
                        category: { connect: { id: category.id } },
                        minimum_stock_level: minimumStockLevel ?? 0,
                    };
                    assetType = await tx.assetType.create({ data: newTypeData });
                }
                // --- Type now exists ---

                // Create Asset Instance
                await tx.assetInstance.create({
                    data: {
                        assetTypeId: assetType.id,
                        inventoryNumber: inventoryNumber, // Передаємо гарантований рядок
                        quantity: quantity,
                        unit_cost: unitCost,
                        purchase_date: purchaseDate,
                        notes: instanceNotes,
                        status: AssetStatus.on_stock
                    }
                });

                importedCount++;
            } // End for loop
        }); // End prisma.$transaction

        return { success: true, count: importedCount };

    } catch (error) {
        console.error('Import Transaction Error:', error);
        return { success: false, count: importedCount, error: error };
    }
} // End performImportTransaction


// --- Головний Обробник API (без змін) ---
export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse<SuccessResponse | ErrorResponse>
) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', ['POST']);
        return res.status(405).json({ message: `Method ${req.method} Not Allowed` });
    }

    const importData: AssetImportRow[] = req.body;
    if (!Array.isArray(importData)) {
        return res.status(400).json({ message: 'Request body must be an array of import rows.' });
    }

    const dataWithIndices = importData.map((row, index) => ({ ...row, rowIndex: row.rowIndex ?? index + 1 }));


    const validationResult = await validateImportData(dataWithIndices);
    if (!validationResult.isValid) {
        console.log(`Import validation failed: ${validationResult.error} (Row: ${validationResult.rowIndex}, Field: ${validationResult.fieldName})`);
        return res.status(400).json({
            message: validationResult.error ?? 'Invalid data provided.',
            rowIndex: validationResult.rowIndex,
            fieldName: validationResult.fieldName
        });
    }

    const transactionResult = await performImportTransaction(dataWithIndices);

    if (transactionResult.success) {
        console.log(`Successfully imported ${transactionResult.count} assets.`);
        return res.status(200).json({
            message: `Successfully imported ${transactionResult.count} assets.`,
            importedCount: transactionResult.count
        });
    } else {
        const errorMessage = transactionResult.error instanceof Error
                           ? transactionResult.error.message
                           : 'An unknown error occurred during the import transaction.';
        // Додаємо більше деталей до помилки 500, якщо можливо
        const errorDetails = transactionResult.error instanceof Prisma.PrismaClientKnownRequestError
                            ? ` (Code: ${transactionResult.error.code}, Meta: ${JSON.stringify(transactionResult.error.meta)})`
                            : '';
        return res.status(500).json({
            message: 'Import failed during database transaction.' + errorDetails,
            error: errorMessage
        });
    }
} // End handler    