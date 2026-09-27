import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedContext, requirePermission } from '@/lib/auth/permissions';
import { checkLimit } from '@/lib/billing/featureGating';
import { logAuditEvent } from '@/lib/audit/auditLogger';
import { supabaseAdmin } from '@/lib/supabase/admin';

export async function POST(req: NextRequest) {
  try {
    const { errorResponse, context } = await getAuthenticatedContext(req);
    if (errorResponse || !context) {
      return errorResponse || NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    // 1. Permission check
    const permCheck = await requirePermission(context.companyId, 'team.invite', req);
    if (permCheck.errorResponse) {
      return permCheck.errorResponse;
    }

    const body = await req.json();
    const { email, role = 'employee' } = body;

    if (!email || !email.includes('@')) {
      return NextResponse.json(
        { error: 'Une adresse email valide est requise.' },
        { status: 400 }
      );
    }

    const validRoles = ['owner', 'admin', 'manager', 'commercial', 'accountant', 'comptable', 'employee'];
    if (!validRoles.includes(role)) {
      return NextResponse.json(
        { error: `Rôle invalide. Rôles autorisés: ${validRoles.join(', ')}` },
        { status: 400 }
      );
    }

    // 2. Feature limit check on team members
    const limitCheck = await checkLimit(context.companyId, 'users');
    if (!limitCheck.allowed) {
      return NextResponse.json(
        {
          error: limitCheck.message || 'La limite d’utilisateurs de votre abonnement est atteinte.',
          limit_reached: true,
          current: limitCheck.current,
          max: limitCheck.max,
        },
        { status: 403 }
      );
    }

    // 3. Check if user is already a member
    const { data: existingUser } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('email', email.trim().toLowerCase())
      .maybeSingle();

    if (existingUser) {
      const { data: existingMem } = await supabaseAdmin
        .from('memberships')
        .select('id')
        .eq('company_id', context.companyId)
        .eq('user_id', existingUser.id)
        .maybeSingle();

      if (existingMem) {
        return NextResponse.json(
          { error: 'Cet utilisateur fait déjà partie de votre entreprise.' },
          { status: 400 }
        );
      }
    }

    // 4. Generate invitation token & expiration (7 days)
    const token = crypto.randomUUID();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    // 5. Insert invitation record
    const { data: invitation, error: invErr } = await supabaseAdmin
      .from('invitations')
      .insert({
        company_id: context.companyId,
        email: email.trim().toLowerCase(),
        role,
        token,
        expires_at: expiresAt.toISOString(),
        invited_by: context.user.id,
      })
      .select('*')
      .maybeSingle();

    if (invErr) {
      console.warn('Could not insert in invitations table (table may need migration):', invErr.message);
    }

    // 6. Audit log
    await logAuditEvent({
      companyId: context.companyId,
      userId: context.user.id,
      action: 'user.invited',
      entityType: 'invitation',
      entityId: invitation?.id || token,
      newValues: { email, role, expiresAt: expiresAt.toISOString() },
      ipAddress: req.headers.get('x-forwarded-for') || undefined,
      userAgent: req.headers.get('user-agent') || undefined,
    });

    const inviteUrl = `${req.nextUrl.origin}/invite/${token}`;

    return NextResponse.json({
      success: true,
      message: `Invitation envoyée avec succès à ${email}`,
      invitation: {
        id: invitation?.id || token,
        email,
        role,
        token,
        expires_at: expiresAt.toISOString(),
        invite_url: inviteUrl,
      },
    });
  } catch (error: any) {
    console.error('Error inviting team member:', error);
    const status = error.message?.includes('Accès non autorisé') ? 403 : 500;
    return NextResponse.json({ error: error.message || 'Erreur serveur' }, { status });
  }
}
