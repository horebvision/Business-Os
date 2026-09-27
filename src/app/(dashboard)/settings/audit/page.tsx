'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import {
  ShieldAlert,
  Search,
  Filter,
  Clock,
  User,
  ShieldCheck,
  FileText,
  Activity,
  Loader2,
  AlertCircle,
  Eye,
  X,
} from 'lucide-react';
import Link from 'next/link';

export default function AuditLogsPage() {
  const { session, currentCompany, currentRole } = useAuth();

  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedAction, setSelectedAction] = useState('all');
  const [selectedLog, setSelectedLog] = useState<any | null>(null);

  const fetchLogs = async () => {
    if (!session?.access_token) return;
    setLoading(true);

    try {
      const url = new URL('/api/settings/audit', window.location.origin);
      if (selectedAction !== 'all') url.searchParams.set('action', selectedAction);
      if (search.trim()) url.searchParams.set('search', search.trim());

      const res = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      const data = await res.json();
      if (res.ok && data.logs) {
        setLogs(data.logs);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [session?.access_token, selectedAction]);

  const canViewAudit = ['owner', 'admin', 'manager'].includes(currentRole || '');

  if (!canViewAudit) {
    return (
      <div className="p-8 max-w-md mx-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl text-center space-y-3">
        <ShieldAlert className="w-10 h-10 text-rose-500 mx-auto" />
        <h2 className="text-base font-extrabold text-slate-900 dark:text-white">Accès Non Autorisé</h2>
        <p className="text-xs text-slate-500">
          Seuls les administrateurs et managers de {currentCompany?.name} peuvent consulter le journal d&apos;audit.
        </p>
      </div>
    );
  }

  const filteredLogs = logs.filter((log) => {
    if (!search.trim()) return true;
    const s = search.toLowerCase();
    return (
      log.action?.toLowerCase().includes(s) ||
      log.user_email?.toLowerCase().includes(s) ||
      log.resource_type?.toLowerCase().includes(s)
    );
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
              Journal d&apos;Audit & Sécurité
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-500/10 text-indigo-600 border border-indigo-500/20">
              Traçabilité
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Historique certifié des actions sensibles, modifications de rôles, accès et transactions dans {currentCompany?.name}.
          </p>
        </div>

        <Link
          href="/settings"
          className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 self-start sm:self-auto transition-colors"
        >
          Retour aux Paramètres
        </Link>
      </div>

      {/* Filter Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-4 shadow-sm flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher par utilisateur, action, ressource..."
            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs outline-none"
          />
        </div>

        <select
          value={selectedAction}
          onChange={(e) => setSelectedAction(e.target.value)}
          className="p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs outline-none"
        >
          <option value="all">Toutes les actions</option>
          <option value="user.invited">Invitations d&apos;utilisateurs</option>
          <option value="user.role_changed">Changements de rôle</option>
          <option value="subscription.updated">Modifications d&apos;abonnement</option>
          <option value="customers.imported">Imports de clients</option>
          <option value="leads.imported">Imports de prospects</option>
        </select>
      </div>

      {/* Logs Table */}
      {loading ? (
        <div className="p-16 text-center text-slate-400">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-indigo-500 mb-2" />
          <p className="text-xs">Chargement du journal d&apos;audit...</p>
        </div>
      ) : filteredLogs.length === 0 ? (
        <div className="p-12 text-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl">
          <Activity className="w-10 h-10 text-slate-300 mx-auto mb-2" />
          <p className="text-xs text-slate-500">Aucun événement d&apos;audit enregistré correspondant aux critères.</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-sm">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/60 uppercase text-[10px] font-bold text-slate-500 tracking-wider border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="py-3.5 px-5">Date & Heure</th>
                <th className="py-3.5 px-5">Utilisateur</th>
                <th className="py-3.5 px-5">Action</th>
                <th className="py-3.5 px-5">Objet</th>
                <th className="py-3.5 px-5 text-center">Détails</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {filteredLogs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                  <td className="py-3.5 px-5 text-slate-500 font-mono text-[11px] whitespace-nowrap">
                    {new Date(log.created_at).toLocaleString('fr-FR', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </td>
                  <td className="py-3.5 px-5 font-semibold text-slate-900 dark:text-white">
                    {log.user_email || 'Système'}
                  </td>
                  <td className="py-3.5 px-5">
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold font-mono bg-indigo-500/10 text-indigo-600 border border-indigo-500/20">
                      {log.action}
                    </span>
                  </td>
                  <td className="py-3.5 px-5 text-slate-600 dark:text-slate-400 capitalize">
                    {log.resource_type || '—'}
                  </td>
                  <td className="py-3.5 px-5 text-center">
                    <button
                      onClick={() => setSelectedLog(log)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 transition-colors"
                      title="Inspecter le payload"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Payload Inspection Modal */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-lg w-full p-6 shadow-2xl relative space-y-4">
            <button
              onClick={() => setSelectedLog(null)}
              className="absolute top-5 right-5 text-slate-400 hover:text-slate-600"
            >
              <X className="w-5 h-5" />
            </button>

            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-500">
                Inspection d&apos;Événement
              </span>
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white mt-1">
                {selectedLog.action}
              </h3>
              <p className="text-xs text-slate-400 mt-0.5 font-mono">
                ID : {selectedLog.id} • IP : {selectedLog.ip_address || 'Non enregistrée'}
              </p>
            </div>

            <div className="bg-slate-950 text-slate-200 p-4 rounded-2xl text-xs font-mono overflow-x-auto max-h-60 border border-slate-800">
              <pre>{JSON.stringify({ oldValue: selectedLog.old_value, newValue: selectedLog.new_value }, null, 2)}</pre>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setSelectedLog(null)}
                className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold shadow"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
