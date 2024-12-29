-- DropForeignKey
ALTER TABLE "CommitStats" DROP CONSTRAINT "CommitStats_userId_fkey";

-- CreateTable
CREATE TABLE "AnalysisProgress" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "progress" JSONB NOT NULL,
    "error" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnalysisProgress_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AnalysisProgress_userId_key" ON "AnalysisProgress"("userId");

-- AddForeignKey
ALTER TABLE "AnalysisProgress" ADD CONSTRAINT "AnalysisProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommitStats" ADD CONSTRAINT "CommitStats_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
