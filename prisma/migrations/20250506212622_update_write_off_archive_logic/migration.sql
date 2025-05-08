-- CreateEnum
CREATE TYPE "WriteOffOperationType" AS ENUM ('STOCK_REDUCTION', 'INSTANCE_DISPOSAL');

-- AlterTable
ALTER TABLE "WriteOffLog" ADD COLUMN     "assetInstanceId" INTEGER,
ADD COLUMN     "chiefAccountantSignatoryId" INTEGER,
ADD COLUMN     "commissionChairId" INTEGER,
ADD COLUMN     "headOfEnterpriseSignatoryId" INTEGER,
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "operationType" "WriteOffOperationType" DEFAULT 'STOCK_REDUCTION',
ADD COLUMN     "performedById" INTEGER,
ADD COLUMN     "responsibleEmployeeId" INTEGER,
ADD COLUMN     "totalValueAtWriteOff" DECIMAL(10,2),
ADD COLUMN     "unitCostAtWriteOff" DECIMAL(10,2),
ADD COLUMN     "writeOffDocumentNumber" TEXT;

-- CreateTable
CREATE TABLE "WriteOffLogCommissionMembership" (
    "id" SERIAL NOT NULL,
    "writeOffLogId" INTEGER NOT NULL,
    "employeeId" INTEGER NOT NULL,

    CONSTRAINT "WriteOffLogCommissionMembership_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WriteOffLogCommissionMembership_writeOffLogId_idx" ON "WriteOffLogCommissionMembership"("writeOffLogId");

-- CreateIndex
CREATE INDEX "WriteOffLogCommissionMembership_employeeId_idx" ON "WriteOffLogCommissionMembership"("employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "WriteOffLogCommissionMembership_writeOffLogId_employeeId_key" ON "WriteOffLogCommissionMembership"("writeOffLogId", "employeeId");

-- CreateIndex
CREATE INDEX "WriteOffLog_assetInstanceId_idx" ON "WriteOffLog"("assetInstanceId");

-- CreateIndex
CREATE INDEX "WriteOffLog_performedById_idx" ON "WriteOffLog"("performedById");

-- CreateIndex
CREATE INDEX "WriteOffLog_responsibleEmployeeId_idx" ON "WriteOffLog"("responsibleEmployeeId");

-- CreateIndex
CREATE INDEX "WriteOffLog_operationType_idx" ON "WriteOffLog"("operationType");

-- CreateIndex
CREATE INDEX "WriteOffLog_commissionChairId_idx" ON "WriteOffLog"("commissionChairId");

-- CreateIndex
CREATE INDEX "WriteOffLog_headOfEnterpriseSignatoryId_idx" ON "WriteOffLog"("headOfEnterpriseSignatoryId");

-- CreateIndex
CREATE INDEX "WriteOffLog_chiefAccountantSignatoryId_idx" ON "WriteOffLog"("chiefAccountantSignatoryId");

-- AddForeignKey
ALTER TABLE "WriteOffLog" ADD CONSTRAINT "WriteOffLog_assetInstanceId_fkey" FOREIGN KEY ("assetInstanceId") REFERENCES "AssetInstance"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WriteOffLog" ADD CONSTRAINT "WriteOffLog_performedById_fkey" FOREIGN KEY ("performedById") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WriteOffLog" ADD CONSTRAINT "WriteOffLog_responsibleEmployeeId_fkey" FOREIGN KEY ("responsibleEmployeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WriteOffLog" ADD CONSTRAINT "WriteOffLog_commissionChairId_fkey" FOREIGN KEY ("commissionChairId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WriteOffLog" ADD CONSTRAINT "WriteOffLog_headOfEnterpriseSignatoryId_fkey" FOREIGN KEY ("headOfEnterpriseSignatoryId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WriteOffLog" ADD CONSTRAINT "WriteOffLog_chiefAccountantSignatoryId_fkey" FOREIGN KEY ("chiefAccountantSignatoryId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WriteOffLogCommissionMembership" ADD CONSTRAINT "WriteOffLogCommissionMembership_writeOffLogId_fkey" FOREIGN KEY ("writeOffLogId") REFERENCES "WriteOffLog"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WriteOffLogCommissionMembership" ADD CONSTRAINT "WriteOffLogCommissionMembership_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
