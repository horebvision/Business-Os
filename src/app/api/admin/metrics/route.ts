import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedContext } from '@/lib/auth/permissions';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { DEFAULT_PLANS } from '@/lib/billing/plans';

export async function GET(req: NextRequest) {
  try {
    const { errorResponse, context } = await getAuthenticatedContext(req);
    if (errorResponse || !context) {
      return errorResponse || NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    // Verify if user is platform admin or owner
    const { data: userProfile } = await supabaseAdmin
      .from('users')
      .select('id, email, is_platform_admin')
      .eq('id', context.user.id)
      .maybeSingle();

    const isPlatformAdmin = userProfile?.is_platform_admin === true || context.role === 'owner';
    if (!isPlatformAdmin) {
      return NextResponse.json(
        { error: 'Accès réservé aux administrateurs de la plateforme BusinessOS.' },
        { status: 403 }
      );
    }

    // 1. Total companies
    const { count: totalCompanies } = await supabaseAdmin
      .from('companies')
      .select('*', { count: 'exact', head: true });

    // 2. Total users
    const { count: totalUsers } = await supabaseAdmin
      .from('users')
      .select('*', { count: 'exact', head: true });

    // 3. Subscriptions breakdown
    const { data: allSubscriptions } = await supabaseAdmin
      .from('subscriptions')
      .select('*');

    const subs: any[] = allSubscriptions || [];
    const activeSubs = subs.filter((s: any) => s.status === 'active').length;
    const trialingSubs = subs.filter((s: any) => s.status === 'trialing').length;
    const pastDueSubs = subs.filter((s: any) => s.status === 'past_due').length;
    const canceledSubs = subs.filter((s: any) => s.status === 'canceled').length;

    // 4. MRR calculation from active subscriptions
    let calculatedMrr = 0;
    const planList: any[] = Object.values(DEFAULT_PLANS);
    subs.forEach((s: any) => {
      if (s.status === 'active') {
        const plan = planList.find((p: any) => p.slug === s.plan_id || p.id === s.plan_id);
        if (plan && plan.price_monthly) {
          calculatedMrr += plan.price_monthly;
        } else {
          // Default Business plan MRR
          calculatedMrr += 45000;
        }
      }
    });

    // 5. Recent Companies list
    const { data: recentCompanies } = await supabaseAdmin
      .from('companies')
      .select('id, name, created_at, plan, currency')
      .order('created_at', { ascending: false })
      .limit(10);

    // 6. Recent Audit Events / System Activity
    const { data: recentAudits } = await supabaseAdmin
      .from('audit_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10);

    return NextResponse.json({
      metrics: {
        totalCompanies: totalCompanies || 0,
        totalUsers: totalUsers || 0,
        activeSubscriptions: activeSubs,
        trialingSubscriptions: trialingSubs,
        pastDueSubscriptions: pastDueSubs,
        canceledSubscriptions: canceledSubs,
        estimatedMrr: calculatedMrr,
        currency: 'XOF',
      },
      recentCompanies: recentCompanies || [],
      recentAudits: recentAudits || [],
    });
  } catch (error: any) {
    console.error('Admin metrics error:', error);
    const status = error.message?.includes('Accès non autorisé') ? 403 : 500;
    return NextResponse.json({ error: error.message || 'Erreur serveur' }, { status });
  }
}
