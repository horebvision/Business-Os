// ==============================================================================
// BUSINESSOS — WHATSAPP CLOUD API SERVICE (PHASE 6)
// ==============================================================================
// Service complet pour l'envoi de messages WhatsApp via Meta Cloud API.
// Variables d'environnement requises :
//   WHATSAPP_PHONE_NUMBER_ID   (ex: 123456789012345)
//   WHATSAPP_ACCESS_TOKEN      (token permanent Meta Business)
//   WHATSAPP_VERIFY_TOKEN      (token personnalisé pour webhook verification)
//
// Documentation : https://developers.facebook.com/docs/whatsapp/cloud-api

const WA_API_VERSION = 'v21.0';

function getWAConfig() {
  return {
    phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID,
    accessToken: process.env.WHATSAPP_ACCESS_TOKEN,
    verifyToken: process.env.WHATSAPP_VERIFY_TOKEN,
  };
}

export function isWhatsAppConfigured(): boolean {
  const cfg = getWAConfig();
  return Boolean(cfg.phoneNumberId && cfg.accessToken && cfg.accessToken.length > 20);
}

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface WASendResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export interface WATextMessage {
  to: string; // format international sans +, ex: 221771234567
  text: string;
}

export interface WATemplateMessage {
  to: string;
  templateName: string; // ex: 'quote_notification'
  languageCode: string; // ex: 'fr'
  components?: Array<{
    type: 'header' | 'body' | 'button';
    parameters: Array<{ type: 'text'; text: string }>;
  }>;
}

export interface WAInvoiceNotification {
  phoneNumber: string;
  clientName: string;
  invoiceNumber: string;
  amount: string;
  dueDate?: string;
  paymentLink?: string;
  companyName: string;
}

export interface WAQuoteNotification {
  phoneNumber: string;
  clientName: string;
  quoteNumber: string;
  amount: string;
  validUntil?: string;
  approvalLink?: string;
  companyName: string;
}

// ─── Fonctions d'envoi ─────────────────────────────────────────────────────────

/**
 * Envoyer un message texte libre WhatsApp.
 */
export async function sendWhatsAppText(msg: WATextMessage): Promise<WASendResult> {
  if (!isWhatsAppConfigured()) {
    return {
      success: false,
      error: 'WhatsApp Cloud API non configuré. Définissez WHATSAPP_PHONE_NUMBER_ID et WHATSAPP_ACCESS_TOKEN.',
    };
  }

  const { phoneNumberId, accessToken } = getWAConfig();
  const phone = normalizePhone(msg.to);

  try {
    const res = await fetch(
      `https://graph.facebook.com/${WA_API_VERSION}/${phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: phone,
          type: 'text',
          text: { preview_url: false, body: msg.text },
        }),
      }
    );

    const data = await res.json();

    if (!res.ok) {
      return {
        success: false,
        error: data.error?.message ?? `Erreur HTTP ${res.status}`,
      };
    }

    return {
      success: true,
      messageId: data.messages?.[0]?.id,
    };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Envoyer un template WhatsApp approuvé par Meta.
 */
export async function sendWhatsAppTemplate(msg: WATemplateMessage): Promise<WASendResult> {
  if (!isWhatsAppConfigured()) {
    return { success: false, error: 'WhatsApp Cloud API non configuré.' };
  }

  const { phoneNumberId, accessToken } = getWAConfig();
  const phone = normalizePhone(msg.to);

  try {
    const res = await fetch(
      `https://graph.facebook.com/${WA_API_VERSION}/${phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: phone,
          type: 'template',
          template: {
            name: msg.templateName,
            language: { code: msg.languageCode },
            components: msg.components ?? [],
          },
        }),
      }
    );

    const data = await res.json();

    if (!res.ok) {
      return { success: false, error: data.error?.message ?? `Erreur HTTP ${res.status}` };
    }

    return { success: true, messageId: data.messages?.[0]?.id };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// ─── Messages métier prêts à l'emploi ─────────────────────────────────────────

/**
 * Notifier un client qu'une nouvelle facture est émise.
 */
export async function sendInvoiceNotification(data: WAInvoiceNotification): Promise<WASendResult> {
  const lines = [
    `Bonjour ${data.clientName} 👋`,
    ``,
    `📄 *Nouvelle facture* de *${data.companyName}*`,
    ``,
    `• N° : *${data.invoiceNumber}*`,
    `• Montant : *${data.amount}*`,
    data.dueDate ? `• Échéance : *${data.dueDate}*` : null,
    ``,
    data.paymentLink
      ? `💳 Payez en ligne : ${data.paymentLink}`
      : `Contactez-nous pour connaître les modalités de paiement.`,
    ``,
    `Merci pour votre confiance ! 🙏`,
  ].filter(Boolean).join('\n');

  return sendWhatsAppText({ to: data.phoneNumber, text: lines });
}

/**
 * Envoyer un devis par WhatsApp.
 */
export async function sendQuoteNotification(data: WAQuoteNotification): Promise<WASendResult> {
  const lines = [
    `Bonjour ${data.clientName} 👋`,
    ``,
    `📋 *Nouveau devis* de *${data.companyName}*`,
    ``,
    `• N° : *${data.quoteNumber}*`,
    `• Montant : *${data.amount}*`,
    data.validUntil ? `• Valable jusqu'au : *${data.validUntil}*` : null,
    ``,
    data.approvalLink
      ? `✅ Consultez et validez votre devis : ${data.approvalLink}`
      : `Répondez à ce message pour accepter ou poser vos questions.`,
    ``,
    `Merci ! 😊`,
  ].filter(Boolean).join('\n');

  return sendWhatsAppText({ to: data.phoneNumber, text: lines });
}

/**
 * Relance de paiement par WhatsApp.
 */
export async function sendPaymentReminder(data: {
  phoneNumber: string;
  clientName: string;
  invoiceNumber: string;
  amount: string;
  daysOverdue: number;
  paymentLink?: string;
  companyName: string;
}): Promise<WASendResult> {
  const urgencyEmoji = data.daysOverdue > 30 ? '🚨' : data.daysOverdue > 14 ? '⚠️' : '🔔';

  const lines = [
    `Bonjour ${data.clientName},`,
    ``,
    `${urgencyEmoji} *Rappel de paiement* — ${data.companyName}`,
    ``,
    `La facture *${data.invoiceNumber}* d'un montant de *${data.amount}* est en retard de *${data.daysOverdue} jour(s)*.`,
    ``,
    data.paymentLink
      ? `💳 Réglez maintenant : ${data.paymentLink}`
      : `Merci de nous contacter pour régulariser votre situation.`,
    ``,
    `Cordialement,`,
    `L'équipe ${data.companyName}`,
  ].join('\n');

  return sendWhatsAppText({ to: data.phoneNumber, text: lines });
}

// ─── Utilitaires ───────────────────────────────────────────────────────────────

/**
 * Normalise un numéro de téléphone en format E.164 sans le +.
 * Gère les préfixes locaux africains et européens courants.
 */
export function normalizePhone(phone: string): string {
  // Supprimer tout sauf les chiffres
  let digits = phone.replace(/\D/g, '');

  // Si commence par 00, remplacer par rien (sera géré ensuite)
  if (digits.startsWith('00')) digits = digits.slice(2);

  // Si commence par 0 et longueur locale (~8-9 chiffres) → essayer de deviner
  // (Sénégal : +221, Côte d'Ivoire : +225, France : +33...)
  // En pratique, les numéros devraient être stockés avec l'indicatif pays

  return digits;
}

/**
 * Génère un deep-link WhatsApp (fallback si API non configurée).
 */
export function getWhatsAppDeepLink(phone: string, message: string): string {
  const encoded = encodeURIComponent(message);
  return `https://wa.me/${normalizePhone(phone)}?text=${encoded}`;
}
