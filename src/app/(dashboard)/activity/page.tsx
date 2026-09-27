'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { createClient } from '@/lib/supabase/client';
import { Activity } from '@/lib/types';
import { History, Loader2 } from 'lucide-react';

export default function ActivityPage() {
  const { currentCompany } = useAuth();
  const supabase = createClient();

  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentCompany?.id) return;
    const fetchActivities = async () => {
      setLoading(true);
      const { data } = await supabase
        .from('activities')
        .select('*')
        .eq('company_id', currentCompany.id)
        .order('created_at', { ascending: false });

      if (data) setActivities(data as Activity[]);
      setLoading(false);
    };

    fetchActivities();
  }, [currentCompany?.id]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
          Journal d&apos;activité
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
          Historique chronologique et immuable de toutes les actions réalisées dans votre espace.
        </p>
      </div>

      {loading ? (
        <div className="p-12 text-center text-slate-400">
          <Loader2 className="w-7 h-7 animate-spin mx-auto text-indigo-500 mb-2" />
          <span className="text-xs">Chargement du journal d&apos;activité...</span>
        </div>
      ) : activities.length === 0 ? (
        <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <History className="w-10 h-10 text-slate-400 mx-auto mb-3 opacity-60" />
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">Aucune activité enregistrée</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            Les actions réalisées (création de devis, enregistrement de paiements, relances) apparaîtront ici.
          </p>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm divide-y divide-slate-100 dark:divide-slate-800">
          {activities.map((act) => (
            <div key={act.id} className="py-4 flex items-start justify-between gap-4">
              <div>
                <span className="text-xs font-bold text-slate-900 dark:text-white block">
                  {act.action} — {act.entity_title || ''}
                </span>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {act.description}
                </p>
              </div>
              <span className="text-[11px] text-slate-400 flex-shrink-0">
                {new Date(act.created_at).toLocaleString('fr-FR')}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
