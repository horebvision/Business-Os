'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/context/AuthContext';
import { createClient } from '@/lib/supabase/client';
import { Invoice, InvoiceStatus } from '@/lib/types';
import { formatMoney, getDaysOverdue } from '@/lib/finance/money';
import { 
  Receipt, 
  Plus, 
  Search, 
  Filter, 
  Loader2, 
  DollarSign, 
  TrendingUp, 
  Clock, 
  CheckCircle2, 
  AlertTriangle, 
  Eye, 
  CreditCard, 
  Send,
  Calendar,
  Building
} from 'lucide-react';
import Link from 'next/link';
import PaymentModal from '@/components/finance/PaymentModal';
import ReminderModal from '@/components/finance/ReminderModal';

const STATUS_BADGES: Record<InvoiceStatus, { label: string; class: string }> = {
  'Brouillon': { label: 'Brouillon', class: 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20' },
  'Envoyée': { label: 'Envoyée', class: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20' },
  'Partiellement payée': { label: 'Partiellement payée', class: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20' },
  'Payée': { label: 'Payée', class: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' },
  'En retard': { label: 'En retard', class: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20' },
  'Annulée': { label: 'Annulée', class: 'bg-slate-400/10 text-slate-400 border-slate-400/20' },
};

export default function InvoicesPage() {
  const { currentCompany } = useAuth();
  const supabase = createClient();

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'due_date' | 'total_desc' | 'remaining_desc' | 'recent'>('due_date');

  // Modals
  const [selectedInvoiceForPayment, setSelectedInvoiceForPayment] = useState<Invoice | null>(null);
  const [selectedInvoiceForReminder, setSelectedInvoiceForReminder] = useState<Invoice | null>(null);

  const fetchInvoices = async () => {
    if (!currentCompany?.id) return;
    setLoading(true);
    const { data } = await supabase
      .from('invoices')
      .select('*, customer:customer_id(*)')
      .eq('company_id', currentCompany.id)
      .order('due_date', { ascending: true });

    if (data) setInvoices(data as Invoice[]);
    setLoading(false);
  };

  useEffect(() => {
    fetchInvoices();
  }, [currentCompany?.id]);

  // Financial KPIs
  const metrics = useMemo(() => {
    const totalInvoiced = invoices.reduce((acc, i) => acc + (Number(i.total) || 0), 0);
    const totalPaid = invoices.reduce((acc, i) => acc + (Number(i.paid_amount) || 0), 0);
    const totalRemaining = invoices.reduce((acc, i) => acc + (Number(i.remaining_amount) || 0), 0);
    const overdueInvoices = invoices.filter((i) => {
      const isOverdue = getDaysOverdue(i.due_date) > 0 && i.status !== 'Payée' && i.status !== 'Annulée';
      return isOverdue || i.status === 'En retard';
    });
    const paidCount = invoices.filter((i) => i.status === 'Payée').length;
    const partialCount = invoices.filter((i) => i.status === 'Partiellement payée').length;

    return {
      totalCount: invoices.length,
      totalInvoiced,
      totalPaid,
      totalRemaining,
      overdueCount: overdueInvoices.length,
      overdueAmount: overdueInvoices.reduce((acc, i) => acc + (Number(i.remaining_amount) || 0), 0),
      paidCount,
      partialCount,
    };
  }, [invoices]);

  // Filter & sort
  const filteredInvoices = useMemo(() => {
    return invoices
      .filter((i) => {
        const matchesSearch =
          i.invoice_number.toLowerCase().includes(search.toLowerCase()) ||
          (i.customer?.name && i.customer.name.toLowerCase().includes(search.toLowerCase())) ||
          (i.customer?.company_name && i.customer.company_name.toLowerCase().includes(search.toLowerCase())) ||
          (i.subject && i.subject.toLowerCase().includes(search.toLowerCase()));

        let matchesStatus = true;
        if (statusFilter !== 'all') {
          if (statusFilter === 'overdue') {
            matchesStatus = getDaysOverdue(i.due_date) > 0 && i.status !== 'Payée' && i.status !== 'Annulée';
          } else {
            matchesStatus = i.status === statusFilter;
          }
        }

        return matchesSearch && matchesStatus;
      })
      .sort((a, b) => {
        if (sortBy === 'total_desc') return (Number(b.total) || 0) - (Number(a.total) || 0);
        if (sortBy === 'remaining_desc') return (Number(b.remaining_amount) || 0) - (Number(a.remaining_amount) || 0);
        if (sortBy === 'recent') return new Date(b.issue_date || b.created_at).getTime() - new Date(a.issue_date || a.created_at).getTime();
        return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
      });
  }, [invoices, search, statusFilter, sortBy]);

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Factures & Règlements
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Gérez vos créances clients, enregistrez les encaissements et automatisez vos relances d&apos;impayés.
          </p>
        </div>

        <Link
          href="/invoices/new"
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl shadow-md shadow-indigo-600/20 transition-all hover:scale-[1.02] active:scale-[0.98] self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Nouvelle facture</span>
        </Link>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider block">
            CA Facturé
          </span>
          <span className="text-base sm:text-lg font-black text-slate-900 dark:text-white mt-1 block truncate">
            {formatMoney(metrics.totalInvoiced, currentCompany?.currency)}
          </span>
        </div>

        <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider block">
            Montant Encaissé
          </span>
          <span className="text-base sm:text-lg font-black text-emerald-600 dark:text-emerald-400 mt-1 block truncate">
            {formatMoney(metrics.totalPaid, currentCompany?.currency)}
          </span>
        </div>

        <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider block">
            Reste à Encaisser
          </span>
          <span className="text-base sm:text-lg font-black text-amber-600 dark:text-amber-400 mt-1 block truncate">
            {formatMoney(metrics.totalRemaining, currentCompany?.currency)}
          </span>
        </div>

        <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider block">
            Factures en retard
          </span>
          <div className="mt-1 flex items-baseline gap-1">
            <span className={`text-base sm:text-lg font-black ${
              metrics.overdueCount > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-900 dark:text-white'
            }`}>
              {metrics.overdueCount}
            </span>
            {metrics.overdueAmount > 0 && (
              <span className="text-[10px] text-slate-400 truncate">
                ({formatMoney(metrics.overdueAmount, currentCompany?.currency)})
              </span>
            )}
          </div>
        </div>

        <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider block">
            Payées
          </span>
          <span className="text-base sm:text-lg font-black text-emerald-600 dark:text-emerald-400 mt-1 block">
            {metrics.paidCount}
          </span>
        </div>

        <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider block">
            Partielles
          </span>
          <span className="text-base sm:text-lg font-black text-amber-600 dark:text-amber-400 mt-1 block">
            {metrics.partialCount}
          </span>
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
            placeholder="Rechercher par n° de facture, client, objet..."
            className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div className="flex items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="all">Tous les statuts</option>
            <option value="overdue">🚨 En retard d&apos;échéance</option>
            <option value="Brouillon">Brouillon</option>
            <option value="Envoyée">Envoyée</option>
            <option value="Partiellement payée">Partiellement payée</option>
            <option value="Payée">Payée</option>
            <option value="Annulée">Annulée</option>
          </select>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="px-3 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="due_date">Date d&apos;échéance</option>
            <option value="remaining_desc">Reste dû décroissant</option>
            <option value="total_desc">Total TTC décroissant</option>
            <option value="recent">Plus récentes</option>
          </select>
        </div>
      </div>

      {/* Main Table */}
      {loading ? (
        <div className="p-16 text-center text-slate-400">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-indigo-500 mb-2" />
          <span className="text-xs font-medium">Chargement des factures...</span>
        </div>
      ) : filteredInvoices.length === 0 ? (
        <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <Receipt className="w-12 h-12 text-slate-400 mx-auto mb-3 opacity-60" />
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">Aucune facture trouvée</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            {search || statusFilter !== 'all'
              ? 'Aucune facture ne correspond à ces critères.'
              : 'Émettez votre première facture client ou convertissez un devis existant.'}
          </p>
          <Link
            href="/invoices/new"
            className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-semibold shadow hover:bg-indigo-500"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Créer une facture</span>
          </Link>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700 dark:text-slate-300">
              <thead className="bg-slate-50 dark:bg-slate-800/60 uppercase text-[10px] font-bold text-slate-500 tracking-wider border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="py-3.5 px-4">N° Facture</th>
                  <th className="py-3.5 px-4">Client</th>
                  <th className="py-3.5 px-4">Échéance</th>
                  <th className="py-3.5 px-4">Total TTC</th>
                  <th className="py-3.5 px-4">Payé</th>
                  <th className="py-3.5 px-4">Reste dû</th>
                  <th className="py-3.5 px-4">Statut</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {filteredInvoices.map((inv) => {
                  const badge = STATUS_BADGES[inv.status] || STATUS_BADGES['Brouillon'];
                  const overdueDays = getDaysOverdue(inv.due_date);
                  const isOverdue = overdueDays > 0 && inv.status !== 'Payée' && inv.status !== 'Annulée';

                  return (
                    <tr
                      key={inv.id}
                      className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors group"
                    >
                      <td className="py-3.5 px-4">
                        <Link
                          href={`/invoices/${inv.id}`}
                          className="font-bold text-indigo-600 dark:text-indigo-400 hover:underline block"
                        >
                          {inv.invoice_number}
                        </Link>
                        {inv.subject && (
                          <span className="text-[11px] text-slate-400 truncate max-w-[180px] block">
                            {inv.subject}
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-4">
                        <span className="font-semibold text-slate-900 dark:text-white block">
                          {inv.customer?.name || (inv as any).customer_name || 'Client sans nom'}
                        </span>
                        {inv.customer?.company_name && (
                          <span className="text-[10px] text-slate-400">{inv.customer.company_name}</span>
                        )}
                      </td>

                      <td className="py-3.5 px-4">
                        <span className="text-slate-700 dark:text-slate-300 block">
                          {new Date(inv.due_date).toLocaleDateString('fr-FR')}
                        </span>
                        {isOverdue ? (
                          <span className="text-[10px] text-rose-500 font-bold">
                            {overdueDays}j de retard
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-400">
                            Émis le {new Date(inv.issue_date).toLocaleDateString('fr-FR')}
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 font-black text-slate-900 dark:text-white">
                        {formatMoney(inv.total, inv.currency)}
                      </td>

                      <td className="py-3.5 px-4 font-semibold text-emerald-600 dark:text-emerald-400">
                        {formatMoney(inv.paid_amount, inv.currency)}
                      </td>

                      <td className="py-3.5 px-4">
                        <span className={`font-black ${
                          Number(inv.remaining_amount) > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-400'
                        }`}>
                          {formatMoney(inv.remaining_amount, inv.currency)}
                        </span>
                      </td>

                      <td className="py-3.5 px-4">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border ${badge.class}`}>
                          {isOverdue && inv.status !== 'En retard' ? 'En retard' : badge.label}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5 opacity-90 group-hover:opacity-100 transition-opacity">
                          {Number(inv.remaining_amount) > 0 && inv.status !== 'Annulée' && (
                            <>
                              <button
                                onClick={() => setSelectedInvoiceForPayment(inv)}
                                className="px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 text-[10px] font-bold flex items-center gap-1 transition-colors"
                                title="Enregistrer un paiement"
                              >
                                <CreditCard className="w-3 h-3" />
                                <span>Paiement</span>
                              </button>

                              <button
                                onClick={() => setSelectedInvoiceForReminder(inv)}
                                className="p-1.5 rounded-lg text-amber-500 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/40 transition-colors"
                                title="Relancer le client (IA)"
                              >
                                <Send className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}

                          <Link
                            href={`/invoices/${inv.id}`}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                            title="Consulter"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </Link>
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

      {/* Payment Modal */}
      {selectedInvoiceForPayment && (
        <PaymentModal
          isOpen={true}
          invoice={selectedInvoiceForPayment}
          onClose={() => setSelectedInvoiceForPayment(null)}
          onSuccess={fetchInvoices}
        />
      )}

      {/* Reminder Modal */}
      {selectedInvoiceForReminder && (
        <ReminderModal
          isOpen={true}
          invoice={selectedInvoiceForReminder}
          onClose={() => setSelectedInvoiceForReminder(null)}
          onSuccess={fetchInvoices}
        />
      )}
    </div>
  );
}
