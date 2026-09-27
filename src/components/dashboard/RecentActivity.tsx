'use client';

import React from 'react';
import { Activity } from '@/lib/types';
import { History, FileSpreadsheet, Receipt, Wallet, CheckSquare, UserPlus, Clock } from 'lucide-react';

interface RecentActivityProps {
  activities: Activity[];
  loading?: boolean;
}

export default function RecentActivity({ activities, loading }: RecentActivityProps) {
  if (loading) {
    return (
      <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm animate-pulse">
        <div className="h-5 w-40 bg-slate-200 dark:bg-slate-800 rounded-lg mb-4" />
        <div className="space-y-3">
          <div className="h-10 bg-slate-100 dark:bg-slate-800/60 rounded-xl" />
          <div className="h-10 bg-slate-100 dark:bg-slate-800/60 rounded-xl" />
        </div>
      </div>
    );
  }

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'payment':
        return <Wallet className="w-4 h-4 text-emerald-500" />;
      case 'invoice':
        return <Receipt className="w-4 h-4 text-blue-500" />;
      case 'quote':
        return <FileSpreadsheet className="w-4 h-4 text-indigo-500" />;
      case 'task':
        return <CheckSquare className="w-4 h-4 text-teal-500" />;
      case 'lead':
        return <UserPlus className="w-4 h-4 text-amber-500" />;
      default:
        return <Clock className="w-4 h-4 text-slate-400" />;
    }
  };

  const formatDate = (iso: string) => {
    try {
      const d = new Date(iso);
      return d.toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return iso;
    }
  };

  return (
    <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
            <History className="w-4 h-4" />
          </div>
          <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
            Journal d&apos;activité
          </h2>
        </div>
        <span className="text-xs text-slate-600 dark:text-slate-400">
          En temps réel
        </span>
      </div>

      {activities.length === 0 ? (
        <div className="py-8 text-center bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
          <History className="w-7 h-7 text-slate-400 mx-auto mb-2 opacity-60" />
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Aucune activité récente enregistrée.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
          {activities.map((act) => (
            <div key={act.id} className="py-3 flex items-start gap-3">
              <div className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800/80 mt-0.5 flex-shrink-0">
                {getActivityIcon(act.entity_type)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                    {act.action}
                  </p>
                  <span className="text-[10px] text-slate-400 flex-shrink-0">
                    {formatDate(act.created_at)}
                  </span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5 leading-snug">
                  {act.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
