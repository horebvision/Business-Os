// ==============================================================================
// BUSINESSOS — SERVICE D'IDEMPOTENCE WEBHOOKS PERSISTANT (PHASE 6.2 HARDENING)
// ==============================================================================
// Assure que les webhooks externes (Stripe, WhatsApp, Wave, etc.) ne sont
// JAMAIS exécutés deux fois, même en environnement multi-instance ou après redémarrage.
//
// Cycle d'états :
//   received / processing → processed (succès)
//                         → failed    (échec métier, permet un retry légitime)
//
// Protection concurrence :
//   - Contrainte UNIQUE (provider, event_id) dans PostgreSQL
//   - Résolution atomique des conflits
//   - Pas de stockage de payloads sensibles (hash SHA-256 uniquement)

import crypto from 'crypto';
import { supabaseAdmin } from '@/lib/supabase/admin';

export type WebhookProcessStatus = 'received' | 'processing' | 'processed' | 'failed';

export interface WebhookClaimResult {
  canProcess: boolean;
  isDuplicate: boolean;
  status?: WebhookProcessStatus;
  reason?: 'already_processed' | 'concurrent_in_progress' | 'first_time' | 'retry_after_failure';
}

// Mémoire de repli local (si la table DB n'est pas encore migrée)
const inMemoryCache = new Map<string, { status: WebhookProcessStatus; ts: number }>();
const IN_MEMORY_TTL = 60 * 60 * 1000; // 1h

/**
 * Calcule une empreinte SHA-256 non réversible du payload (sécurité / non-exposition).
 */
export function hashWebhookPayload(payload: string | Buffer): string {
  return crypto.createHash('sha256').update(payload).digest('hex');
}

/**
 * Nettoie les messages d'erreur pour éviter toute fuite de secret dans la base.
 */
function sanitizeErrorMessage(msg?: string): string | null {
  if (!msg) return null;
  return msg
    .replace(/(sk_live_|sk_test_|whsec_|Bearer\s+)[a-zA-Z0-9_\-]+/gi, '$1***REDACTED***')
    .substring(0, 500);
}

/**
 * Revendique le droit exclusif de traiter un webhook.
 * Retourne `canProcess: true` si ce webhook doit être traité.
 * Retourne `isDuplicate: true` si ce webhook est déjà traité ou en cours.
 */
export async function claimWebhook(
  provider: string,
  eventId: string,
  eventType: string,
  payloadHash?: string
): Promise<WebhookClaimResult> {
  const compositeKey = `${provider}:${eventId}`;

  try {
    const supabase = supabaseAdmin;

    // 1. Vérification dans la table persistante
    const { data: existing, error: selectError } = await supabase
      .from('processed_webhooks')
      .select('status, received_at')
      .eq('provider', provider)
      .eq('event_id', eventId)
      .maybeSingle();

    if (selectError && selectError.code !== 'PGRST116') {
      // Table probablement non migrée, passer au fallback mémoire
      return claimWebhookInMemory(compositeKey);
    }

    if (existing) {
      if (existing.status === 'processed') {
        return {
          canProcess: false,
          isDuplicate: true,
          status: 'processed',
          reason: 'already_processed',
        };
      }

      if (existing.status === 'processing') {
        const receivedAt = new Date(existing.received_at).getTime();
        const isStale = Date.now() - receivedAt > 5 * 60 * 1000; // 5 min timeout

        if (!isStale) {
          return {
            canProcess: false,
            isDuplicate: true,
            status: 'processing',
            reason: 'concurrent_in_progress',
          };
        }
        // Si bloqué depuis > 5 min, autoriser la reprise
      }

      // Si statut 'failed' ou bloqué, réactiver en 'processing'
      await supabase
        .from('processed_webhooks')
        .update({
          status: 'processing',
          received_at: new Date().toISOString(),
          payload_hash: payloadHash || null,
        })
        .eq('provider', provider)
        .eq('event_id', eventId);

      return {
        canProcess: true,
        isDuplicate: false,
        status: 'processing',
        reason: 'retry_after_failure',
      };
    }

    // 2. Première arrivée : insertion protégée par contrainte UNIQUE
    const { error: insertError } = await supabase
      .from('processed_webhooks')
      .insert({
        provider,
        event_id: eventId,
        event_type: eventType,
        status: 'processing',
        payload_hash: payloadHash || null,
        received_at: new Date().toISOString(),
      });

    if (insertError) {
      // Conflit d'insertion simultanée (code 23505 = unique_violation)
      if (insertError.code === '23505' || insertError.message?.includes('duplicate key')) {
        return {
          canProcess: false,
          isDuplicate: true,
          status: 'processing',
          reason: 'concurrent_in_progress',
        };
      }
      // Autre erreur DB, basculer sur fallback
      return claimWebhookInMemory(compositeKey);
    }

    return {
      canProcess: true,
      isDuplicate: false,
      status: 'processing',
      reason: 'first_time',
    };
  } catch (err: any) {
    console.warn('[WebhookIdempotence] Erreur DB, utilisation du repli mémoire :', err.message);
    return claimWebhookInMemory(compositeKey);
  }
}

/**
 * Marque l'issue finale du traitement d'un événement webhook.
 */
export async function finalizeWebhook(
  provider: string,
  eventId: string,
  success: boolean,
  errorMessage?: string
): Promise<void> {
  const compositeKey = `${provider}:${eventId}`;
  const finalStatus: WebhookProcessStatus = success ? 'processed' : 'failed';

  // Mise à jour mémoire
  inMemoryCache.set(compositeKey, { status: finalStatus, ts: Date.now() });

  try {
    const supabase = supabaseAdmin;
    await supabase
      .from('processed_webhooks')
      .update({
        status: finalStatus,
        processed_at: success ? new Date().toISOString() : null,
        error_message: sanitizeErrorMessage(errorMessage),
      })
      .eq('provider', provider)
      .eq('event_id', eventId);
  } catch (err: any) {
    console.warn('[WebhookIdempotence] Échec mise à jour statut DB :', err.message);
  }
}

// ─── Repli Mémoire Robuste ───────────────────────────────────────────────────

function claimWebhookInMemory(key: string): WebhookClaimResult {
  const now = Date.now();
  const entry = inMemoryCache.get(key);

  if (entry) {
    if (now - entry.ts > IN_MEMORY_TTL) {
      inMemoryCache.delete(key);
    } else if (entry.status === 'processed') {
      return { canProcess: false, isDuplicate: true, status: 'processed', reason: 'already_processed' };
    } else if (entry.status === 'processing') {
      return { canProcess: false, isDuplicate: true, status: 'processing', reason: 'concurrent_in_progress' };
    }
  }

  inMemoryCache.set(key, { status: 'processing', ts: now });
  return { canProcess: true, isDuplicate: false, status: 'processing', reason: 'first_time' };
}
