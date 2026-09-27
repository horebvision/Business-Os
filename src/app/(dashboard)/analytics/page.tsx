'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/context/AuthContext';
import { createClient } from '@/lib/supabase/client';
import { Invoice, Payment, Quote, Lead, Customer, Task, Activity } from '@/lib/types';
import { formatMoney, getDaysOverdue } from '@/lib/finance/money';
import {
  TrendingUp,
  BarChart3,
  Calendar,
  Users,
  Receipt,
  FileSpreadsheet,
  CheckSquare,
  DollarSign,
  ArrowUpRight,
  ArrowDownRight,
  PieChart,
  ShieldCheck,
  Download,
  Filter,
  Sparkles,
  Loader2,
} from 'lucide-react';

type TimeRange = '7d' | '30d' | '90d' | 'this_year' | 'last_year';

export default function AnalyticsPage() {
  const { currentCompany } = useAuth();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<TimeRange>('30d');
  const [activeTab, setActiveTab] = useState<'overview' | 'commercial' | 'finance' | 'clients'>('overview');

  // Entities loaded from Supabase
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);

  const currency = currentCompany?.currency || 'FCFA';

  useEffect(() => {
    async function loadData() {
      if (!currentCompany?.id) return;
      setLoading(true);

      try {
        const [
          { data: invData },
          { data: payData },
          { data: quoteData },
          { data: leadData },
          { data: custData },
          { data: taskData },
          { data: actData },
        ] = await Promise.all([
          supabase.from('invoices').select('*').eq('company_id', currentCompany.id),
          supabase.from('payments').select('*').eq('company_id', currentCompany.id),
          supabase.from('quotes').select('*').eq('company_id', currentCompany.id),
          supabase.from('leads').select('*').eq('company_id', currentCompany.id),
          supabase.from('customers').select('*').eq('company_id', currentCompany.id),
          supabase.from('tasks').select('*').eq('company_id', currentCompany.id),
          supabase.from('activities').select('*').eq('company_id', currentCompany.id),
        ]);

        setInvoices((invData as Invoice[]) || []);
        setPayments((payData as Payment[]) || []);
        setQuotes((quoteData as Quote[]) || []);
        setLeads((leadData as Lead[]) || []);
        setCustomers((custData as Customer[]) || []);
        setTasks((taskData as Task[]) || []);
        setActivities((actData as Activity[]) || []);
      } catch (err) {
        console.error('Erreur chargement analytics:', err);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [currentCompany?.id]);

  // Compute filter start date
  const filterStartDate = useMemo(() => {
    const now = new Date();
    if (range === '7d') {
      const d = new Date(now);
      d.setDate(d.getDate() - 7);
      return d;
    }
    if (range === '30d') {
      const d = new Date(now);
      d.setDate(d.getDate() - 30);
      return d;
    }
    if (range === '90d') {
      const d = new Date(now);
      d.setDate(d.getDate() - 90);
      return d;
    }
    if (range === 'this_year') {
      return new Date(now.getFullYear(), 0, 1);
    }
    if (range === 'last_year') {
      return new Date(now.getFullYear() - 1, 0, 1);
    }
    return new Date(now.getTime() - 30 * 86400000);
  }, [range]);

  // Filtered dataset
  const filteredData = useMemo(() => {
    const startIso = filterStartDate.toISOString();

    const filteredInvoices = invoices.filter((i) => i.created_at >= startIso && i.status !== 'Annulée');
    const filteredPayments = payments.filter((p) => p.created_at >= startIso || (p.payment_date && p.payment_date >= startIso.split('T')[0]));
    const filteredQuotes = quotes.filter((q) => q.created_at >= startIso);
    const filteredLeads = leads.filter((l) => l.created_at >= startIso);
    const filteredCustomers = customers.filter((c) => c.created_at >= startIso);
    const filteredTasks = tasks.filter((t) => t.created_at >= startIso);

    // Commercial metrics
    const totalPipelineValue = leads.reduce((sum, l) => sum + (Number(l.potential_amount) || 0), 0);
    const wonLeads = leads.filter((l) => l.status === 'Gagné');
    const leadConversionRate = leads.length > 0 ? Math.round((wonLeads.length / leads.length) * 100) : 0;

    const acceptedQuotes = filteredQuotes.filter((q) => q.status === 'Accepté');
    const quoteAcceptanceRate = filteredQuotes.length > 0 ? Math.round((acceptedQuotes.length / filteredQuotes.length) * 100) : 0;

    // Financial metrics
    const totalInvoiced = filteredInvoices.reduce((sum, i) => sum + (Number(i.total) || 0), 0);
    const totalCollected = filteredPayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
    const unpaidInvoices = invoices.filter((i) => i.status !== 'Payée' && i.status !== 'Annulée');
    const totalReceivables = unpaidInvoices.reduce((sum, i) => sum + (Number(i.remaining_amount) || Number(i.total) || 0), 0);
    const overdueInvoices = unpaidInvoices.filter((i) => i.due_date && getDaysOverdue(i.due_date) > 0);
    const totalOverdue = overdueInvoices.reduce((sum, i) => sum + (Number(i.remaining_amount) || Number(i.total) || 0), 0);

    // Customer metrics
    const avgCustomerValue = customers.length > 0 ? Math.round(totalInvoiced / customers.length) : 0;
    const completedTasks = tasks.filter((t) => t.status === 'Terminée');

    return {
      filteredInvoices,
      filteredPayments,
      filteredQuotes,
      filteredLeads,
      filteredCustomers,
      filteredTasks,
      totalPipelineValue,
      leadConversionRate,
      quoteAcceptanceRate,
      totalInvoiced,
      totalCollected,
      totalReceivables,
      totalOverdue,
      overdueCount: overdueInvoices.length,
      avgCustomerValue,
      completedTasksCount: completedTasks.length,
    };
  }, [filterStartDate, invoices, payments, quotes, leads, customers, tasks]);

  // Export CSV Helper
  const handleExportCSV = () => {
    const headers = ['Type', 'Numero_Ref', 'Date', 'Client', 'Montant', 'Statut'];
    const rows: string[][] = [];

    filteredData.filteredInvoices.forEach((i) => {
      rows.push(['Facture', i.invoice_number, i.issue_date || i.created_at, (i as any).customer?.name || '', String(i.total), i.status]);
    });
    filteredData.filteredQuotes.forEach((q) => {
      rows.push(['Devis', q.quote_number, q.issue_date || q.created_at, (q as any).customer?.name || '', String(q.total), q.status]);
    });
    filteredData.filteredPayments.forEach((p) => {
      rows.push(['Paiement', p.reference || p.id, p.payment_date, '', String(p.amount), 'Validé']);
    });

    const csvContent = [headers.join(';'), ...rows.map((r) => r.map((c) => `"${c}"`).join(';'))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `BusinessOS_Analytics_${range}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-16">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-12">
      {/* Top Header & Range Filters */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs text-slate-400 font-medium">Pilotage Dirigeant</span>
            <span className="text-slate-300 dark:text-slate-700">/</span>
            <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400">Analytics</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Tableau de Bord Dirigeant
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Indicateurs de performance réels, santé commerciale, trésorerie et efficience opérationnelle.
          </p>
        </div>

        {/* Filter Toolbar */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="bg-slate-100 dark:bg-slate-800 p-1 rounded-2xl flex items-center gap-1 text-xs font-semibold">
            {[
              { id: '7d', label: '7 jours' },
              { id: '30d', label: '30 jours' },
              { id: '90d', label: '90 jours' },
              { id: 'this_year', label: 'Cette année' },
              { id: 'last_year', label: 'Année préc.' },
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => setRange(t.id as TimeRange)}
                className={`px-3 py-1.5 rounded-xl transition-all ${
                  range === t.id
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm font-bold'
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <button
            onClick={handleExportCSV}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-slate-300 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold shadow-sm transition-all"
          >
            <Download className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* 4 Executive KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              CA Facturé sur période
            </span>
            <div className="w-8 h-8 rounded-xl bg-indigo-500/10 text-indigo-600 flex items-center justify-center">
              <Receipt className="w-4 h-4" />
            </div>
          </div>
          <span className="text-2xl font-black text-slate-900 dark:text-white block">
            {formatMoney(filteredData.totalInvoiced, currency)}
          </span>
          <span className="text-[11px] text-slate-500 block">
            {filteredData.filteredInvoices.length} facture(s) émise(s)
          </span>
        </div>

        <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
              Encaissements Réels
            </span>
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400 block">
            {formatMoney(filteredData.totalCollected, currency)}
          </span>
          <span className="text-[11px] text-slate-500 block">
            {filteredData.filteredPayments.length} règlement(s) enregistré(s)
          </span>
        </div>

        <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-500">
              Valeur du Pipeline
            </span>
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <span className="text-2xl font-black text-slate-900 dark:text-white block">
            {formatMoney(filteredData.totalPipelineValue, currency)}
          </span>
          <span className="text-[11px] text-slate-500 block">
            {leads.length} opportunité(s) active(s)
          </span>
        </div>

        <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-rose-500">
              Créances en Retard
            </span>
            <div className="w-8 h-8 rounded-xl bg-rose-500/10 text-rose-500 flex items-center justify-center">
              <ArrowDownRight className="w-4 h-4" />
            </div>
          </div>
          <span className="text-2xl font-black text-rose-600 dark:text-rose-400 block">
            {formatMoney(filteredData.totalOverdue, currency)}
          </span>
          <span className="text-[11px] text-slate-500 block">
            {filteredData.overdueCount} facture(s) en souffrance
          </span>
        </div>
      </div>

      {/* Tabs Bar */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-px overflow-x-auto">
        {[
          { id: 'overview', label: 'Synthèse Exécutive', icon: Sparkles },
          { id: 'commercial', label: 'Performance Commerciale & Pipeline', icon: Users },
          { id: 'finance', label: 'Finances & Trésorerie', icon: Receipt },
          { id: 'clients', label: 'Portefeuille Clients & Activité', icon: BarChart3 },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-3 text-xs font-semibold border-b-2 transition-all whitespace-nowrap ${
                isActive
                  ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 font-bold'
                  : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab 1: Synthèse Exécutive */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
              Taux de Conversion & Efficacité
            </h3>
            <div className="space-y-4 pt-2">
              <div>
                <div className="flex items-center justify-between text-xs mb-1.5 font-bold">
                  <span>Acceptation des devis</span>
                  <span className="text-indigo-600 dark:text-indigo-400">{filteredData.quoteAcceptanceRate}%</span>
                </div>
                <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                  <div className="h-full rounded-full bg-indigo-600" style={{ width: `${filteredData.quoteAcceptanceRate}%` }} />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between text-xs mb-1.5 font-bold">
                  <span>Conversion des prospects en clients</span>
                  <span className="text-emerald-500">{filteredData.leadConversionRate}%</span>
                </div>
                <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                  <div className="h-full rounded-full bg-emerald-500" style={{ width: `${filteredData.leadConversionRate}%` }} />
                </div>
              </div>
            </div>
          </div>

          <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
              Activité de l&apos;Entreprise sur la Période
            </h3>
            <div className="grid grid-cols-2 gap-3 pt-2">
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Nouveaux contacts</span>
                <span className="text-xl font-black text-slate-900 dark:text-white mt-1 block">
                  {filteredData.filteredLeads.length + filteredData.filteredCustomers.length}
                </span>
              </div>
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Devis transmis</span>
                <span className="text-xl font-black text-slate-900 dark:text-white mt-1 block">
                  {filteredData.filteredQuotes.length}
                </span>
              </div>
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Tâches exécutées</span>
                <span className="text-xl font-black text-slate-900 dark:text-white mt-1 block">
                  {filteredData.completedTasksCount}
                </span>
              </div>
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Actions enregistrées</span>
                <span className="text-xl font-black text-slate-900 dark:text-white mt-1 block">
                  {activities.length}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Performance Commerciale */}
      {activeTab === 'commercial' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <span className="text-xs uppercase font-bold text-slate-400 block">Prospects générés</span>
            <span className="text-3xl font-black text-slate-900 dark:text-white block">
              {filteredData.filteredLeads.length}
            </span>
            <p className="text-xs text-slate-500">
              Sur les <strong>{leads.length}</strong> prospects totaux de votre CRM.
            </p>
          </div>

          <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <span className="text-xs uppercase font-bold text-slate-400 block">Devis acceptés</span>
            <span className="text-3xl font-black text-emerald-500 block">
              {filteredData.filteredQuotes.filter((q) => q.status === 'Accepté').length}
            </span>
            <p className="text-xs text-slate-500">
              Taux d&apos;acceptation de <strong>{filteredData.quoteAcceptanceRate}%</strong> sur la période sélectionnée.
            </p>
          </div>

          <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <span className="text-xs uppercase font-bold text-slate-400 block">Encaissement moyen par client</span>
            <span className="text-3xl font-black text-indigo-600 dark:text-indigo-400 block">
              {formatMoney(filteredData.avgCustomerValue, currency)}
            </span>
            <p className="text-xs text-slate-500">
              Calculé sur vos <strong>{customers.length}</strong> clients actifs.
            </p>
          </div>
        </div>
      )}

      {/* Tab 3: Finance */}
      {activeTab === 'finance' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
              Créances & Retards de Paiement
            </h3>
            <div className="space-y-3 pt-2">
              <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/30 flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-rose-700 dark:text-rose-400 block">
                    Factures échues dépassées
                  </span>
                  <span className="text-[11px] text-rose-600/80">
                    {filteredData.overdueCount} dossier(s) nécessitant une relance
                  </span>
                </div>
                <span className="text-lg font-black text-rose-600 dark:text-rose-400">
                  {formatMoney(filteredData.totalOverdue, currency)}
                </span>
              </div>

              <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/30 flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-amber-700 dark:text-amber-400 block">
                    Total des créances non soldées
                  </span>
                  <span className="text-[11px] text-amber-600/80">En attente de règlement</span>
                </div>
                <span className="text-lg font-black text-amber-700 dark:text-amber-400">
                  {formatMoney(filteredData.totalReceivables, currency)}
                </span>
              </div>
            </div>
          </div>

          <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
              Historique des Encaissements Réels
            </h3>
            {filteredData.filteredPayments.length === 0 ? (
              <p className="text-xs text-slate-400 py-6 text-center">Aucun encaissement sur cette période.</p>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {filteredData.filteredPayments.slice(0, 5).map((p) => (
                  <div
                    key={p.id}
                    className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs"
                  >
                    <div>
                      <span className="font-bold text-slate-900 dark:text-white block">
                        {p.payment_method || 'Règlement'}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {p.payment_date || new Date(p.created_at).toLocaleDateString('fr-FR')}
                      </span>
                    </div>
                    <span className="font-black text-emerald-600 dark:text-emerald-400">
                      +{formatMoney(p.amount, currency)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 4: Clients */}
      {activeTab === 'clients' && (
        <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
            Portefeuille Clients ({customers.length})
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {customers.map((c) => (
              <div
                key={c.id}
                className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 space-y-2"
              >
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-xs text-slate-900 dark:text-white truncate">
                    {c.name}
                  </h4>
                  <span className="text-[10px] font-semibold text-slate-400">
                    {c.company_name || 'Particulier'}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[11px] pt-1 border-t border-slate-200/60 dark:border-slate-700/60">
                  <span className="text-slate-500">Facturé :</span>
                  <span className="font-bold text-slate-900 dark:text-white">
                    {formatMoney(c.total_invoiced || 0, currency)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
