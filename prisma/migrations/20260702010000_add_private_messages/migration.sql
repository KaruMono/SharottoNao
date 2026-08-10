CREATE TYPE "PrivateMessageType" AS ENUM ('TEXT', 'IMAGE');

CREATE TABLE "PrivateConversation" (
  "id" SERIAL NOT NULL,
  "participantAId" INTEGER NOT NULL,
  "participantBId" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "PrivateConversation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PrivateMessage" (
  "id" SERIAL NOT NULL,
  "conversationId" INTEGER NOT NULL,
  "senderId" INTEGER NOT NULL,
  "receiverId" INTEGER NOT NULL,
  "type" "PrivateMessageType" NOT NULL DEFAULT 'TEXT',
  "content" TEXT,
  "imageUrl" VARCHAR(500),
  "readAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "PrivateMessage_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PrivateConversation_participantAId_participantBId_key" ON "PrivateConversation"("participantAId", "participantBId");
CREATE INDEX "PrivateConversation_participantAId_updatedAt_idx" ON "PrivateConversation"("participantAId", "updatedAt");
CREATE INDEX "PrivateConversation_participantBId_updatedAt_idx" ON "PrivateConversation"("participantBId", "updatedAt");
CREATE INDEX "PrivateMessage_conversationId_createdAt_idx" ON "PrivateMessage"("conversationId", "createdAt");
CREATE INDEX "PrivateMessage_receiverId_readAt_idx" ON "PrivateMessage"("receiverId", "readAt");
CREATE INDEX "PrivateMessage_senderId_createdAt_idx" ON "PrivateMessage"("senderId", "createdAt");

ALTER TABLE "PrivateConversation" ADD CONSTRAINT "PrivateConversation_participantAId_fkey" FOREIGN KEY ("participantAId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PrivateConversation" ADD CONSTRAINT "PrivateConversation_participantBId_fkey" FOREIGN KEY ("participantBId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PrivateMessage" ADD CONSTRAINT "PrivateMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "PrivateConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PrivateMessage" ADD CONSTRAINT "PrivateMessage_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PrivateMessage" ADD CONSTRAINT "PrivateMessage_receiverId_fkey" FOREIGN KEY ("receiverId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
