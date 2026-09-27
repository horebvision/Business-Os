import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { enforceRateLimit } from '@/lib/security/rateLimit';

export async function POST(req: NextRequest) {
  try {
    const rateLimitError = await enforceRateLimit(req, {
      maxRequests: 15,
      windowMs: 60_000,
      keyPrefix: 'email',
    });
    if (rateLimitError) return rateLimitError;

    const supabase = await createClient();
    const authHeader = req.headers.get('authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;
    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser(token);

    if (userErr || !user) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    const {
      companyId,
      to,
      subject,
      body,
      entityType, // 'invoice' | 'quote' | 'customer'
      entityId,
      customerName,
    } = await req.json();

    if (!to || !subject || !body) {
      return NextResponse.json(
        { error: 'Destinataire, objet et contenu de message obligatoires.' },
        { status: 400 }
      );
    }

    const resendApiKey = process.env.RESEND_API_KEY;

    // Strict compliance with rule 21: Never simulate sending if not configured
    if (!resendApiKey || resendApiKey.trim() === '' || resendApiKey.startsWith('re_placeholder')) {
      return NextResponse.json(
        {
          success: false,
          configured: false,
          error:
            'Service email non configuré. Veuillez renseigner la variable d\'environnement RESEND_API_KEY sur votre serveur pour activer l\'expédition réelle.',
        },
        { status: 503 }
      );
    }

    // Call Resend REST API
    const senderEmail = process.env.RESEND_SENDER_EMAIL || 'BusinessOS <onboarding@resend.dev>';

    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendApiKey.trim()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: senderEmail,
        to: [to],
        subject: subject,
        text: body,
      }),
    });

    const resendData = await resendRes.json();

    if (!resendRes.ok) {
      return NextResponse.json(
        {
          success: false,
          configured: true,
          error: resendData.message || 'Erreur lors de la transmission à Resend.',
          details: resendData,
        },
        { status: resendRes.status }
      );
    }

    // Log activity in Supabase
    if (companyId) {
      await supabase.from('activities').insert({
        company_id: companyId,
        user_id: user.id,
        action: 'Email de relance envoyé',
        entity_type: entityType || 'invoice',
        entity_id: entityId || null,
        entity_title: subject,
        description: `Email envoyé à ${customerName ? customerName + ' (' + to + ')' : to} : "${subject}"`,
        metadata: {
          resend_id: resendData.id,
          recipient: to,
          sent_at: new Date().toISOString(),
          status: 'sent',
        },
      });
    }

    return NextResponse.json({
      success: true,
      configured: true,
      id: resendData.id,
      message: 'Email envoyé avec succès via Resend.',
    });
  } catch (err: any) {
    console.error('Error sending email:', err);
    return NextResponse.json({ error: err.message || 'Erreur serveur interne' }, { status: 500 });
  }
}

// GET endpoint to check if Resend is configured
export async function GET() {
  const resendApiKey = process.env.RESEND_API_KEY;
  const isConfigured = Boolean(resendApiKey && !resendApiKey.startsWith('re_placeholder') && resendApiKey.length > 10);

  return NextResponse.json({
    configured: isConfigured,
    provider: 'Resend',
    sender: process.env.RESEND_SENDER_EMAIL || 'onboarding@resend.dev',
  });
}
