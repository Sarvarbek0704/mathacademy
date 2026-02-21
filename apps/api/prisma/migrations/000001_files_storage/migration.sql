-- Add local storage metadata to files
ALTER TABLE "files" ADD COLUMN IF NOT EXISTS "purpose" VARCHAR(30);
ALTER TABLE "files" ADD COLUMN IF NOT EXISTS "storage_provider" VARCHAR(20) NOT NULL DEFAULT 'LOCAL';
ALTER TABLE "files" ADD COLUMN IF NOT EXISTS "storage_path" TEXT;

CREATE INDEX IF NOT EXISTS "files_tenant_owner_purpose_idx" ON "files" ("tenant_id", "owner_type", "owner_id", "purpose");
