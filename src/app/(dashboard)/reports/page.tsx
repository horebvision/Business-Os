'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { createClient } from '@/lib/supabase/client';
import { Invoice, Quote, Payment, Customer } from '@/lib/types';
import { formatMoney } from '@/lib/finance/money';
import {
  BarChart3,
  TrendingUp,
  Receipt,
  FileSpreadsheet,
  Users,
  Calendar,
  Filter,
  DollarSign,
  AlertCircle,
  CheckCircle2,
  Clock,
  ArrowUpRight,
  Loader2,
  Building2,
  Sparkles,
} from 'lucide-react';

type DateFilterType = 'today' | 'this_week' | 'this_month' | 'this_quarter' | 'this_year' | 'all' | 'custom';

export default function ReportsPage() {
  const { currentCompany } = useAuth();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);

  // Date Filter State
  const [dateFilter, setDateFilter] = useState<DateFilterType>('this_month');
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');

  const fetchData = async () => {
    if (!currentCompany?.id) return;
    setLoading(true);

    try {
      // 1. Fetch Invoices
      const { data: invData } = await supabase
        .from('invoices')
        .select('*, customer:customers(id, name, company_name)')
        .eq('company_id', currentCompany.id);

      // 2. Fetch Quotes
      const { data: quoteData } = await supabase
        .from('quotes')
        .select('*')
        .eq('company_id', currentCompany.id);

      // 3. Fetch Payments
      const { data: payData } = await supabase
        .from('payments')
        .select('*')
        .eq('company_id', currentCompany.id);

      // 4. Fetch Customers
      const { data: custData } = await supabase
        .from('customers')
        .select('*')
        .eq('company_id', currentCompany.id);

      setInvoices((invData as Invoice[]) || []);
      setQuotes((quoteData as Quote[]) || []);
      setPayments((payData as Payment[]) || []);
      setCustomers((custData as Customer[]) || []);
    } catch (err) {
      console.error('Erreur chargement rapports:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [currentCompany?.id]);

  const currency = currentCompany?.currency || 'FCFA';

  // Helper to test if a date string falls inside the chosen filter range
  const isDateInRange = (dateStr: string | null | undefined): boolean => {
    if (!dateStr) return false;
    if (dateFilter === 'all') return true;

    const itemDate = new Date(dateStr);
    const now = new Date();

    if (dateFilter === 'today') {
      return (
        itemDate.getFullYear() === now.getFullYear() &&
        itemDate.getMonth() === now.getMonth() &&
        itemDate.getDate() === now.getDate()
      );
    }

    if (dateFilter === 'this_week') {
      const startOfWeek = new Date(now);
      const day = startOfWeek.getDay() || 7; // Monday as 1
      startOfWeek.setDate(startOfWeek.getDate() - day + 1);
      startOfWeek.setHours(0, 0, 0, 0);
      return itemDate >= startOfWeek && itemDate <= now;
    }

    if (dateFilter === 'this_month') {
      return itemDate.getFullYear() === now.getFullYear() && itemDate.getMonth() === now.getMonth();
    }

    if (dateFilter === 'this_quarter') {
      const currentQuarter = Math.floor(now.getMonth() / 3);
      const itemQuarter = Math.floor(itemDate.getMonth() / 3);
      return itemDate.getFullYear() === now.getFullYear() && currentQuarter === itemQuarter;
    }

    if (dateFilter === 'this_year') {
      return itemDate.getFullYear() === now.getFullYear();
    }

    if (dateFilter === 'custom') {
      if (customStartDate && new Date(dateStr) < new Date(customStartDate)) return false;
      if (customEndDate && new Date(dateStr) > new Date(customEndDate + 'T23:59:59')) return false;
      return true;
    }

    return true;
  };

  // Filtered collections
  const filteredInvoices = useMemo(() => {
    return invoices.filter((i) => isDateInRange(i.issue_date || i.created_at));
  }, [invoices, dateFilter, customStartDate, customEndDate]);

  const filteredQuotes = useMemo(() => {
    return quotes.filter((q) => isDateInRange(q.issue_date || q.quote_date || q.created_at));
  }, [quotes, dateFilter, customStartDate, customEndDate]);

  const filteredPayments = useMemo(() => {
    return payments.filter((p) => isDateInRange(p.payment_date || p.created_at));
  }, [payments, dateFilter, customStartDate, customEndDate]);

  // 1. Ventes Analytics
  const salesStats = useMemo(() => {
    const validInvoices = filteredInvoices.filter((i) => i.status !== 'Annulée');
    const totalSales = validInvoices.reduce((acc, i) => acc + (Number(i.total) || 0), 0);
    const countSales = validInvoices.length;
    const averageOrderValue = countSales > 0 ? Math.round(totalSales / countSales) : 0;

    return {
      totalSales,
      countSales,
      averageOrderValue,
    };
  }, [filteredInvoices]);

  // 2. Devis Analytics
  const quotesStats = useMemo(() => {
    const sent = filteredQuotes.filter((q) => q.status !== 'Brouillon').length;
    const accepted = filteredQuotes.filter((q) => q.status === 'Accepté').length;
    const rejected = filteredQuotes.filter((q) => q.status === 'Refusé').length;
    const totalDecided = accepted + rejected;
    const acceptanceRate = totalDecided > 0 ? Math.round((accepted / totalDecided) * 100) : 0;

    return {
      sent,
      accepted,
      rejected,
      acceptanceRate,
      totalCount: filteredQuotes.length,
    };
  }, [filteredQuotes]);

  // 3. Factures Analytics
  const invoiceStats = useMemo(() => {
    const valid = filteredInvoices.filter((i) => i.status !== 'Annulée');
    const totalInvoiced = valid.reduce((acc, i) => acc + (Number(i.total) || 0), 0);
    const totalCollected = filteredPayments.reduce((acc, p) => acc + (Number(p.amount) || 0), 0);
    const totalRemaining = valid.reduce(
      (acc, i) => acc + (Number(i.remaining_amount) || Math.max(0, Number(i.total) - Number(i.paid_amount))),
      0
    );

    const todayStr = new Date().toISOString().split('T')[0];
    const overdueInvoices = valid.filter(
      (i) => i.status !== 'Payée' && (i.status === 'En retard' || (i.due_date && i.due_date < todayStr))
    );
    const totalOverdue = overdueInvoices.reduce(
      (acc, i) => acc + (Number(i.remaining_amount) || (Number(i.total) - Number(i.paid_amount))),
      0
    );

    return {
      totalInvoiced,
      totalCollected,
      totalRemaining,
      totalOverdue,
      overdueCount: overdueInvoices.length,
    };
  }, [filteredInvoices, filteredPayments]);

  // 4. Clients Analytics
  const customerStats = useMemo(() => {
    // Group invoices by customer
    const clientMap = new Map<string, { id: string; name: string; totalBought: number; totalDue: number }>();

    customers.forEach((c) => {
      clientMap.set(c.id, {
        id: c.id,
        name: c.company_name ? `${c.name} (${c.company_name})` : c.name,
        totalBought: 0,
        totalDue: 0,
      });
    });

    invoices.forEach((inv) => {
      if (inv.status === 'Annulée' || !inv.customer_id) return;
      const rec = clientMap.get(inv.customer_id);
      if (rec) {
        rec.totalBought += Number(inv.total) || 0;
        if (inv.status !== 'Payée') {
          rec.totalDue += Number(inv.remaining_amount) || (Number(inv.total) - Number(inv.paid_amount)) || 0;
        }
      }
    });

    const allClients = Array.from(clientMap.values());
    const topClients = [...allClients].sort((a, b) => b.totalBought - a.totalBought).slice(0, 5);
    const clientsWithDue = [...allClients].filter((c) => c.totalDue > 0).sort((a, b) => b.totalDue - a.totalDue).slice(0, 5);

    return {
      topClients,
      clientsWithDue,
    };
  }, [customers, invoices]);

  return (
    <div className="space-y-8">
      {/* Header & Date Filters */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-bold">
              <BarChart3 className="w-5 h-5" />
            </span>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              Rapports & Indicateurs de Performance
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Analyses des ventes, devis, facturation et créances clients en {currency}.
          </p>
        </div>

        {/* Date Filter Pills */}
        <div className="flex flex-wrap items-center gap-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-1.5 rounded-2xl shadow-sm self-start lg:self-auto text-xs font-semibold">
          <button
            onClick={() => setDateFilter('today')}
            className={`px-3 py-1.5 rounded-xl transition-all ${
              dateFilter === 'today'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Aujourd&apos;hui
          </button>

          <button
            onClick={() => setDateFilter('this_week')}
            className={`px-3 py-1.5 rounded-xl transition-all ${
              dateFilter === 'this_week'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Cette semaine
          </button>

          <button
            onClick={() => setDateFilter('this_month')}
            className={`px-3 py-1.5 rounded-xl transition-all ${
              dateFilter === 'this_month'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Ce mois
          </button>

          <button
            onClick={() => setDateFilter('this_quarter')}
            className={`px-3 py-1.5 rounded-xl transition-all ${
              dateFilter === 'this_quarter'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Ce trimestre
          </button>

          <button
            onClick={() => setDateFilter('this_year')}
            className={`px-3 py-1.5 rounded-xl transition-all ${
              dateFilter === 'this_year'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Cette année
          </button>

          <button
            onClick={() => setDateFilter('all')}
            className={`px-3 py-1.5 rounded-xl transition-all ${
              dateFilter === 'all'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Tout
          </button>

          <button
            onClick={() => setDateFilter('custom')}
            className={`px-3 py-1.5 rounded-xl transition-all ${
              dateFilter === 'custom'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Personnalisé
          </button>
        </div>
      </div>

      {/* Custom Date Inputs if selected */}
      {dateFilter === 'custom' && (
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-wrap items-center gap-4 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-slate-500 font-medium">Du :</span>
            <input
              type="date"
              value={customStartDate}
              onChange={(e) => setCustomStartDate(e.target.value)}
              className="px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-slate-500 font-medium">Au :</span>
            <input
              type="date"
              value={customEndDate}
              onChange={(e) => setCustomEndDate(e.target.value)}
              className="px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
            />
          </div>
        </div>
      )}

      {loading ? (
        <div className="p-16 text-center text-slate-400 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-indigo-500 mb-3" />
          <span className="text-xs font-medium">Calcul des indicateurs financiers...</span>
        </div>
      ) : (
        <div className="space-y-8">
          {/* SECTION 1: VENTES */}
          <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <div className="flex items-center gap-2.5 border-b border-slate-100 dark:border-slate-800 pb-3">
              <span className="p-2 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                <TrendingUp className="w-4 h-4" />
              </span>
              <div>
                <h2 className="text-sm font-extrabold uppercase tracking-wider text-slate-900 dark:text-white">
                  1. Performance des Ventes
                </h2>
                <p className="text-xs text-slate-400">Chiffre d&apos;affaires généré et panier moyen</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                <span className="text-[10px] font-bold uppercase text-slate-400 block">Chiffre d&apos;affaires facturé</span>
                <span className="text-2xl font-black text-indigo-600 dark:text-indigo-400 tracking-tight">
                  {formatMoney(salesStats.totalSales, currency)}
                </span>
                <span className="text-[11px] text-slate-500 block mt-1">Sur la période sélectionnée</span>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                <span className="text-[10px] font-bold uppercase text-slate-400 block">Nombre de ventes</span>
                <span className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                  {salesStats.countSales}
                </span>
                <span className="text-[11px] text-slate-500 block mt-1">Factures conclues</span>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                <span className="text-[10px] font-bold uppercase text-slate-400 block">Valeur moyenne (Panier)</span>
                <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400 tracking-tight">
                  {formatMoney(salesStats.averageOrderValue, currency)}
                </span>
                <span className="text-[11px] text-slate-500 block mt-1">Par facture conclue</span>
              </div>
            </div>
          </div>

          {/* SECTION 2: DEVIS */}
          <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <div className="flex items-center gap-2.5 border-b border-slate-100 dark:border-slate-800 pb-3">
              <span className="p-2 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
                <FileSpreadsheet className="w-4 h-4" />
              </span>
              <div>
                <h2 className="text-sm font-extrabold uppercase tracking-wider text-slate-900 dark:text-white">
                  2. Pipeline & Transformation Devis
                </h2>
                <p className="text-xs text-slate-400">Taux de conversion et réponse commerciale</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 pt-2">
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                <span className="text-[10px] font-bold uppercase text-slate-400 block">Devis envoyés</span>
                <span className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                  {quotesStats.sent}
                </span>
                <span className="text-[11px] text-slate-500 block mt-1">Propositions soumises</span>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                <span className="text-[10px] font-bold uppercase text-emerald-500 block">Devis acceptés</span>
                <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400 tracking-tight">
                  {quotesStats.accepted}
                </span>
                <span className="text-[11px] text-emerald-600/80 block mt-1">Prêts pour facturation</span>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                <span className="text-[10px] font-bold uppercase text-rose-500 block">Devis refusés</span>
                <span className="text-2xl font-black text-rose-600 dark:text-rose-400 tracking-tight">
                  {quotesStats.rejected}
                </span>
                <span className="text-[11px] text-rose-500/80 block mt-1">Rejetés ou annulés</span>
              </div>

              <div className="p-4 rounded-2xl bg-blue-500/10 border border-blue-500/20">
                <span className="text-[10px] font-bold uppercase text-blue-600 dark:text-blue-400 block">
                  Taux d&apos;acceptation
                </span>
                <span className="text-2xl font-black text-blue-600 dark:text-blue-400 tracking-tight">
                  {quotesStats.acceptanceRate}%
                </span>
                <span className="text-[11px] text-blue-500 block mt-1">Acceptés / Décidés</span>
              </div>
            </div>
          </div>

          {/* SECTION 3: FACTURES & TRÉSORERIE */}
          <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <div className="flex items-center gap-2.5 border-b border-slate-100 dark:border-slate-800 pb-3">
              <span className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <Receipt className="w-4 h-4" />
              </span>
              <div>
                <h2 className="text-sm font-extrabold uppercase tracking-wider text-slate-900 dark:text-white">
                  3. Facturation & Encaissements
                </h2>
                <p className="text-xs text-slate-400">Flux d&apos;argent, recouvrement et créances échues</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 pt-2">
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                <span className="text-[10px] font-bold uppercase text-slate-400 block">Total Facturé</span>
                <span className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
                  {formatMoney(invoiceStats.totalInvoiced, currency)}
                </span>
                <span className="text-[11px] text-slate-500 block mt-1">Factures valides</span>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                <span className="text-[10px] font-bold uppercase text-emerald-500 block">Total Encaissé</span>
                <span className="text-xl font-black text-emerald-600 dark:text-emerald-400 tracking-tight">
                  {formatMoney(invoiceStats.totalCollected, currency)}
                </span>
                <span className="text-[11px] text-emerald-600/80 block mt-1">Paiements validés</span>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                <span className="text-[10px] font-bold uppercase text-amber-500 block">Reste à percevoir</span>
                <span className="text-xl font-black text-amber-600 dark:text-amber-400 tracking-tight">
                  {formatMoney(invoiceStats.totalRemaining, currency)}
                </span>
                <span className="text-[11px] text-amber-500 block mt-1">Solde à recouvrer</span>
              </div>

              <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20">
                <span className="text-[10px] font-bold uppercase text-rose-600 dark:text-rose-400 block">
                  En retard ({invoiceStats.overdueCount})
                </span>
                <span className="text-xl font-black text-rose-600 dark:text-rose-400 tracking-tight">
                  {formatMoney(invoiceStats.totalOverdue, currency)}
                </span>
                <span className="text-[11px] text-rose-500 block mt-1">Échéance dépassée</span>
              </div>
            </div>
          </div>

          {/* SECTION 4: CLIENTS */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Top Clients by Revenue */}
            <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
              <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
                <Users className="w-4 h-4 text-indigo-500" />
                <h3 className="text-sm font-extrabold uppercase tracking-wider text-slate-900 dark:text-white">
                  Meilleurs Clients (par Volume d&apos;affaires)
                </h3>
              </div>

              {customerStats.topClients.length === 0 ? (
                <p className="text-xs text-slate-400 italic py-4">Aucune donnée client disponible.</p>
              ) : (
                <div className="space-y-3">
                  {customerStats.topClients.map((c, idx) => (
                    <div
                      key={c.id}
                      className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center gap-3">
                        <span className="w-6 h-6 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-bold flex items-center justify-center text-[10px]">
                          #{idx + 1}
                        </span>
                        <Link
                          href={`/customers/${c.id}`}
                          className="font-bold text-slate-900 dark:text-white hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors truncate max-w-[200px]"
                        >
                          {c.name}
                        </Link>
                      </div>
                      <span className="font-extrabold text-indigo-600 dark:text-indigo-400">
                        {formatMoney(c.totalBought, currency)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Clients with Receivables */}
            <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
              <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
                <Clock className="w-4 h-4 text-amber-500" />
                <h3 className="text-sm font-extrabold uppercase tracking-wider text-slate-900 dark:text-white">
                  Clients avec Créances en Cours
                </h3>
              </div>

              {customerStats.clientsWithDue.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-400">
                  <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                  <span>Aucun client débiteur actuellement.</span>
                </div>
              ) : (
                <div className="space-y-3">
                  {customerStats.clientsWithDue.map((c, idx) => (
                    <div
                      key={c.id}
                      className="p-3.5 rounded-2xl bg-amber-500/5 border border-amber-500/20 flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center gap-3">
                        <span className="w-6 h-6 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 font-bold flex items-center justify-center text-[10px]">
                          #{idx + 1}
                        </span>
                        <Link
                          href={`/customers/${c.id}`}
                          className="font-bold text-slate-900 dark:text-white hover:text-amber-600 dark:hover:text-amber-400 transition-colors truncate max-w-[200px]"
                        >
                          {c.name}
                        </Link>
                      </div>
                      <span className="font-black text-amber-600 dark:text-amber-400">
                        {formatMoney(c.totalDue, currency)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
