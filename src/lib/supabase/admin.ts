// ==============================================================================
// BUSINESSOS — CLIENT SUPABASE ADMIN (PHASE 6.2 HARDENING)
// ==============================================================================
// Client serveur avec privilèges élevés (service_role).
// RÈGLE ABSOLUE :
//   - NE JAMAIS retourner ce client ou sa clé côté navigateur
//   - NE JAMAIS utiliser la clé ANON en repli
//   - Si la clé service_role est absente, lever une erreur claire

import { createClient, SupabaseClient } from '@supabase/supabase-js';

let cachedAdminClient: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error('SERVICE_ROLE_KEY_MISSING: SUPABASE_SERVICE_ROLE_KEY non configurée.');
  }

  if (!cachedAdminClient) {
    cachedAdminClient = createClient(url, key, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }

  return cachedAdminClient;
}

/**
 * Proxy admin sûr préservant la compatibilité avec l'export existant.
 */
export const supabaseAdmin: any = new Proxy(
  {},
  {
    get(_target, prop) {
      const client = getSupabaseAdmin();
      return (client as any)[prop];
    },
  }
);
