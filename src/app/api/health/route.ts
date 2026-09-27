// ==============================================================================
// BUSINESSOS — HEALTH CHECK API (PHASE 6 & PHASE 6.2 HARDENING)
// ==============================================================================
// Route : GET /api/health
// Vérifie l'état de tous les services critiques sans exposer AUCUN secret.
// Distingue clairement : configured / not_configured / healthy / unhealthy
// Utilisable par les load balancers, monitoring d'infrastructure, probes K8s.

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export interface ServiceHealth {
  configured: boolean;
  status: 'healthy' | 'unhealthy' | 'not_configured' | 'degraded';
  latencyMs?: number;
  message: string;
}

export interface HealthReport {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  version: string;
  environment: string;
  uptime: number;
  services: {
    database: ServiceHealth;
    stripe: ServiceHealth;
    resend: ServiceHealth;
    whatsapp: ServiceHealth;
    mobile_money: ServiceHealth & {
      providers: {
        wave: ServiceHealth;
        orange_money: ServiceHealth;
        mtn_momo: ServiceHealth;
      };
    };
  };
}

const processStartTime = Date.now();

export async function GET(_request: NextRequest) {
  const dbHealth = await checkDatabase();
  const stripeHealth = checkStripe();
  const resendHealth = checkResend();
  const whatsappHealth = checkWhatsApp();
  const waveHealth = checkWave();
  const orangeHealth = checkOrangeMoney();
  const mtnHealth = checkMtnMomo();

  const mmConfigured = waveHealth.configured || orangeHealth.configured || mtnHealth.configured;
  const mobileMoneyHealth: ServiceHealth & { providers: any } = {
    configured: mmConfigured,
    status: mmConfigured ? 'healthy' : 'not_configured',
    message: mmConfigured
      ? 'Au moins un opérateur Mobile Money configuré'
      : 'Aucun opérateur Mobile Money configuré (mode sandbox / requis en production)',
    providers: {
      wave: waveHealth,
      orange_money: orangeHealth,
      mtn_momo: mtnHealth,
    },
  };

  const services = {
    database: dbHealth,
    stripe: stripeHealth,
    resend: resendHealth,
    whatsapp: whatsappHealth,
    mobile_money: mobileMoneyHealth,
  };

  // Statut global :
  // unhealthy si la base de données est down
  // degraded si un service configuré est dégradé/down
  // healthy si les services critiques fonctionnent
  let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
  if (dbHealth.status === 'unhealthy') {
    overallStatus = 'unhealthy';
  } else if ([stripeHealth, resendHealth, whatsappHealth].some(s => s.status === 'unhealthy')) {
    overallStatus = 'degraded';
  }

  const report: HealthReport = {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version ?? '6.2.0',
    environment: process.env.NODE_ENV ?? 'development',
    uptime: Math.floor((Date.now() - processStartTime) / 1000),
    services,
  };

  const httpStatus = overallStatus === 'unhealthy' ? 503 : 200;

  return NextResponse.json(report, {
    status: httpStatus,
    headers: {
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    },
  });
}

// ─── Sondes des services ──────────────────────────────────────────────────────

async function checkDatabase(): Promise<ServiceHealth> {
  const t0 = Date.now();
  try {
    const supabase = await createClient();
    const { error } = await supabase
      .from('companies')
      .select('id')
      .limit(1)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') {
      return {
        configured: true,
        status: 'unhealthy',
        latencyMs: Date.now() - t0,
        message: 'Erreur communication base de données',
      };
    }

    return {
      configured: true,
      status: 'healthy',
      latencyMs: Date.now() - t0,
      message: 'Base de données PostgreSQL opérationnelle',
    };
  } catch (err: any) {
    return {
      configured: true,
      status: 'unhealthy',
      latencyMs: Date.now() - t0,
      message: 'Indisponibilité connexion Supabase',
    };
  }
}

function checkStripe(): ServiceHealth {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    return {
      configured: false,
      status: 'not_configured',
      message: 'STRIPE_SECRET_KEY non configurée',
    };
  }
  const mode = key.startsWith('sk_live_') ? 'live' : 'test';
  return {
    configured: true,
    status: 'healthy',
    message: `Stripe configuré en mode ${mode}`,
  };
}

function checkResend(): ServiceHealth {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    return {
      configured: false,
      status: 'not_configured',
      message: 'RESEND_API_KEY non configurée (envois emails simulés localement)',
    };
  }
  return {
    configured: true,
    status: 'healthy',
    message: 'Resend API configuré pour envoi transactionnel',
  };
}

function checkWhatsApp(): ServiceHealth {
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  if (!phoneId || !token) {
    return {
      configured: false,
      status: 'not_configured',
      message: 'WhatsApp Cloud API non configuré (repli direct wa.me actif)',
    };
  }
  return {
    configured: true,
    status: 'healthy',
    message: 'WhatsApp Business Cloud API configuré',
  };
}

function checkWave(): ServiceHealth {
  const key = process.env.WAVE_API_KEY;
  if (!key) {
    return {
      configured: false,
      status: 'not_configured',
      message: 'WAVE_API_KEY non configurée',
    };
  }
  return {
    configured: true,
    status: 'healthy',
    message: 'Wave Checkout API configuré',
  };
}

function checkOrangeMoney(): ServiceHealth {
  const key = process.env.ORANGE_MONEY_MERCHANT_KEY;
  if (!key) {
    return {
      configured: false,
      status: 'not_configured',
      message: 'ORANGE_MONEY_MERCHANT_KEY non configurée',
    };
  }
  return {
    configured: true,
    status: 'healthy',
    message: 'Orange Money Web Payment API configuré',
  };
}

function checkMtnMomo(): ServiceHealth {
  const key = process.env.MTN_MOMO_SUBSCRIPTION_KEY;
  if (!key) {
    return {
      configured: false,
      status: 'not_configured',
      message: 'MTN_MOMO_SUBSCRIPTION_KEY non configurée',
    };
  }
  return {
    configured: true,
    status: 'healthy',
    message: 'MTN Mobile Money Collections API configuré',
  };
}
