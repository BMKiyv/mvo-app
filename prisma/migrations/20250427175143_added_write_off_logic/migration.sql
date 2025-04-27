-- CreateEnum
CREATE TYPE "CommissionRole" AS ENUM ('none', 'member', 'chair');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AssetStatus" ADD VALUE 'damaged';
ALTER TYPE "AssetStatus" ADD VALUE 'unreturned';

-- AlterTable
ALTER TABLE "Employee" ADD COLUMN     "commission_role" "CommissionRole" NOT NULL DEFAULT 'none';

-- CreateTable
CREATE TABLE "WriteOffLog" (
    "id" SERIAL NOT NULL,
    "assetTypeId" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL,
    "writeOffDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reason" TEXT,

    CONSTRAINT "WriteOffLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WriteOffLog_assetTypeId_idx" ON "WriteOffLog"("assetTypeId");

-- CreateIndex
CREATE INDEX "WriteOffLog_writeOffDate_idx" ON "WriteOffLog"("writeOffDate");

-- AddForeignKey
ALTER TABLE "WriteOffLog" ADD CONSTRAINT "WriteOffLog_assetTypeId_fkey" FOREIGN KEY ("assetTypeId") REFERENCES "AssetType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
