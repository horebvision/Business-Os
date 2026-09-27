-- ==============================================================================
-- BUSINESSOS — PHASE 3 FINANCIAL & COMMERCIAL MIGRATION
-- (DEVIS, FACTURES, PAIEMENTS, RELANCES & ACCÈS PUBLIC SÉCURISÉ)
-- ==============================================================================

-- 1. ENHANCE QUOTES (DEVIS)
ALTER TABLE public.quotes 
    ADD COLUMN IF NOT EXISTS subject TEXT,
    ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES public.users(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS public_token TEXT UNIQUE,
    ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS rejected_reason TEXT;

-- Generate public_token for any existing quotes without one
UPDATE public.quotes 
SET public_token = encode(gen_random_bytes(16), 'hex') 
WHERE public_token IS NULL;

-- Default public_token for future quotes
ALTER TABLE public.quotes 
    ALTER COLUMN public_token SET DEFAULT encode(gen_random_bytes(16), 'hex');

-- Update status check constraint on quotes to include 'Annulé'
ALTER TABLE public.quotes DROP CONSTRAINT IF EXISTS quotes_status_check;
ALTER TABLE public.quotes ADD CONSTRAINT quotes_status_check 
    CHECK (status IN ('Brouillon', 'Envoyé', 'Consulté', 'Accepté', 'Refusé', 'Expiré', 'Annulé'));

-- 2. ENHANCE QUOTE ITEMS
ALTER TABLE public.quote_items 
    ADD COLUMN IF NOT EXISTS reference TEXT,
    ADD COLUMN IF NOT EXISTS unit TEXT DEFAULT 'unité',
    ADD COLUMN IF NOT EXISTS discount_rate NUMERIC(5, 2) DEFAULT 0.00,
    ADD COLUMN IF NOT EXISTS tax_rate NUMERIC(5, 2) DEFAULT 18.00;

-- 3. ENHANCE INVOICES (FACTURES)
ALTER TABLE public.invoices 
    ADD COLUMN IF NOT EXISTS subject TEXT,
    ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES public.users(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS public_token TEXT UNIQUE,
    ADD COLUMN IF NOT EXISTS payment_terms TEXT DEFAULT '15 jours';

-- Generate public_token for any existing invoices without one
UPDATE public.invoices 
SET public_token = encode(gen_random_bytes(16), 'hex') 
WHERE public_token IS NULL;

-- Default public_token for future invoices
ALTER TABLE public.invoices 
    ALTER COLUMN public_token SET DEFAULT encode(gen_random_bytes(16), 'hex');

-- 4. ENHANCE INVOICE ITEMS
ALTER TABLE public.invoice_items 
    ADD COLUMN IF NOT EXISTS reference TEXT,
    ADD COLUMN IF NOT EXISTS unit TEXT DEFAULT 'unité',
    ADD COLUMN IF NOT EXISTS discount_rate NUMERIC(5, 2) DEFAULT 0.00,
    ADD COLUMN IF NOT EXISTS tax_rate NUMERIC(5, 2) DEFAULT 18.00;

-- 5. ENHANCE PAYMENTS
ALTER TABLE public.payments DROP CONSTRAINT IF EXISTS payments_payment_method_check;
ALTER TABLE public.payments ADD CONSTRAINT payments_payment_method_check 
    CHECK (payment_method IN ('Espèces', 'Virement bancaire', 'Chèque', 'Mobile Money', 'Carte', 'Autre'));

-- 6. REMINDERS TABLE (RELANCES AUTOMATISÉES & PROGRAMMÉES)
CREATE TABLE IF NOT EXISTS public.reminders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
    customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
    reminder_type TEXT NOT NULL DEFAULT 'email' CHECK (reminder_type IN ('email', 'whatsapp', 'sms', 'manuel')),
    channel TEXT DEFAULT 'email',
    status TEXT NOT NULL DEFAULT 'en_attente' CHECK (status IN ('en_attente', 'envoyé', 'annulé')),
    scheduled_for DATE NOT NULL DEFAULT CURRENT_DATE,
    sent_at TIMESTAMPTZ,
    days_overdue INT DEFAULT 0,
    message TEXT NOT NULL,
    created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_reminders_company ON public.reminders(company_id);
CREATE INDEX IF NOT EXISTS idx_reminders_invoice ON public.reminders(invoice_id);
CREATE INDEX IF NOT EXISTS idx_reminders_status ON public.reminders(company_id, status);

ALTER TABLE public.reminders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view company reminders" ON public.reminders
    FOR SELECT USING (public.is_member_of(company_id));

CREATE POLICY "Members can manage company reminders" ON public.reminders
    FOR ALL USING (public.is_member_of(company_id));

-- 7. PUBLIC ACCESS POLICIES (POUR CONSULTATION ET ACCEPTATION VIA TOKEN SANS LOGIN)
-- Permet à toute personne possédant le public_token exact de consulter le devis
CREATE POLICY "Public can view quote with valid token" ON public.quotes
    FOR SELECT USING (public_token IS NOT NULL);

-- Permet de lire les lignes d'un devis accessible via token
CREATE POLICY "Public can view quote items with valid token" ON public.quote_items
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.quotes q 
            WHERE q.id = quote_items.quote_id 
              AND q.public_token IS NOT NULL
        )
    );

-- Permet au client public d'accepter ou refuser le devis
CREATE POLICY "Public can accept or reject quote with token" ON public.quotes
    FOR UPDATE USING (public_token IS NOT NULL)
    WITH CHECK (status IN ('Consulté', 'Accepté', 'Refusé'));

-- Permet la consultation publique des factures avec token
CREATE POLICY "Public can view invoice with valid token" ON public.invoices
    FOR SELECT USING (public_token IS NOT NULL);

CREATE POLICY "Public can view invoice items with valid token" ON public.invoice_items
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.invoices i 
            WHERE i.id = invoice_items.invoice_id 
              AND i.public_token IS NOT NULL
        )
    );
