import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedContext, requirePermission } from '@/lib/auth/permissions';
import { logAuditEvent } from '@/lib/audit/auditLogger';
import { supabaseAdmin } from '@/lib/supabase/admin';

export async function GET(req: NextRequest) {
  try {
    const { errorResponse, context } = await getAuthenticatedContext(req);
    if (errorResponse || !context) {
      return errorResponse || NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    const permCheck = await requirePermission(context.companyId, 'team.view', req);
    if (permCheck.errorResponse) {
      return permCheck.errorResponse;
    }

    const { data: invitations, error } = await supabaseAdmin
      .from('invitations')
      .select('*')
      .eq('company_id', context.companyId)
      .is('accepted_at', null)
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ invitations: [] });
    }

    return NextResponse.json({ invitations: invitations || [] });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Erreur serveur' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { errorResponse, context } = await getAuthenticatedContext(req);
    if (errorResponse || !context) {
      return errorResponse || NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    const permCheck = await requirePermission(context.companyId, 'team.manage', req);
    if (permCheck.errorResponse) {
      return permCheck.errorResponse;
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID requis' }, { status: 400 });
    }

    await supabaseAdmin
      .from('invitations')
      .delete()
      .eq('id', id)
      .eq('company_id', context.companyId);

    await logAuditEvent({
      companyId: context.companyId,
      userId: context.user.id,
      action: 'invitation.revoked',
      entityType: 'invitation',
      entityId: id,
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Erreur serveur' }, { status: 500 });
  }
}
