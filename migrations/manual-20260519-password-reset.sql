-- Password reset notification support
-- Run manually when DB_SYNC=false

-- 1. Enum-ga yangi qiymat qo'shish
ALTER TYPE "superadmin_notifications_type_enum" ADD VALUE IF NOT EXISTS 'password_reset_request';

-- 2. superadmin_notifications jadvaliga yangi ustunlar qo'shish
ALTER TABLE superadmin_notifications
  ADD COLUMN IF NOT EXISTS "requestedUserId" uuid NULL REFERENCES users(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS "isApproved" boolean NOT NULL DEFAULT false;

-- 3. organizationId nullable qilish (password_reset_request uchun tashkilot bo'lmasligi mumkin)
ALTER TABLE superadmin_notifications
  ALTER COLUMN "organizationId" DROP NOT NULL;
