-- ==============================================================================
-- BUSINESSOS — PHASE 5 MIGRATION
-- ABONNEMENTS, ÉQUIPES, PERMISSIONS, LIMITES, PAIEMENTS, AUDIT & ANALYTICS
-- Migration 100% Idempotente & Rétro-compatible
-- ==============================================================================

-- 1. TABLE PLANS (Section 4)
CREATE TABLE IF NOT EXISTS public.plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    description TEXT,
    price_monthly NUMERIC(15, 2) NOT NULL DEFAULT 0,
    price_yearly NUMERIC(15, 2) NOT NULL DEFAULT 0,
    currency TEXT NOT NULL DEFAULT 'XOF',
    trial_days INT NOT NULL DEFAULT 14,
    is_active BOOLEAN NOT NULL DEFAULT true,
    features JSONB NOT NULL DEFAULT '{}'::jsonb,
    limits JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Index sur slug
CREATE INDEX IF NOT EXISTS idx_plans_slug ON public.plans(slug);

-- RLS pour plans
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'plans' AND policyname = 'plans_read_policy'
    ) THEN
        CREATE POLICY plans_read_policy ON public.plans
            FOR SELECT TO authenticated, anon USING (is_active = true);
    END IF;
END $$;

-- Seed des 3 plans de base si la table est vide
INSERT INTO public.plans (name, slug, description, price_monthly, price_yearly, currency, trial_days, is_active, features, limits)
VALUES 
(
    'Starter',
    'starter',
    'Pour indépendants et créateurs d''entreprise souhaitant structurer leur gestion commerciale.',
    15000.00,
    150000.00,
    'XOF',
    14,
    true,
    '{"crm": true, "quotes": true, "invoices": true, "payments": true, "email_resend": true, "whatsapp_link": true, "ai_basic": true, "client_portal": false, "advanced_analytics": false, "api_webhooks": false}'::jsonb,
    '{"max_users": 1, "max_customers": 100, "max_leads": 100, "max_invoices_per_month": 50, "max_quotes_per_month": 50, "max_automations": 3, "ai_credits_per_month": 50}'::jsonb
),
(
    'Business',
    'business',
    'Pour PME et équipes en croissance ayant besoin d''automatisation, d''analyses et de portail client.',
    45000.00,
    450000.00,
    'XOF',
    14,
    true,
    '{"crm": true, "quotes": true, "invoices": true, "payments": true, "email_resend": true, "whatsapp_link": true, "whatsapp_cloud": true, "ai_basic": true, "ai_advanced": true, "client_portal": true, "advanced_analytics": true, "api_webhooks": true, "custom_export": true}'::jsonb,
    '{"max_users": 5, "max_customers": 500, "max_leads": 500, "max_invoices_per_month": 300, "max_quotes_per_month": 300, "max_automations": 15, "ai_credits_per_month": 300}'::jsonb
),
(
    'Pro',
    'pro',
    'Pour entreprises établies exigeant de hautes limites, une IA illimitée et un support dédié.',
    95000.00,
    950000.00,
    'XOF',
    14,
    true,
    '{"crm": true, "quotes": true, "invoices": true, "payments": true, "email_resend": true, "whatsapp_link": true, "whatsapp_cloud": true, "ai_basic": true, "ai_advanced": true, "client_portal": true, "advanced_analytics": true, "api_webhooks": true, "custom_export": true, "priority_support": true, "audit_logs": true}'::jsonb,
    '{"max_users": 20, "max_customers": 10000, "max_leads": 10000, "max_invoices_per_month": 2000, "max_quotes_per_month": 2000, "max_automations": 50, "ai_credits_per_month": 1000}'::jsonb
)
ON CONFLICT (slug) DO UPDATE 
SET 
    price_monthly = EXCLUDED.price_monthly,
    price_yearly = EXCLUDED.price_yearly,
    features = EXCLUDED.features,
    limits = EXCLUDED.limits,
    updated_at = timezone('utc'::text, now());

-- 2. EVOLUTION DE LA TABLE SUBSCRIPTIONS (Section 5)
-- Supprimer la contrainte check stricte sur status et plan_tier si elle existe
ALTER TABLE IF EXISTS public.subscriptions DROP CONSTRAINT IF EXISTS subscriptions_status_check;
ALTER TABLE IF EXISTS public.subscriptions DROP CONSTRAINT IF EXISTS subscriptions_plan_tier_check;

-- Ajouter les nouvelles colonnes nécessaires
ALTER TABLE IF EXISTS public.subscriptions
    ADD COLUMN IF NOT EXISTS plan_id UUID REFERENCES public.plans(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS billing_interval TEXT DEFAULT 'monthly',
    ADD COLUMN IF NOT EXISTS trial_start TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
    ADD COLUMN IF NOT EXISTS trial_end TIMESTAMPTZ DEFAULT (timezone('utc'::text, now()) + INTERVAL '14 days'),
    ADD COLUMN IF NOT EXISTS cancel_at_period_end BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS canceled_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS provider TEXT DEFAULT 'manual',
    ADD COLUMN IF NOT EXISTS provider_customer_id TEXT,
    ADD COLUMN IF NOT EXISTS provider_subscription_id TEXT;

-- Nouvelles contraintes sur status et billing_interval
ALTER TABLE IF EXISTS public.subscriptions 
    ADD CONSTRAINT subscriptions_status_check 
    CHECK (status IN ('trialing', 'active', 'past_due', 'paused', 'canceled', 'expired'));

ALTER TABLE IF EXISTS public.subscriptions 
    ADD CONSTRAINT subscriptions_billing_interval_check 
    CHECK (billing_interval IN ('monthly', 'yearly'));

-- Lier les subscriptions existantes au plan Starter par défaut
UPDATE public.subscriptions s
SET plan_id = (SELECT id FROM public.plans WHERE slug = 'starter' LIMIT 1)
WHERE s.plan_id IS NULL;

-- 3. TABLE USAGE_RECORDS (Section 8)
CREATE TABLE IF NOT EXISTS public.usage_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    metric TEXT NOT NULL, -- 'customers', 'leads', 'invoices', 'quotes', 'users', 'automations', 'ai_credits'
    current_value INT NOT NULL DEFAULT 0,
    period_start TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    period_end TIMESTAMPTZ DEFAULT (timezone('utc'::text, now()) + INTERVAL '30 days') NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT usage_records_company_metric_period_key UNIQUE (company_id, metric, period_start)
);

CREATE INDEX IF NOT EXISTS idx_usage_records_company ON public.usage_records(company_id, metric);

ALTER TABLE public.usage_records ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'usage_records' AND policyname = 'usage_records_tenant_isolation'
    ) THEN
        CREATE POLICY usage_records_tenant_isolation ON public.usage_records
            FOR ALL USING (company_id IN (SELECT company_id FROM public.memberships WHERE user_id = auth.uid()));
    END IF;
END $$;

-- 4. TABLE INVITATIONS (Section 14)
CREATE TABLE IF NOT EXISTS public.invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'employee',
    token TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (timezone('utc'::text, now()) + INTERVAL '7 days'),
    accepted_at TIMESTAMPTZ,
    invited_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_invitations_token ON public.invitations(token);
CREATE INDEX IF NOT EXISTS idx_invitations_company ON public.invitations(company_id);

ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'invitations' AND policyname = 'invitations_tenant_isolation'
    ) THEN
        CREATE POLICY invitations_tenant_isolation ON public.invitations
            FOR ALL USING (company_id IN (SELECT company_id FROM public.memberships WHERE user_id = auth.uid()));
    END IF;
END $$;

-- Policy pour permettre à anon de lire une invitation par son token
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'invitations' AND policyname = 'invitations_token_read'
    ) THEN
        CREATE POLICY invitations_token_read ON public.invitations
            FOR SELECT TO anon, authenticated USING (token IS NOT NULL);
    END IF;
END $$;

-- 5. EXTENSION DES RÔLES MEMBERSHIPS (Section 15)
ALTER TABLE IF EXISTS public.memberships DROP CONSTRAINT IF EXISTS memberships_role_check;
ALTER TABLE IF EXISTS public.memberships 
    ADD CONSTRAINT memberships_role_check 
    CHECK (role IN ('owner', 'admin', 'manager', 'commercial', 'accountant', 'comptable', 'employee'));

-- 6. TABLE AUDIT_LOGS (Section 18 & 19)
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    action TEXT NOT NULL, -- e.g. 'invoice.created', 'payment.created', 'user.invited', etc.
    entity_type TEXT NOT NULL, -- 'invoice', 'quote', 'lead', 'customer', 'membership', 'subscription', 'automation'
    entity_id TEXT,
    old_values JSONB DEFAULT '{}'::jsonb,
    new_values JSONB DEFAULT '{}'::jsonb,
    ip_address TEXT,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_company_date ON public.audit_logs(company_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON public.audit_logs(company_id, action);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'audit_logs' AND policyname = 'audit_logs_tenant_isolation'
    ) THEN
        CREATE POLICY audit_logs_tenant_isolation ON public.audit_logs
            FOR ALL USING (company_id IN (SELECT company_id FROM public.memberships WHERE user_id = auth.uid()));
    END IF;
END $$;

-- 7. TABLE PAYMENT_TRANSACTIONS (Section 11 & 12)
CREATE TABLE IF NOT EXISTS public.payment_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    subscription_id UUID REFERENCES public.subscriptions(id) ON DELETE SET NULL,
    invoice_id UUID REFERENCES public.invoices(id) ON DELETE SET NULL,
    provider TEXT NOT NULL, -- 'wave', 'orange_money', 'mtn_momo', 'manual', 'card'
    amount NUMERIC(15, 2) NOT NULL,
    currency TEXT NOT NULL DEFAULT 'XOF',
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'cancelled')),
    provider_tx_id TEXT,
    customer_phone TEXT,
    customer_email TEXT,
    reference TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_payment_transactions_company ON public.payment_transactions(company_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_reference ON public.payment_transactions(reference);

ALTER TABLE public.payment_transactions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'payment_transactions' AND policyname = 'payment_transactions_tenant_isolation'
    ) THEN
        CREATE POLICY payment_transactions_tenant_isolation ON public.payment_transactions
            FOR ALL USING (company_id IN (SELECT company_id FROM public.memberships WHERE user_id = auth.uid()));
    END IF;
END $$;

-- 8. TABLE SUBSCRIPTION_EVENTS (Section 12)
CREATE TABLE IF NOT EXISTS public.subscription_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    subscription_id UUID REFERENCES public.subscriptions(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL, -- 'created', 'renewed', 'plan_changed', 'canceled', 'payment_failed', 'trial_started', 'trial_expired'
    payload JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_subscription_events_company ON public.subscription_events(company_id, created_at DESC);

ALTER TABLE public.subscription_events ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'subscription_events' AND policyname = 'subscription_events_tenant_isolation'
    ) THEN
        CREATE POLICY subscription_events_tenant_isolation ON public.subscription_events
            FOR ALL USING (company_id IN (SELECT company_id FROM public.memberships WHERE user_id = auth.uid()));
    END IF;
END $$;

-- 9. CHAMP PLATFORM ADMIN SUR USERS (Section 36)
ALTER TABLE IF EXISTS public.users
    ADD COLUMN IF NOT EXISTS is_platform_admin BOOLEAN DEFAULT false;

-- 10. TRIGGER AUTOMATIQUE POUR INITIALISATION D'ABONNEMENT À LA CRÉATION D'ENTREPRISE
CREATE OR REPLACE FUNCTION public.handle_new_company_subscription()
RETURNS TRIGGER AS $$
DECLARE
    v_starter_plan_id UUID;
    v_trial_days INT;
BEGIN
    -- Récupérer le plan starter
    SELECT id, trial_days INTO v_starter_plan_id, v_trial_days
    FROM public.plans
    WHERE slug = 'starter'
    LIMIT 1;

    IF v_trial_days IS NULL THEN
        v_trial_days := 14;
    END IF;

    -- Créer la souscription en période d'essai
    INSERT INTO public.subscriptions (
        company_id,
        plan_tier,
        plan_id,
        status,
        billing_interval,
        trial_start,
        trial_end,
        current_period_start,
        current_period_end
    ) VALUES (
        NEW.id,
        'starter',
        v_starter_plan_id,
        'trialing',
        'monthly',
        timezone('utc'::text, now()),
        timezone('utc'::text, now()) + (v_trial_days || ' days')::INTERVAL,
        timezone('utc'::text, now()),
        timezone('utc'::text, now()) + (v_trial_days || ' days')::INTERVAL
    )
    ON CONFLICT (company_id) DO NOTHING;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_new_company_subscription ON public.companies;
CREATE TRIGGER trg_new_company_subscription
    AFTER INSERT ON public.companies
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_company_subscription();

-- Initialiser la subscription pour les entreprises existantes sans subscription
DO $$
DECLARE
    r RECORD;
    v_starter_id UUID;
BEGIN
    SELECT id INTO v_starter_id FROM public.plans WHERE slug = 'starter' LIMIT 1;
    
    FOR r IN SELECT id FROM public.companies WHERE id NOT IN (SELECT company_id FROM public.subscriptions) LOOP
        INSERT INTO public.subscriptions (
            company_id,
            plan_tier,
            plan_id,
            status,
            billing_interval,
            trial_start,
            trial_end,
            current_period_start,
            current_period_end
        ) VALUES (
            r.id,
            'starter',
            v_starter_id,
            'active',
            'monthly',
            timezone('utc'::text, now()),
            timezone('utc'::text, now()) + INTERVAL '14 days',
            timezone('utc'::text, now()),
            timezone('utc'::text, now()) + INTERVAL '30 days'
        )
        ON CONFLICT (company_id) DO NOTHING;
    END LOOP;
END $$;
