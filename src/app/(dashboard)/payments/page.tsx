'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { createClient } from '@/lib/supabase/client';
import { Payment, PaymentMethod } from '@/lib/types';
import { formatMoney } from '@/lib/finance/money';
import PaymentModal from '@/components/finance/PaymentModal';
import {
  Wallet,
  Plus,
  Search,
  Filter,
  Loader2,
  Calendar,
  CreditCard,
  Building2,
  ArrowUpRight,
  TrendingUp,
  Receipt,
  AlertCircle,
  FileText,
  Clock,
  Sparkles,
  CheckCircle2,
} from 'lucide-react';

export default function PaymentsPage() {
  const { currentCompany } = useAuth();
  const supabase = createClient();

  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalDue, setTotalDue] = useState<number>(0);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMethod, setSelectedMethod] = useState<string>('all');
  const [selectedPeriod, setSelectedPeriod] = useState<string>('all');

  const fetchPaymentsAndStats = async () => {
    if (!currentCompany?.id) return;
    setLoading(true);

    try {
      // 1. Fetch payments with joined customer and invoice
      const { data: payData, error: payError } = await supabase
        .from('payments')
        .select(`
          *,
          customer:customers(id, name, company_name),
          invoice:invoices(id, invoice_number, total, remaining_amount, currency)
        `)
        .eq('company_id', currentCompany.id)
        .order('payment_date', { ascending: false });

      if (payError) throw payError;
      setPayments((payData as Payment[]) || []);

      // 2. Fetch remaining receivables (créances restantes) from unpaid invoices
      const { data: invData } = await supabase
        .from('invoices')
        .select('remaining_amount, total, status')
        .eq('company_id', currentCompany.id)
        .not('status', 'in', '("Payée","Annulée")');

      if (invData) {
        const sumDue = invData.reduce((acc, inv) => acc + (Number(inv.remaining_amount) || 0), 0);
        setTotalDue(sumDue);
      }
    } catch (err) {
      console.error('Erreur chargement paiements:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPaymentsAndStats();
  }, [currentCompany?.id]);

  // KPIs calculation
  const currency = currentCompany?.currency || 'FCFA';

  const kpis = useMemo(() => {
    const totalCollected = payments.reduce((acc, p) => acc + (Number(p.amount) || 0), 0);
    const countPayments = payments.length;

    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth();

    const thisMonthPayments = payments.filter((p) => {
      const d = new Date(p.payment_date);
      return d.getFullYear() === currentYear && d.getMonth() === currentMonth;
    });

    const totalThisMonth = thisMonthPayments.reduce((acc, p) => acc + (Number(p.amount) || 0), 0);

    return {
      totalCollected,
      totalThisMonth,
      countPayments,
      totalDue,
    };
  }, [payments, totalDue]);

  // Filtering
  const filteredPayments = useMemo(() => {
    return payments.filter((p) => {
      // Search
      const search = searchQuery.toLowerCase().trim();
      const matchSearch =
        !search ||
        (p.invoice?.invoice_number || '').toLowerCase().includes(search) ||
        (p.customer?.name || '').toLowerCase().includes(search) ||
        (p.customer?.company_name || '').toLowerCase().includes(search) ||
        (p.reference || '').toLowerCase().includes(search) ||
        (p.notes || '').toLowerCase().includes(search);

      // Method
      const matchMethod = selectedMethod === 'all' || p.payment_method === selectedMethod;

      // Period
      let matchPeriod = true;
      if (selectedPeriod !== 'all') {
        const pDate = new Date(p.payment_date);
        const now = new Date();
        if (selectedPeriod === 'this_month') {
          matchPeriod = pDate.getFullYear() === now.getFullYear() && pDate.getMonth() === now.getMonth();
        } else if (selectedPeriod === 'last_month') {
          const lastMonth = now.getMonth() === 0 ? 11 : now.getMonth() - 1;
          const lastMonthYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
          matchPeriod = pDate.getFullYear() === lastMonthYear && pDate.getMonth() === lastMonth;
        } else if (selectedPeriod === 'this_year') {
          matchPeriod = pDate.getFullYear() === now.getFullYear();
        }
      }

      return matchSearch && matchMethod && matchPeriod;
    });
  }, [payments, searchQuery, selectedMethod, selectedPeriod]);

  const getMethodBadgeStyle = (method: string) => {
    switch (method) {
      case 'Mobile Money':
        return 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20';
      case 'Virement bancaire':
      case 'Virement':
        return 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20';
      case 'Espèces':
        return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20';
      case 'Chèque':
        return 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20';
      case 'Carte':
        return 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20';
      default:
        return 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold">
              <Wallet className="w-5 h-5" />
            </span>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              Paiements & Encaissements
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Suivi des flux de trésorerie, règlements partiels et apurement des créances clients.
          </p>
        </div>

        <button
          onClick={() => setIsPaymentModalOpen(true)}
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-2xl shadow-lg shadow-emerald-600/20 transition-all self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Nouveau paiement</span>
        </button>
      </div>

      {/* 4 Financial KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Collected */}
        <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden group hover:border-emerald-500/40 transition-all">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider">Total Encaissé</span>
            <span className="p-2 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <TrendingUp className="w-4 h-4" />
            </span>
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
            {formatMoney(kpis.totalCollected, currency)}
          </div>
          <div className="mt-2 text-[11px] text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Tous les paiements enregistrés</span>
          </div>
        </div>

        {/* Payments This Month */}
        <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden group hover:border-indigo-500/40 transition-all">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider">Paiements du mois</span>
            <span className="p-2 rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
              <Calendar className="w-4 h-4" />
            </span>
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
            {formatMoney(kpis.totalThisMonth, currency)}
          </div>
          <div className="mt-2 text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
            <span>Mois en cours</span>
          </div>
        </div>

        {/* Number of Payments */}
        <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden group hover:border-blue-500/40 transition-all">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider">Nombre de règlements</span>
            <span className="p-2 rounded-2xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
              <Receipt className="w-4 h-4" />
            </span>
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
            {kpis.countPayments}
          </div>
          <div className="mt-2 text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
            <span>Transactions validées</span>
          </div>
        </div>

        {/* Remaining Receivables */}
        <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden group hover:border-amber-500/40 transition-all">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider">Créances Restantes</span>
            <span className="p-2 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <AlertCircle className="w-4 h-4" />
            </span>
          </div>
          <div className="text-2xl font-black text-amber-600 dark:text-amber-400 tracking-tight">
            {formatMoney(kpis.totalDue, currency)}
          </div>
          <div className="mt-2 text-[11px] text-amber-600/90 dark:text-amber-400/90 font-medium flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" />
            <span>À recouvrer sur factures émises</span>
          </div>
        </div>
      </div>

      {/* Search & Filters Bar */}
      <div className="p-4 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Rechercher par client, n° facture, référence..."
            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        {/* Method filter */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400 pl-1">
            <Filter className="w-3.5 h-3.5" />
            <span>Mode :</span>
          </div>
          <select
            value={selectedMethod}
            onChange={(e) => setSelectedMethod(e.target.value)}
            className="px-3 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="all">Tous les modes</option>
            <option value="Espèces">Espèces</option>
            <option value="Virement bancaire">Virement</option>
            <option value="Mobile Money">Mobile Money</option>
            <option value="Chèque">Chèque</option>
            <option value="Carte">Carte</option>
            <option value="Autre">Autre</option>
          </select>

          {/* Period filter */}
          <select
            value={selectedPeriod}
            onChange={(e) => setSelectedPeriod(e.target.value)}
            className="px-3 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="all">Toutes périodes</option>
            <option value="this_month">Ce mois-ci</option>
            <option value="last_month">Mois dernier</option>
            <option value="this_year">Cette année</option>
          </select>
        </div>
      </div>

      {/* Payments Table */}
      {loading ? (
        <div className="p-16 text-center text-slate-400 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-emerald-500 mb-3" />
          <span className="text-xs font-medium">Chargement des règlements...</span>
        </div>
      ) : filteredPayments.length === 0 ? (
        <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <Wallet className="w-12 h-12 text-slate-300 dark:text-slate-700 mx-auto mb-3" />
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">Aucun paiement trouvé</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            {searchQuery || selectedMethod !== 'all' || selectedPeriod !== 'all'
              ? 'Aucun règlement ne correspond à vos critères de recherche.'
              : 'Enregistrez votre premier encaissement pour mettre à jour vos créances et factures.'}
          </p>
          <button
            onClick={() => setIsPaymentModalOpen(true)}
            className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-xl transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Enregistrer un paiement</span>
          </button>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700 dark:text-slate-300">
              <thead className="bg-slate-50 dark:bg-slate-800/60 uppercase text-[10px] font-bold text-slate-500 tracking-wider border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="py-4 px-5">Date</th>
                  <th className="py-4 px-5">Facture</th>
                  <th className="py-4 px-5">Client</th>
                  <th className="py-4 px-5">Mode de règlement</th>
                  <th className="py-4 px-5">Référence</th>
                  <th className="py-4 px-5">Commentaire</th>
                  <th className="py-4 px-5 text-right">Montant</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {filteredPayments.map((p) => (
                  <tr
                    key={p.id}
                    className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    {/* Date */}
                    <td className="py-4 px-5 text-slate-600 dark:text-slate-400 font-medium">
                      {new Date(p.payment_date).toLocaleDateString('fr-FR', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </td>

                    {/* Invoice */}
                    <td className="py-4 px-5 font-bold text-slate-900 dark:text-white">
                      {p.invoice ? (
                        <Link
                          href={`/invoices/${p.invoice.id}`}
                          className="inline-flex items-center gap-1.5 text-indigo-600 dark:text-indigo-400 hover:underline"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          <span>{p.invoice.invoice_number}</span>
                        </Link>
                      ) : (
                        <span className="text-slate-400 italic">Facture supprimée</span>
                      )}
                    </td>

                    {/* Customer */}
                    <td className="py-4 px-5">
                      {p.customer ? (
                        <Link
                          href={`/customers/${p.customer.id}`}
                          className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                        >
                          <span className="font-semibold text-slate-900 dark:text-white block">
                            {p.customer.name}
                          </span>
                          {p.customer.company_name && (
                            <span className="text-[10px] text-slate-400 block">
                              {p.customer.company_name}
                            </span>
                          )}
                        </Link>
                      ) : (
                        <span className="text-slate-400 italic">Client non spécifié</span>
                      )}
                    </td>

                    {/* Method */}
                    <td className="py-4 px-5">
                      <span
                        className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold border ${getMethodBadgeStyle(
                          p.payment_method
                        )}`}
                      >
                        {p.payment_method}
                      </span>
                    </td>

                    {/* Reference */}
                    <td className="py-4 px-5 text-slate-500 font-mono text-[11px]">
                      {p.reference ? (
                        <span className="px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                          {p.reference}
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>

                    {/* Notes */}
                    <td className="py-4 px-5 text-slate-500 text-[11px] max-w-xs truncate">
                      {p.notes || <span className="text-slate-400 italic">Aucun</span>}
                    </td>

                    {/* Amount */}
                    <td className="py-4 px-5 text-right font-black text-emerald-600 dark:text-emerald-400 text-sm">
                      +{formatMoney(p.amount, currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Payment Modal */}
      <PaymentModal
        isOpen={isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
        onSuccess={() => {
          fetchPaymentsAndStats();
        }}
      />
    </div>
  );
}
