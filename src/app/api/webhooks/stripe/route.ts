// ==============================================================================
// BUSINESSOS — WEBHOOK STRIPE (PHASE 6 & PHASE 6.2 HARDENING)
// ==============================================================================
// Route : POST /api/webhooks/stripe
// Gère les événements Stripe : abonnements, paiements, renouvellements, annulations.
// Sécurité :
//   - Vérification stricte par signature Stripe
//   - Idempotence persistante PostgreSQL (processed_webhooks) anti-doublon et anti-concurrence
//   - Sanitization des logs et messages d'erreurs
//   - Ne JAMAIS utiliser getAuthenticatedContext ici (appel externe Stripe)

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { stripeSubscriptionProvider } from '@/lib/payments/stripeProvider';
import {
  claimWebhook,
  finalizeWebhook,
  hashWebhookPayload,
} from '@/lib/security/webhookIdempotence';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const signature = request.headers.get('stripe-signature');
  const rawBody = await request.arrayBuffer();
  const bodyBuffer = Buffer.from(rawBody);

  // 1. Vérification de la signature Stripe
  const result = await stripeSubscriptionProvider.handleWebhook(bodyBuffer, signature ?? undefined);

  if (!result.success) {
    console.error('[Stripe Webhook] Signature invalide ou erreur :', result.message);
    return NextResponse.json(
      { error: result.message ?? 'Webhook invalide' },
      { status: 400 }
    );
  }

  // 2. Idempotence persistante & anti-concurrence
  const eventId = result.transactionId ?? `${result.eventType}-${Date.now()}`;
  const payloadHash = hashWebhookPayload(bodyBuffer);

  const claim = await claimWebhook('stripe', eventId, result.eventType, payloadHash);

  if (claim.isDuplicate) {
    console.log(`[Stripe Webhook] Doublon identifié et ignoré (${claim.reason}) : ${eventId}`);
    return NextResponse.json({
      received: true,
      duplicate: true,
      eventType: result.eventType,
      reason: claim.reason,
    });
  }

  console.log(`[Stripe Webhook] Traitement événement : ${result.eventType}`, {
    eventId,
    companyId: result.companyId,
    planTier: result.planTier,
  });

  const supabase = await createClient();
  let processSuccess = true;
  let processError: string | undefined;

  try {
    switch (result.eventType) {
      // ── Paiement d'abonnement réussi (Checkout) ────────────────────────
      case 'checkout.session.completed': {
        if (!result.companyId || !result.planTier) break;

        // Mettre à jour le plan de l'entreprise
        await supabase
          .from('companies')
          .update({
            plan: result.planTier,
            trial_ends_at: null, // trial terminé, abonnement payant actif
            subscription_status: 'active',
            updated_at: new Date().toISOString(),
          })
          .eq('id', result.companyId);

        // Créer un audit log
        await supabase.from('audit_logs').insert({
          company_id: result.companyId,
          action: 'subscription.activated',
          entity_type: 'billing',
          entity_id: result.transactionId,
          new_values: {
            plan: result.planTier,
            amount: result.amount,
            provider: 'stripe',
          },
          ip_address: '0.0.0.0',
          user_agent: 'stripe-webhook',
        });

        break;
      }

      // ── Abonnement annulé ou supprimé ──────────────────────────────────
      case 'customer.subscription.deleted': {
        if (!result.companyId) break;

        await supabase
          .from('companies')
          .update({
            plan: 'starter',
            subscription_status: 'cancelled',
            updated_at: new Date().toISOString(),
          })
          .eq('id', result.companyId);

        await supabase.from('audit_logs').insert({
          company_id: result.companyId,
          action: 'subscription.cancelled',
          entity_type: 'billing',
          entity_id: result.transactionId,
          new_values: { provider: 'stripe', event: result.eventType },
          ip_address: '0.0.0.0',
          user_agent: 'stripe-webhook',
        });

        break;
      }

      // ── Mise à jour abonnement (upgrade/downgrade) ─────────────────────
      case 'customer.subscription.updated': {
        if (!result.companyId || !result.planTier) break;

        await supabase
          .from('companies')
          .update({
            plan: result.planTier,
            subscription_status: 'active',
            updated_at: new Date().toISOString(),
          })
          .eq('id', result.companyId);

        break;
      }

      // ── Renouvellement / Facture Stripe payée avec succès ───────────────
      case 'invoice.paid': {
        if (!result.companyId) break;

        await supabase
          .from('companies')
          .update({
            subscription_status: 'active',
            updated_at: new Date().toISOString(),
          })
          .eq('id', result.companyId);

        break;
      }

      // ── Paiement facture échoué ────────────────────────────────────────
      case 'invoice.payment_failed': {
        if (!result.companyId) break;

        await supabase
          .from('companies')
          .update({
            subscription_status: 'past_due',
            updated_at: new Date().toISOString(),
          })
          .eq('id', result.companyId);

        try {
          await supabase.from('notifications').insert({
            company_id: result.companyId,
            type: 'warning',
            title: 'Paiement échoué',
            message: 'Le renouvellement de votre abonnement a échoué. Veuillez mettre à jour votre moyen de paiement.',
            link: '/billing',
            is_read: false,
          });
        } catch {
          // notification non bloquante
        }

        break;
      }

      default:
        console.log(`[Stripe Webhook] Événement ignoré : ${result.eventType}`);
    }
  } catch (err: any) {
    processSuccess = false;
    processError = err.message;
    console.error('[Stripe Webhook] Erreur lors du traitement métier :', err.message);
  } finally {
    // 3. Finalisation persistante de l'idempotence
    await finalizeWebhook('stripe', eventId, processSuccess, processError);
  }

  // Toujours accuser réception 200 à Stripe pour éviter les boucles d'envoi
  return NextResponse.json({
    received: true,
    eventType: result.eventType,
    status: processSuccess ? 'processed' : 'failed',
  });
}
