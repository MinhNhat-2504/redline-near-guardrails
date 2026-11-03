BEGIN;
-- CreateTable
CREATE TABLE "NearChallenge" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "nonce" TEXT NOT NULL,
    "stateHash" TEXT NOT NULL,
    "recipient" TEXT NOT NULL,
    "callbackUrl" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NearChallenge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NearSession" (
    "tokenHash" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "publicKey" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NearSession_pkey" PRIMARY KEY ("tokenHash")
);

-- CreateTable
CREATE TABLE "NearGrant" (
    "scope" TEXT NOT NULL,
    "grantId" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "executorId" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL,
    "policyJson" TEXT NOT NULL,
    "spentYocto" DECIMAL(39,0) NOT NULL,
    "pendingYocto" DECIMAL(39,0) NOT NULL,
    "nextNonce" DECIMAL(20,0) NOT NULL,
    "finalizedTransactions" DECIMAL(10,0) NOT NULL,
    "pendingTransactions" DECIMAL(10,0) NOT NULL,
    "observedHeight" BIGINT NOT NULL,
    "observedHash" TEXT NOT NULL,

    CONSTRAINT "NearGrant_pkey" PRIMARY KEY ("scope","grantId")
);

-- CreateTable
CREATE TABLE "NearTransaction" (
    "scope" TEXT NOT NULL,
    "hash" TEXT NOT NULL,
    "signerId" TEXT NOT NULL,
    "ownerId" TEXT,
    "grantId" TEXT,
    "intentId" TEXT,
    "argsJson" TEXT,
    "signedBase64" TEXT,
    "keyPublic" TEXT,
    "keyNonce" DECIMAL(20,0),
    "state" TEXT NOT NULL DEFAULT 'TRACKED',
    "reason" TEXT,
    "observation" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NearTransaction_pkey" PRIMARY KEY ("scope","hash")
);

-- CreateTable
CREATE TABLE "NearIntentRequest" (
    "scope" TEXT NOT NULL,
    "grantId" TEXT NOT NULL,
    "intentId" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "argsJson" TEXT NOT NULL,
    "txHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NearIntentRequest_pkey" PRIMARY KEY ("scope","grantId","intentId")
);

-- CreateTable
CREATE TABLE "NearReceiptEvent" (
    "scope" TEXT NOT NULL,
    "id" TEXT NOT NULL,
    "txHash" TEXT NOT NULL,
    "receiptId" TEXT NOT NULL,
    "logIndex" INTEGER NOT NULL,
    "event" TEXT NOT NULL,
    "dataJson" TEXT NOT NULL,

    CONSTRAINT "NearReceiptEvent_pkey" PRIMARY KEY ("scope","id")
);

-- CreateTable
CREATE TABLE "NearWatermark" (
    "scope" TEXT NOT NULL,
    "height" BIGINT NOT NULL,
    "hash" TEXT NOT NULL,

    CONSTRAINT "NearWatermark_pkey" PRIMARY KEY ("scope")
);

-- CreateIndex
CREATE INDEX "NearSession_accountId_idx" ON "NearSession"("accountId");

-- CreateIndex
CREATE INDEX "NearGrant_scope_ownerId_idx" ON "NearGrant"("scope", "ownerId");

-- CreateIndex
CREATE INDEX "NearTransaction_scope_grantId_intentId_idx" ON "NearTransaction"("scope", "grantId", "intentId");

-- CreateIndex
CREATE INDEX "NearTransaction_scope_signerId_state_idx" ON "NearTransaction"("scope", "signerId", "state");

-- CreateIndex
CREATE INDEX "NearReceiptEvent_scope_txHash_idx" ON "NearReceiptEvent"("scope", "txHash");

-- Application parsers enforce the same exact unsigned bounds.
ALTER TABLE "NearGrant" ADD CONSTRAINT "NearGrant_unsigned_bounds" CHECK (
  "spentYocto" >= 0 AND "spentYocto" <= 340282366920938463463374607431768211455 AND
  "pendingYocto" >= 0 AND "pendingYocto" <= 340282366920938463463374607431768211455 AND
  "nextNonce" >= 0 AND "nextNonce" <= 18446744073709551615 AND
  "finalizedTransactions" >= 0 AND "finalizedTransactions" <= 4294967295 AND
  "pendingTransactions" >= 0 AND "pendingTransactions" <= 4294967295
);
ALTER TABLE "NearTransaction" ADD CONSTRAINT "NearTransaction_nonce_bounds" CHECK (
  "keyNonce" IS NULL OR ("keyNonce" >= 0 AND "keyNonce" <= 18446744073709551615)
);
COMMIT;
