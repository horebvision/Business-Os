// ==============================================================================
// BUSINESSOS — API ROUTE : /api/integrations/whatsapp/send (PHASE 6)
// ==============================================================================
// Envoie un message WhatsApp à un client ou prospect.

import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedContext } from '@/lib/auth/permissions';
import {
  sendInvoiceNotification,
  sendQuoteNotification,
  sendPaymentReminder,
  sendWhatsAppText,
  getWhatsAppDeepLink,
  isWhatsAppConfigured,
} from '@/lib/integrations/whatsappService';

export async function POST(request: NextRequest) {
  try {
    const authResult = await getAuthenticatedContext(request);
    if (authResult.errorResponse) return authResult.errorResponse;
    const ctx = authResult.context!;

    const body = await request.json();
    const { type, phoneNumber, data: messageData } = body;

    if (!phoneNumber) {
      return NextResponse.json({ error: 'phoneNumber requis' }, { status: 400 });
    }

    // Si WhatsApp Cloud API non configuré → retourner deep-link fallback
    if (!isWhatsAppConfigured()) {
      let fallbackText = messageData?.text ?? 'Bonjour depuis BusinessOS';
      if (type === 'invoice') {
        fallbackText = `Bonjour ${messageData?.clientName}, voici votre facture ${messageData?.invoiceNumber} : ${messageData?.amount}`;
      } else if (type === 'quote') {
        fallbackText = `Bonjour ${messageData?.clientName}, voici votre devis ${messageData?.quoteNumber} : ${messageData?.amount}`;
      }

      return NextResponse.json({
        success: false,
        mode: 'deep_link',
        deepLink: getWhatsAppDeepLink(phoneNumber, fallbackText),
        message: 'WhatsApp Cloud API non configuré. Utilisez le deep-link pour envoyer manuellement.',
      });
    }

    const companyName = messageData?.companyName ?? ctx.companyId;
    let result;

    switch (type) {
      case 'invoice':
        result = await sendInvoiceNotification({
          phoneNumber,
          clientName: messageData.clientName,
          invoiceNumber: messageData.invoiceNumber,
          amount: messageData.amount,
          dueDate: messageData.dueDate,
          paymentLink: messageData.paymentLink,
          companyName,
        });
        break;

      case 'quote':
        result = await sendQuoteNotification({
          phoneNumber,
          clientName: messageData.clientName,
          quoteNumber: messageData.quoteNumber,
          amount: messageData.amount,
          validUntil: messageData.validUntil,
          approvalLink: messageData.approvalLink,
          companyName,
        });
        break;

      case 'reminder':
        result = await sendPaymentReminder({
          phoneNumber,
          clientName: messageData.clientName,
          invoiceNumber: messageData.invoiceNumber,
          amount: messageData.amount,
          daysOverdue: messageData.daysOverdue ?? 0,
          paymentLink: messageData.paymentLink,
          companyName,
        });
        break;

      case 'text':
        result = await sendWhatsAppText({
          to: phoneNumber,
          text: messageData.text,
        });
        break;

      default:
        return NextResponse.json({ error: 'type invalide (invoice|quote|reminder|text)' }, { status: 400 });
    }

    return NextResponse.json(result);
  } catch (err: any) {
    console.error('[WhatsApp Send Error]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function GET(_request: NextRequest) {
  return NextResponse.json({
    configured: isWhatsAppConfigured(),
    message: isWhatsAppConfigured()
      ? 'WhatsApp Cloud API opérationnel'
      : 'WhatsApp Cloud API non configuré. Définissez WHATSAPP_PHONE_NUMBER_ID et WHATSAPP_ACCESS_TOKEN.',
  });
}
