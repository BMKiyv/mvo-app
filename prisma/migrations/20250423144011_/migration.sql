/*
  Warnings:

  - The `status` column on the `AssetInstance` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- CreateEnum
CREATE TYPE "AssetStatus" AS ENUM ('on_stock', 'issued', 'written_off', 'in_repair', 'lost', 'reserved');

-- DropIndex
DROP INDEX "AssetInstance_inventoryNumber_key";

-- AlterTable
ALTER TABLE "AssetInstance" ADD COLUMN     "quantity" INTEGER NOT NULL DEFAULT 1,
DROP COLUMN "status",
ADD COLUMN     "status" "AssetStatus" NOT NULL DEFAULT 'on_stock';
