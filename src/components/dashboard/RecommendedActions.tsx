'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowRight, AlertCircle, Clock, FileSpreadsheet, CheckSquare, Sparkles } from 'lucide-react';
import { RecommendedAction } from '@/lib/types';

interface RecommendedActionsProps {
  actions: RecommendedAction[];
  loading?: boolean;
}

export default function RecommendedActions({ actions, loading }: RecommendedActionsProps) {
  if (loading) {
    return (
      <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm animate-pulse">
        <div className="h-5 w-48 bg-slate-200 dark:bg-slate-800 rounded-lg mb-4" />
        <div className="space-y-3">
          <div className="h-14 bg-slate-100 dark:bg-slate-800/60 rounded-2xl" />
          <div className="h-14 bg-slate-100 dark:bg-slate-800/60 rounded-2xl" />
        </div>
      </div>
    );
  }

  const getBadgeAndBorder = (type: string) => {
    switch (type) {
      case 'danger':
        return {
          indicator: '🔴',
          border: 'border-rose-200 dark:border-rose-900/40 hover:border-rose-400',
          bg: 'bg-rose-50/50 dark:bg-rose-950/20',
          badgeText: 'text-rose-600 dark:text-rose-400 bg-rose-100 dark:bg-rose-900/40',
        };
      case 'warning':
        return {
          indicator: '🟠',
          border: 'border-amber-200 dark:border-amber-900/40 hover:border-amber-400',
          bg: 'bg-amber-50/50 dark:bg-amber-950/20',
          badgeText: 'text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/40',
        };
      case 'info':
        return {
          indicator: '🔵',
          border: 'border-blue-200 dark:border-blue-900/40 hover:border-blue-400',
          bg: 'bg-blue-50/50 dark:bg-blue-950/20',
          badgeText: 'text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/40',
        };
      default:
        return {
          indicator: '🟢',
          border: 'border-emerald-200 dark:border-emerald-900/40 hover:border-emerald-400',
          bg: 'bg-emerald-50/50 dark:bg-emerald-950/20',
          badgeText: 'text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/40',
        };
    }
  };

  return (
    <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-500">
            <Sparkles className="w-4 h-4" />
          </div>
          <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
            Actions Recommandées
          </h2>
        </div>
        <span className="text-xs text-slate-600 dark:text-slate-400">
          Priorités du jour
        </span>
      </div>

      {actions.length === 0 ? (
        <div className="py-8 text-center bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
          <CheckSquare className="w-8 h-8 text-emerald-500 mx-auto mb-2 opacity-80" />
          <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
            Tout est à jour ! Aucune urgence à traiter.
          </p>
          <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-1">
            Vos factures et prospects sont parfaitement sous contrôle.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {actions.map((act) => {
            const styles = getBadgeAndBorder(act.type);
            return (
              <Link
                key={act.id}
                href={act.link}
                className={`group flex items-center justify-between p-3.5 rounded-2xl border transition-all ${styles.border} ${styles.bg}`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-base flex-shrink-0">{styles.indicator}</span>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                      {act.message}
                    </p>
                    <span className="text-[11px] text-slate-600 dark:text-slate-400">
                      Cliquez pour traiter maintenant
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${styles.badgeText}`}>
                    {act.actionLabel}
                  </span>
                  <ArrowRight className="w-4 h-4 text-slate-400 group-hover:translate-x-0.5 group-hover:text-indigo-500 transition-all" />
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
