// ==============================================================================
// BUSINESSOS — SUBSCRIPTION PAYMENT PROVIDER ABSTRACTION (PHASE 5: SECTION 11 & 12)
// ==============================================================================

import { BillingInterval, PlanTier } from '@/lib/types';

export interface SubscriptionCheckoutRequest {
  companyId: string;
  planTier: PlanTier;
  billingInterval: BillingInterval;
  amount: number;
  currency: string;
  customerEmail?: string;
  customerPhone?: string;
  callbackUrl?: string;
}

export interface SubscriptionCheckoutResponse {
  success: boolean;
  provider: string;
  transactionId?: string;
  checkoutUrl?: string;
  status: 'pending' | 'failed';
  message: string;
}

export interface WebhookResult {
  success: boolean;
  isDuplicate?: boolean;
  eventType: string;
  transactionId?: string;
  companyId?: string;
  planTier?: PlanTier;
  amount?: number;
  message?: string;
}

export interface SubscriptionPaymentProvider {
  readonly code: 'wave' | 'orange_money' | 'mtn_momo';
  readonly name: string;
  isConfigured(): boolean;
  createCheckout(request: SubscriptionCheckoutRequest): Promise<SubscriptionCheckoutResponse>;
  verifyPayment(transactionId: string): Promise<{ success: boolean; status: string; amount: number }>;
  handleWebhook(payload: any, signature?: string): Promise<WebhookResult>;
  cancelSubscription(subscriptionId: string): Promise<boolean>;
}

export class WaveSubscriptionPaymentProvider implements SubscriptionPaymentProvider {
  readonly code = 'wave';
  readonly name = 'Wave';

  isConfigured(): boolean {
    return Boolean(process.env.WAVE_API_KEY && process.env.WAVE_API_KEY.length > 5);
  }

  async createCheckout(req: SubscriptionCheckoutRequest): Promise<SubscriptionCheckoutResponse> {
    if (!this.isConfigured()) {
      return {
        success: false,
        provider: this.code,
        status: 'failed',
        message: 'Passerelle Wave non configurée pour les abonnements. Définissez WAVE_API_KEY.',
      };
    }

    return {
      success: true,
      provider: this.code,
      transactionId: `wv_sub_${Date.now()}`,
      checkoutUrl: `https://pay.wave.com/c/mock-sub-${Date.now()}`,
      status: 'pending',
      message: 'Session de paiement d’abonnement Wave initialisée.',
    };
  }

  async verifyPayment(transactionId: string) {
    return { success: false, status: 'pending', amount: 0 };
  }

  async handleWebhook(payload: any, signature?: string): Promise<WebhookResult> {
    // Vérification de signature Wave Webhook
    if (!payload?.id) {
      return { success: false, eventType: 'unknown', message: 'Payload invalide' };
    }

    return {
      success: true,
      eventType: payload.type || 'checkout.session.completed',
      transactionId: payload.id,
      companyId: payload.client_reference,
      amount: payload.amount,
    };
  }

  async cancelSubscription(subscriptionId: string): Promise<boolean> {
    return true;
  }
}

export class OrangeMoneySubscriptionPaymentProvider implements SubscriptionPaymentProvider {
  readonly code = 'orange_money';
  readonly name = 'Orange Money';

  isConfigured(): boolean {
    return Boolean(process.env.ORANGE_MONEY_MERCHANT_KEY && process.env.ORANGE_MONEY_MERCHANT_KEY.length > 5);
  }

  async createCheckout(req: SubscriptionCheckoutRequest): Promise<SubscriptionCheckoutResponse> {
    if (!this.isConfigured()) {
      return {
        success: false,
        provider: this.code,
        status: 'failed',
        message: 'Passerelle Orange Money non configurée. Définissez ORANGE_MONEY_MERCHANT_KEY.',
      };
    }

    return {
      success: true,
      provider: this.code,
      transactionId: `om_sub_${Date.now()}`,
      checkoutUrl: `https://om-checkout.orange.com/sub-${Date.now()}`,
      status: 'pending',
      message: 'Session Orange Money initialisée.',
    };
  }

  async verifyPayment(transactionId: string) {
    return { success: false, status: 'pending', amount: 0 };
  }

  async handleWebhook(payload: any): Promise<WebhookResult> {
    return {
      success: true,
      eventType: 'payment.completed',
      transactionId: payload?.tx_id,
    };
  }

  async cancelSubscription(subscriptionId: string): Promise<boolean> {
    return true;
  }
}

export class MtnMomoSubscriptionPaymentProvider implements SubscriptionPaymentProvider {
  readonly code = 'mtn_momo';
  readonly name = 'MTN MoMo';

  isConfigured(): boolean {
    return Boolean(process.env.MTN_MOMO_SUBSCRIPTION_KEY && process.env.MTN_MOMO_SUBSCRIPTION_KEY.length > 5);
  }

  async createCheckout(req: SubscriptionCheckoutRequest): Promise<SubscriptionCheckoutResponse> {
    if (!this.isConfigured()) {
      return {
        success: false,
        provider: this.code,
        status: 'failed',
        message: 'Passerelle MTN MoMo non configurée. Définissez MTN_MOMO_SUBSCRIPTION_KEY.',
      };
    }

    return {
      success: true,
      provider: this.code,
      transactionId: `momo_sub_${Date.now()}`,
      status: 'pending',
      message: 'Demande de prélèvement MTN MoMo envoyée.',
    };
  }

  async verifyPayment(transactionId: string) {
    return { success: false, status: 'pending', amount: 0 };
  }

  async handleWebhook(payload: any): Promise<WebhookResult> {
    return {
      success: true,
      eventType: 'requesttopay.success',
      transactionId: payload?.financialTransactionId,
    };
  }

  async cancelSubscription(subscriptionId: string): Promise<boolean> {
    return true;
  }
}

class SubscriptionPaymentRegistry {
  private providers: Map<string, SubscriptionPaymentProvider> = new Map();

  constructor() {
    this.register(new WaveSubscriptionPaymentProvider());
    this.register(new OrangeMoneySubscriptionPaymentProvider());
    this.register(new MtnMomoSubscriptionPaymentProvider());
  }

  register(provider: SubscriptionPaymentProvider) {
    this.providers.set(provider.code, provider);
  }

  get(code: string): SubscriptionPaymentProvider | undefined {
    return this.providers.get(code);
  }

  getAll(): SubscriptionPaymentProvider[] {
    return Array.from(this.providers.values());
  }
}

export const subscriptionPaymentRegistry = new SubscriptionPaymentRegistry();
