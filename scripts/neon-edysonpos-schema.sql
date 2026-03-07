-- =============================================================================
-- Neon database schema: sampleBilliard (3Sekawan) + EdysonPOS
-- Run this in Neon SQL Editor or via psql. Run before any app migration.
-- Table naming:
--   - sampleBilliard_* first (3Sekawan).
--   - EdysonPOS tables use EdysonPOSSample_ prefix: EdysonPOSSample_categories,
--     EdysonPOSSample_systemData, EdysonPOSSample_barangs, EdysonPOSSample_userProfiles,
--     EdysonPOSSample_jualanKontan, EdysonPOSSample_jualanGrosir, EdysonPOSSample_jualanItems,
--     EdysonPOSSample_grosirPayments, EdysonPOSSample_grosirDrafts, EdysonPOSSample_grosirDraftItems.
--   - EdysonPOSSample (add-on table) uses constraint edyson_pos_sample_name_unique.
-- =============================================================================

-- Enable UUID extension (Neon has it by default; uncomment if needed)
-- CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================================================
-- PART 1: sampleBilliard (3Sekawan – billiard & shop)
-- Tables listed first with "sampleBilliard" prefix.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- sampleBilliard_sessions (billiard table sessions)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sampleBilliard_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_number INTEGER NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  duration_hours NUMERIC(10,4) NOT NULL DEFAULT 0,
  rate_per_hour NUMERIC(18,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active',
  paid_at TIMESTAMPTZ,
  payment_method TEXT,
  cashier_id UUID NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sampleBilliard_sessions_table ON sampleBilliard_sessions(table_number);
CREATE INDEX IF NOT EXISTS idx_sampleBilliard_sessions_started ON sampleBilliard_sessions(started_at);
CREATE INDEX IF NOT EXISTS idx_sampleBilliard_sessions_status ON sampleBilliard_sessions(status);

COMMENT ON TABLE sampleBilliard_sessions IS '3Sekawan: billiard table sessions (table_number, billing, checkout)';

-- -----------------------------------------------------------------------------
-- sampleBilliard_shop_expenses (shop expense tracking)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sampleBilliard_shop_expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expense_date DATE NOT NULL,
  category TEXT NOT NULL,
  description TEXT,
  amount NUMERIC(18,2) NOT NULL DEFAULT 0,
  created_by UUID,
  notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_sampleBilliard_shop_expenses_date ON sampleBilliard_shop_expenses(expense_date);
CREATE INDEX IF NOT EXISTS idx_sampleBilliard_shop_expenses_category ON sampleBilliard_shop_expenses(category);

COMMENT ON TABLE sampleBilliard_shop_expenses IS '3Sekawan: shop expenses by category and date';

-- =============================================================================
-- PART 2: EdysonPOS tables (all with EdysonPOSSample_ prefix)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. EdysonPOSSample_categories
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "EdysonPOSSample_categories" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  title VARCHAR(255) NOT NULL
);

-- -----------------------------------------------------------------------------
-- 2. EdysonPOSSample_systemData (key-value / app state, e.g. grosir invoice counter)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "EdysonPOSSample_systemData" (
  id VARCHAR(64) PRIMARY KEY,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "grosirInvoiceNo" BIGINT NOT NULL DEFAULT 1
);

-- -----------------------------------------------------------------------------
-- 3. EdysonPOSSample_barangs (products; id = barcode)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "EdysonPOSSample_barangs" (
  id VARCHAR(128) PRIMARY KEY,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "createdBy" TEXT NOT NULL DEFAULT 'system',
  "barangNama" VARCHAR(512) NOT NULL,
  "barangType" TEXT NOT NULL DEFAULT 'umum',
  "barangUnit" TEXT NOT NULL DEFAULT 'Pcs',
  "barangHarga" NUMERIC(18,2) NOT NULL DEFAULT 0,
  "barangModal" NUMERIC(18,2) NOT NULL DEFAULT 0,
  "barangGrosir" NUMERIC(18,2) NOT NULL DEFAULT 0,
  "barangBon" NUMERIC(18,2) NOT NULL DEFAULT 0,
  "barangNote" VARCHAR(512),
  "stockBarang" INTEGER NOT NULL DEFAULT 0,
  "stockTokoMini" INTEGER NOT NULL DEFAULT 0
);

-- -----------------------------------------------------------------------------
-- 4. EdysonPOSSample_userProfiles (no FK to auth.users on Neon unless you add your own auth)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "EdysonPOSSample_userProfiles" (
  id UUID PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  "fullName" TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  role TEXT NOT NULL CHECK (role IN ('admin', 'cashier', 'manager')),
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "lastLoginAt" TIMESTAMPTZ
);

-- Optional: FK from sampleBilliard_sessions to EdysonPOSSample_userProfiles (run after table exists)
-- ALTER TABLE sampleBilliard_sessions
--   ADD CONSTRAINT fk_sampleBilliard_sessions_cashier
--   FOREIGN KEY (cashier_id) REFERENCES "EdysonPOSSample_userProfiles"(id) ON DELETE SET NULL;

-- -----------------------------------------------------------------------------
-- 5. EdysonPOSSample_jualanKontan (cash sales)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "EdysonPOSSample_jualanKontan" (
  id TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  "created_atIndo" TEXT,
  "totalBelanja" NUMERIC(18,2) NOT NULL DEFAULT 0,
  "namaKasir" VARCHAR(255) NOT NULL,
  "caraPembayaran" VARCHAR(128) NOT NULL,
  "userId" UUID REFERENCES "EdysonPOSSample_userProfiles"(id) ON DELETE SET NULL
);

-- -----------------------------------------------------------------------------
-- 6. EdysonPOSSample_jualanGrosir (wholesale sales)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "EdysonPOSSample_jualanGrosir" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  "created_atIndo" TEXT,
  "invoiceNo" BIGINT NOT NULL,
  "namaPelanggan" TEXT NOT NULL DEFAULT '',
  "totalBelanja" NUMERIC(18,2) NOT NULL DEFAULT 0,
  "setorGrosir" NUMERIC(18,2) NOT NULL DEFAULT 0,
  "sisaBonGrosir" BIGINT NOT NULL DEFAULT 0,
  "namaKasir" TEXT NOT NULL,
  "caraPembayaran" TEXT NOT NULL DEFAULT '',
  "paymentHistory" JSONB,
  "payment_status" TEXT CHECK ("payment_status" IN ('unpaid', 'partially_paid', 'paid')),
  "percent_paid" NUMERIC(5,2),
  "userId" UUID REFERENCES "EdysonPOSSample_userProfiles"(id) ON DELETE SET NULL
);

-- -----------------------------------------------------------------------------
-- 7. EdysonPOSSample_jualanItems (line items for both cash and grosir sales)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "EdysonPOSSample_jualanItems" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  "jualanKontanId" TEXT REFERENCES "EdysonPOSSample_jualanKontan"(id) ON DELETE CASCADE,
  "jualanGrosirId" UUID REFERENCES "EdysonPOSSample_jualanGrosir"(id) ON DELETE CASCADE,
  "barangId" VARCHAR(128) NOT NULL REFERENCES "EdysonPOSSample_barangs"(id) ON DELETE RESTRICT,
  "barangNama" VARCHAR(512) NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  "unitPrice" NUMERIC(18,2) NOT NULL,
  "totalPrice" NUMERIC(18,2) NOT NULL,
  "barangUnit" TEXT NOT NULL DEFAULT 'Pcs',
  CONSTRAINT EdysonPOSSample_jualan_items_one_parent_check CHECK (
    ("jualanKontanId" IS NOT NULL AND "jualanGrosirId" IS NULL) OR
    ("jualanKontanId" IS NULL AND "jualanGrosirId" IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_EdysonPOSSample_jualan_items_kontan ON "EdysonPOSSample_jualanItems"("jualanKontanId");
CREATE INDEX IF NOT EXISTS idx_EdysonPOSSample_jualan_items_grosir ON "EdysonPOSSample_jualanItems"("jualanGrosirId");
CREATE INDEX IF NOT EXISTS idx_EdysonPOSSample_jualan_items_barang ON "EdysonPOSSample_jualanItems"("barangId");

-- -----------------------------------------------------------------------------
-- 8. EdysonPOSSample_grosirPayments (payments against wholesale invoices)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "EdysonPOSSample_grosirPayments" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  "jualanGrosirId" UUID NOT NULL REFERENCES "EdysonPOSSample_jualanGrosir"(id) ON DELETE CASCADE,
  amount NUMERIC(18,2) NOT NULL,
  "paymentMethod" TEXT NOT NULL DEFAULT 'cash',
  "createdBy" TEXT NOT NULL,
  "userId" UUID REFERENCES "EdysonPOSSample_userProfiles"(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_EdysonPOSSample_grosir_payments_jualan ON "EdysonPOSSample_grosirPayments"("jualanGrosirId");

-- -----------------------------------------------------------------------------
-- 9. EdysonPOSSample_grosirDrafts (saved carts for wholesale)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "EdysonPOSSample_grosirDrafts" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  "createdBy" UUID REFERENCES "EdysonPOSSample_userProfiles"(id) ON DELETE SET NULL,
  "namaPelanggan" TEXT NOT NULL DEFAULT '',
  "totalBelanja" NUMERIC(18,2) NOT NULL DEFAULT 0,
  "setorAwal" NUMERIC(18,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft'
);

-- -----------------------------------------------------------------------------
-- 10. EdysonPOSSample_grosirDraftItems (line items for grosir drafts)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "EdysonPOSSample_grosirDraftItems" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "grosirDraftId" UUID NOT NULL REFERENCES "EdysonPOSSample_grosirDrafts"(id) ON DELETE CASCADE,
  "barangId" VARCHAR(128) NOT NULL REFERENCES "EdysonPOSSample_barangs"(id) ON DELETE RESTRICT,
  "barangNama" VARCHAR(512) NOT NULL,
  "barangUnit" TEXT NOT NULL DEFAULT 'Pcs',
  quantity INTEGER NOT NULL DEFAULT 1,
  "unitPrice" NUMERIC(18,2) NOT NULL,
  "totalPrice" NUMERIC(18,2) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_EdysonPOSSample_grosir_draft_items_draft ON "EdysonPOSSample_grosirDraftItems"("grosirDraftId");

-- -----------------------------------------------------------------------------
-- 11. EdysonPOSSample (add-on table for sample/demo or metadata)
-- Constraint name: edyson_pos_sample_name_unique
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "EdysonPOSSample" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  metadata JSONB,
  CONSTRAINT edyson_pos_sample_name_unique UNIQUE (name)
);

COMMENT ON TABLE "EdysonPOSSample" IS 'Sample/demo or metadata table for EdysonPOS (Neon)';

-- -----------------------------------------------------------------------------
-- Optional: seed EdysonPOSSample_systemData for grosir invoice counter
-- -----------------------------------------------------------------------------
INSERT INTO "EdysonPOSSample_systemData" (id, "grosirInvoiceNo")
VALUES ('notaGrosir', 1)
ON CONFLICT (id) DO NOTHING;

-- -----------------------------------------------------------------------------
-- Optional: function for “users without profiles” (Neon has no auth.users)
-- Replace with your own auth table name if you add one (e.g. auth.users or users).
-- This version returns empty set; implement when you have an auth table.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_users_without_profiles()
RETURNS TABLE (id UUID, email TEXT, created_at TIMESTAMPTZ) AS $$
  -- If you add an auth.users or users table, join here and exclude existing profiles
  SELECT NULL::UUID AS id, NULL::TEXT AS email, NULL::TIMESTAMPTZ AS created_at
  WHERE false;
$$ LANGUAGE sql STABLE;
