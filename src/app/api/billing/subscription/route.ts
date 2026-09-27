import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedContext, requirePermission } from '@/lib/auth/permissions';
import { DEFAULT_PLANS, getPlanByTier, calculateTrialDaysRemaining } from '@/lib/billing/plans';
import { getUsage } from '@/lib/billing/featureGating';
import { logAuditEvent } from '@/lib/audit/auditLogger';
import { createClient } from '@/lib/supabase/server';
import { PlanTier } from '@/lib/types';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const companyIdParam = searchParams.get('companyId') || undefined;

    const { errorResponse, context } = await getAuthenticatedContext(req, companyIdParam);
    if (errorResponse) return errorResponse;
    const { companyId, user } = context!;

    const supabase = await createClient();

    // 1. Fetch Subscription from table
    const { data: sub } = await supabase
      .from('subscriptions')
      .select('*, plan:plans(*)')
      .eq('company_id', companyId)
      .maybeSingle();

    // 2. Fetch Company details
    const { data: company } = await supabase
      .from('companies')
      .select('id, name, plan, currency')
      .eq('id', companyId)
      .single();

    const planTier: PlanTier = (sub?.plan_tier || company?.plan || 'starter') as PlanTier;
    const activePlan = sub?.plan && sub.plan.limits ? sub.plan : getPlanByTier(planTier);

    // 3. Compute real usage for 7 key resources
    const [usersUsage, custUsage, leadsUsage, invUsage, quotesUsage, autoUsage, aiUsage] = await Promise.all([
      getUsage(companyId, 'users', supabase),
      getUsage(companyId, 'customers', supabase),
      getUsage(companyId, 'leads', supabase),
      getUsage(companyId, 'invoices', supabase),
      getUsage(companyId, 'quotes', supabase),
      getUsage(companyId, 'automations', supabase),
      getUsage(companyId, 'ai_credits', supabase),
    ]);

    // 4. Fetch recent transactions
    const { data: transactions } = await supabase
      .from('payment_transactions')
      .select('*')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })
      .limit(10);

    const trialDaysRemaining = calculateTrialDaysRemaining(sub);

    return NextResponse.json({
      subscription: sub || {
        company_id: companyId,
        plan_tier: planTier,
        status: 'trialing',
        billing_interval: 'monthly',
        trial_days_remaining: 14,
        current_period_start: new Date().toISOString(),
        current_period_end: new Date(Date.now() + 14 * 86400000).toISOString(),
      },
      plan: activePlan,
      trialDaysRemaining,
      usage: {
        users: usersUsage,
        customers: custUsage,
        leads: leadsUsage,
        invoices: invUsage,
        quotes: quotesUsage,
        automations: autoUsage,
        aiCredits: aiUsage,
      },
      transactions: transactions || [],
      allPlans: Object.values(DEFAULT_PLANS),
    });
  } catch (error: any) {
    console.error('Erreur API billing:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des informations de facturation.' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { companyId, targetPlan, billingInterval } = body;

    const { errorResponse, context } = await requirePermission(companyId, 'billing.manage', req);
    if (errorResponse) return errorResponse;
    const { user } = context!;

    if (!targetPlan || !DEFAULT_PLANS[targetPlan as PlanTier]) {
      return NextResponse.json({ error: 'Plan d’abonnement invalide.' }, { status: 400 });
    }

    const supabase = await createClient();
    const newPlan = DEFAULT_PLANS[targetPlan as PlanTier];

    // 1. Update or upsert subscription
    const periodDays = billingInterval === 'yearly' ? 365 : 30;
    const now = new Date();
    const periodEnd = new Date(now.getTime() + periodDays * 86400000);

    const { data: updatedSub, error: subErr } = await supabase
      .from('subscriptions')
      .upsert(
        {
          company_id: companyId,
          plan_tier: targetPlan,
          status: 'active',
          billing_interval: billingInterval || 'monthly',
          current_period_start: now.toISOString(),
          current_period_end: periodEnd.toISOString(),
          cancel_at_period_end: false,
          updated_at: now.toISOString(),
        },
        { onConflict: 'company_id' }
      )
      .select()
      .maybeSingle();

    // 2. Synchronize plan column on company
    await supabase
      .from('companies')
      .update({ plan: targetPlan, updated_at: now.toISOString() })
      .eq('id', companyId);

    // 3. Log audit event
    await logAuditEvent(
      {
        companyId,
        userId: user.id,
        action: 'subscription.changed',
        entityType: 'subscription',
        newValues: { targetPlan, billingInterval, price: billingInterval === 'yearly' ? newPlan.price_yearly : newPlan.price_monthly },
      },
      supabase
    );

    return NextResponse.json({
      success: true,
      message: `Votre abonnement a été basculé avec succès vers le forfait ${newPlan.name} !`,
      subscription: updatedSub,
    });
  } catch (error: any) {
    console.error('Erreur mise à jour subscription:', error);
    return NextResponse.json({ error: 'Impossible de changer d’abonnement.' }, { status: 500 });
  }
}
