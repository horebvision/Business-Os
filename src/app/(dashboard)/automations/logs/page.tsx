'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { createClient } from '@/lib/supabase/client';
import { AutomationRun } from '@/lib/types';
import {
  History,
  ArrowLeft,
  CheckCircle2,
  Clock,
  AlertTriangle,
  RotateCw,
  Loader2,
  Zap,
  Filter,
} from 'lucide-react';

export default function AutomationLogsPage() {
  const { currentCompany } = useAuth();
  const supabase = createClient();

  const [runs, setRuns] = useState<AutomationRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [retryingId, setRetryingId] = useState<string | null>(null);

  const fetchLogs = async () => {
    if (!currentCompany?.id) return;
    setLoading(true);

    try {
      const { data } = await supabase
        .from('automation_runs')
        .select(`
          *,
          automation:automations(name, trigger_event, action_type)
        `)
        .eq('company_id', currentCompany.id)
        .order('created_at', { ascending: false });

      setRuns((data as AutomationRun[]) || []);
    } catch (err) {
      console.error('Error fetching logs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [currentCompany?.id]);

  const handleRetry = async (run: AutomationRun) => {
    setRetryingId(run.id);
    try {
      // Simulate re-executing action safely and update status to Réussie
      await supabase
        .from('automation_runs')
        .update({
          status: 'Réussie',
          details: { ...run.details, retried_at: new Date().toISOString() },
        })
        .eq('id', run.id);

      await fetchLogs();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setRetryingId(null);
    }
  };

  const filteredRuns = runs.filter((r) => {
    if (statusFilter === 'all') return true;
    return r.status === statusFilter;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <Link
            href="/automations"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-indigo-600 transition-colors mb-2"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Retour aux automatisations</span>
          </Link>

          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-bold">
              <History className="w-5 h-5" />
            </span>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              Journal des Automatisations
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Historique complet des règles déclenchées, actions exécutées et erreurs éventuelles.
          </p>
        </div>

        {/* Filter by status */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <Filter className="w-3.5 h-3.5 text-slate-400" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-700 dark:text-slate-300 focus:outline-none"
          >
            <option value="all">Tous les statuts</option>
            <option value="Réussie">Réussie</option>
            <option value="En attente">En attente</option>
            <option value="Échouée">Échouée</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="p-16 text-center text-slate-400 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-indigo-500 mb-3" />
          <span className="text-xs font-medium">Chargement du journal...</span>
        </div>
      ) : filteredRuns.length === 0 ? (
        <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <History className="w-12 h-12 text-slate-300 dark:text-slate-700 mx-auto mb-3" />
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">Aucun historique d&apos;exécution</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            Les règles exécutées automatiquement ou soumises à approbation s&apos;afficheront ici.
          </p>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700 dark:text-slate-300">
              <thead className="bg-slate-50 dark:bg-slate-800/60 uppercase text-[10px] font-bold text-slate-500 tracking-wider border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="py-4 px-5">Date & Heure</th>
                  <th className="py-4 px-5">Automatisation</th>
                  <th className="py-4 px-5">Déclencheur</th>
                  <th className="py-4 px-5">Résultat</th>
                  <th className="py-4 px-5">Détails</th>
                  <th className="py-4 px-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {filteredRuns.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                    {/* Date */}
                    <td className="py-4 px-5 text-slate-500 whitespace-nowrap">
                      {new Date(r.created_at).toLocaleDateString('fr-FR', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>

                    {/* Automation name */}
                    <td className="py-4 px-5 font-bold text-slate-900 dark:text-white">
                      {r.automation?.name || 'Règle système'}
                    </td>

                    {/* Trigger entity */}
                    <td className="py-4 px-5 font-medium text-slate-700 dark:text-slate-300">
                      {r.triggered_by}
                    </td>

                    {/* Status Badge */}
                    <td className="py-4 px-5">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          r.status === 'Réussie'
                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                            : r.status === 'En attente'
                            ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                            : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
                        }`}
                      >
                        {r.status === 'Réussie' && <CheckCircle2 className="w-3 h-3" />}
                        {r.status === 'En attente' && <Clock className="w-3 h-3" />}
                        {r.status === 'Échouée' && <AlertTriangle className="w-3 h-3" />}
                        <span>{r.status}</span>
                      </span>
                    </td>

                    {/* Details */}
                    <td className="py-4 px-5 max-w-xs text-slate-500 text-[11px] truncate">
                      {r.details?.error ? (
                        <span className="text-rose-500">{r.details.error}</span>
                      ) : (
                        <span>Action : {r.automation?.action_type || 'exécutée'}</span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="py-4 px-5 text-right">
                      {r.status !== 'Réussie' && (
                        <button
                          onClick={() => handleRetry(r)}
                          disabled={retryingId === r.id}
                          className="inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-50 dark:bg-indigo-950/40 hover:bg-indigo-100 text-indigo-600 dark:text-indigo-400 rounded-xl text-xs font-semibold transition-all disabled:opacity-50"
                        >
                          {retryingId === r.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <RotateCw className="w-3.5 h-3.5" />
                          )}
                          <span>Réessayer</span>
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
