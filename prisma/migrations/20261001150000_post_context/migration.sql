-- AlterEnum
ALTER TYPE "AIFeature" ADD VALUE 'POST_CONTEXT';

-- CreateTable
CREATE TABLE "post_contexts" (
    "postId" UUID NOT NULL,
    "summary" VARCHAR(400) NOT NULL,
    "bodyHash" CHAR(64) NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "promptVersion" TEXT NOT NULL,
    "requestId" UUID,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "post_contexts_pkey" PRIMARY KEY ("postId")
);

-- CreateIndex
CREATE UNIQUE INDEX "post_contexts_requestId_key" ON "post_contexts"("requestId");

-- AddForeignKey
ALTER TABLE "post_contexts" ADD CONSTRAINT "post_contexts_postId_fkey" FOREIGN KEY ("postId") REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_contexts" ADD CONSTRAINT "post_contexts_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "ai_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;

