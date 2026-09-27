import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedContext, requireRole } from '@/lib/auth/permissions';
import { supabaseAdmin } from '@/lib/supabase/admin';

export async function GET(req: NextRequest) {
  try {
    const { errorResponse, context } = await getAuthenticatedContext(req);
    if (errorResponse || !context) {
      return errorResponse || NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    // Only owner, admin, or manager can inspect audit logs
    const roleCheck = await requireRole(context.companyId, ['owner', 'admin', 'manager'], req);
    if (roleCheck.errorResponse) {
      return roleCheck.errorResponse;
    }

    const { searchParams } = new URL(req.url);
    const action = searchParams.get('action');
    const search = searchParams.get('search');

    // 1. Try fetching from audit_logs table
    let query = supabaseAdmin
      .from('audit_logs')
      .select('*')
      .eq('company_id', context.companyId)
      .order('created_at', { ascending: false })
      .limit(100);

    if (action && action !== 'all') {
      query = query.eq('action', action);
    }

    const { data: auditData, error } = await query;

    if (!error && auditData && auditData.length > 0) {
      let filtered = auditData;
      if (search && search.trim()) {
        const s = search.toLowerCase();
        filtered = (filtered as any[]).filter(
          (a: any) =>
            a.action?.toLowerCase().includes(s) ||
            a.user_email?.toLowerCase().includes(s) ||
            a.resource_type?.toLowerCase().includes(s)
        );
      }
      return NextResponse.json({ logs: filtered, source: 'audit_logs' });
    }

    // 2. Fallback to activities table if audit_logs is empty or unmigrated
    const { data: activities } = await supabaseAdmin
      .from('activities')
      .select('*')
      .eq('company_id', context.companyId)
      .order('created_at', { ascending: false })
      .limit(100);

    const mapped = ((activities as any[]) || []).map((act: any) => ({
      id: act.id,
      company_id: act.company_id,
      user_id: act.user_id,
      user_email: 'Utilisateur actif',
      action: act.action,
      resource_type: act.entity_type || 'activity',
      resource_id: act.entity_id || act.id,
      new_value: { title: act.entity_title, description: act.description },
      created_at: act.created_at,
    }));

    return NextResponse.json({ logs: mapped, source: 'activities' });
  } catch (error: any) {
    console.error('Audit logs API error:', error);
    const status = error.message?.includes('Accès non autorisé') ? 403 : 500;
    return NextResponse.json({ error: error.message || 'Erreur serveur' }, { status });
  }
}
