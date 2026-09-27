'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { formatMoney } from '@/lib/finance/money';
import {
  ShieldAlert,
  Building2,
  Users,
  CreditCard,
  Clock,
  TrendingUp,
  Server,
  Activity,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Calendar,
} from 'lucide-react';
import Link from 'next/link';

export default function PlatformAdminPage() {
  const { session, currentRole } = useAuth();

  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(true);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!session?.access_token) return;

    const fetchAdminMetrics = async () => {
      setLoading(true);
      try {
        const res = await fetch('/api/admin/metrics', {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });

        if (res.status === 403) {
          setAuthorized(false);
          setLoading(false);
          return;
        }

        const json = await res.json();
        if (!res.ok || json.error) {
          setError(json.error || 'Erreur lors du chargement des données plateforme.');
        } else {
          setData(json);
        }
      } catch (err: any) {
        setError(err.message || 'Erreur réseau.');
      } finally {
        setLoading(false);
      }
    };

    fetchAdminMetrics();
  }, [session?.access_token]);

  if (loading) {
    return (
      <div className="p-16 text-center text-slate-400">
        <Loader2 className="w-8 h-8 animate-spin mx-auto text-indigo-500 mb-3" />
        <p className="text-xs font-semibold">Chargement de la console d&apos;administration BusinessOS...</p>
      </div>
    );
  }

  if (!authorized) {
    return (
      <div className="p-8 max-w-lg mx-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl text-center space-y-4 shadow-sm">
        <div className="w-12 h-12 rounded-2xl bg-rose-500/10 text-rose-600 flex items-center justify-center mx-auto">
          <ShieldAlert className="w-6 h-6" />
        </div>
        <h2 className="text-lg font-black text-slate-900 dark:text-white">Accès Réservé</h2>
        <p className="text-xs text-slate-500 leading-relaxed">
          Cette interface est strictement réservée aux administrateurs globaux de la plateforme BusinessOS. Vous n&apos;avez pas les privilèges requis pour consulter les métriques SaaS.
        </p>
        <div className="pt-2">
          <Link
            href="/dashboard"
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl shadow transition-all"
          >
            Retour au Dashboard
          </Link>
        </div>
      </div>
    );
  }

  const metrics = data?.metrics || {};
  const recentCompanies = data?.recentCompanies || [];
  const recentAudits = data?.recentAudits || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
              Console Plateforme SaaS
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-500/10 text-purple-600 border border-purple-500/20">
              Super Admin
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Supervision globale multi-tenants, abonnements réels, MRR et santé opérationnelle de BusinessOS.
          </p>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-600 text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Top 5 KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-bold text-slate-400">Entreprises</span>
            <Building2 className="w-4 h-4 text-indigo-500" />
          </div>
          <p className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white mt-2">
            {metrics.totalCompanies || 0}
          </p>
          <span className="text-[10px] text-slate-400 block mt-1">Tenants inscrits</span>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-bold text-slate-400">Utilisateurs</span>
            <Users className="w-4 h-4 text-blue-500" />
          </div>
          <p className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white mt-2">
            {metrics.totalUsers || 0}
          </p>
          <span className="text-[10px] text-slate-400 block mt-1">Comptes authentifiés</span>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-bold text-emerald-500">Abonnements Actifs</span>
            <CreditCard className="w-4 h-4 text-emerald-500" />
          </div>
          <p className="text-xl sm:text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-2">
            {metrics.activeSubscriptions || 0}
          </p>
          <span className="text-[10px] text-slate-400 block mt-1">Clients payants</span>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-bold text-amber-500">Essais en cours</span>
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
          <p className="text-xl sm:text-2xl font-black text-amber-600 dark:text-amber-400 mt-2">
            {metrics.trialingSubscriptions || 0}
          </p>
          <span className="text-[10px] text-slate-400 block mt-1">Période 14 jours</span>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-bold text-purple-500">MRR Estimé</span>
            <TrendingUp className="w-4 h-4 text-purple-500" />
          </div>
          <p className="text-xl sm:text-2xl font-black text-purple-600 dark:text-purple-400 mt-2">
            {formatMoney(metrics.estimatedMrr || 0, metrics.currency || 'XOF')}
          </p>
          <span className="text-[10px] text-slate-400 block mt-1">Revenu Mensuel Récurrent</span>
        </div>
      </div>

      {/* Grid: Recent Tenants & System Health */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Companies (2 cols) */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-sm">
          <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <h2 className="text-xs font-black uppercase tracking-wider text-slate-500">
              Dernières Entreprises Inscrites
            </h2>
          </div>

          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {recentCompanies.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400">Aucune entreprise trouvée.</div>
            ) : (
              recentCompanies.map((c: any) => (
                <div key={c.id} className="p-4 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-indigo-500/10 text-indigo-600 font-bold flex items-center justify-center text-xs">
                      {c.name ? c.name[0] : 'C'}
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-900 dark:text-white">{c.name}</h4>
                      <p className="text-[11px] text-slate-400 font-mono">ID : {c.id.slice(0, 8)}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                      {c.plan || 'trial'}
                    </span>
                    <span className="text-[11px] text-slate-400 hidden sm:inline">
                      {new Date(c.created_at).toLocaleDateString('fr-FR')}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Platform Status & Infrastructure */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-5">
          <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
            <Server className="w-4 h-4 text-emerald-500" />
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-500">
              Santé Système & Services
            </h3>
          </div>

          <div className="space-y-3 text-xs">
            <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60">
              <span className="text-slate-600 dark:text-slate-400 font-medium">PostgreSQL / Supabase</span>
              <span className="inline-flex items-center gap-1 font-bold text-emerald-600">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Opérationnel</span>
              </span>
            </div>

            <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60">
              <span className="text-slate-600 dark:text-slate-400 font-medium">Multi-tenant RLS</span>
              <span className="inline-flex items-center gap-1 font-bold text-emerald-600">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Actif & Isolé</span>
              </span>
            </div>

            <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60">
              <span className="text-slate-600 dark:text-slate-400 font-medium">Service Emails (Resend)</span>
              <span className="inline-flex items-center gap-1 font-bold text-slate-500">
                <span>Architecture V1/V2</span>
              </span>
            </div>

            <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60">
              <span className="text-slate-600 dark:text-slate-400 font-medium">Passerelles Mobile Money</span>
              <span className="inline-flex items-center gap-1 font-bold text-amber-500">
                <span>Prêtes (Attente Marchand)</span>
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
