// ==============================================================================
// BUSINESSOS — RATE LIMITING PERSISTANT & ATOMIQUE (PHASE 6.2 HARDENING)
// ==============================================================================
// Protège les endpoints critiques (IA, webhooks, emails, auth) contre les abus.
//
// Caractéristiques :
//   - Persistant & partagé entre toutes les instances de l'application
//   - Atomique via la fonction PostgreSQL `consume_rate_limit` (protégé contre race conditions)
//   - Nettoyage automatique des clés expirées (TTL)
//   - Repli transparent en mémoire si la base de données est indisponible

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

export interface RateLimitOptions {
  maxRequests: number; // Nombre maximum de requêtes autorisées
  windowMs: number;    // Fenêtre temporelle en ms (ex: 60_000 pour 1 min)
  keyPrefix?: string;  // Préfixe pour distinguer les routes (ex: 'assistant', 'email', 'webhook')
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetMs: number;
  totalLimit: number;
}

// ─── Cache de repli en mémoire ────────────────────────────────────────────────
interface MemoryRecord {
  count: number;
  resetAt: number;
}
const inMemoryStore = new Map<string, MemoryRecord>();

// Nettoyage périodique toutes les 5 minutes
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    for (const [key, record] of inMemoryStore.entries()) {
      if (record.resetAt <= now) {
        inMemoryStore.delete(key);
      }
    }
  }, 5 * 60 * 1000);
}

function checkRateLimitInMemory(
  key: string,
  maxRequests: number,
  windowMs: number
): RateLimitResult {
  const now = Date.now();
  const record = inMemoryStore.get(key);

  if (!record || record.resetAt <= now) {
    inMemoryStore.set(key, { count: 1, resetAt: now + windowMs });
    return {
      allowed: true,
      remaining: maxRequests - 1,
      resetMs: windowMs,
      totalLimit: maxRequests,
    };
  }

  if (record.count >= maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      resetMs: Math.max(0, record.resetAt - now),
      totalLimit: maxRequests,
    };
  }

  record.count += 1;
  return {
    allowed: true,
    remaining: maxRequests - record.count,
    resetMs: Math.max(0, record.resetAt - now),
    totalLimit: maxRequests,
  };
}

// ─── Vérification persistante & atomique ──────────────────────────────────────

/**
 * Vérifie et incrémente le compteur de requêtes de manière persistante et atomique.
 */
export async function checkRateLimit(
  identifier: string,
  options: RateLimitOptions
): Promise<RateLimitResult> {
  const { maxRequests, windowMs, keyPrefix = 'global' } = options;
  const key = `${keyPrefix}:${identifier}`;

  try {
    // Appel à la fonction atomique PostgreSQL via supabaseAdmin
    const { data, error } = await supabaseAdmin.rpc('consume_rate_limit', {
      p_key: key,
      p_max_requests: maxRequests,
      p_window_ms: windowMs,
    });

    if (!error && data) {
      return {
        allowed: Boolean(data.allowed),
        remaining: Number(data.remaining),
        resetMs: Number(data.resetMs),
        totalLimit: maxRequests,
      };
    }
  } catch {
    // Bascule silencieuse vers le repli mémoire
  }

  return checkRateLimitInMemory(key, maxRequests, windowMs);
}

/**
 * Version synchrone pour les tests locaux et contextes sans await.
 */
export function checkRateLimitSync(
  identifier: string,
  options: RateLimitOptions
): RateLimitResult {
  const { maxRequests, windowMs, keyPrefix = 'global' } = options;
  return checkRateLimitInMemory(`${keyPrefix}:${identifier}`, maxRequests, windowMs);
}

/**
 * Helper NextRequest : applique le rate limiting et retourne une réponse 429 si dépassé.
 */
export async function enforceRateLimit(
  req: NextRequest,
  options: RateLimitOptions,
  customIdentifier?: string
): Promise<NextResponse | null> {
  const ip =
    customIdentifier ||
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    req.headers.get('x-real-ip') ||
    'anonymous_client';

  const result = await checkRateLimit(ip, options);

  if (!result.allowed) {
    const retryAfterSec = Math.ceil(result.resetMs / 1000);
    return NextResponse.json(
      {
        error: `Trop de requêtes. Veuillez patienter ${retryAfterSec} seconde(s) avant de réessayer.`,
        retryAfter: retryAfterSec,
      },
      {
        status: 429,
        headers: {
          'Retry-After': String(retryAfterSec),
          'X-RateLimit-Limit': String(result.totalLimit),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': String(Math.ceil((Date.now() + result.resetMs) / 1000)),
        },
      }
    );
  }

  return null;
}
