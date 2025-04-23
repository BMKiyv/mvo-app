// pages/api/asset-types/index.ts (або pages/api/asset-types.ts)
import type { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Define the structure for the asset type options
type AssetTypeOption = {
  id: number;
  name: string;
  // Add categoryName if needed later by joining with AssetCategory
};

type ApiResponseData = AssetTypeOption[];
type ApiErrorData = { message: string };

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponseData | ApiErrorData>
) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ message: `Method ${req.method} Not Allowed` });
  }

  try {
    // Fetch all asset types, selecting only id and name
    const assetTypes = await prisma.assetType.findMany({
      select: {
        id: true,
        name: true,
      },
      orderBy: {
        name: 'asc', // Order alphabetically for the dropdown
      },
    });

    // No need to format further as select already gives the desired structure
    res.status(200).json(assetTypes);

  } catch (error) {
    console.error('Failed to fetch asset types:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  } finally {
    await prisma.$disconnect();
  }
}
