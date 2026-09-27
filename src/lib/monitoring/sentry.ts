// ==============================================================================
// BUSINESSOS — MONITORING & GESTION DES ERREURS (PHASE 6.2 HARDENING)
// ==============================================================================
// Intégration monitoring avec repli élégant si SENTRY_DSN est absent.
// RÈGLE ABSOLUE DE SÉCURITÉ :
//   - Aucun mot de passe, token, clé secrète ou donnée financière sensible
//     ne doit être transmis à la plateforme de monitoring.
//   - En l'absence de DSN, l'application fonctionne parfaitement sans crash.

import { sanitizePayload } from '@/lib/audit/auditLogger';

export interface ErrorReportContext {
  route?: string;
  userId?: string;
  companyId?: string;
  extra?: Record<string, any>;
}

/**
 * Capture et journalise une exception de manière sécurisée.
 */
export function captureException(error: Error | any, context?: ErrorReportContext) {
  const dsn = process.env.SENTRY_DSN;
  const env = process.env.NODE_ENV ?? 'development';
  const version = process.env.npm_package_version ?? '6.2.0';

  const cleanContext = {
    route: context?.route,
    userId: context?.userId,
    companyId: context?.companyId,
    extra: sanitizePayload(context?.extra),
  };

  const errorMessage = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error ? error.stack : undefined;

  // 1. Journalisation locale structurée (toujours active)
  if (env !== 'test') {
    console.error(`[BusinessOS Error] [${cleanContext.route || 'Unknown'}]`, {
      message: errorMessage,
      context: cleanContext,
      timestamp: new Date().toISOString(),
      version,
    });
  }

  // 2. Si SENTRY_DSN est configuré, transmission sécurisée via API Sentry
  if (dsn && dsn.startsWith('https://')) {
    try {
      // Transmission asynchrone non-bloquante via Sentry Envelope/Store API
      sendToSentry(dsn, {
        message: errorMessage,
        stack,
        level: 'error',
        environment: env,
        release: version,
        tags: {
          route: cleanContext.route,
          companyId: cleanContext.companyId,
        },
        extra: cleanContext.extra,
      }).catch(() => {
        // En cas d'échec réseau vers Sentry, ne pas interrompre le service
      });
    } catch {
      // Tolérance totale aux pannes du collecteur externe
    }
  }
}

/**
 * Envoie un rapport d'événement vers le endpoint Sentry Store HTTP.
 */
async function sendToSentry(dsn: string, payload: any) {
  try {
    const url = new URL(dsn);
    const key = url.username;
    const projectId = url.pathname.replace('/', '');
    const endpoint = `${url.protocol}//${url.host}/api/${projectId}/store/`;

    const body = JSON.stringify({
      event_id: Math.random().toString(36).substring(2) + Date.now().toString(36),
      timestamp: new Date().toISOString(),
      platform: 'javascript',
      logger: 'businessos-logger',
      ...payload,
    });

    await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Sentry-Auth': `Sentry sentry_version=7, sentry_key=${key}, sentry_client=businessos/6.2.0`,
      },
      body,
    });
  } catch {
    // Échec silencieux
  }
}
