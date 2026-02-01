-- CreateEnum
CREATE TYPE "FileStatus" AS ENUM ('SUCCESS', 'FAILED', 'PENDING');

-- CreateTable
CREATE TABLE "FileLog" (
    "id" SERIAL NOT NULL,
    "originalName" TEXT NOT NULL,
    "originalPath" TEXT NOT NULL,
    "movedToPath" TEXT NOT NULL,
    "fileExtension" TEXT NOT NULL,
    "errorMessage" TEXT,
    "fileSize" INTEGER NOT NULL,
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "FileStatus" NOT NULL,

    CONSTRAINT "FileLog_pkey" PRIMARY KEY ("id")
);
