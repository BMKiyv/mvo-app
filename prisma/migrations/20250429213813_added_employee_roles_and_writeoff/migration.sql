-- AlterTable
ALTER TABLE "Employee" ADD COLUMN     "is_chief_accountant" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "is_head_of_enterprise" BOOLEAN NOT NULL DEFAULT false;
