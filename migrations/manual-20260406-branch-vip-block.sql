-- DB_SYNC=false bo‘lsa qo‘lda ishga tushiring

ALTER TABLE branches
  ADD COLUMN IF NOT EXISTS "isBlocked" boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "blockedAt" timestamptz NULL,
  ADD COLUMN IF NOT EXISTS "blockedReason" text NULL,
  ADD COLUMN IF NOT EXISTS "isVip" boolean NOT NULL DEFAULT false;
