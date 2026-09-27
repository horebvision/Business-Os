import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedContext } from '@/lib/auth/permissions';
import { logAuditEvent } from '@/lib/audit/auditLogger';
import { supabaseAdmin } from '@/lib/supabase/admin';

export async function POST(req: NextRequest) {
  try {
    const { errorResponse, context } = await getAuthenticatedContext(req);
    if (errorResponse || !context) {
      return (
        errorResponse ||
        NextResponse.json(
          { error: 'Veuillez vous connecter pour accepter cette invitation.' },
          { status: 401 }
        )
      );
    }

    const body = await req.json();
    const { token } = body;

    if (!token) {
      return NextResponse.json({ error: 'Jeton d’invitation manquant.' }, { status: 400 });
    }

    // 1. Find invitation
    const { data: invite, error: fetchErr } = await supabaseAdmin
      .from('invitations')
      .select('*, company:companies(name)')
      .eq('token', token)
      .maybeSingle();

    if (fetchErr || !invite) {
      return NextResponse.json({ error: 'Invitation introuvable ou invalide.' }, { status: 404 });
    }

    if (invite.accepted_at) {
      return NextResponse.json(
        { error: 'Cette invitation a déjà été acceptée.' },
        { status: 400 }
      );
    }

    if (new Date(invite.expires_at) < new Date()) {
      return NextResponse.json(
        { error: 'Cette invitation a expiré. Demandez un nouvel envoi à votre administrateur.' },
        { status: 410 }
      );
    }

    // 2. Check if user already has membership in this company
    const { data: existingMem } = await supabaseAdmin
      .from('memberships')
      .select('id')
      .eq('company_id', invite.company_id)
      .eq('user_id', context.user.id)
      .maybeSingle();

    if (existingMem) {
      // Mark accepted and redirect
      await supabaseAdmin
        .from('invitations')
        .update({ accepted_at: new Date().toISOString() })
        .eq('id', invite.id);

      return NextResponse.json({
        success: true,
        message: 'Vous êtes déjà membre de cette entreprise.',
        companyId: invite.company_id,
      });
    }

    // 3. Create membership
    const { error: memErr } = await supabaseAdmin.from('memberships').insert({
      company_id: invite.company_id,
      user_id: context.user.id,
      role: invite.role,
    });

    if (memErr) {
      return NextResponse.json({ error: memErr.message }, { status: 500 });
    }

    // 4. Mark invitation as accepted
    await supabaseAdmin
      .from('invitations')
      .update({ accepted_at: new Date().toISOString() })
      .eq('id', invite.id);

    // 5. Audit log
    await logAuditEvent({
      companyId: invite.company_id,
      userId: context.user.id,
      action: 'user.invitation_accepted',
      entityType: 'membership',
      newValues: { role: invite.role, userEmail: context.user.email },
    });

    return NextResponse.json({
      success: true,
      message: `Bienvenue dans l’équipe de ${invite.company?.name || 'l’entreprise'} !`,
      companyId: invite.company_id,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Erreur serveur' }, { status: 500 });
  }
}
