import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { paymentRegistry, SupportedPaymentProviderCode } from '@/lib/payments/paymentProvider';

// BUG FIX: Ne jamais utiliser la clé anon comme fallback de la service_role key
// Si SUPABASE_SERVICE_ROLE_KEY absent → erreur explicite, jamais de fallback silencieux
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!serviceRoleKey) {
  console.error('[Portal Checkout] SUPABASE_SERVICE_ROLE_KEY manquant — route désactivée');
}

const supabaseAdmin = serviceRoleKey
  ? createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      serviceRoleKey
    )
  : null;


export async function POST(req: NextRequest) {
  try {
    // Guard: service role key obligatoire pour ce endpoint
    if (!supabaseAdmin) {
      return NextResponse.json(
        { error: 'Configuration serveur incomplète. SUPABASE_SERVICE_ROLE_KEY requis.' },
        { status: 503 }
      );
    }

    const body = await req.json();
    const { portalToken, invoiceId, providerCode = 'wave' } = body;

    if (!portalToken || !invoiceId) {
      return NextResponse.json(
        { error: 'Paramètres manquants (portalToken, invoiceId)' },
        { status: 400 }
      );
    }

    // 1. Authenticate customer via portal_token or fallback to customer id
    const { data: customer, error: custErr } = await supabaseAdmin
      .from('customers')
      .select('id, name, email, company_id')
      .or(`portal_token.eq.${portalToken},id.eq.${portalToken}`)
      .maybeSingle();

    if (custErr || !customer) {
      return NextResponse.json(
        { error: 'Accès portail non autorisé ou expiré' },
        { status: 401 }
      );
    }

    // 2. Fetch invoice and ensure it strictly belongs to this customer & company
    const { data: invoice, error: invErr } = await supabaseAdmin
      .from('invoices')
      .select('*')
      .eq('id', invoiceId)
      .eq('customer_id', customer.id)
      .eq('company_id', customer.company_id)
      .maybeSingle();

    if (invErr || !invoice) {
      return NextResponse.json(
        { error: 'Facture introuvable pour ce compte client' },
        { status: 404 }
      );
    }

    const remainingAmount = Number(invoice.remaining_amount) || (Number(invoice.total) - Number(invoice.paid_amount));
    if (remainingAmount <= 0) {
      return NextResponse.json(
        { error: 'Cette facture est déjà intégralement soldée.' },
        { status: 400 }
      );
    }

    // 3. Check PaymentProvider configuration
    const provider = paymentRegistry.get(providerCode as SupportedPaymentProviderCode);
    if (!provider || !provider.isConfigured()) {
      return NextResponse.json({
        success: false,
        configured: false,
        provider: providerCode,
        message: "Le paiement en ligne n'est pas encore configuré pour cette entreprise.",
      });
    }

    // 4. Provider is configured - initiate real checkout session
    const response = await provider.initiatePayment({
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoice_number,
      customerName: customer.name,
      customerEmail: customer.email,
      amount: remainingAmount,
      currency: invoice.currency || 'XOF',
      description: `Règlement facture ${invoice.invoice_number}`,
      callbackUrl: `${req.nextUrl.origin}/portal/${portalToken}?payment_success=true&invoice_id=${invoice.id}`,
      metadata: { companyId: customer.company_id, customerId: customer.id },
    });

    return NextResponse.json(response);
  } catch (error: any) {
    console.error('Portal checkout error:', error);
    return NextResponse.json(
      { error: error.message || 'Erreur lors de la préparation du paiement.' },
      { status: 500 }
    );
  }
}
