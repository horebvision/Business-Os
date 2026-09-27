'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/context/AuthContext';
import { createClient } from '@/lib/supabase/client';
import { Quote, QuoteStatus } from '@/lib/types';
import { formatMoney } from '@/lib/finance/money';
import { 
  FileSpreadsheet, 
  Plus, 
  Search, 
  Filter, 
  Loader2, 
  TrendingUp, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Eye, 
  FileText, 
  Receipt,
  Calendar,
  Building,
  User,
  ArrowUpDown
} from 'lucide-react';
import Link from 'next/link';

const STATUS_BADGES: Record<QuoteStatus, { label: string; class: string }> = {
  'Brouillon': { label: 'Brouillon', class: 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20' },
  'Envoyé': { label: 'Envoyé', class: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20' },
  'Consulté': { label: 'Consulté', class: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20' },
  'Accepté': { label: 'Accepté', class: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' },
  'Refusé': { label: 'Refusé', class: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20' },
  'Expiré': { label: 'Expiré', class: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20' },
  'Annulé': { label: 'Annulé', class: 'bg-slate-400/10 text-slate-400 border-slate-400/20' },
};

export default function QuotesPage() {
  const { currentCompany } = useAuth();
  const supabase = createClient();

  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [periodFilter, setPeriodFilter] = useState<'all' | 'month' | 'quarter' | 'year'>('all');
  const [sortBy, setSortBy] = useState<'recent' | 'amount_desc' | 'amount_asc' | 'status'>('recent');

  const fetchQuotes = async () => {
    if (!currentCompany?.id) return;
    setLoading(true);
    const { data } = await supabase
      .from('quotes')
      .select('*, customer:customer_id(name, company_name), assignee:assigned_to(full_name, email)')
      .eq('company_id', currentCompany.id)
      .order('created_at', { ascending: false });

    if (data) setQuotes(data as Quote[]);
    setLoading(false);
  };

  useEffect(() => {
    fetchQuotes();
  }, [currentCompany?.id]);

  // KPIs
  const stats = useMemo(() => {
    const total = quotes.length;
    const totalAmount = quotes.reduce((acc, q) => acc + (Number(q.total) || 0), 0);
    const pendingQuotes = quotes.filter((q) => ['Brouillon', 'Envoyé', 'Consulté'].includes(q.status));
    const acceptedQuotes = quotes.filter((q) => q.status === 'Accepté');
    const rejectedQuotes = quotes.filter((q) => q.status === 'Refusé');

    const decidedCount = acceptedQuotes.length + rejectedQuotes.length;
    const acceptanceRate = decidedCount > 0 ? Math.round((acceptedQuotes.length / decidedCount) * 100) : 0;

    return {
      total,
      totalAmount,
      pendingCount: pendingQuotes.length,
      pendingAmount: pendingQuotes.reduce((acc, q) => acc + (Number(q.total) || 0), 0),
      acceptedCount: acceptedQuotes.length,
      acceptedAmount: acceptedQuotes.reduce((acc, q) => acc + (Number(q.total) || 0), 0),
      rejectedCount: rejectedQuotes.length,
      acceptanceRate,
    };
  }, [quotes]);

  // Filtering & Sorting
  const filteredQuotes = useMemo(() => {
    return quotes
      .filter((q) => {
        const matchesSearch =
          q.quote_number.toLowerCase().includes(search.toLowerCase()) ||
          (q.customer?.name && q.customer.name.toLowerCase().includes(search.toLowerCase())) ||
          (q.customer?.company_name && q.customer.company_name.toLowerCase().includes(search.toLowerCase())) ||
          (q.subject && q.subject.toLowerCase().includes(search.toLowerCase()));

        const matchesStatus = statusFilter === 'all' || q.status === statusFilter;

        let matchesPeriod = true;
        if (periodFilter !== 'all') {
          const issueDate = new Date(q.issue_date);
          const now = new Date();
          if (periodFilter === 'month') {
            matchesPeriod = issueDate.getMonth() === now.getMonth() && issueDate.getFullYear() === now.getFullYear();
          } else if (periodFilter === 'quarter') {
            const currentQ = Math.floor(now.getMonth() / 3);
            const quoteQ = Math.floor(issueDate.getMonth() / 3);
            matchesPeriod = currentQ === quoteQ && issueDate.getFullYear() === now.getFullYear();
          } else if (periodFilter === 'year') {
            matchesPeriod = issueDate.getFullYear() === now.getFullYear();
          }
        }

        return matchesSearch && matchesStatus && matchesPeriod;
      })
      .sort((a, b) => {
        if (sortBy === 'amount_desc') return (Number(b.total) || 0) - (Number(a.total) || 0);
        if (sortBy === 'amount_asc') return (Number(a.total) || 0) - (Number(b.total) || 0);
        if (sortBy === 'status') return a.status.localeCompare(b.status);
        return new Date(b.issue_date || b.created_at).getTime() - new Date(a.issue_date || a.created_at).getTime();
      });
  }, [quotes, search, statusFilter, periodFilter, sortBy]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Devis & Propositions
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Établissez des devis professionnels, partagez-les en ligne et convertissez-les en factures.
          </p>
        </div>

        <Link
          href="/quotes/new"
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl shadow-md shadow-indigo-600/20 transition-all hover:scale-[1.02] active:scale-[0.98] self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Nouveau devis</span>
        </Link>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <span className="text-[11px] font-bold uppercase text-slate-400 tracking-wider">
            Total des devis ({stats.total})
          </span>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white truncate">
              {formatMoney(stats.totalAmount, currentCompany?.currency)}
            </span>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <span className="text-[11px] font-bold uppercase text-slate-400 tracking-wider">
            Devis en attente ({stats.pendingCount})
          </span>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-xl sm:text-2xl font-black text-indigo-600 dark:text-indigo-400 truncate">
              {formatMoney(stats.pendingAmount, currentCompany?.currency)}
            </span>
            <span className="text-xs text-indigo-500 font-semibold flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
            </span>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <span className="text-[11px] font-bold uppercase text-slate-400 tracking-wider">
            Devis acceptés ({stats.acceptedCount})
          </span>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-xl sm:text-2xl font-black text-emerald-600 dark:text-emerald-400 truncate">
              {formatMoney(stats.acceptedAmount, currentCompany?.currency)}
            </span>
            <span className="text-xs text-emerald-500 font-semibold flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
            </span>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <span className="text-[11px] font-bold uppercase text-slate-400 tracking-wider">
            Taux d&apos;acceptation
          </span>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-2xl font-black text-slate-900 dark:text-white">
              {stats.acceptanceRate}%
            </span>
            <span className="text-xs text-indigo-500 font-semibold flex items-center gap-1">
              <TrendingUp className="w-3.5 h-3.5" />
            </span>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm space-y-3 sm:space-y-0 sm:flex sm:items-center sm:gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher par n° de devis, client, objet..."
            className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div className="flex items-center gap-2">
          {/* Status filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="all">Tous les statuts</option>
            <option value="Brouillon">Brouillon</option>
            <option value="Envoyé">Envoyé</option>
            <option value="Consulté">Consulté</option>
            <option value="Accepté">Accepté</option>
            <option value="Refusé">Refusé</option>
            <option value="Expiré">Expiré</option>
            <option value="Annulé">Annulé</option>
          </select>

          {/* Period filter */}
          <select
            value={periodFilter}
            onChange={(e) => setPeriodFilter(e.target.value as any)}
            className="px-3 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="all">Toutes périodes</option>
            <option value="month">Ce mois-ci</option>
            <option value="quarter">Ce trimestre</option>
            <option value="year">Cette année</option>
          </select>

          {/* Sort */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="px-3 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="recent">Plus récents</option>
            <option value="amount_desc">Montant décroissant</option>
            <option value="amount_asc">Montant croissant</option>
            <option value="status">Statut</option>
          </select>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="p-16 text-center text-slate-400">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-indigo-500 mb-2" />
          <span className="text-xs font-medium">Chargement des devis...</span>
        </div>
      ) : filteredQuotes.length === 0 ? (
        <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <FileSpreadsheet className="w-12 h-12 text-slate-400 mx-auto mb-3 opacity-60" />
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">Aucun devis trouvé</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            {search || statusFilter !== 'all' || periodFilter !== 'all'
              ? 'Aucun devis ne correspond à ces critères.'
              : 'Créez votre première proposition commerciale avec calcul automatique et lien public.'}
          </p>
          <Link
            href="/quotes/new"
            className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-semibold shadow hover:bg-indigo-500"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Créer un devis</span>
          </Link>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700 dark:text-slate-300">
              <thead className="bg-slate-50 dark:bg-slate-800/60 uppercase text-[10px] font-bold text-slate-500 tracking-wider border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="py-3.5 px-4">N° Devis & Objet</th>
                  <th className="py-3.5 px-4">Client</th>
                  <th className="py-3.5 px-4">Émission / Expiration</th>
                  <th className="py-3.5 px-4">Montant HT</th>
                  <th className="py-3.5 px-4">Taxes</th>
                  <th className="py-3.5 px-4">Total TTC</th>
                  <th className="py-3.5 px-4">Statut</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {filteredQuotes.map((q) => {
                  const badge = STATUS_BADGES[q.status] || STATUS_BADGES['Brouillon'];

                  return (
                    <tr
                      key={q.id}
                      className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors group"
                    >
                      <td className="py-3.5 px-4">
                        <Link
                          href={`/quotes/${q.id}`}
                          className="font-bold text-indigo-600 dark:text-indigo-400 hover:underline block"
                        >
                          {q.quote_number}
                        </Link>
                        {q.subject && (
                          <span className="text-[11px] text-slate-500 dark:text-slate-400 truncate max-w-[200px] block">
                            {q.subject}
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-4">
                        <span className="font-semibold text-slate-900 dark:text-white block">
                          {q.customer?.name || (q as any).customer_name || 'Client sans nom'}
                        </span>
                        {q.customer?.company_name && (
                          <span className="text-[10px] text-slate-400">{q.customer.company_name}</span>
                        )}
                      </td>

                      <td className="py-3.5 px-4">
                        <span className="text-slate-700 dark:text-slate-300 block">
                          {new Date(q.issue_date).toLocaleDateString('fr-FR')}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          Exp : {new Date(q.expiration_date).toLocaleDateString('fr-FR')}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 font-semibold text-slate-700 dark:text-slate-300">
                        {formatMoney(q.subtotal, q.currency)}
                      </td>

                      <td className="py-3.5 px-4 text-slate-500">
                        {formatMoney(q.tax_amount, q.currency)}
                      </td>

                      <td className="py-3.5 px-4 font-black text-slate-900 dark:text-white">
                        {formatMoney(q.total, q.currency)}
                      </td>

                      <td className="py-3.5 px-4">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border ${badge.class}`}>
                          {badge.label}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5 opacity-90 group-hover:opacity-100 transition-opacity">
                          <Link
                            href={`/quotes/${q.id}`}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                            title="Consulter le devis"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </Link>

                          {q.status === 'Accepté' && (
                            <Link
                              href={`/invoices/new?from_quote_id=${q.id}`}
                              className="px-2 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 text-[10px] font-bold flex items-center gap-1 transition-colors"
                              title="Créer la facture"
                            >
                              <Receipt className="w-3 h-3" />
                              <span>Facturer</span>
                            </Link>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
