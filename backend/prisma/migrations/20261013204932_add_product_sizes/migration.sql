-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "sizes" TEXT[] DEFAULT ARRAY[]::TEXT[];
