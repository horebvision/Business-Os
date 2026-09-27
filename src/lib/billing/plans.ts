// ==============================================================================
// BUSINESSOS — PLANS & PRICING CONFIGURATION (PHASE 5: SECTION 3 & 4)
// ==============================================================================

import { Plan, PlanTier, Subscription } from '@/lib/types';

export const DEFAULT_PLANS: Record<PlanTier, Plan> = {
  starter: {
    id: 'plan_starter_default',
    name: 'Starter',
    slug: 'starter',
    description: 'Pour indépendants et créateurs d’entreprise souhaitant structurer leur gestion commerciale.',
    price_monthly: 15000,
    price_yearly: 150000,
    currency: 'XOF',
    trial_days: 14,
    is_active: true,
    features: {
      crm: true,
      quotes: true,
      invoices: true,
      payments: true,
      email_resend: true,
      whatsapp_link: true,
      whatsapp_cloud: false,
      ai_basic: true,
      ai_advanced: false,
      client_portal: false,
      advanced_analytics: false,
      api_webhooks: false,
      custom_export: false,
      priority_support: false,
      audit_logs: false,
    },
    limits: {
      max_users: 1,
      max_customers: 100,
      max_leads: 100,
      max_invoices_per_month: 50,
      max_quotes_per_month: 50,
      max_automations: 3,
      ai_credits_per_month: 50,
    },
  },
  business: {
    id: 'plan_business_default',
    name: 'Business',
    slug: 'business',
    description: 'Pour PME et équipes en croissance ayant besoin d’automatisation, d’analyses et de portail client.',
    price_monthly: 45000,
    price_yearly: 450000,
    currency: 'XOF',
    trial_days: 14,
    is_active: true,
    features: {
      crm: true,
      quotes: true,
      invoices: true,
      payments: true,
      email_resend: true,
      whatsapp_link: true,
      whatsapp_cloud: true,
      ai_basic: true,
      ai_advanced: true,
      client_portal: true,
      advanced_analytics: true,
      api_webhooks: true,
      custom_export: true,
      priority_support: false,
      audit_logs: true,
    },
    limits: {
      max_users: 5,
      max_customers: 500,
      max_leads: 500,
      max_invoices_per_month: 300,
      max_quotes_per_month: 300,
      max_automations: 15,
      ai_credits_per_month: 300,
    },
  },
  pro: {
    id: 'plan_pro_default',
    name: 'Pro',
    slug: 'pro',
    description: 'Pour entreprises établies exigeant de hautes limites, une IA illimitée et un support dédié.',
    price_monthly: 95000,
    price_yearly: 950000,
    currency: 'XOF',
    trial_days: 14,
    is_active: true,
    features: {
      crm: true,
      quotes: true,
      invoices: true,
      payments: true,
      email_resend: true,
      whatsapp_link: true,
      whatsapp_cloud: true,
      ai_basic: true,
      ai_advanced: true,
      client_portal: true,
      advanced_analytics: true,
      api_webhooks: true,
      custom_export: true,
      priority_support: true,
      audit_logs: true,
    },
    limits: {
      max_users: 20,
      max_customers: 10000,
      max_leads: 10000,
      max_invoices_per_month: 2000,
      max_quotes_per_month: 2000,
      max_automations: 50,
      ai_credits_per_month: 1000,
    },
  },
};

export function getPlanByTier(tier: PlanTier | string): Plan {
  const normalized = (tier?.toLowerCase() || 'starter') as PlanTier;
  return DEFAULT_PLANS[normalized] || DEFAULT_PLANS.starter;
}

export function calculateTrialDaysRemaining(subscription?: Partial<Subscription> | null): number {
  if (!subscription || subscription.status !== 'trialing') return 0;
  const trialEndStr = subscription.trial_end || subscription.current_period_end;
  if (!trialEndStr) return 0;

  const trialEnd = new Date(trialEndStr).getTime();
  const now = Date.now();
  const diffDays = Math.ceil((trialEnd - now) / (1000 * 60 * 60 * 24));
  return Math.max(0, diffDays);
}

export function isSubscriptionActive(subscription?: Partial<Subscription> | null): boolean {
  if (!subscription) return false;
  if (subscription.status === 'active') return true;
  if (subscription.status === 'trialing') {
    return calculateTrialDaysRemaining(subscription) > 0;
  }
  return false;
}
