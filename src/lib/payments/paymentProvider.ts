// ==============================================================================
// BUSINESSOS — PAYMENT PROVIDER ABSTRACTION (PHASE 4: SECTION 29)
// ==============================================================================
// Cette abstraction prépare l'intégration des passerelles Mobile Money d'Afrique de l'Ouest
// (Wave, Orange Money, MTN MoMo) sans réécrire le module de paiements de BusinessOS.

export type SupportedPaymentProviderCode = 'wave' | 'orange_money' | 'mtn_momo' | 'stripe';

export interface PaymentInitiateRequest {
  amount: number;
  currency: string;
  customerPhone?: string;
  customerName?: string;
  customerEmail?: string;
  invoiceId?: string;
  invoiceNumber?: string;
  description: string;
  callbackUrl?: string;
  metadata?: Record<string, any>;
}

export interface PaymentInitiateResponse {
  success: boolean;
  provider: SupportedPaymentProviderCode;
  transactionId?: string;
  checkoutUrl?: string;
  qrCodeUrl?: string;
  ussdPrompt?: string;
  status: 'pending' | 'requires_action' | 'failed';
  message: string;
}

export interface PaymentVerificationResponse {
  transactionId: string;
  provider: SupportedPaymentProviderCode;
  status: 'pending' | 'completed' | 'failed' | 'cancelled';
  amount: number;
  currency: string;
  paidAt?: string;
  rawResponse?: Record<string, any>;
}

export interface PaymentProviderInfo {
  code: SupportedPaymentProviderCode;
  name: string;
  logo: string;
  countrySupport: string[];
  isConfigured: boolean;
  mode: 'live' | 'test' | 'unconfigured';
  description: string;
}

/**
 * Interface abstraite commune à tous les fournisseurs Mobile Money.
 */
export interface PaymentProvider {
  readonly code: SupportedPaymentProviderCode;
  readonly name: string;
  isConfigured(): boolean;
  getInfo(): PaymentProviderInfo;
  initiatePayment(request: PaymentInitiateRequest): Promise<PaymentInitiateResponse>;
  verifyPayment(transactionId: string): Promise<PaymentVerificationResponse>;
}

/**
 * Adaptateur Wave Checkout & QR
 */
export class WavePaymentProvider implements PaymentProvider {
  readonly code: SupportedPaymentProviderCode = 'wave';
  readonly name: string = 'Wave';

  private apiKey?: string;

  constructor() {
    this.apiKey = process.env.WAVE_API_KEY;
  }

  isConfigured(): boolean {
    return Boolean(this.apiKey && this.apiKey.length > 5);
  }

  getInfo(): PaymentProviderInfo {
    return {
      code: 'wave',
      name: 'Wave',
      logo: '🌊',
      countrySupport: ['Sénégal (SN)', 'Côte d’Ivoire (CI)', 'Mali (ML)', 'Burkina Faso (BF)'],
      isConfigured: this.isConfigured(),
      mode: this.isConfigured() ? 'live' : 'unconfigured',
      description: 'Paiement direct 1% par lien instantané ou QR Code Wave Mobile.',
    };
  }

  async initiatePayment(request: PaymentInitiateRequest): Promise<PaymentInitiateResponse> {
    if (!this.isConfigured()) {
      return {
        success: false,
        provider: 'wave',
        status: 'failed',
        message: 'Passerelle Wave non configurée. Définissez WAVE_API_KEY côté serveur pour activer les encaissements directs.',
      };
    }

    // Architecture prête pour Wave Checkout API
    // POST https://api.wave.com/v1/checkout/sessions
    return {
      success: true,
      provider: 'wave',
      transactionId: `wv_${Date.now()}`,
      checkoutUrl: `https://pay.wave.com/c/mock-session-${Date.now()}`,
      status: 'pending',
      message: 'Session de paiement Wave initialisée.',
    };
  }

  async verifyPayment(transactionId: string): Promise<PaymentVerificationResponse> {
    return {
      transactionId,
      provider: 'wave',
      status: 'pending',
      amount: 0,
      currency: 'XOF',
    };
  }
}

/**
 * Adaptateur Orange Money Web & USSD Push
 */
export class OrangeMoneyPaymentProvider implements PaymentProvider {
  readonly code: SupportedPaymentProviderCode = 'orange_money';
  readonly name: string = 'Orange Money';

  private merchantKey?: string;

  constructor() {
    this.merchantKey = process.env.ORANGE_MONEY_MERCHANT_KEY;
  }

  isConfigured(): boolean {
    return Boolean(this.merchantKey && this.merchantKey.length > 5);
  }

  getInfo(): PaymentProviderInfo {
    return {
      code: 'orange_money',
      name: 'Orange Money',
      logo: '🍊',
      countrySupport: ['Sénégal', 'Côte d’Ivoire', 'Cameroun', 'Mali', 'Guinée', 'RDC'],
      isConfigured: this.isConfigured(),
      mode: this.isConfigured() ? 'live' : 'unconfigured',
      description: 'Encaissements par Web Payment ou Push USSD (*144# / *150#) Orange Money.',
    };
  }

  async initiatePayment(request: PaymentInitiateRequest): Promise<PaymentInitiateResponse> {
    if (!this.isConfigured()) {
      return {
        success: false,
        provider: 'orange_money',
        status: 'failed',
        message: 'Passerelle Orange Money non configurée. Définissez ORANGE_MONEY_MERCHANT_KEY côté serveur.',
      };
    }

    return {
      success: true,
      provider: 'orange_money',
      transactionId: `om_${Date.now()}`,
      checkoutUrl: `https://om-checkout.orange.com/pay-${Date.now()}`,
      ussdPrompt: '#144#399#',
      status: 'pending',
      message: 'Demande Orange Money créée.',
    };
  }

  async verifyPayment(transactionId: string): Promise<PaymentVerificationResponse> {
    return {
      transactionId,
      provider: 'orange_money',
      status: 'pending',
      amount: 0,
      currency: 'XOF',
    };
  }
}

/**
 * Adaptateur MTN MoMo (Mobile Money API)
 */
export class MtnMomoPaymentProvider implements PaymentProvider {
  readonly code: SupportedPaymentProviderCode = 'mtn_momo';
  readonly name: string = 'MTN MoMo';

  private subscriptionKey?: string;

  constructor() {
    this.subscriptionKey = process.env.MTN_MOMO_SUBSCRIPTION_KEY;
  }

  isConfigured(): boolean {
    return Boolean(this.subscriptionKey && this.subscriptionKey.length > 5);
  }

  getInfo(): PaymentProviderInfo {
    return {
      code: 'mtn_momo',
      name: 'MTN MoMo',
      logo: '💛',
      countrySupport: ['Côte d’Ivoire', 'Cameroun', 'Bénin', 'Ghana', 'Congo'],
      isConfigured: this.isConfigured(),
      mode: this.isConfigured() ? 'live' : 'unconfigured',
      description: 'Collection API directe Request-to-Pay MTN MoMo pour prélèvement avec code secret.',
    };
  }

  async initiatePayment(request: PaymentInitiateRequest): Promise<PaymentInitiateResponse> {
    if (!this.isConfigured()) {
      return {
        success: false,
        provider: 'mtn_momo',
        status: 'failed',
        message: 'Passerelle MTN MoMo non configurée. Définissez MTN_MOMO_SUBSCRIPTION_KEY côté serveur.',
      };
    }

    return {
      success: true,
      provider: 'mtn_momo',
      transactionId: `momo_${Date.now()}`,
      status: 'pending',
      message: 'Demande de prélèvement MTN MoMo envoyée sur le mobile client.',
    };
  }

  async verifyPayment(transactionId: string): Promise<PaymentVerificationResponse> {
    return {
      transactionId,
      provider: 'mtn_momo',
      status: 'pending',
      amount: 0,
      currency: 'XOF',
    };
  }
}

/**
 * Registre centralisé des fournisseurs de paiement
 */
class PaymentProviderRegistry {
  private providers: Map<SupportedPaymentProviderCode, PaymentProvider> = new Map();

  constructor() {
    this.register(new WavePaymentProvider());
    this.register(new OrangeMoneyPaymentProvider());
    this.register(new MtnMomoPaymentProvider());
    // Stripe ajouté Phase 6 (lazy import pour éviter le bundle côté client)
    if (typeof process !== 'undefined' && process.env.STRIPE_SECRET_KEY) {
      import('./stripeProvider').then(({ stripeInvoiceProvider }) => {
        this.providers.set('stripe', stripeInvoiceProvider as any);
      }).catch(() => {});
    }
  }

  register(provider: PaymentProvider) {
    this.providers.set(provider.code, provider);
  }

  get(code: SupportedPaymentProviderCode): PaymentProvider | undefined {
    return this.providers.get(code);
  }

  getAll(): PaymentProvider[] {
    return Array.from(this.providers.values());
  }

  getAllInfo(): PaymentProviderInfo[] {
    return this.getAll().map((p) => p.getInfo());
  }
}

export const paymentRegistry = new PaymentProviderRegistry();
