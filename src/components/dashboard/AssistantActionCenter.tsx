'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { ActionCenterItem, PriorityScore } from '@/lib/types';
import { DailyBriefing, WeeklyBriefing } from '@/lib/assistant/priorityEngine';
import WeeklyBriefingModal from '@/components/dashboard/WeeklyBriefingModal';
import {
  Sparkles,
  AlertTriangle,
  Clock,
  ArrowRight,
  CheckCircle2,
  Calendar,
  Send,
  Users,
  FileSpreadsheet,
  Receipt,
  CheckSquare,
  Bot,
  Zap,
} from 'lucide-react';

interface AssistantActionCenterProps {
  items: ActionCenterItem[];
  briefing: DailyBriefing;
  weeklyBriefing?: WeeklyBriefing;
  currency?: string;
  loading: boolean;
}

export default function AssistantActionCenter({
  items,
  briefing,
  weeklyBriefing,
  currency = 'FCFA',
  loading,
}: AssistantActionCenterProps) {
  const [filterPriority, setFilterPriority] = useState<string>('all');
  const [showWeeklyModal, setShowWeeklyModal] = useState(false);

  const filteredItems = items.filter((it) => {
    if (filterPriority === 'all') return true;
    return it.priority === filterPriority;
  });

  const getPriorityBadge = (p: PriorityScore) => {
    switch (p) {
      case 'Urgent':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
            <span>Urgent</span>
          </span>
        );
      case 'Important':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            <span>Important</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
            <span>À surveiller</span>
          </span>
        );
    }
  };

  const getIconForEntity = (type: string) => {
    switch (type) {
      case 'invoice':
        return <Receipt className="w-4 h-4 text-rose-500" />;
      case 'lead':
        return <Users className="w-4 h-4 text-amber-500" />;
      case 'quote':
        return <FileSpreadsheet className="w-4 h-4 text-blue-500" />;
      case 'task':
        return <CheckSquare className="w-4 h-4 text-emerald-500" />;
      default:
        return <Zap className="w-4 h-4 text-indigo-500" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Briefing du Jour Card (Section 16 & 38) */}
      <div className="p-6 rounded-3xl bg-gradient-to-br from-indigo-900/40 via-slate-900 to-purple-950/40 border border-indigo-500/30 shadow-xl relative overflow-hidden">
        <div className="relative z-10 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-indigo-500/20 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center font-bold">
                <Bot className="w-5 h-5 text-indigo-300" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-extrabold text-white tracking-tight">
                    Votre Briefing Quotidien
                  </h3>
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                    BusinessOS AI
                  </span>
                </div>
                <p className="text-xs text-indigo-200/70 capitalize mt-0.5">
                  {briefing.date}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
              <button
                type="button"
                onClick={() => setShowWeeklyModal(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-indigo-200 hover:text-white text-xs font-semibold border border-indigo-500/30 transition-all shadow-sm"
              >
                <Calendar className="w-3.5 h-3.5 text-indigo-400" />
                <span>Résumé de la semaine</span>
              </button>

              <Link
                href="/ai"
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-indigo-600/80 hover:bg-indigo-600 text-white text-xs font-semibold border border-indigo-400/30 transition-all shadow-sm"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Assistant IA</span>
              </Link>
            </div>
          </div>

          {/* 4 Daily Key Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
            <div className="p-3.5 rounded-2xl bg-slate-900/60 border border-indigo-500/20">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Tâches du jour</span>
              <span className="text-xl font-black text-white">{briefing.tasksCount}</span>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-900/60 border border-indigo-500/20">
              <span className="text-[10px] uppercase font-bold text-rose-300 block">Factures à relancer</span>
              <span className="text-xl font-black text-rose-400">{briefing.invoicesToRemindCount}</span>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-900/60 border border-indigo-500/20">
              <span className="text-[10px] uppercase font-bold text-amber-300 block">Prospects à relancer</span>
              <span className="text-xl font-black text-amber-400">{briefing.leadsToContactCount}</span>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-900/60 border border-indigo-500/20">
              <span className="text-[10px] uppercase font-bold text-blue-300 block">Devis à échéance</span>
              <span className="text-xl font-black text-blue-400">{briefing.quotesExpiringCount}</span>
            </div>
          </div>

          {/* Top Priority Highlight (Section 16) */}
          <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-start sm:items-center gap-2.5">
              <AlertTriangle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5 sm:mt-0" />
              <div>
                <span className="font-extrabold text-rose-300 block">PRIORITÉ DU JOUR :</span>
                <span className="text-white font-medium">{briefing.topPriorityMessage}</span>
              </div>
            </div>

            {briefing.topPriorityAction && (
              <Link
                href={briefing.topPriorityAction.link}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl shadow-md transition-all whitespace-nowrap self-start sm:self-auto"
              >
                <span>{briefing.topPriorityAction.label}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Action Center ("À FAIRE") Section (Section 9 & 10) */}
      <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400">
              <AlertTriangle className="w-4 h-4" />
            </span>
            <div>
              <h2 className="text-base font-extrabold text-slate-900 dark:text-white tracking-tight">
                Centre d&apos;Actions — À FAIRE
              </h2>
              <p className="text-xs text-slate-400">
                Actions détectées automatiquement par BusinessOS avec score d&apos;urgence.
              </p>
            </div>
          </div>

          {/* Priority filter pills */}
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-xs font-semibold self-start sm:self-auto">
            <button
              onClick={() => setFilterPriority('all')}
              className={`px-3 py-1 rounded-lg transition-all ${
                filterPriority === 'all'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Tout ({items.length})
            </button>
            <button
              onClick={() => setFilterPriority('Urgent')}
              className={`px-3 py-1 rounded-lg transition-all text-rose-600 ${
                filterPriority === 'Urgent'
                  ? 'bg-white dark:bg-slate-900 shadow-sm font-bold'
                  : 'text-slate-500 hover:text-rose-600'
              }`}
            >
              Urgent ({items.filter((i) => i.priority === 'Urgent').length})
            </button>
            <button
              onClick={() => setFilterPriority('Important')}
              className={`px-3 py-1 rounded-lg transition-all text-amber-600 ${
                filterPriority === 'Important'
                  ? 'bg-white dark:bg-slate-900 shadow-sm font-bold'
                  : 'text-slate-500 hover:text-amber-600'
              }`}
            >
              Important ({items.filter((i) => i.priority === 'Important').length})
            </button>
          </div>
        </div>

        {/* List of Action Items */}
        {loading ? (
          <div className="p-8 text-center text-xs text-slate-400">
            Analyse des actions requises en cours...
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="p-8 text-center bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-100 dark:border-slate-800">
            <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
            <h4 className="text-xs font-bold text-slate-900 dark:text-white">Tout est à jour !</h4>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Aucune action urgente ni facture en retard ne nécessite votre attention immédiate.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredItems.map((item) => (
              <div
                key={item.id}
                className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 flex items-center justify-center flex-shrink-0 mt-0.5">
                    {getIconForEntity(item.entityType)}
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-xs text-slate-900 dark:text-white">
                        {item.title}
                      </span>
                      {getPriorityBadge(item.priority)}
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      {item.subtitle}
                    </p>
                  </div>
                </div>

                <Link
                  href={item.actionUrl}
                  className="inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 bg-white dark:bg-slate-900 hover:bg-indigo-600 hover:text-white text-indigo-600 dark:text-indigo-400 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold shadow-sm transition-all whitespace-nowrap self-end sm:self-auto"
                >
                  <span>{item.actionLabel}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal Résumé de la semaine (Section 17) */}
      <WeeklyBriefingModal
        briefing={weeklyBriefing || null}
        currency={currency}
        isOpen={showWeeklyModal}
        onClose={() => setShowWeeklyModal(false)}
      />
    </div>
  );
}
