import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedContext, requirePermission } from '@/lib/auth/permissions';
import { logAuditEvent } from '@/lib/audit/auditLogger';
import { supabaseAdmin } from '@/lib/supabase/admin';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { errorResponse, context } = await getAuthenticatedContext(req);
    if (errorResponse || !context) {
      return errorResponse || NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    const permCheck = await requirePermission(context.companyId, 'team.manage', req);
    if (permCheck.errorResponse) {
      return permCheck.errorResponse;
    }

    const body = await req.json();
    const { role } = body;

    const validRoles = ['owner', 'admin', 'manager', 'commercial', 'accountant', 'comptable', 'employee'];
    if (!validRoles.includes(role)) {
      return NextResponse.json({ error: 'Rôle invalide' }, { status: 400 });
    }

    // Verify membership belongs to this company
    const { data: currentMember, error: fetchErr } = await supabaseAdmin
      .from('memberships')
      .select('*, user:users(*)')
      .eq('id', id)
      .eq('company_id', context.companyId)
      .maybeSingle();

    if (fetchErr || !currentMember) {
      return NextResponse.json({ error: 'Membre introuvable' }, { status: 404 });
    }

    // Protect last owner demotion
    if (currentMember.role === 'owner' && role !== 'owner') {
      const { count } = await supabaseAdmin
        .from('memberships')
        .select('*', { count: 'exact', head: true })
        .eq('company_id', context.companyId)
        .eq('role', 'owner');

      if ((count || 0) <= 1) {
        return NextResponse.json(
          { error: 'Impossible de rétrograder le seul propriétaire de l’entreprise.' },
          { status: 400 }
        );
      }
    }

    const { data: updated, error: updateErr } = await supabaseAdmin
      .from('memberships')
      .update({ role })
      .eq('id', id)
      .select('*')
      .maybeSingle();

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    await logAuditEvent({
      companyId: context.companyId,
      userId: context.user.id,
      action: 'user.role_changed',
      entityType: 'membership',
      entityId: id,
      oldValues: { role: currentMember.role },
      newValues: { role },
    });

    return NextResponse.json({ success: true, member: updated });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Erreur serveur' }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { errorResponse, context } = await getAuthenticatedContext(req);
    if (errorResponse || !context) {
      return errorResponse || NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    const permCheck = await requirePermission(context.companyId, 'team.manage', req);
    if (permCheck.errorResponse) {
      return permCheck.errorResponse;
    }

    const { data: currentMember } = await supabaseAdmin
      .from('memberships')
      .select('*')
      .eq('id', id)
      .eq('company_id', context.companyId)
      .maybeSingle();

    if (!currentMember) {
      return NextResponse.json({ error: 'Membre introuvable' }, { status: 404 });
    }

    if (currentMember.role === 'owner') {
      return NextResponse.json(
        { error: 'Le propriétaire de l’entreprise ne peut pas être supprimé.' },
        { status: 400 }
      );
    }

    await supabaseAdmin
      .from('memberships')
      .delete()
      .eq('id', id)
      .eq('company_id', context.companyId);

    await logAuditEvent({
      companyId: context.companyId,
      userId: context.user.id,
      action: 'user.removed',
      entityType: 'membership',
      entityId: id,
      oldValues: { role: currentMember.role, userId: currentMember.user_id },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Erreur serveur' }, { status: 500 });
  }
}
