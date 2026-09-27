'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Plan, Subscription, PlanTier, BillingInterval } from '@/lib/types';
import { formatMoney } from '@/lib/finance/money';
import {
  CreditCard,
  ShieldCheck,
  Zap,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  TrendingUp,
  Users,
  FileSpreadsheet,
  Receipt,
  Bot,
  Clock,
  Sparkles,
  Loader2,
  Check,
  X,
} from 'lucide-react';
import Link from 'next/link';

interface BillingData {
  subscription: Subscription;
  plan: Plan;
  trialDaysRemaining: number;
  usage: {
    users: { current: number; max: number; remaining: number; allowed: boolean; percentage: number };
    customers: { current: number; max: number; remaining: number; allowed: boolean; percentage: number };
    leads: { current: number; max: number; remaining: number; allowed: boolean; percentage: number };
    invoices: { current: number; max: number; remaining: number; allowed: boolean; percentage: number };
    quotes: { current: number; max: number; remaining: number; allowed: boolean; percentage: number };
    automations: { current: number; max: number; remaining: number; allowed: boolean; percentage: number };
    aiCredits: { current: number; max: number; remaining: number; allowed: boolean; percentage: number };
  };
  transactions: any[];
  allPlans: Plan[];
}

export default function BillingPage() {
  const { currentCompany } = useAuth();
  const [data, setData] = useState<BillingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [changePlanModalOpen, setChangePlanModalOpen] = useState(false);
  const [selectedInterval, setSelectedInterval] = useState<BillingInterval>('monthly');
  const [upgradingTo, setUpgradingTo] = useState<string | null>(null);
  const [actionSuccessMsg, setActionSuccessMsg] = useState<string | null>(null);
  const [actionErrorMsg, setActionErrorMsg] = useState<string | null>(null);

  const fetchBilling = async () => {
    if (!currentCompany?.id) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/billing/subscription?companyId=${currentCompany.id}`);
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (err) {
      console.error('Erreur chargement billing:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBilling();
  }, [currentCompany?.id]);

  const handleChangePlan = async (targetPlan: PlanTier) => {
    if (!currentCompany?.id) return;
    setUpgradingTo(targetPlan);
    setActionErrorMsg(null);
    setActionSuccessMsg(null);

    try {
      const res = await fetch('/api/billing/subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId: currentCompany.id,
          targetPlan,
          billingInterval: selectedInterval,
        }),
      });

      const resData = await res.json();
      if (!res.ok) {
        throw new Error(resData.error || 'Erreur lors du changement de plan.');
      }

      setActionSuccessMsg(resData.message);
      setChangePlanModalOpen(false);
      await fetchBilling();
    } catch (err: any) {
      setActionErrorMsg(err.message || 'Impossible de mettre à jour le forfait.');
    } finally {
      setUpgradingTo(null);
    }
  };

  const currency = currentCompany?.currency || 'FCFA';

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  const sub = data?.subscription;
  const currentPlan = data?.plan;
  const isTrial = sub?.status === 'trialing';
  const trialDays = data?.trialDaysRemaining || 0;

  return (
    <div className="space-y-8 max-w-5xl">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs text-slate-400 font-medium">Facturation & Forfaits</span>
            <span className="text-slate-300 dark:text-slate-700">/</span>
            <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400">Abonnement</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Abonnement & Utilisation
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Gérez le forfait de votre entreprise, surveillez vos quotas et accédez à vos factures.
          </p>
        </div>

        <button
          onClick={() => setChangePlanModalOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-600/20 transition-all self-start sm:self-auto hover:scale-[1.02]"
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>Changer de forfait</span>
        </button>
      </div>

      {/* Feedback Messages */}
      {actionSuccessMsg && (
        <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
          <span>{actionSuccessMsg}</span>
        </div>
      )}

      {actionErrorMsg && (
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 flex-shrink-0" />
          <span>{actionErrorMsg}</span>
        </div>
      )}

      {/* Trial Banner (Section 6) */}
      {isTrial && (
        <div className="p-6 rounded-3xl bg-gradient-to-r from-amber-500/15 via-orange-500/10 to-amber-500/5 border border-amber-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold flex-shrink-0 mt-0.5">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-extrabold text-slate-900 dark:text-white">
                  Période d&apos;essai gratuite
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-amber-500/20 text-amber-700 dark:text-amber-300">
                  {trialDays} jour(s) restant(s)
                </span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">
                Votre période d&apos;essai se termine le{' '}
                <strong>
                  {sub?.trial_end
                    ? new Date(sub.trial_end).toLocaleDateString('fr-FR', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                      })
                    : 'prochainement'}
                </strong>
                . Vous bénéficiez de toutes les fonctionnalités du forfait {currentPlan?.name}.
              </p>
            </div>
          </div>

          <button
            onClick={() => setChangePlanModalOpen(true)}
            className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-bold shadow-md shadow-amber-600/20 transition-all whitespace-nowrap self-start sm:self-auto"
          >
            Choisir un abonnement
          </button>
        </div>
      )}

      {/* Current Plan Overview Card (Section 9) */}
      <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Forfait actif
            </span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              {isTrial ? 'Essai actif' : sub?.status === 'active' ? 'Abonnement actif' : sub?.status}
            </span>
          </div>

          <div>
            <h2 className="text-2xl font-black text-slate-900 dark:text-white">
              BusinessOS {currentPlan?.name}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-lg leading-relaxed">
              {currentPlan?.description}
            </p>
          </div>

          <div className="flex items-baseline gap-2 pt-1">
            <span className="text-3xl font-black text-slate-900 dark:text-white">
              {sub?.billing_interval === 'yearly'
                ? formatMoney(currentPlan?.price_yearly || 0, currency)
                : formatMoney(currentPlan?.price_monthly || 0, currency)}
            </span>
            <span className="text-xs text-slate-400">
              / {sub?.billing_interval === 'yearly' ? 'an' : 'mois'}
            </span>
          </div>
        </div>

        <div className="flex flex-col gap-2 flex-shrink-0 md:border-l md:border-slate-100 md:dark:border-slate-800 md:pl-6">
          <div className="text-xs text-slate-500 dark:text-slate-400 space-y-1">
            <span className="block text-[11px] uppercase font-bold text-slate-400">Période en cours</span>
            <span className="font-semibold text-slate-900 dark:text-white block">
              Du {new Date(sub?.current_period_start || Date.now()).toLocaleDateString('fr-FR')} au{' '}
              {new Date(sub?.current_period_end || Date.now()).toLocaleDateString('fr-FR')}
            </span>
          </div>

          <button
            onClick={() => setChangePlanModalOpen(true)}
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-xl text-xs font-bold transition-all mt-2"
          >
            <span>Modifier la formule</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Quotas & Usage Progress Bars (Section 8 & 9) */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-indigo-500" />
            <h3 className="text-base font-extrabold text-slate-900 dark:text-white tracking-tight">
              Utilisation & Quotas du Forfait
            </h3>
          </div>
          <span className="text-xs text-slate-400">Réinitialisation le 1er de chaque mois</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[
            {
              title: 'Clients',
              current: data?.usage.customers.current || 0,
              max: data?.usage.customers.max || 100,
              pct: data?.usage.customers.percentage || 0,
              icon: Users,
              color: 'indigo',
            },
            {
              title: 'Prospects',
              current: data?.usage.leads.current || 0,
              max: data?.usage.leads.max || 100,
              pct: data?.usage.leads.percentage || 0,
              icon: Users,
              color: 'amber',
            },
            {
              title: 'Factures (ce mois)',
              current: data?.usage.invoices.current || 0,
              max: data?.usage.invoices.max || 50,
              pct: data?.usage.invoices.percentage || 0,
              icon: Receipt,
              color: 'rose',
            },
            {
              title: 'Devis (ce mois)',
              current: data?.usage.quotes.current || 0,
              max: data?.usage.quotes.max || 50,
              pct: data?.usage.quotes.percentage || 0,
              icon: FileSpreadsheet,
              color: 'blue',
            },
            {
              title: 'Utilisateurs / Équipe',
              current: data?.usage.users.current || 1,
              max: data?.usage.users.max || 1,
              pct: data?.usage.users.percentage || 100,
              icon: Users,
              color: 'emerald',
            },
            {
              title: 'Automatisations actives',
              current: data?.usage.automations.current || 0,
              max: data?.usage.automations.max || 3,
              pct: data?.usage.automations.percentage || 0,
              icon: Zap,
              color: 'purple',
            },
            {
              title: 'Actions IA (ce mois)',
              current: data?.usage.aiCredits.current || 0,
              max: data?.usage.aiCredits.max || 50,
              pct: data?.usage.aiCredits.percentage || 0,
              icon: Bot,
              color: 'indigo',
            },
          ].map((item, idx) => (
            <div
              key={idx}
              className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  {item.title}
                </span>
                <span className="text-xs font-extrabold text-slate-900 dark:text-white">
                  {item.current} / {item.max}
                </span>
              </div>

              {/* Progress bar */}
              <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    item.pct >= 90
                      ? 'bg-rose-500'
                      : item.pct >= 70
                      ? 'bg-amber-500'
                      : 'bg-indigo-600'
                  }`}
                  style={{ width: `${Math.min(100, item.pct)}%` }}
                />
              </div>

              <div className="flex items-center justify-between text-[11px] text-slate-400">
                <span>{item.pct}% consommé</span>
                {item.pct >= 100 ? (
                  <span className="font-bold text-rose-500">Limite atteinte</span>
                ) : (
                  <span>{item.max - item.current} restant(s)</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Change Plan Modal */}
      {changePlanModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-4xl bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-black text-slate-900 dark:text-white">
                  Changer de forfait BusinessOS
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Choisissez la formule la plus adaptée à la taille et aux ambitions de votre structure.
                </p>
              </div>
              <button
                onClick={() => setChangePlanModalOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-xl"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Interval Toggle */}
            <div className="p-4 bg-slate-50 dark:bg-slate-800/40 border-b border-slate-200 dark:border-slate-800 flex items-center justify-center gap-3">
              <span className={`text-xs font-semibold ${selectedInterval === 'monthly' ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400'}`}>
                Facturation mensuelle
              </span>
              <button
                onClick={() => setSelectedInterval(selectedInterval === 'monthly' ? 'yearly' : 'monthly')}
                className="w-12 h-6 rounded-full bg-indigo-600 p-1 flex items-center transition-all"
              >
                <div
                  className={`w-4 h-4 rounded-full bg-white transition-transform ${
                    selectedInterval === 'yearly' ? 'translate-x-6' : 'translate-x-0'
                  }`}
                />
              </button>
              <div className="flex items-center gap-1.5">
                <span className={`text-xs font-semibold ${selectedInterval === 'yearly' ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400'}`}>
                  Facturation annuelle
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                  -2 mois offerts
                </span>
              </div>
            </div>

            {/* Plans Grid */}
            <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-4 overflow-y-auto">
              {data?.allPlans.map((p) => {
                const isCurrent = currentPlan?.slug === p.slug;
                const price = selectedInterval === 'yearly' ? p.price_yearly : p.price_monthly;

                return (
                  <div
                    key={p.slug}
                    className={`p-6 rounded-3xl border flex flex-col justify-between transition-all ${
                      isCurrent
                        ? 'border-indigo-600 bg-indigo-50/20 dark:bg-indigo-950/20 ring-2 ring-indigo-600'
                        : 'border-slate-200 dark:border-slate-800 hover:border-indigo-300'
                    }`}
                  >
                    <div className="space-y-4">
                      <div>
                        <div className="flex items-center justify-between">
                          <h4 className="text-base font-extrabold text-slate-900 dark:text-white">
                            {p.name}
                          </h4>
                          {isCurrent && (
                            <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-indigo-600 text-white">
                              Actuel
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
                          {p.description}
                        </p>
                      </div>

                      <div className="flex items-baseline gap-1">
                        <span className="text-2xl font-black text-slate-900 dark:text-white">
                          {formatMoney(price, currency)}
                        </span>
                        <span className="text-[11px] text-slate-400">
                          / {selectedInterval === 'yearly' ? 'an' : 'mois'}
                        </span>
                      </div>

                      <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
                        <div className="flex items-center gap-2">
                          <Check className="w-3.5 h-3.5 text-emerald-500" />
                          <span>Jusqu&apos;à <strong>{p.limits.max_users}</strong> utilisateur(s)</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Check className="w-3.5 h-3.5 text-emerald-500" />
                          <span><strong>{p.limits.max_customers}</strong> clients & prospects</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Check className="w-3.5 h-3.5 text-emerald-500" />
                          <span><strong>{p.limits.max_invoices_per_month}</strong> factures / mois</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Check className="w-3.5 h-3.5 text-emerald-500" />
                          <span><strong>{p.limits.max_automations}</strong> règles d&apos;automatisation</span>
                        </div>
                        {p.features.client_portal && (
                          <div className="flex items-center gap-2">
                            <Check className="w-3.5 h-3.5 text-emerald-500" />
                            <span>Portail client en ligne</span>
                          </div>
                        )}
                        {p.features.advanced_analytics && (
                          <div className="flex items-center gap-2">
                            <Check className="w-3.5 h-3.5 text-emerald-500" />
                            <span>Analytics dirigeants avancés</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <button
                      onClick={() => handleChangePlan(p.slug)}
                      disabled={isCurrent || upgradingTo !== null}
                      className={`w-full py-2.5 px-4 rounded-xl text-xs font-bold transition-all mt-6 ${
                        isCurrent
                          ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
                          : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/20'
                      }`}
                    >
                      {upgradingTo === p.slug ? (
                        <Loader2 className="w-4 h-4 animate-spin mx-auto" />
                      ) : isCurrent ? (
                        'Forfait actuel'
                      ) : (
                        `Choisir le forfait ${p.name}`
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
