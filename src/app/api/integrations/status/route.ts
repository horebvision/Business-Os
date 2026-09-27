import { NextResponse } from 'next/server';
import { paymentRegistry } from '@/lib/payments/paymentProvider';
import { getWhatsAppConfig } from '@/lib/integrations/whatsapp';

export async function GET() {
  try {
    // 1. Email (Resend)
    const hasResend = Boolean(process.env.RESEND_API_KEY && process.env.RESEND_API_KEY.length > 5);

    // 2. WhatsApp
    const waConfig = getWhatsAppConfig();

    // 3. Mobile Money Payments
    const providersInfo = paymentRegistry.getAllInfo();

    return NextResponse.json({
      email: {
        provider: 'Resend',
        isConfigured: hasResend,
        status: hasResend ? 'connected' : 'unconfigured',
        details: hasResend
          ? 'Clé API Resend détectée. Envoi d’emails actif.'
          : 'Service email non configuré. Définissez RESEND_API_KEY côté serveur.',
      },
      whatsapp: {
        provider: 'WhatsApp Business',
        isConfigured: waConfig.isApiConfigured,
        status: waConfig.isApiConfigured ? 'connected' : 'ready_deep_link',
        details: waConfig.isApiConfigured
          ? 'API WhatsApp Cloud officielle connectée.'
          : 'Mode direct opérationnel (liens wa.me préremplis). Clé Cloud API non configurée.',
        senderPhone: waConfig.senderPhone || null,
      },
      payments: providersInfo.map((p) => ({
        code: p.code,
        name: p.name,
        logo: p.logo,
        isConfigured: p.isConfigured,
        status: p.isConfigured ? 'connected' : 'unconfigured',
        countrySupport: p.countrySupport,
        description: p.description,
      })),
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Impossible de récupérer le statut des intégrations.' },
      { status: 500 }
    );
  }
}
