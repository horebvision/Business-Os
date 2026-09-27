'use client';

import React from 'react';
import { WeeklyBriefing } from '@/lib/assistant/priorityEngine';
import { formatMoney } from '@/lib/finance/money';
import {
  X,
  Calendar,
  DollarSign,
  TrendingUp,
  Users,
  FileCheck,
  Clock,
  CheckCircle2,
  AlertCircle,
  Sparkles,
} from 'lucide-react';

interface WeeklyBriefingModalProps {
  briefing: WeeklyBriefing | null;
  currency?: string;
  isOpen: boolean;
  onClose: () => void;
}

export default function WeeklyBriefingModal({
  briefing,
  currency = 'FCFA',
  isOpen,
  onClose,
}: WeeklyBriefingModalProps) {
  if (!isOpen || !briefing) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in">
      <div className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-6 bg-gradient-to-r from-indigo-900/30 via-slate-900 to-purple-900/30 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center font-bold">
              <Sparkles className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-black text-slate-900 dark:text-white">
                  Résumé de la Semaine
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                  BusinessOS AI
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Synthèse hebdomadaire consolidée de vos performances et priorités
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 overflow-y-auto">
          {/* Key Financial & Pipeline Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60">
              <span className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 block mb-1">
                Chiffre d&apos;affaires
              </span>
              <span className="text-base font-black text-slate-900 dark:text-white">
                {formatMoney(briefing.totalRevenue, currency)}
              </span>
            </div>

            <div className="p-3.5 rounded-2xl bg-emerald-500/5 dark:bg-emerald-950/20 border border-emerald-500/20">
              <span className="text-[10px] uppercase font-bold text-emerald-600 dark:text-emerald-400 block mb-1">
                Encaissements
              </span>
              <span className="text-base font-black text-emerald-600 dark:text-emerald-400">
                {formatMoney(briefing.totalCollected, currency)}
              </span>
            </div>

            <div className="p-3.5 rounded-2xl bg-rose-500/5 dark:bg-rose-950/20 border border-rose-500/20">
              <span className="text-[10px] uppercase font-bold text-rose-600 dark:text-rose-400 block mb-1">
                Factures impayées
              </span>
              <span className="text-base font-black text-rose-600 dark:text-rose-400">
                {formatMoney(briefing.unpaidAmount, currency)}
              </span>
            </div>

            <div className="p-3.5 rounded-2xl bg-indigo-500/5 dark:bg-indigo-950/20 border border-indigo-500/20">
              <span className="text-[10px] uppercase font-bold text-indigo-600 dark:text-indigo-400 block mb-1">
                Tâches terminées
              </span>
              <span className="text-base font-black text-indigo-600 dark:text-indigo-400">
                {briefing.completedTasksCount}
              </span>
            </div>
          </div>

          {/* CRM & Commercial Row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Nouveaux clients</span>
              <span className="text-lg font-black text-slate-900 dark:text-white mt-0.5 block">
                {briefing.newCustomersCount}
              </span>
            </div>

            <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Nouveaux prospects</span>
              <span className="text-lg font-black text-slate-900 dark:text-white mt-0.5 block">
                {briefing.newLeadsCount}
              </span>
            </div>

            <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Devis envoyés</span>
              <span className="text-lg font-black text-slate-900 dark:text-white mt-0.5 block">
                {briefing.quotesSentCount}
              </span>
            </div>

            <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800">
              <span className="text-[10px] uppercase font-bold text-emerald-500 block">Devis acceptés</span>
              <span className="text-lg font-black text-emerald-500 mt-0.5 block">
                {briefing.quotesAcceptedCount}
              </span>
            </div>
          </div>

          {/* Attention Items Section (Section 17) */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-500" />
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white">
                Ce qui mérite votre attention
              </h4>
            </div>

            <div className="space-y-2">
              {briefing.attentionItems.map((item, idx) => (
                <div
                  key={idx}
                  className="p-3.5 rounded-2xl bg-amber-500/5 dark:bg-amber-950/20 border border-amber-500/20 flex items-start gap-3"
                >
                  <span className="w-2 h-2 rounded-full bg-amber-500 mt-1.5 flex-shrink-0" />
                  <p className="text-xs text-slate-700 dark:text-slate-300 font-medium leading-relaxed">
                    {item}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100 text-xs font-bold transition-all shadow-sm"
          >
            Fermer le briefing
          </button>
        </div>
      </div>
    </div>
  );
}
