import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const token = searchParams.get('token');

    if (!token) {
      return NextResponse.json({ error: 'Token manquant' }, { status: 400 });
    }

    const { data: invite, error } = await supabaseAdmin
      .from('invitations')
      .select('id, email, role, expires_at, accepted_at, company:companies(id, name, logo_url)')
      .eq('token', token)
      .maybeSingle();

    if (error || !invite) {
      return NextResponse.json({ error: 'Invitation introuvable' }, { status: 404 });
    }

    const isExpired = new Date(invite.expires_at) < new Date();
    const isAccepted = Boolean(invite.accepted_at);

    return NextResponse.json({
      invitation: {
        id: invite.id,
        email: invite.email,
        role: invite.role,
        isExpired,
        isAccepted,
        company: invite.company,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Erreur serveur' }, { status: 500 });
  }
}
