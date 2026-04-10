-- Run manually when DB_SYNC=false (adjust if columns already exist)

ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS "isBlocked" boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "blockedAt" timestamptz NULL,
  ADD COLUMN IF NOT EXISTS "blockedReason" text NULL,
  ADD COLUMN IF NOT EXISTS "isVip" boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "paymentDueAt" date NULL,
  ADD COLUMN IF NOT EXISTS "lastNotifiedPaymentDueAt" date NULL;

CREATE TABLE IF NOT EXISTS "organization_payments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "organizationId" uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  "amount" numeric(14,2) NOT NULL,
  "paidAt" date NOT NULL,
  "note" text NULL,
  "createdByUserId" uuid NULL REFERENCES users(id) ON DELETE SET NULL,
  "createdAt" timestamptz NOT NULL DEFAULT now()
);

CREATE TYPE "superadmin_notifications_type_enum" AS ENUM ('payment_due');

CREATE TABLE IF NOT EXISTS "superadmin_notifications" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "type" "superadmin_notifications_type_enum" NOT NULL,
  "organizationId" uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  "message" text NOT NULL,
  "readAt" timestamptz NULL,
  "createdAt" timestamptz NOT NULL DEFAULT now()
);
