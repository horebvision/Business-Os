import { NextRequest, NextResponse } from 'next/server';
import { subscriptionPaymentRegistry } from '@/lib/payments/subscriptionPaymentProvider';
import { createClient } from '@/lib/supabase/server';
import { enforceRateLimit } from '@/lib/security/rateLimit';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
) {
  try {
    const rateLimitError = await enforceRateLimit(req, {
      maxRequests: 120,
      windowMs: 60_000,
      keyPrefix: 'webhook',
    });
    if (rateLimitError) return rateLimitError;

    const { provider: providerCode } = await params;
    const provider = subscriptionPaymentRegistry.get(providerCode);

    if (!provider) {
      return NextResponse.json({ error: 'Fournisseur de paiement non supporté.' }, { status: 400 });
    }

    const payload = await req.json();
    const signature = req.headers.get('x-signature') || req.headers.get('x-wave-signature') || undefined;

    // 1. Délégation au provider pour validation
    const result = await provider.handleWebhook(payload, signature);

    if (!result.success) {
      return NextResponse.json({ error: result.message || 'Validation échouée.' }, { status: 400 });
    }

    const supabase = await createClient();

    // 2. Vérification d'idempotence (éviter les doublons)
    if (result.transactionId) {
      const { data: existingTx } = await supabase
        .from('payment_transactions')
        .select('id, status')
        .eq('provider_tx_id', result.transactionId)
        .maybeSingle();

      if (existingTx && existingTx.status === 'completed') {
        // Doublon déjà traité avec succès
        return NextResponse.json({ message: 'Événement déjà traité (idempotent).', duplicate: true }, { status: 200 });
      }
    }

    // 3. Journaliser l'événement et mettre à jour la souscription
    if (result.companyId) {
      // Enregistrer dans payment_transactions
      await supabase.from('payment_transactions').insert({
        company_id: result.companyId,
        provider: providerCode,
        amount: result.amount || 0,
        status: 'completed',
        provider_tx_id: result.transactionId || null,
        metadata: payload,
      });

      // Mettre à jour la subscription
      await supabase
        .from('subscriptions')
        .update({
          status: 'active',
          updated_at: new Date().toISOString(),
        })
        .eq('company_id', result.companyId);

      // Enregistrer subscription_events
      await supabase.from('subscription_events').insert({
        company_id: result.companyId,
        event_type: result.eventType,
        payload,
      });
    }

    return NextResponse.json({ success: true, processed: true });
  } catch (error: any) {
    console.error('Erreur webhook paiement:', error);
    return NextResponse.json({ error: 'Erreur traitement webhook.' }, { status: 500 });
  }
}
