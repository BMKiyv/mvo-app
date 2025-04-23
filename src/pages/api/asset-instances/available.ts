// pages/api/asset-instances/available.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient, AssetStatus } from '@prisma/client';

const prisma = new PrismaClient();

// Define the structure for available asset data
// Include necessary info for selection in the modal
type AvailableAssetData = {
  instanceId: number;
  inventoryNumber: string;
  quantity: number; // Available quantity in this instance/batch
  unit_cost: string; // Use string representation of Decimal
  purchase_date: Date;
  notes: string | null;
};

type ApiResponseData = AvailableAssetData[];
type ApiErrorData = { message: string };

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponseData | ApiErrorData>
) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ message: `Method ${req.method} Not Allowed` });
  }

  const { assetTypeId } = req.query;

  // Validate assetTypeId
  if (typeof assetTypeId !== 'string' || isNaN(parseInt(assetTypeId))) {
    return res.status(400).json({ message: 'Invalid or missing assetTypeId parameter.' });
  }
  const typeId = parseInt(assetTypeId);

  try {
    // Find asset instances of the specified type that are on stock
    // and have a quantity greater than 0
    const availableInstances = await prisma.assetInstance.findMany({
      where: {
        assetTypeId: typeId,
        status: AssetStatus.on_stock, // Must be on stock
        quantity: {
          gt: 0, // Must have quantity greater than 0
        },
      },
      select: {
        id: true, // Renamed to instanceId later
        inventoryNumber: true,
        quantity: true,
        unit_cost: true, // Keep as Decimal for now, convert later
        purchase_date: true,
        notes: true,
      },
      orderBy: [
        { purchase_date: 'asc' }, // Optional: Order by purchase date (FIFO)
        { id: 'asc' },
      ],
    });

    // Format the response data, converting Decimal to string
    const formattedAssets: AvailableAssetData[] = availableInstances.map(inst => ({
      instanceId: inst.id,
      inventoryNumber: inst.inventoryNumber,
      quantity: inst.quantity,
      unit_cost: inst.unit_cost.toString(), // Convert Decimal to string
      purchase_date: inst.purchase_date,
      notes: inst.notes,
    }));

    res.status(200).json(formattedAssets);

  } catch (error) {
    console.error(`Failed to fetch available assets for type ${typeId}:`, error);
    res.status(500).json({ message: 'Internal Server Error' });
  } finally {
    await prisma.$disconnect();
  }
}
