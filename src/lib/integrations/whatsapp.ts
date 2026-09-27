// ==============================================================================
// BUSINESSOS — WHATSAPP INTEGRATION & DEEP-LINK HELPER (PHASE 4: SECTION 24)
// ==============================================================================
// Permet de générer des liens WhatsApp directs avec message prérempli (wa.me)
// et prépare l'architecture pour l'API officielle WhatsApp Cloud de Meta.

export interface WhatsAppConfig {
  isApiConfigured: boolean;
  phoneNumberId?: string;
  businessAccountId?: string;
  senderPhone?: string;
}

export function getWhatsAppConfig(): WhatsAppConfig {
  const token = process.env.WHATSAPP_API_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;

  return {
    isApiConfigured: Boolean(token && phoneId),
    phoneNumberId: phoneId,
    businessAccountId: process.env.WHATSAPP_BUSINESS_ACCOUNT_ID,
    senderPhone: process.env.WHATSAPP_SENDER_PHONE,
  };
}

/**
 * Nettoie et formate un numéro de téléphone pour WhatsApp (ex: +221 77 123 45 67 -> 221771234567)
 */
export function sanitizeWhatsAppPhone(phone?: string | null): string {
  if (!phone) return '';
  return phone.replace(/[^\d]/g, '');
}

/**
 * Génère une URL WhatsApp sécurisée ouvrant l'application native ou Web avec message pré-rempli.
 * RÈGLE ABSOLUE : N'affirme jamais qu'un message a été envoyé via API si l'API n'est pas active.
 */
export function buildWhatsAppLink(phone: string | null | undefined, text: string): string {
  const cleanPhone = sanitizeWhatsAppPhone(phone);
  const encodedText = encodeURIComponent(text.trim());
  if (cleanPhone) {
    return `https://wa.me/${cleanPhone}?text=${encodedText}`;
  }
  return `https://wa.me/?text=${encodedText}`;
}

/**
 * Modèles types de messages WhatsApp professionnels pour les entrepreneurs ouest-africains.
 */
export const WHATSAPP_TEMPLATES = {
  invoiceReminder: (params: {
    customerName: string;
    invoiceNumber: string;
    amount: string;
    dueDate: string;
    companyName: string;
    portalUrl?: string;
  }) => {
    let msg = `Bonjour ${params.customerName},\n\nSauf erreur de notre part, la facture n° *${params.invoiceNumber}* d'un montant de *${params.amount}*, échue le ${params.dueDate}, est toujours en attente de règlement.\n\nMerci de bien vouloir procéder au paiement dès que possible.`;
    if (params.portalUrl) {
      msg += `\n\nVous pouvez consulter et régler votre facture en ligne ici : ${params.portalUrl}`;
    }
    msg += `\n\nBien cordialement,\n*${params.companyName}*`;
    return msg;
  },

  quoteFollowUp: (params: {
    customerName: string;
    quoteNumber: string;
    amount: string;
    companyName: string;
    portalUrl?: string;
  }) => {
    let msg = `Bonjour ${params.customerName},\n\nNous revenons vers vous concernant notre proposition n° *${params.quoteNumber}* d'un montant de *${params.amount}*.\n\nAvez-vous eu l'occasion de la consulter ou souhaitez-vous des ajustements ?`;
    if (params.portalUrl) {
      msg += `\n\nConsulter et valider le devis en ligne : ${params.portalUrl}`;
    }
    msg += `\n\nExcellente journée,\n*${params.companyName}*`;
    return msg;
  },

  leadWelcome: (params: {
    leadName: string;
    companyName: string;
    senderName: string;
  }) => {
    return `Bonjour ${params.leadName},\n\nRavi de faire votre connaissance ! Je suis ${params.senderName} de *${params.companyName}*.\n\nNous avons bien reçu votre demande d'information. À quel moment seriez-vous disponible pour un court échange afin de cibler au mieux vos besoins ?\n\nÀ très vite !`;
  },
};

/**
 * Service pour l'API officielle WhatsApp Cloud (Meta Graph API)
 * Pour envoi automatique par serveur une fois le token configuré.
 */
export class WhatsAppCloudService {
  private config = getWhatsAppConfig();

  async sendTemplateMessage(to: string, templateName: string, components: any[]) {
    if (!this.config.isApiConfigured) {
      throw new Error(
        'WhatsApp Cloud API non configurée. Définissez WHATSAPP_API_TOKEN et WHATSAPP_PHONE_NUMBER_ID dans vos variables d’environnement.'
      );
    }

    const cleanTo = sanitizeWhatsAppPhone(to);
    const url = `https://graph.facebook.com/v18.0/${this.config.phoneNumberId}/messages`;

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.WHATSAPP_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: cleanTo,
        type: 'template',
        template: {
          name: templateName,
          language: { code: 'fr' },
          components,
        },
      }),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(`Erreur WhatsApp API: ${JSON.stringify(err)}`);
    }

    return await res.json();
  }
}
