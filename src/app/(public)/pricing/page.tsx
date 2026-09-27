'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { DEFAULT_PLANS } from '@/lib/billing/plans';
import { formatMoney } from '@/lib/finance/money';
import {
  Check,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  HelpCircle,
  Zap,
  Building2,
  Users,
  MessageSquare,
  Bot,
  Lock,
} from 'lucide-react';

export default function PricingPage() {
  const [interval, setInterval] = useState<'monthly' | 'yearly'>('monthly');

  const plans = Object.values(DEFAULT_PLANS);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 py-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-16">
        {/* Header */}
        <div className="text-center space-y-4 max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-600 dark:text-indigo-400 text-xs font-bold uppercase tracking-wider">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Tarifs transparents & sans engagement</span>
          </div>

          <h1 className="text-4xl sm:text-5xl font-black tracking-tight text-slate-900 dark:text-white">
            Un investissement rentable dès votre premier client
          </h1>

          <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 leading-relaxed">
            Choisissez la formule taillée pour la croissance de votre PME. Tous nos forfaits incluent 14 jours d&apos;essai gratuit sans carte bancaire requise.
          </p>

          {/* Toggle Monthly / Yearly */}
          <div className="pt-4 flex items-center justify-center gap-3">
            <span className={`text-xs font-bold ${interval === 'monthly' ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400'}`}>
              Mensuel
            </span>
            <button
              onClick={() => setInterval(interval === 'monthly' ? 'yearly' : 'monthly')}
              className="w-14 h-7 rounded-full bg-indigo-600 p-1 flex items-center transition-all shadow-inner"
            >
              <div
                className={`w-5 h-5 rounded-full bg-white transition-transform shadow-md ${
                  interval === 'yearly' ? 'translate-x-7' : 'translate-x-0'
                }`}
              />
            </button>
            <div className="flex items-center gap-1.5">
              <span className={`text-xs font-bold ${interval === 'yearly' ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400'}`}>
                Annuel
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                -2 mois offerts
              </span>
            </div>
          </div>
        </div>

        {/* Pricing Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {plans.map((p) => {
            const isPopular = p.slug === 'business';
            const price = interval === 'yearly' ? p.price_yearly : p.price_monthly;

            return (
              <div
                key={p.slug}
                className={`relative rounded-3xl p-8 flex flex-col justify-between transition-all duration-300 ${
                  isPopular
                    ? 'bg-gradient-to-b from-indigo-900/10 via-white to-white dark:from-indigo-950/40 dark:via-slate-900 dark:to-slate-900 border-2 border-indigo-600 shadow-xl shadow-indigo-600/10 scale-105'
                    : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm hover:border-slate-300'
                }`}
              >
                {isPopular && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-indigo-600 text-white text-[10px] font-black uppercase tracking-wider shadow-md">
                    Formule la plus choisie
                  </div>
                )}

                <div className="space-y-6">
                  <div>
                    <h3 className="text-xl font-black text-slate-900 dark:text-white">
                      {p.name}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">
                      {p.description}
                    </p>
                  </div>

                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white">
                      {formatMoney(price, 'FCFA')}
                    </span>
                    <span className="text-xs text-slate-400 font-medium">
                      / {interval === 'yearly' ? 'an' : 'mois'}
                    </span>
                  </div>

                  <div className="space-y-3 pt-4 border-t border-slate-100 dark:border-slate-800 text-xs">
                    <div className="flex items-center gap-2.5">
                      <Check className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                      <span><strong>{p.limits.max_users}</strong> utilisateur(s) inclus</span>
                    </div>
                    <div className="flex items-center gap-2.5">
                      <Check className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                      <span><strong>{p.limits.max_customers}</strong> clients & prospects</span>
                    </div>
                    <div className="flex items-center gap-2.5">
                      <Check className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                      <span><strong>{p.limits.max_invoices_per_month}</strong> factures / mois</span>
                    </div>
                    <div className="flex items-center gap-2.5">
                      <Check className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                      <span><strong>{p.limits.max_automations}</strong> automatisations actives</span>
                    </div>
                    <div className="flex items-center gap-2.5">
                      <Check className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                      <span><strong>{p.limits.ai_credits_per_month}</strong> actions Assistant IA / mois</span>
                    </div>
                    {p.features.client_portal && (
                      <div className="flex items-center gap-2.5">
                        <Check className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                        <span>Portail client (devis & factures sécurisés)</span>
                      </div>
                    )}
                    {p.features.advanced_analytics && (
                      <div className="flex items-center gap-2.5">
                        <Check className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                        <span>Analytics avancés & vision dirigeant</span>
                      </div>
                    )}
                    {p.features.priority_support && (
                      <div className="flex items-center gap-2.5">
                        <Check className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                        <span>Support VIP prioritaire 24/7</span>
                      </div>
                    )}
                  </div>
                </div>

                <Link
                  href={`/register?plan=${p.slug}`}
                  className={`mt-8 w-full py-3 px-4 rounded-xl text-xs font-bold text-center transition-all flex items-center justify-center gap-2 ${
                    isPopular
                      ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/30 hover:scale-[1.02]'
                      : 'bg-slate-900 hover:bg-slate-800 text-white dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100 shadow-sm'
                  }`}
                >
                  <span>Démarrer l&apos;essai gratuit (14 jours)</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            );
          })}
        </div>

        {/* Security & Guarantee note */}
        <div className="max-w-2xl mx-auto p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center space-y-2">
          <div className="w-8 h-8 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center mx-auto">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-900 dark:text-white">
            Garantie Sérénité & Isolation des Données
          </h4>
          <p className="text-xs text-slate-500 leading-relaxed">
            Vos données financières sont chiffrées et isolées par entreprise selon les normes les plus strictes. Vous pouvez changer de formule ou exporter l&apos;intégralité de vos données à tout moment.
          </p>
        </div>
      </div>
    </div>
  );
}
