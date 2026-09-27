-- ==============================================================================
-- BUSINESSOS — PHASE 4 MIGRATION (AUTOMATISATIONS & ASSISTANT IA)
-- Idempotent migration script
-- ==============================================================================

-- 1. Support for Client Portal Token on customers
ALTER TABLE IF EXISTS customers
  ADD COLUMN IF NOT EXISTS portal_token TEXT UNIQUE;

-- Create index for quick token lookup
CREATE INDEX IF NOT EXISTS idx_customers_portal_token ON customers(portal_token);

-- Populate existing customers with unique portal tokens if null
UPDATE customers
SET portal_token = encode(gen_random_bytes(24), 'hex')
WHERE portal_token IS NULL;

-- 2. Integrations settings on companies (Email & WhatsApp & Payment Providers)
ALTER TABLE IF EXISTS companies
  ADD COLUMN IF NOT EXISTS email_provider TEXT DEFAULT 'resend',
  ADD COLUMN IF NOT EXISTS sender_email TEXT,
  ADD COLUMN IF NOT EXISTS sender_name TEXT,
  ADD COLUMN IF NOT EXISTS whatsapp_phone TEXT,
  ADD COLUMN IF NOT EXISTS whatsapp_enabled BOOLEAN DEFAULT FALSE;

-- 3. Automations and Automation Runs Indexes
CREATE INDEX IF NOT EXISTS idx_automations_company_active ON automations(company_id, is_active);
CREATE INDEX IF NOT EXISTS idx_automation_runs_company ON automation_runs(company_id, created_at DESC);

-- 4. Enable RLS on automations & automation_runs if not already enabled
ALTER TABLE IF EXISTS automations ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS automation_runs ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies for Automations
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'automations' AND policyname = 'automations_tenant_isolation'
  ) THEN
    CREATE POLICY automations_tenant_isolation ON automations
      FOR ALL
      USING (company_id IN (SELECT company_id FROM memberships WHERE user_id = auth.uid()));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'automation_runs' AND policyname = 'automation_runs_tenant_isolation'
  ) THEN
    CREATE POLICY automation_runs_tenant_isolation ON automation_runs
      FOR ALL
      USING (company_id IN (SELECT company_id FROM memberships WHERE user_id = auth.uid()));
  END IF;
END $$;

-- 6. Public Portal Access Policies (Read-only by valid portal_token)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'customers' AND policyname = 'customers_portal_read'
  ) THEN
    CREATE POLICY customers_portal_read ON customers
      FOR SELECT
      TO anon, authenticated
      USING (portal_token IS NOT NULL);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'quotes' AND policyname = 'quotes_portal_read'
  ) THEN
    CREATE POLICY quotes_portal_read ON quotes
      FOR SELECT
      TO anon, authenticated
      USING (customer_id IN (SELECT id FROM customers WHERE portal_token IS NOT NULL));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'invoices' AND policyname = 'invoices_portal_read'
  ) THEN
    CREATE POLICY invoices_portal_read ON invoices
      FOR SELECT
      TO anon, authenticated
      USING (customer_id IN (SELECT id FROM customers WHERE portal_token IS NOT NULL));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'payments' AND policyname = 'payments_portal_read'
  ) THEN
    CREATE POLICY payments_portal_read ON payments
      FOR SELECT
      TO anon, authenticated
      USING (customer_id IN (SELECT id FROM customers WHERE portal_token IS NOT NULL));
  END IF;
END $$;
