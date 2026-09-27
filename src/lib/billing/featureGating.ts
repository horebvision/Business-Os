// ==============================================================================
// BUSINESSOS — FEATURE GATING & LIMITS ENGINE (PHASE 5: SECTION 7 & 8)
// ==============================================================================

import { PlanFeatures, PlanLimits, PlanTier } from '@/lib/types';
import { DEFAULT_PLANS, getPlanByTier, isSubscriptionActive } from '@/lib/billing/plans';
import { createClient } from '@/lib/supabase/server';

export type FeatureKey = keyof PlanFeatures;
export type ResourceKey = 'users' | 'customers' | 'leads' | 'invoices' | 'quotes' | 'automations' | 'ai_credits';

export interface UsageStatus {
  resource: ResourceKey;
  current: number;
  max: number;
  remaining: number;
  allowed: boolean;
  percentage: number;
}

export interface LimitCheckResult {
  allowed: boolean;
  message?: string;
  current: number;
  max: number;
  planName: string;
}

/**
 * Récupère le plan actif effectif d'une entreprise (depuis subscriptions ou companies.plan).
 */
export async function getCompanyActivePlan(companyId: string, supabaseClient?: any) {
  const supabase = supabaseClient || (await createClient());

  try {
    // 1. Tenter de lire depuis subscriptions
    const { data: sub } = await supabase
      .from('subscriptions')
      .select('*, plan:plans(*)')
      .eq('company_id', companyId)
      .maybeSingle();

    if (sub) {
      if (sub.plan && sub.plan.limits) {
        return {
          plan: sub.plan,
          tier: (sub.plan_tier || sub.plan.slug || 'starter') as PlanTier,
          subscription: sub,
        };
      }
      const tier = (sub.plan_tier || 'starter') as PlanTier;
      return {
        plan: getPlanByTier(tier),
        tier,
        subscription: sub,
      };
    }

    // 2. Repli sur le champ plan de companies
    const { data: comp } = await supabase
      .from('companies')
      .select('plan')
      .eq('id', companyId)
      .maybeSingle();

    const tier = ((comp?.plan as PlanTier) || 'starter') as PlanTier;
    return {
      plan: getPlanByTier(tier),
      tier,
      subscription: null,
    };
  } catch (err) {
    return {
      plan: DEFAULT_PLANS.starter,
      tier: 'starter' as PlanTier,
      subscription: null,
    };
  }
}

/**
 * Vérifie si l'entreprise dispose d'une fonctionnalité spécifique.
 */
export async function hasFeature(
  companyId: string,
  feature: FeatureKey,
  supabaseClient?: any
): Promise<boolean> {
  const { plan, subscription } = await getCompanyActivePlan(companyId, supabaseClient);

  // Si abonnement présent mais expiré/annulé, bloquer les fonctionnalités avancées
  if (subscription && !isSubscriptionActive(subscription)) {
    return false;
  }

  return Boolean(plan.features[feature]);
}

/**
 * Calcule l'utilisation actuelle d'une ressource pour le mois ou la période en cours.
 */
export async function getUsage(
  companyId: string,
  resource: ResourceKey,
  supabaseClient?: any
): Promise<UsageStatus> {
  const supabase = supabaseClient || (await createClient());
  const { plan } = await getCompanyActivePlan(companyId, supabase);

  let current = 0;
  let max = 100;

  // Définir la limite max selon le plan
  switch (resource) {
    case 'users':
      max = plan.limits.max_users;
      break;
    case 'customers':
      max = plan.limits.max_customers;
      break;
    case 'leads':
      max = plan.limits.max_leads;
      break;
    case 'invoices':
      max = plan.limits.max_invoices_per_month;
      break;
    case 'quotes':
      max = plan.limits.max_quotes_per_month;
      break;
    case 'automations':
      max = plan.limits.max_automations;
      break;
    case 'ai_credits':
      max = plan.limits.ai_credits_per_month;
      break;
  }

  // Calcul du compte réel actuel
  try {
    const today = new Date();
    const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString();

    if (resource === 'users') {
      const { count } = await supabase
        .from('memberships')
        .select('*', { count: 'exact', head: true })
        .eq('company_id', companyId)
        .eq('is_active', true);
      current = count || 0;
    } else if (resource === 'customers') {
      const { count } = await supabase
        .from('customers')
        .select('*', { count: 'exact', head: true })
        .eq('company_id', companyId);
      current = count || 0;
    } else if (resource === 'leads') {
      const { count } = await supabase
        .from('leads')
        .select('*', { count: 'exact', head: true })
        .eq('company_id', companyId);
      current = count || 0;
    } else if (resource === 'invoices') {
      const { count } = await supabase
        .from('invoices')
        .select('*', { count: 'exact', head: true })
        .eq('company_id', companyId)
        .gte('created_at', firstDayOfMonth);
      current = count || 0;
    } else if (resource === 'quotes') {
      const { count } = await supabase
        .from('quotes')
        .select('*', { count: 'exact', head: true })
        .eq('company_id', companyId)
        .gte('created_at', firstDayOfMonth);
      current = count || 0;
    } else if (resource === 'automations') {
      const { count } = await supabase
        .from('automations')
        .select('*', { count: 'exact', head: true })
        .eq('company_id', companyId)
        .eq('is_active', true);
      current = count || 0;
    } else if (resource === 'ai_credits') {
      // Compter les actions IA du mois dans activities
      const { count } = await supabase
        .from('activities')
        .select('*', { count: 'exact', head: true })
        .eq('company_id', companyId)
        .eq('entity_type', 'ai')
        .gte('created_at', firstDayOfMonth);
      current = count || 0;
    }
  } catch (e) {
    current = 0;
  }

  const allowed = current < max;
  const remaining = Math.max(0, max - current);
  const percentage = max > 0 ? Math.min(100, Math.round((current / max) * 100)) : 0;

  return {
    resource,
    current,
    max,
    remaining,
    allowed,
    percentage,
  };
}

/**
 * Vérifie si une création est autorisée au regard des quotas de l'abonnement.
 */
export async function checkLimit(
  companyId: string,
  resource: ResourceKey,
  supabaseClient?: any
): Promise<LimitCheckResult> {
  const { plan } = await getCompanyActivePlan(companyId, supabaseClient);
  const usage = await getUsage(companyId, resource, supabaseClient);

  if (!usage.allowed) {
    const resourceNames: Record<ResourceKey, string> = {
      users: 'utilisateurs',
      customers: 'clients',
      leads: 'prospects',
      invoices: 'factures ce mois-ci',
      quotes: 'devis ce mois-ci',
      automations: 'automatisations actives',
      ai_credits: 'crédits IA mensuels',
    };

    return {
      allowed: false,
      current: usage.current,
      max: usage.max,
      planName: plan.name,
      message: `Vous avez atteint la limite de ${usage.max} ${resourceNames[resource]} de votre forfait ${plan.name}. Passez au plan supérieur pour continuer à créer sans interruption.`,
    };
  }

  return {
    allowed: true,
    current: usage.current,
    max: usage.max,
    planName: plan.name,
  };
}
