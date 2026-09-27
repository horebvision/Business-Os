-- ==============================================================================
-- BUSINESSOS — PHASE 6.2 : DURCISSEMENT PRODUCTION (HARDENING)
-- ==============================================================================
-- Migration SQL :
-- 1. Table processed_webhooks pour idempotence persistante et anti-concurrence
-- 2. Table rate_limit_buckets et fonction atomique consume_rate_limit()
-- 3. Table audit_logs et payment_transactions avec RLS
-- 4. Index optimisés pour les requêtes de production
-- 5. Sécurisation RLS stricte (aucun accès direct anon aux tables sensibles)

-- ──────────────────────────────────────────────────────────────────────────────
-- 1. IDEMPOTENCE WEBHOOKS PERSISTANTE
-- ──────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.processed_webhooks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider TEXT NOT NULL,
    event_id TEXT NOT NULL,
    event_type TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'received' CHECK (status IN ('received', 'processing', 'processed', 'failed')),
    received_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    processed_at TIMESTAMPTZ,
    payload_hash TEXT,
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_processed_webhooks_provider_event UNIQUE (provider, event_id)
);

CREATE INDEX IF NOT EXISTS idx_processed_webhooks_lookup 
    ON public.processed_webhooks (provider, event_id, status);
CREATE INDEX IF NOT EXISTS idx_processed_webhooks_received_at 
    ON public.processed_webhooks (received_at DESC);

ALTER TABLE public.processed_webhooks ENABLE ROW LEVEL SECURITY;

-- Interdire strictement l'accès anon/client direct sur processed_webhooks
DROP POLICY IF EXISTS "service_role_only_processed_webhooks" ON public.processed_webhooks;
CREATE POLICY "service_role_only_processed_webhooks" ON public.processed_webhooks
    FOR ALL TO service_role
    USING (true)
    WITH CHECK (true);

-- ──────────────────────────────────────────────────────────────────────────────
-- 2. RATE LIMITING PERSISTANT & ATOMIQUE
-- ──────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.rate_limit_buckets (
    key TEXT PRIMARY KEY,
    window_start TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    request_count INT NOT NULL DEFAULT 1,
    expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_rate_limit_buckets_expires_at 
    ON public.rate_limit_buckets (expires_at);

ALTER TABLE public.rate_limit_buckets ENABLE ROW LEVEL SECURITY;

-- Interdire strictement la modification manuelle des compteurs par les clients
DROP POLICY IF EXISTS "service_role_only_rate_limit_buckets" ON public.rate_limit_buckets;
CREATE POLICY "service_role_only_rate_limit_buckets" ON public.rate_limit_buckets
    FOR ALL TO service_role
    USING (true)
    WITH CHECK (true);

-- Fonction atomique exécutée côté PostgreSQL pour éviter les race conditions (100 reqs concurrentes)
CREATE OR REPLACE FUNCTION public.consume_rate_limit(
    p_key TEXT,
    p_max_requests INT,
    p_window_ms INT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_now TIMESTAMPTZ := clock_timestamp();
    v_window_interval INTERVAL := (p_window_ms || ' milliseconds')::INTERVAL;
    v_rec RECORD;
    v_allowed BOOLEAN;
    v_remaining INT;
    v_reset_ms BIGINT;
BEGIN
    -- Nettoyage opportuniste des entrées expirées depuis plus de 2 minutes
    DELETE FROM public.rate_limit_buckets 
    WHERE expires_at < (v_now - INTERVAL '2 minutes');

    -- UPSERT atomique avec verrou de ligne
    INSERT INTO public.rate_limit_buckets (key, window_start, request_count, expires_at)
    VALUES (p_key, v_now, 1, v_now + v_window_interval)
    ON CONFLICT (key) DO UPDATE
    SET 
        window_start = CASE 
            WHEN rate_limit_buckets.expires_at <= v_now THEN v_now 
            ELSE rate_limit_buckets.window_start 
        END,
        request_count = CASE 
            WHEN rate_limit_buckets.expires_at <= v_now THEN 1 
            ELSE rate_limit_buckets.request_count + 1 
        END,
        expires_at = CASE 
            WHEN rate_limit_buckets.expires_at <= v_now THEN v_now + v_window_interval 
            ELSE rate_limit_buckets.expires_at 
        END
    RETURNING request_count, expires_at INTO v_rec;

    IF v_rec.request_count <= p_max_requests THEN
        v_allowed := TRUE;
        v_remaining := p_max_requests - v_rec.request_count;
    ELSE
        v_allowed := FALSE;
        v_remaining := 0;
    END IF;

    v_reset_ms := GREATEST(0, (EXTRACT(EPOCH FROM (v_rec.expires_at - v_now)) * 1000)::BIGINT);

    RETURN jsonb_build_object(
        'allowed', v_allowed,
        'remaining', v_remaining,
        'resetMs', v_reset_ms,
        'totalLimit', p_max_requests,
        'requestCount', v_rec.request_count
    );
END;
$$;

-- Accorder l'exécution de la fonction atomique sécurisée
GRANT EXECUTE ON FUNCTION public.consume_rate_limit(TEXT, INT, INT) TO anon, authenticated, service_role;

-- ──────────────────────────────────────────────────────────────────────────────
-- 3. AUDIT LOGS & TRANSACTIONS TABLE
-- ──────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
    user_id UUID,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT,
    old_values JSONB,
    new_values JSONB,
    ip_address TEXT,
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_company_created 
    ON public.audit_logs (company_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action 
    ON public.audit_logs (action);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "company_audit_logs_select" ON public.audit_logs;
CREATE POLICY "company_audit_logs_select" ON public.audit_logs
    FOR SELECT TO authenticated
    USING (
        company_id IN (
            SELECT company_id FROM public.memberships WHERE user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "company_audit_logs_insert" ON public.audit_logs;
CREATE POLICY "company_audit_logs_insert" ON public.audit_logs
    FOR INSERT TO authenticated
    WITH CHECK (
        company_id IN (
            SELECT company_id FROM public.memberships WHERE user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "service_role_audit_logs_all" ON public.audit_logs;
CREATE POLICY "service_role_audit_logs_all" ON public.audit_logs
    FOR ALL TO service_role
    USING (true)
    WITH CHECK (true);

-- Table des transactions de paiement réelles
CREATE TABLE IF NOT EXISTS public.payment_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
    provider TEXT NOT NULL,
    amount NUMERIC NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'pending',
    provider_tx_id TEXT,
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_payment_transactions_provider_tx 
    ON public.payment_transactions (provider_tx_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_company 
    ON public.payment_transactions (company_id, created_at DESC);

ALTER TABLE public.payment_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "company_payment_transactions_select" ON public.payment_transactions;
CREATE POLICY "company_payment_transactions_select" ON public.payment_transactions
    FOR SELECT TO authenticated
    USING (
        company_id IN (
            SELECT company_id FROM public.memberships WHERE user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "service_role_payment_transactions_all" ON public.payment_transactions;
CREATE POLICY "service_role_payment_transactions_all" ON public.payment_transactions
    FOR ALL TO service_role
    USING (true)
    WITH CHECK (true);

-- ──────────────────────────────────────────────────────────────────────────────
-- 4. INDEX DE PRODUCTION (PERFORMANCE & RECHERCHE)
-- ──────────────────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_subscriptions_company_status 
    ON public.subscriptions (company_id, status);
CREATE INDEX IF NOT EXISTS idx_notifications_company_read 
    ON public.notifications (company_id, is_read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_automation_runs_automation 
    ON public.automation_runs (automation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_invoices_company_status 
    ON public.invoices (company_id, status);
CREATE INDEX IF NOT EXISTS idx_quotes_company_status 
    ON public.quotes (company_id, status);
