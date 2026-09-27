-- ==============================================================================
-- BUSINESSOS — DATABASE SCHEMA MIGRATION (PHASE 1 FOUNDATION & FULL SAAS CORE)
-- ==============================================================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==============================================================================
-- 1. USERS & PROFILES
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL UNIQUE,
    first_name TEXT,
    last_name TEXT,
    full_name TEXT GENERATED ALWAYS AS (
        CASE 
            WHEN first_name IS NOT NULL AND last_name IS NOT NULL THEN first_name || ' ' || last_name
            WHEN first_name IS NOT NULL THEN first_name
            WHEN last_name IS NOT NULL THEN last_name
            ELSE email
        END
    ) STORED,
    phone TEXT,
    job_title TEXT,
    avatar_url TEXT,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ==============================================================================
-- 2. COMPANIES (MULTI-TENANT ROOT)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.companies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    logo_url TEXT,
    sector TEXT,
    phone TEXT,
    email TEXT,
    address TEXT,
    country TEXT DEFAULT 'Côte d''Ivoire' NOT NULL,
    city TEXT DEFAULT 'Abidjan' NOT NULL,
    currency TEXT DEFAULT 'FCFA' NOT NULL,
    plan TEXT DEFAULT 'free' CHECK (plan IN ('free', 'pro', 'business')),
    managed_modules JSONB DEFAULT '["customers", "leads", "quotes", "invoices", "payments", "tasks", "team"]'::jsonb,
    onboarding_completed BOOLEAN DEFAULT false NOT NULL,
    created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ==============================================================================
-- 3. MEMBERSHIPS & ROLES
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.memberships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'owner' CHECK (role IN ('owner', 'admin', 'employee', 'accountant')),
    is_active BOOLEAN DEFAULT true NOT NULL,
    invited_email TEXT,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(company_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_memberships_company_user ON public.memberships(company_id, user_id);
CREATE INDEX IF NOT EXISTS idx_memberships_user ON public.memberships(user_id);

-- ==============================================================================
-- 4. CRM — LEADS (PROSPECTS)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.leads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    company_name TEXT,
    phone TEXT,
    email TEXT,
    source TEXT DEFAULT 'Autre',
    status TEXT NOT NULL DEFAULT 'Nouveau' CHECK (status IN ('Nouveau', 'Contacté', 'Qualifié', 'Proposition envoyée', 'Négociation', 'Gagné', 'Perdu')),
    potential_amount NUMERIC(15, 2) DEFAULT 0.00,
    assigned_to UUID REFERENCES public.users(id) ON DELETE SET NULL,
    next_action TEXT,
    last_interaction_at TIMESTAMPTZ,
    notes TEXT,
    created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_leads_company ON public.leads(company_id);
CREATE INDEX IF NOT EXISTS idx_leads_status ON public.leads(company_id, status);

-- ==============================================================================
-- 5. CRM — CUSTOMERS (CLIENTS)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    company_name TEXT,
    phone TEXT,
    email TEXT,
    address TEXT,
    city TEXT,
    notes TEXT,
    total_invoiced NUMERIC(15, 2) DEFAULT 0.00,
    total_paid NUMERIC(15, 2) DEFAULT 0.00,
    total_due NUMERIC(15, 2) DEFAULT 0.00,
    last_activity_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
    created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_customers_company ON public.customers(company_id);

-- ==============================================================================
-- 6. FINANCES — QUOTES & ITEMS (DEVIS)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.quotes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
    quote_number TEXT NOT NULL,
    issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
    expiration_date DATE NOT NULL DEFAULT (CURRENT_DATE + INTERVAL '30 days'),
    subtotal NUMERIC(15, 2) DEFAULT 0.00 NOT NULL,
    discount_rate NUMERIC(5, 2) DEFAULT 0.00,
    discount_amount NUMERIC(15, 2) DEFAULT 0.00,
    tax_rate NUMERIC(5, 2) DEFAULT 18.00, -- Standard TVA Côte d'Ivoire
    tax_amount NUMERIC(15, 2) DEFAULT 0.00,
    total NUMERIC(15, 2) DEFAULT 0.00 NOT NULL,
    currency TEXT DEFAULT 'FCFA' NOT NULL,
    status TEXT NOT NULL DEFAULT 'Brouillon' CHECK (status IN ('Brouillon', 'Envoyé', 'Consulté', 'Accepté', 'Refusé', 'Expiré')),
    terms TEXT,
    notes TEXT,
    created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(company_id, quote_number)
);

CREATE TABLE IF NOT EXISTS public.quote_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quote_id UUID NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
    description TEXT NOT NULL,
    quantity NUMERIC(10, 2) DEFAULT 1.00 NOT NULL,
    unit_price NUMERIC(15, 2) DEFAULT 0.00 NOT NULL,
    total NUMERIC(15, 2) DEFAULT 0.00 NOT NULL,
    sort_order INT DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_quotes_company ON public.quotes(company_id);
CREATE INDEX IF NOT EXISTS idx_quotes_customer ON public.quotes(customer_id);

-- ==============================================================================
-- 7. FINANCES — INVOICES & ITEMS (FACTURES)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
    quote_id UUID REFERENCES public.quotes(id) ON DELETE SET NULL,
    invoice_number TEXT NOT NULL,
    issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
    due_date DATE NOT NULL DEFAULT (CURRENT_DATE + INTERVAL '15 days'),
    subtotal NUMERIC(15, 2) DEFAULT 0.00 NOT NULL,
    discount_amount NUMERIC(15, 2) DEFAULT 0.00,
    tax_amount NUMERIC(15, 2) DEFAULT 0.00,
    total NUMERIC(15, 2) DEFAULT 0.00 NOT NULL,
    paid_amount NUMERIC(15, 2) DEFAULT 0.00 NOT NULL,
    remaining_amount NUMERIC(15, 2) GENERATED ALWAYS AS (total - paid_amount) STORED,
    currency TEXT DEFAULT 'FCFA' NOT NULL,
    status TEXT NOT NULL DEFAULT 'Brouillon' CHECK (status IN ('Brouillon', 'Envoyée', 'Partiellement payée', 'Payée', 'En retard', 'Annulée')),
    notes TEXT,
    terms TEXT,
    last_reminder_sent_at TIMESTAMPTZ,
    created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(company_id, invoice_number)
);

CREATE TABLE IF NOT EXISTS public.invoice_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
    description TEXT NOT NULL,
    quantity NUMERIC(10, 2) DEFAULT 1.00 NOT NULL,
    unit_price NUMERIC(15, 2) DEFAULT 0.00 NOT NULL,
    total NUMERIC(15, 2) DEFAULT 0.00 NOT NULL,
    sort_order INT DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_invoices_company ON public.invoices(company_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON public.invoices(company_id, status);
CREATE INDEX IF NOT EXISTS idx_invoices_customer ON public.invoices(customer_id);

-- ==============================================================================
-- 8. FINANCES — PAYMENTS (PAIEMENTS)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
    customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
    amount NUMERIC(15, 2) NOT NULL CHECK (amount > 0),
    payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
    payment_method TEXT NOT NULL DEFAULT 'Virement bancaire' CHECK (payment_method IN ('Espèces', 'Virement bancaire', 'Chèque', 'Mobile Money', 'Autre')),
    reference TEXT,
    notes TEXT,
    created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_payments_company ON public.payments(company_id);
CREATE INDEX IF NOT EXISTS idx_payments_invoice ON public.payments(invoice_id);

-- ==============================================================================
-- 9. TASKS (TÂCHES)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    assigned_to UUID REFERENCES public.users(id) ON DELETE SET NULL,
    priority TEXT NOT NULL DEFAULT 'Normale' CHECK (priority IN ('Faible', 'Normale', 'Haute', 'Urgente')),
    due_date DATE,
    customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
    project_name TEXT,
    status TEXT NOT NULL DEFAULT 'À faire' CHECK (status IN ('À faire', 'En cours', 'Terminée')),
    completed_at TIMESTAMPTZ,
    created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_tasks_company ON public.tasks(company_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned ON public.tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON public.tasks(company_id, status);

-- ==============================================================================
-- 10. ACTIVITIES (JOURNAL D'AUDIT)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.activities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id UUID,
    entity_title TEXT,
    description TEXT NOT NULL,
    customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_activities_company ON public.activities(company_id);
CREATE INDEX IF NOT EXISTS idx_activities_customer ON public.activities(customer_id);

-- ==============================================================================
-- 11. NOTIFICATIONS
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'info' CHECK (type IN ('info', 'success', 'warning', 'danger')),
    link TEXT,
    is_read BOOLEAN DEFAULT false NOT NULL,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON public.notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_company ON public.notifications(company_id);

-- ==============================================================================
-- 12. DOCUMENTS
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'Autres' CHECK (category IN ('Devis', 'Factures', 'Contrats', 'Reçus', 'Autres')),
    file_url TEXT NOT NULL,
    file_size INT,
    mime_type TEXT,
    created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_documents_company ON public.documents(company_id);

-- ==============================================================================
-- 13. AUTOMATIONS & RUNS
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.automations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    trigger_event TEXT NOT NULL, -- 'invoice_overdue', 'quote_accepted', 'lead_created', 'task_due_soon', 'customer_created'
    action_type TEXT NOT NULL,  -- 'create_task', 'send_email', 'change_status', 'create_notification', 'schedule_reminder'
    action_config JSONB DEFAULT '{}'::jsonb NOT NULL,
    is_active BOOLEAN DEFAULT true NOT NULL,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.automation_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    automation_id UUID NOT NULL REFERENCES public.automations(id) ON DELETE CASCADE,
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    triggered_by TEXT,
    status TEXT NOT NULL CHECK (status IN ('success', 'failed', 'pending')),
    details JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ==============================================================================
-- 14. SUBSCRIPTIONS
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE UNIQUE,
    plan_tier TEXT DEFAULT 'free' CHECK (plan_tier IN ('free', 'pro', 'business')),
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'past_due', 'canceled', 'trialing')),
    current_period_start TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
    current_period_end TIMESTAMPTZ DEFAULT (timezone('utc'::text, now()) + INTERVAL '30 days'),
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ==============================================================================
-- 15. AUTOMATIC TRIGGER FOR AUTH.USERS -> PUBLIC.USERS
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.users (id, email, first_name, last_name, phone, avatar_url)
    VALUES (
        NEW.id,
        NEW.email,
        NEW.raw_user_meta_data->>'first_name',
        NEW.raw_user_meta_data->>'last_name',
        NEW.raw_user_meta_data->>'phone',
        NEW.raw_user_meta_data->>'avatar_url'
    )
    ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        first_name = COALESCE(EXCLUDED.first_name, public.users.first_name),
        last_name = COALESCE(EXCLUDED.last_name, public.users.last_name),
        phone = COALESCE(EXCLUDED.phone, public.users.phone),
        avatar_url = COALESCE(EXCLUDED.avatar_url, public.users.avatar_url),
        updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT OR UPDATE ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();

-- ==============================================================================
-- 16. TRIGGER TO UPDATE CUSTOMER STATS UPON PAYMENT / INVOICE
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.update_invoice_payment_stats()
RETURNS TRIGGER AS $$
DECLARE
    v_total_paid NUMERIC(15, 2);
    v_invoice_total NUMERIC(15, 2);
    v_customer_id UUID;
    v_company_id UUID;
BEGIN
    -- Recalculate paid amount for the affected invoice
    SELECT COALESCE(SUM(amount), 0) INTO v_total_paid 
    FROM public.payments 
    WHERE invoice_id = COALESCE(NEW.invoice_id, OLD.invoice_id);

    SELECT total, customer_id, company_id INTO v_invoice_total, v_customer_id, v_company_id 
    FROM public.invoices 
    WHERE id = COALESCE(NEW.invoice_id, OLD.invoice_id);

    UPDATE public.invoices 
    SET 
        paid_amount = v_total_paid,
        status = CASE 
            WHEN v_total_paid >= v_invoice_total AND v_invoice_total > 0 THEN 'Payée'
            WHEN v_total_paid > 0 AND v_total_paid < v_invoice_total THEN 'Partiellement payée'
            WHEN due_date < CURRENT_DATE AND v_total_paid < v_invoice_total THEN 'En retard'
            ELSE status
        END,
        updated_at = timezone('utc'::text, now())
    WHERE id = COALESCE(NEW.invoice_id, OLD.invoice_id);

    -- Also update customer aggregated totals if customer_id is present
    IF v_customer_id IS NOT NULL THEN
        UPDATE public.customers
        SET 
            total_invoiced = (SELECT COALESCE(SUM(total), 0) FROM public.invoices WHERE customer_id = v_customer_id AND status != 'Annulée'),
            total_paid = (SELECT COALESCE(SUM(amount), 0) FROM public.payments WHERE customer_id = v_customer_id),
            total_due = (SELECT COALESCE(SUM(total - paid_amount), 0) FROM public.invoices WHERE customer_id = v_customer_id AND status NOT IN ('Payée', 'Annulée')),
            last_activity_at = timezone('utc'::text, now()),
            updated_at = timezone('utc'::text, now())
        WHERE id = v_customer_id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_payment_change ON public.payments;
CREATE TRIGGER on_payment_change
    AFTER INSERT OR UPDATE OR DELETE ON public.payments
    FOR EACH ROW EXECUTE FUNCTION public.update_invoice_payment_stats();

-- ==============================================================================
-- 17. ROW LEVEL SECURITY (RLS) FOR MULTI-TENANT ISOLATION
-- ==============================================================================
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quote_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automation_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

-- Security helper: check if user is a member of the company
CREATE OR REPLACE FUNCTION public.is_member_of(p_company_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.memberships 
        WHERE company_id = p_company_id 
          AND user_id = auth.uid() 
          AND is_active = true
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Users policies
CREATE POLICY "Users can read own profile" ON public.users
    FOR SELECT USING (id = auth.uid());
CREATE POLICY "Users can update own profile" ON public.users
    FOR UPDATE USING (id = auth.uid());
CREATE POLICY "Users can see colleagues in their companies" ON public.users
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.memberships m1
            JOIN public.memberships m2 ON m1.company_id = m2.company_id
            WHERE m1.user_id = auth.uid() AND m2.user_id = public.users.id
        )
    );

-- Companies policies
CREATE POLICY "Members can view their companies" ON public.companies
    FOR SELECT USING (public.is_member_of(id));
CREATE POLICY "Users can create companies" ON public.companies
    FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Owners and admins can update their company" ON public.companies
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.memberships
            WHERE company_id = id AND user_id = auth.uid() AND role IN ('owner', 'admin')
        )
    );

-- Memberships policies
CREATE POLICY "Members can view company memberships" ON public.memberships
    FOR SELECT USING (public.is_member_of(company_id));
CREATE POLICY "Users can insert membership during company creation" ON public.memberships
    FOR INSERT WITH CHECK (user_id = auth.uid() OR public.is_member_of(company_id));
CREATE POLICY "Admins can update company memberships" ON public.memberships
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.memberships
            WHERE company_id = public.memberships.company_id AND user_id = auth.uid() AND role IN ('owner', 'admin')
        )
    );
CREATE POLICY "Admins can delete company memberships" ON public.memberships
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM public.memberships
            WHERE company_id = public.memberships.company_id AND user_id = auth.uid() AND role IN ('owner', 'admin')
        )
    );

-- Generic Multi-tenant Policies Macro for business entities
CREATE POLICY "Tenant isolation for leads" ON public.leads
    FOR ALL USING (public.is_member_of(company_id)) WITH CHECK (public.is_member_of(company_id));

CREATE POLICY "Tenant isolation for customers" ON public.customers
    FOR ALL USING (public.is_member_of(company_id)) WITH CHECK (public.is_member_of(company_id));

CREATE POLICY "Tenant isolation for quotes" ON public.quotes
    FOR ALL USING (public.is_member_of(company_id)) WITH CHECK (public.is_member_of(company_id));

CREATE POLICY "Tenant isolation for quote_items" ON public.quote_items
    FOR ALL USING (
        EXISTS (SELECT 1 FROM public.quotes q WHERE q.id = quote_id AND public.is_member_of(q.company_id))
    ) WITH CHECK (
        EXISTS (SELECT 1 FROM public.quotes q WHERE q.id = quote_id AND public.is_member_of(q.company_id))
    );

CREATE POLICY "Tenant isolation for invoices" ON public.invoices
    FOR ALL USING (public.is_member_of(company_id)) WITH CHECK (public.is_member_of(company_id));

CREATE POLICY "Tenant isolation for invoice_items" ON public.invoice_items
    FOR ALL USING (
        EXISTS (SELECT 1 FROM public.invoices i WHERE i.id = invoice_id AND public.is_member_of(i.company_id))
    ) WITH CHECK (
        EXISTS (SELECT 1 FROM public.invoices i WHERE i.id = invoice_id AND public.is_member_of(i.company_id))
    );

CREATE POLICY "Tenant isolation for payments" ON public.payments
    FOR ALL USING (public.is_member_of(company_id)) WITH CHECK (public.is_member_of(company_id));

CREATE POLICY "Tenant isolation for tasks" ON public.tasks
    FOR ALL USING (public.is_member_of(company_id)) WITH CHECK (public.is_member_of(company_id));

CREATE POLICY "Tenant isolation for activities" ON public.activities
    FOR ALL USING (public.is_member_of(company_id)) WITH CHECK (public.is_member_of(company_id));

CREATE POLICY "Tenant isolation for notifications" ON public.notifications
    FOR ALL USING (public.is_member_of(company_id) AND (user_id = auth.uid() OR user_id IS NULL))
    WITH CHECK (public.is_member_of(company_id));

CREATE POLICY "Tenant isolation for documents" ON public.documents
    FOR ALL USING (public.is_member_of(company_id)) WITH CHECK (public.is_member_of(company_id));

CREATE POLICY "Tenant isolation for automations" ON public.automations
    FOR ALL USING (public.is_member_of(company_id)) WITH CHECK (public.is_member_of(company_id));

CREATE POLICY "Tenant isolation for automation_runs" ON public.automation_runs
    FOR ALL USING (public.is_member_of(company_id)) WITH CHECK (public.is_member_of(company_id));

CREATE POLICY "Tenant isolation for subscriptions" ON public.subscriptions
    FOR ALL USING (public.is_member_of(company_id)) WITH CHECK (public.is_member_of(company_id));

-- ==============================================================================
-- 18. DEMO DATA SEEDING RPC (ON-DEMAND ONLY, STRICTLY ISOLATED PER COMPANY)
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.seed_company_demo_data(p_company_id UUID, p_user_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_c1 UUID; v_c2 UUID; v_c3 UUID;
    v_l1 UUID; v_l2 UUID; v_l3 UUID;
    v_q1 UUID; v_q2 UUID;
    v_i1 UUID; v_i2 UUID; v_i3 UUID;
BEGIN
    -- Verify caller is authorized
    IF NOT EXISTS (SELECT 1 FROM public.memberships WHERE company_id = p_company_id AND user_id = p_user_id) THEN
        RAISE EXCEPTION 'Not authorized to seed demo data for this company';
    END IF;

    -- 1. Create Customers
    INSERT INTO public.customers (company_id, name, company_name, phone, email, address, city, created_by)
    VALUES (p_company_id, 'Koffi Kouassi', 'Ivoire Tech Solutions', '+225 07 08 09 10 11', 'contact@ivoiretech.ci', 'Plateau, Immeuble CCIA', 'Abidjan', p_user_id)
    RETURNING id INTO v_c1;

    INSERT INTO public.customers (company_id, name, company_name, phone, email, address, city, created_by)
    VALUES (p_company_id, 'Amina Diallo', 'Sahel Agro Distribution', '+225 05 06 07 08 09', 'amina@sahelagro.com', 'Zone Industrielle Yopougon', 'Abidjan', p_user_id)
    RETURNING id INTO v_c2;

    INSERT INTO public.customers (company_id, name, company_name, phone, email, address, city, created_by)
    VALUES (p_company_id, 'Marc Bamba', 'Bamba BTP & Rénovations', '+225 01 02 03 04 05', 'bamba@btp-ci.com', 'Cocody Angré 8ème tranche', 'Abidjan', p_user_id)
    RETURNING id INTO v_c3;

    -- 2. Create Leads (Prospects)
    INSERT INTO public.leads (company_id, name, company_name, phone, email, source, status, potential_amount, next_action, last_interaction_at, notes, created_by)
    VALUES 
    (p_company_id, 'Yapi Jean-Eudes', 'Global Logistique Express', '+225 07 45 67 89', 'jyapi@globallog.ci', 'Recommandation', 'Proposition envoyée', 1250000.00, 'Relancer pour signature devis', now() - INTERVAL '2 days', 'Très intéressé par l''automatisation des relances de paiement.', p_user_id)
    RETURNING id INTO v_l1;

    INSERT INTO public.leads (company_id, name, company_name, phone, email, source, status, potential_amount, next_action, last_interaction_at, notes, created_by)
    VALUES 
    (p_company_id, 'Fatou Traoré', 'Cabinet Conseil Audit & Fisc', '+225 05 12 34 56', 'fatou.traore@auditfisc.ci', 'Site Web', 'Négociation', 2400000.00, 'Rendez-vous démo finale jeudi', now() - INTERVAL '8 days', 'N''a pas été relancée depuis 8 jours.', p_user_id)
    RETURNING id INTO v_l2;

    INSERT INTO public.leads (company_id, name, company_name, phone, email, source, status, potential_amount, next_action, last_interaction_at, notes, created_by)
    VALUES 
    (p_company_id, 'Emmanuel Assoh', 'Pharmacie des Lagunes', '+225 01 98 76 54', 'direction@pharma-lagunes.ci', 'Prospection directe', 'Nouveau', 850000.00, 'Premier appel de qualification', now() - INTERVAL '1 day', 'Nouveau contact entrant.', p_user_id)
    RETURNING id INTO v_l3;

    -- 3. Create Quotes (Devis)
    INSERT INTO public.quotes (company_id, customer_id, quote_number, issue_date, expiration_date, subtotal, discount_amount, tax_rate, tax_amount, total, currency, status, created_by)
    VALUES (p_company_id, v_c1, 'DEV-2026-001', CURRENT_DATE - INTERVAL '10 days', CURRENT_DATE + INTERVAL '20 days', 1500000.00, 0, 18.00, 270000.00, 1770000.00, 'FCFA', 'Accepté', p_user_id)
    RETURNING id INTO v_q1;

    INSERT INTO public.quote_items (quote_id, description, quantity, unit_price, total)
    VALUES 
    (v_q1, 'Audit organisationnel et comptable', 1, 1000000.00, 1000000.00),
    (v_q1, 'Mise en place de l''assistant digital', 1, 500000.00, 500000.00);

    INSERT INTO public.quotes (company_id, customer_id, quote_number, issue_date, expiration_date, subtotal, discount_amount, tax_rate, tax_amount, total, currency, status, created_by)
    VALUES (p_company_id, v_c2, 'DEV-2026-002', CURRENT_DATE - INTERVAL '3 days', CURRENT_DATE + INTERVAL '27 days', 800000.00, 50000.00, 18.00, 135000.00, 885000.00, 'FCFA', 'Envoyé', p_user_id)
    RETURNING id INTO v_q2;

    INSERT INTO public.quote_items (quote_id, description, quantity, unit_price, total)
    VALUES 
    (v_q2, 'Abonnement gestion commerciale 6 mois', 1, 800000.00, 800000.00);

    -- 4. Create Invoices (Factures)
    -- Invoice 1: Partially Paid
    INSERT INTO public.invoices (company_id, customer_id, quote_id, invoice_number, issue_date, due_date, subtotal, tax_amount, total, paid_amount, currency, status, created_by)
    VALUES (p_company_id, v_c1, v_q1, 'FAC-2026-001', CURRENT_DATE - INTERVAL '15 days', CURRENT_DATE + INTERVAL '15 days', 1500000.00, 270000.00, 1770000.00, 1000000.00, 'FCFA', 'Partiellement payée', p_user_id)
    RETURNING id INTO v_i1;

    INSERT INTO public.invoice_items (invoice_id, description, quantity, unit_price, total)
    VALUES 
    (v_i1, 'Audit organisationnel et comptable', 1, 1000000.00, 1000000.00),
    (v_i1, 'Mise en place de l''assistant digital', 1, 500000.00, 500000.00);

    INSERT INTO public.payments (company_id, invoice_id, customer_id, amount, payment_date, payment_method, reference, notes, created_by)
    VALUES (p_company_id, v_i1, v_c1, 1000000.00, CURRENT_DATE - INTERVAL '10 days', 'Virement bancaire', 'VIR-SGBCI-88912', 'Acompte initial 60%', p_user_id);

    -- Invoice 2: Overdue (Relance requise!)
    INSERT INTO public.invoices (company_id, customer_id, invoice_number, issue_date, due_date, subtotal, tax_amount, total, paid_amount, currency, status, created_by)
    VALUES (p_company_id, v_c3, 'FAC-2026-002', CURRENT_DATE - INTERVAL '30 days', CURRENT_DATE - INTERVAL '12 days', 450000.00, 0.00, 450000.00, 0.00, 'FCFA', 'En retard', p_user_id)
    RETURNING id INTO v_i2;

    INSERT INTO public.invoice_items (invoice_id, description, quantity, unit_price, total)
    VALUES (v_i2, 'Prestation travaux et fournitures administratives', 1, 450000.00, 450000.00);

    -- Invoice 3: Fully Paid
    INSERT INTO public.invoices (company_id, customer_id, invoice_number, issue_date, due_date, subtotal, tax_amount, total, paid_amount, currency, status, created_by)
    VALUES (p_company_id, v_c2, 'FAC-2026-003', CURRENT_DATE - INTERVAL '40 days', CURRENT_DATE - INTERVAL '25 days', 600000.00, 108000.00, 708000.00, 708000.00, 'FCFA', 'Payée', p_user_id)
    RETURNING id INTO v_i3;

    INSERT INTO public.invoice_items (invoice_id, description, quantity, unit_price, total)
    VALUES (v_i3, 'Installation matérielle et formation', 1, 600000.00, 600000.00);

    INSERT INTO public.payments (company_id, invoice_id, customer_id, amount, payment_date, payment_method, reference, notes, created_by)
    VALUES (p_company_id, v_i3, v_c2, 708000.00, CURRENT_DATE - INTERVAL '24 days', 'Mobile Money', 'WAVE-CI-773419', 'Règlement solde total via Wave', p_user_id);

    -- 5. Create Tasks
    INSERT INTO public.tasks (company_id, title, description, assigned_to, priority, due_date, customer_id, project_name, status, created_by)
    VALUES 
    (p_company_id, 'Relancer Bamba BTP pour facture en retard #FAC-2026-002', 'Facture de 450 000 FCFA en retard de 12 jours.', p_user_id, 'Urgente', CURRENT_DATE, v_c3, 'Recouvrement', 'À faire', p_user_id),
    (p_company_id, 'Préparer réunion démo avec Fatou Traoré', 'Présenter le module devis & facturation automatisée.', p_user_id, 'Haute', CURRENT_DATE, NULL, 'Vente', 'À faire', p_user_id),
    (p_company_id, 'Finaliser le rapport d''audit Ivoire Tech', 'Rédiger la synthèse des recommandations administratives.', p_user_id, 'Normale', CURRENT_DATE + INTERVAL '2 days', v_c1, 'Conseil', 'En cours', p_user_id),
    (p_company_id, 'Vérifier la réception du virement SGBCI', 'Vérifier sur le relevé en ligne.', p_user_id, 'Faible', CURRENT_DATE - INTERVAL '1 day', v_c1, 'Comptabilité', 'Terminée', p_user_id);

    -- 6. Create Initial Activities
    INSERT INTO public.activities (company_id, user_id, action, entity_type, entity_id, entity_title, description, customer_id)
    VALUES 
    (p_company_id, p_user_id, 'Paiement enregistré', 'payment', v_i1, 'Paiement de 1 000 000 FCFA', 'Acompte enregistré pour la facture #FAC-2026-001 (Ivoire Tech Solutions)', v_c1),
    (p_company_id, p_user_id, 'Devis accepté', 'quote', v_q1, 'Devis #DEV-2026-001', 'Le devis #DEV-2026-001 de 1 770 000 FCFA a été marqué comme Accepté', v_c1),
    (p_company_id, p_user_id, 'Facture créée', 'invoice', v_i2, 'Facture #FAC-2026-002', 'Facture #FAC-2026-002 émise pour Bamba BTP & Rénovations', v_c3);

    -- 7. Create Initial Notifications
    INSERT INTO public.notifications (company_id, user_id, title, message, type, link)
    VALUES 
    (p_company_id, p_user_id, 'Facture en retard', 'La facture #FAC-2026-002 (450 000 FCFA) pour Bamba BTP est en retard de 12 jours.', 'danger', '/invoices'),
    (p_company_id, p_user_id, 'Prospect à relancer', 'Fatou Traoré (Cabinet Conseil Audit) n''a pas été relancée depuis 8 jours.', 'warning', '/leads'),
    (p_company_id, p_user_id, 'Devis en attente', 'Le devis #DEV-2026-002 attend une réponse de Sahel Agro.', 'info', '/quotes');

    RETURN jsonb_build_object(
        'success', true,
        'message', 'Demo data seeded successfully for company',
        'customers', 3,
        'leads', 3,
        'quotes', 2,
        'invoices', 3,
        'tasks', 4
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
