// ==============================================================================
// BUSINESSOS — CENTRAL AUDIT LOGGER (PHASE 5 & PHASE 6.2 HARDENING)
// ==============================================================================
// Journalise les actions sensibles et garantit la non-divulgation des secrets
// (mots de passe, tokens, clés d'API, autorisations).

import { createClient } from '@/lib/supabase/server';

export interface AuditEventParams {
  companyId: string;
  userId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  oldValues?: Record<string, any> | null;
  newValues?: Record<string, any> | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}

const SENSITIVE_PATTERNS = [
  'password',
  'secret',
  'token',
  'api_key',
  'apikey',
  'authorization',
  'auth',
  'key',
  'bearer',
  'access_token',
  'service_role',
  'service_role_key',
  'resend_api_key',
  'stripe_secret',
  'whatsapp_access_token',
  'credential',
];

/**
 * Nettoie récursivement un objet ou tableau pour masquer strictement tout mot de passe,
 * clé secrète, token ou autorisation.
 */
export function sanitizePayload(data?: any): any {
  if (data === null || data === undefined) return null;

  if (typeof data !== 'object') {
    return data;
  }

  if (Array.isArray(data)) {
    return data.map((item) => sanitizePayload(item));
  }

  const sanitized: Record<string, any> = {};

  for (const [key, value] of Object.entries(data)) {
    const keyLower = key.toLowerCase();
    const isSensitive = SENSITIVE_PATTERNS.some((pattern) => keyLower.includes(pattern));

    if (isSensitive) {
      sanitized[key] = '***REDACTED***';
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizePayload(value);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

/**
 * Enregistre un événement sensible dans le journal d'audit de l'entreprise.
 */
export async function logAuditEvent(params: AuditEventParams, supabaseClient?: any) {
  try {
    const supabase = supabaseClient || (await createClient());

    const payload = {
      company_id: params.companyId,
      user_id: params.userId || null,
      action: params.action,
      entity_type: params.entityType,
      entity_id: params.entityId || null,
      old_values: sanitizePayload(params.oldValues),
      new_values: sanitizePayload(params.newValues),
      ip_address: params.ipAddress || null,
      user_agent: params.userAgent || null,
      created_at: new Date().toISOString(),
    };

    const { error } = await supabase.from('audit_logs').insert(payload);

    if (error) {
      console.warn('[AuditLogger] Fallback log:', params.action, params.entityType, params.entityId);
    }
  } catch (err: any) {
    console.error('[AuditLogger] Erreur enregistrement audit :', err.message);
  }
}
