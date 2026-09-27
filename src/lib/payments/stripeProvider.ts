// ==============================================================================
// BUSINESSOS — STRIPE PAYMENT PROVIDER (PHASE 6)
// ==============================================================================
// Implémente PaymentProvider (facturation client) et SubscriptionPaymentProvider
// (abonnements SaaS). Toujours côté serveur uniquement.
// Variables requises :
//   STRIPE_SECRET_KEY       (sk_live_... ou sk_test_...)
//   STRIPE_WEBHOOK_SECRET   (whsec_...)
//   NEXT_PUBLIC_APP_URL     (https://businessos.app)

import Stripe from 'stripe';
import {
  PaymentProvider,
  PaymentInitiateRequest,
  PaymentInitiateResponse,
  PaymentVerificationResponse,
  PaymentProviderInfo,
} from './paymentProvider';
import {
  SubscriptionPaymentProvider,
  SubscriptionCheckoutRequest,
  SubscriptionCheckoutResponse,
  WebhookResult,
} from './subscriptionPaymentProvider';

// ─── Utilitaires ──────────────────────────────────────────────────────────────

function getStripeClient(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key || key.length < 10) return null;
  return new Stripe(key, { apiVersion: '2026-08-26.dahlia' });
}

function isStripeConfigured(): boolean {
  return Boolean(
    process.env.STRIPE_SECRET_KEY &&
    process.env.STRIPE_SECRET_KEY.startsWith('sk_')
  );
}

// ─── Stripe pour paiements clients (devis / factures) ─────────────────────────

export class StripeInvoicePaymentProvider implements PaymentProvider {
  readonly code = 'stripe' as any; // étendu par rapport à SupportedPaymentProviderCode
  readonly name = 'Stripe';

  isConfigured(): boolean {
    return isStripeConfigured();
  }

  getInfo(): PaymentProviderInfo {
    return {
      code: 'stripe' as any,
      name: 'Stripe',
      logo: '💳',
      countrySupport: ['Monde entier (cartes, SEPA, virements...)'],
      isConfigured: this.isConfigured(),
      mode: process.env.STRIPE_SECRET_KEY?.startsWith('sk_live_')
        ? 'live'
        : this.isConfigured()
        ? 'test'
        : 'unconfigured',
      description: 'Paiement par carte bancaire, SEPA ou lien de paiement Stripe.',
    };
  }

  async initiatePayment(request: PaymentInitiateRequest): Promise<PaymentInitiateResponse> {
    if (!this.isConfigured()) {
      return {
        success: false,
        provider: 'stripe' as any,
        status: 'failed',
        message: 'Stripe non configuré. Définissez STRIPE_SECRET_KEY côté serveur.',
      };
    }

    const stripe = getStripeClient()!;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

    try {
      const session = await stripe.checkout.sessions.create({
        mode: 'payment',
        payment_method_types: ['card'],
        line_items: [
          {
            price_data: {
              currency: request.currency.toLowerCase(),
              unit_amount: Math.round(request.amount * 100), // en centimes
              product_data: {
                name: request.description,
                metadata: {
                  invoiceId: request.invoiceId ?? '',
                  invoiceNumber: request.invoiceNumber ?? '',
                },
              },
            },
            quantity: 1,
          },
        ],
        customer_email: request.customerEmail,
        success_url: request.callbackUrl
          ? `${request.callbackUrl}?session_id={CHECKOUT_SESSION_ID}&status=success`
          : `${appUrl}/portal?payment=success`,
        cancel_url: request.callbackUrl
          ? `${request.callbackUrl}?status=cancelled`
          : `${appUrl}/portal?payment=cancelled`,
        metadata: {
          invoiceId: request.invoiceId ?? '',
          invoiceNumber: request.invoiceNumber ?? '',
          customerPhone: request.customerPhone ?? '',
          ...(request.metadata ?? {}),
        },
      });

      return {
        success: true,
        provider: 'stripe' as any,
        transactionId: session.id,
        checkoutUrl: session.url ?? undefined,
        status: 'requires_action',
        message: 'Session de paiement Stripe créée.',
      };
    } catch (err: any) {
      return {
        success: false,
        provider: 'stripe' as any,
        status: 'failed',
        message: `Erreur Stripe : ${err.message}`,
      };
    }
  }

  async verifyPayment(transactionId: string): Promise<PaymentVerificationResponse> {
    if (!this.isConfigured()) {
      return {
        transactionId,
        provider: 'stripe' as any,
        status: 'failed',
        amount: 0,
        currency: 'EUR',
      };
    }

    const stripe = getStripeClient()!;

    try {
      const session = await stripe.checkout.sessions.retrieve(transactionId);
      const statusMap: Record<string, 'pending' | 'completed' | 'failed' | 'cancelled'> = {
        complete: 'completed',
        open: 'pending',
        expired: 'cancelled',
      };

      return {
        transactionId,
        provider: 'stripe' as any,
        status: statusMap[session.status ?? 'open'] ?? 'pending',
        amount: (session.amount_total ?? 0) / 100,
        currency: session.currency?.toUpperCase() ?? 'EUR',
        paidAt: session.status === 'complete' ? new Date().toISOString() : undefined,
        rawResponse: { status: session.status, payment_status: session.payment_status },
      };
    } catch (err: any) {
      return {
        transactionId,
        provider: 'stripe' as any,
        status: 'failed',
        amount: 0,
        currency: 'EUR',
      };
    }
  }
}

// ─── Stripe pour abonnements SaaS ─────────────────────────────────────────────

// Mapping plans → Price IDs Stripe (à configurer dans .env)
const STRIPE_PRICE_IDS: Record<string, Record<string, string>> = {
  starter: {
    monthly: process.env.STRIPE_PRICE_STARTER_MONTHLY ?? '',
    yearly: process.env.STRIPE_PRICE_STARTER_YEARLY ?? '',
  },
  business: {
    monthly: process.env.STRIPE_PRICE_BUSINESS_MONTHLY ?? '',
    yearly: process.env.STRIPE_PRICE_BUSINESS_YEARLY ?? '',
  },
  pro: {
    monthly: process.env.STRIPE_PRICE_PRO_MONTHLY ?? '',
    yearly: process.env.STRIPE_PRICE_PRO_YEARLY ?? '',
  },
};

export class StripeSubscriptionPaymentProvider implements SubscriptionPaymentProvider {
  readonly code = 'stripe' as any;
  readonly name = 'Stripe';

  isConfigured(): boolean {
    return isStripeConfigured();
  }

  async createCheckout(req: SubscriptionCheckoutRequest): Promise<SubscriptionCheckoutResponse> {
    if (!this.isConfigured()) {
      return {
        success: false,
        provider: 'stripe',
        status: 'failed',
        message: 'Stripe non configuré. Définissez STRIPE_SECRET_KEY.',
      };
    }

    const stripe = getStripeClient()!;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
    const interval = req.billingInterval === 'yearly' ? 'yearly' : 'monthly';
    const priceId = STRIPE_PRICE_IDS[req.planTier]?.[interval];

    // Si pas de Price ID configuré → créer le prix dynamiquement (mode test)
    let resolvedPriceId = priceId;
    if (!resolvedPriceId) {
      const price = await stripe.prices.create({
        unit_amount: Math.round(req.amount * 100),
        currency: req.currency.toLowerCase(),
        recurring: {
          interval: req.billingInterval === 'yearly' ? 'year' : 'month',
        },
        product_data: {
          name: `BusinessOS ${req.planTier.charAt(0).toUpperCase() + req.planTier.slice(1)}`,
        },
      });
      resolvedPriceId = price.id;
    }

    try {
      const session = await stripe.checkout.sessions.create({
        mode: 'subscription',
        payment_method_types: ['card'],
        line_items: [{ price: resolvedPriceId, quantity: 1 }],
        customer_email: req.customerEmail,
        success_url: req.callbackUrl
          ? `${req.callbackUrl}?session_id={CHECKOUT_SESSION_ID}&status=success`
          : `${appUrl}/billing?subscription=success`,
        cancel_url: req.callbackUrl
          ? `${req.callbackUrl}?status=cancelled`
          : `${appUrl}/billing?subscription=cancelled`,
        metadata: {
          companyId: req.companyId,
          planTier: req.planTier,
          billingInterval: req.billingInterval,
        },
        subscription_data: {
          metadata: {
            companyId: req.companyId,
            planTier: req.planTier,
          },
          trial_period_days: 14,
        },
      });

      return {
        success: true,
        provider: 'stripe',
        transactionId: session.id,
        checkoutUrl: session.url ?? undefined,
        status: 'pending',
        message: 'Session d\'abonnement Stripe créée avec essai 14 jours.',
      };
    } catch (err: any) {
      return {
        success: false,
        provider: 'stripe',
        status: 'failed',
        message: `Erreur Stripe : ${err.message}`,
      };
    }
  }

  async verifyPayment(transactionId: string) {
    if (!this.isConfigured()) return { success: false, status: 'unconfigured', amount: 0 };

    const stripe = getStripeClient()!;
    try {
      const session = await stripe.checkout.sessions.retrieve(transactionId);
      return {
        success: session.payment_status === 'paid',
        status: session.payment_status ?? 'unpaid',
        amount: (session.amount_total ?? 0) / 100,
      };
    } catch {
      return { success: false, status: 'error', amount: 0 };
    }
  }

  async handleWebhook(payload: any, signature?: string): Promise<WebhookResult> {
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    const stripe = getStripeClient();

    if (!stripe || !webhookSecret || !signature) {
      return { success: false, eventType: 'unknown', message: 'Stripe webhook non configuré.' };
    }

    let event: Stripe.Event;
    try {
      // payload doit être le Buffer brut (raw body)
      event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);
    } catch (err: any) {
      return { success: false, eventType: 'signature_error', message: err.message };
    }

    const result: WebhookResult = {
      success: true,
      eventType: event.type,
    };

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        result.transactionId = session.id;
        result.companyId = session.metadata?.companyId;
        result.planTier = session.metadata?.planTier as any;
        result.amount = (session.amount_total ?? 0) / 100;
        break;
      }

      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription;
        result.transactionId = sub.id;
        result.companyId = sub.metadata?.companyId;
        result.planTier = sub.metadata?.planTier as any;
        break;
      }

      case 'invoice.payment_failed': {
        // Cast à any pour compatibilité avec les différentes versions du SDK Stripe
        const inv = event.data.object as any;
        const subRef = inv.subscription ?? inv.parent?.subscription_details;
        result.companyId = subRef?.metadata?.companyId ?? inv.metadata?.companyId;
        result.message = 'Paiement échoué — relance automatique Stripe en cours.';
        break;
      }

      default:
        result.message = `Événement ${event.type} reçu mais non géré.`;
    }

    return result;
  }

  async cancelSubscription(subscriptionId: string): Promise<boolean> {
    const stripe = getStripeClient();
    if (!stripe) return false;
    try {
      await stripe.subscriptions.cancel(subscriptionId);
      return true;
    } catch {
      return false;
    }
  }
}

// ─── Exports singleton ─────────────────────────────────────────────────────────

export const stripeInvoiceProvider = new StripeInvoicePaymentProvider();
export const stripeSubscriptionProvider = new StripeSubscriptionPaymentProvider();
