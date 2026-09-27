// ==============================================================================
// BUSINESSOS — WEBHOOK WHATSAPP (PHASE 6)
// ==============================================================================
// Route : GET /api/webhooks/whatsapp  → vérification Meta
//         POST /api/webhooks/whatsapp → réception messages entrants
// Variables : WHATSAPP_VERIFY_TOKEN, WHATSAPP_ACCESS_TOKEN

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// ─── GET : Vérification du webhook par Meta ────────────────────────────────────

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN;

  if (!verifyToken) {
    return new NextResponse('WHATSAPP_VERIFY_TOKEN non défini', { status: 500 });
  }

  if (mode === 'subscribe' && token === verifyToken) {
    console.log('[WhatsApp Webhook] Vérification réussie');
    return new NextResponse(challenge, { status: 200 });
  }

  console.warn('[WhatsApp Webhook] Vérification échouée — token invalide');
  return new NextResponse('Forbidden', { status: 403 });
}

// ─── POST : Réception des messages entrants ────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Valider la structure Meta
    if (body.object !== 'whatsapp_business_account') {
      return NextResponse.json({ status: 'not_whatsapp' }, { status: 200 });
    }

    const entries = body.entry ?? [];
    const supabase = await createClient();

    for (const entry of entries) {
      for (const change of entry.changes ?? []) {
        if (change.field !== 'messages') continue;

        const value = change.value;
        const messages = value?.messages ?? [];

        for (const message of messages) {
          await handleIncomingMessage(supabase, message, value?.contacts?.[0]);
        }
      }
    }

    return NextResponse.json({ status: 'ok' });
  } catch (err: any) {
    console.error('[WhatsApp Webhook] Erreur :', err.message);
    // Toujours 200 pour éviter les relivraisons Meta
    return NextResponse.json({ status: 'error', message: err.message }, { status: 200 });
  }
}

// ─── Traitement d'un message entrant ──────────────────────────────────────────

async function handleIncomingMessage(supabase: any, message: any, contact: any) {
  const from = message.from; // numéro E.164 sans +
  const messageType = message.type;
  const timestamp = new Date(Number(message.timestamp) * 1000).toISOString();

  let textContent = '';
  if (messageType === 'text') {
    textContent = message.text?.body ?? '';
  } else if (messageType === 'button') {
    textContent = `[Bouton] ${message.button?.text ?? ''}`;
  }

  const senderName = contact?.profile?.name ?? from;

  console.log(`[WhatsApp Webhook] Message de ${senderName} (${from}): ${textContent}`);

  // Chercher un prospect ou client avec ce numéro
  // (recherche cross-tenant uniquement avec service role — ici on log juste)
  try {
    // Stocker l'activité WhatsApp entrant si on peut l'associer à un prospect/client
    // Cette logique nécessite la clé service_role pour chercher cross-company
    // En attendant, on log dans une table dédiée si elle existe
    await supabase.from('whatsapp_messages').insert({
      from_phone: from,
      sender_name: senderName,
      message_type: messageType,
      content: textContent,
      direction: 'inbound',
      received_at: timestamp,
      raw_payload: message,
    }).maybeSingle(); // ignorer si la table n'existe pas encore
  } catch {
    // Silencieux — la table peut ne pas exister
  }
}
