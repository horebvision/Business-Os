'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '@/context/AuthContext';
import { createClient } from '@/lib/supabase/client';
import StatCard from '@/components/dashboard/StatCard';
import RecommendedActions from '@/components/dashboard/RecommendedActions';
import RecentActivity from '@/components/dashboard/RecentActivity';
import QuickActionModal from '@/components/layout/QuickActionModal';
import FinancialCharts, { MonthlyFinancialData } from '@/components/finance/FinancialCharts';
import AssistantActionCenter from '@/components/dashboard/AssistantActionCenter';
import { computeActionCenterItems, computeDailyBriefing, computeWeeklyBriefing } from '@/lib/assistant/priorityEngine';
import { formatMoney } from '@/lib/finance/money';
import { 
  Activity, 
  Invoice, 
  Lead, 
  Quote, 
  Task,
  Payment,
  Customer,
  RecommendedAction
} from '@/lib/types';
import { 
  DollarSign, 
  AlertCircle, 
  FileSpreadsheet, 
  UserPlus, 
  CheckSquare, 
  Plus, 
  Sparkles, 
  RotateCw, 
  Users, 
  Receipt, 
  Loader2,
  CheckCircle2,
  TrendingUp,
  Wallet,
  Clock,
  ArrowUpRight,
  BellRing
} from 'lucide-react';
import Link from 'next/link';

export default function DashboardPage() {
  const { currentCompany, user, profile } = useAuth();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [seedingDemo, setSeedingDemo] = useState(false);
  const [demoLoadedSuccess, setDemoLoadedSuccess] = useState(false);
  const [quickActionModalOpen, setQuickActionModalOpen] = useState(false);

  // Raw entities for computing exact real metrics
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [activities, setRecentActivities] = useState<Activity[]>([]);
  const [hasEntities, setHasEntities] = useState(false);

  const loadDashboardData = useCallback(async () => {
    if (!currentCompany?.id) return;
    setLoading(true);

    try {
      // 1. Fetch Invoices
      const { data: invData } = await supabase
        .from('invoices')
        .select('*')
        .eq('company_id', currentCompany.id)
        .order('issue_date', { ascending: false });

      // 2. Fetch Payments
      const { data: payData } = await supabase
        .from('payments')
        .select('*')
        .eq('company_id', currentCompany.id)
        .order('payment_date', { ascending: false });

      // 3. Fetch Quotes
      const { data: quoteData } = await supabase
        .from('quotes')
        .select('*')
        .eq('company_id', currentCompany.id);

      // 4. Fetch Leads
      const { data: leadData } = await supabase
        .from('leads')
        .select('*')
        .eq('company_id', currentCompany.id);

      // 5. Fetch Customers
      const { data: custData } = await supabase
        .from('customers')
        .select('*')
        .eq('company_id', currentCompany.id);

      // 6. Fetch Tasks
      const { data: taskData } = await supabase
        .from('tasks')
        .select('*')
        .eq('company_id', currentCompany.id);

      // 7. Fetch Activities
      const { data: actData } = await supabase
        .from('activities')
        .select('*')
        .eq('company_id', currentCompany.id)
        .order('created_at', { ascending: false })
        .limit(8);

      const invList = (invData as Invoice[]) || [];
      const payList = (payData as Payment[]) || [];
      const quoteList = (quoteData as Quote[]) || [];
      const leadList = (leadData as Lead[]) || [];
      const custList = (custData as Customer[]) || [];
      const taskList = (taskData as Task[]) || [];
      const actList = (actData as Activity[]) || [];

      setInvoices(invList);
      setPayments(payList);
      setQuotes(quoteList);
      setLeads(leadList);
      setCustomers(custList);
      setTasks(taskList);
      setRecentActivities(actList);

      setHasEntities(
        invList.length > 0 ||
        payList.length > 0 ||
        quoteList.length > 0 ||
        leadList.length > 0 ||
        custList.length > 0 ||
        taskList.length > 0
      );
    } catch (err) {
      console.error('Error loading dashboard data:', err);
    } finally {
      setLoading(false);
    }
  }, [currentCompany?.id, supabase]);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  const currency = currentCompany?.currency || 'FCFA';

  // Compute 6 Real Financial KPIs
  const financialStats = useMemo(() => {
    // 1. Chiffre d'affaires facturé (Total invoices excluding cancelled)
    const activeInvoices = invoices.filter((i) => i.status !== 'Annulée');
    const totalInvoiced = activeInvoices.reduce((acc, i) => acc + (Number(i.total) || 0), 0);

    // 2. Montant total encaissé (from payments table)
    const totalCollected = payments.reduce((acc, p) => acc + (Number(p.amount) || 0), 0);

    // 3. Créances restantes (unpaid balance on active invoices)
    const unpaidInvoices = activeInvoices.filter((i) => i.status !== 'Payée');
    const totalReceivables = unpaidInvoices.reduce(
      (acc, i) => acc + (Number(i.remaining_amount) || Math.max(0, Number(i.total) - Number(i.paid_amount))),
      0
    );

    // 4. Factures en retard
    const todayStr = new Date().toISOString().split('T')[0];
    const overdueInvoices = unpaidInvoices.filter(
      (i) => (i.status === 'En retard' || (i.due_date && i.due_date < todayStr))
    );
    const overdueAmount = overdueInvoices.reduce(
      (acc, i) => acc + (Number(i.remaining_amount) || (Number(i.total) - Number(i.paid_amount))),
      0
    );

    // 5. Devis en attente
    const pendingQuotes = quotes.filter(
      (q) => q.status === 'Envoyé' || q.status === 'Consulté' || q.status === 'Brouillon'
    );
    const pendingQuotesAmount = pendingQuotes.reduce((acc, q) => acc + (Number(q.total) || 0), 0);

    // 6. Taux de conversion devis → ventes
    const acceptedQuotes = quotes.filter((q) => q.status === 'Accepté');
    const decidedQuotes = quotes.filter((q) => q.status === 'Accepté' || q.status === 'Refusé');
    const quoteConversionRate =
      decidedQuotes.length > 0
        ? Math.round((acceptedQuotes.length / decidedQuotes.length) * 100)
        : quotes.length > 0
        ? Math.round((acceptedQuotes.length / quotes.length) * 100)
        : 0;

    return {
      totalInvoiced,
      totalCollected,
      totalReceivables,
      unpaidCount: unpaidInvoices.length,
      overdueCount: overdueInvoices.length,
      overdueAmount,
      pendingQuotesCount: pendingQuotes.length,
      pendingQuotesAmount,
      quoteConversionRate,
      acceptedQuotesCount: acceptedQuotes.length,
    };
  }, [invoices, payments, quotes]);

  // Generate 6 Months Data for Financial Chart
  const monthlyChartData = useMemo<MonthlyFinancialData[]>(() => {
    const result: MonthlyFinancialData[] = [];
    const now = new Date();

    const monthNames = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sept', 'Oct', 'Nov', 'Déc'];

    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const year = d.getFullYear();
      const month = d.getMonth();
      const monthKey = `${year}-${String(month + 1).padStart(2, '0')}`;
      const monthLabel = `${monthNames[month]} ${String(year).slice(-2)}`;

      // Invoiced in this month
      const invoicedInMonth = invoices
        .filter((inv) => {
          if (!inv.issue_date || inv.status === 'Annulée') return false;
          const invD = new Date(inv.issue_date);
          return invD.getFullYear() === year && invD.getMonth() === month;
        })
        .reduce((sum, inv) => sum + (Number(inv.total) || 0), 0);

      // Collected in this month
      const collectedInMonth = payments
        .filter((p) => {
          if (!p.payment_date) return false;
          const pD = new Date(p.payment_date);
          return pD.getFullYear() === year && pD.getMonth() === month;
        })
        .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

      result.push({
        monthKey,
        monthLabel,
        invoicedAmount: invoicedInMonth,
        collectedAmount: collectedInMonth,
      });
    }

    return result;
  }, [invoices, payments]);

  // Phase 4: Action Center Items & Daily Briefing
  const actionCenterItems = useMemo(() => {
    return computeActionCenterItems(invoices, leads, quotes, tasks, currency);
  }, [invoices, leads, quotes, tasks, currency]);

  const dailyBriefing = useMemo(() => {
    return computeDailyBriefing(actionCenterItems, invoices, leads, tasks, quotes, currency);
  }, [actionCenterItems, invoices, leads, tasks, quotes, currency]);

  const weeklyBriefing = useMemo(() => {
    return computeWeeklyBriefing(invoices, payments, quotes, leads, customers, tasks, currency);
  }, [invoices, payments, quotes, leads, customers, tasks, currency]);

  // Recommended Actions
  const recommendedActions = useMemo<RecommendedAction[]>(() => {
    const recs: RecommendedAction[] = [];
    const todayStr = new Date().toISOString().split('T')[0];

    const overdueList = invoices.filter(
      (i) => (i.status === 'En retard' || (i.due_date && i.due_date < todayStr)) && i.status !== 'Payée' && i.status !== 'Annulée'
    );

    if (overdueList.length > 0) {
      recs.push({
        id: 'rec_overdue_inv',
        type: 'danger',
        icon: '🔴',
        message: `${overdueList.length} facture${overdueList.length > 1 ? 's doivent' : ' doit'} être relancée${overdueList.length > 1 ? 's' : ''}`,
        count: overdueList.length,
        link: '/reminders',
        actionLabel: 'Relancer avec IA',
      });
    }

    const pendingQuotesList = quotes.filter(
      (q) => q.status === 'Envoyé' || q.status === 'Consulté'
    );
    if (pendingQuotesList.length > 0) {
      recs.push({
        id: 'rec_pending_quotes',
        type: 'info',
        icon: '🔵',
        message: `${pendingQuotesList.length} devis envoyé${pendingQuotesList.length > 1 ? 's attendent' : ' attend'} validation`,
        count: pendingQuotesList.length,
        link: '/quotes',
        actionLabel: 'Suivre les devis',
      });
    }

    const tasksDue = tasks.filter(
      (t) => t.status !== 'Terminée' && (!t.due_date || t.due_date <= todayStr)
    );
    if (tasksDue.length > 0) {
      recs.push({
        id: 'rec_tasks_today',
        type: 'success',
        icon: '🟢',
        message: `${tasksDue.length} tâche${tasksDue.length > 1 ? 's sont' : ' est'} à traiter`,
        count: tasksDue.length,
        link: '/tasks',
        actionLabel: 'Voir les tâches',
      });
    }

    return recs;
  }, [invoices, quotes, tasks]);

  const handleSeedDemoData = async () => {
    if (!currentCompany?.id) return;
    setSeedingDemo(true);
    setDemoLoadedSuccess(false);

    try {
      const res = await fetch('/api/demo-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId: currentCompany.id }),
      });

      const json = await res.json();
      if (json.success) {
        setDemoLoadedSuccess(true);
        await loadDashboardData();
      } else {
        alert(json.error || 'Erreur lors du chargement des données de démonstration.');
      }
    } catch (err: any) {
      alert(err.message || 'Erreur réseau');
    } finally {
      setSeedingDemo(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Top Banner & Quick Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Tableau de bord BusinessOS
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Pilotage financier, cycle devis-factures et gestion de trésorerie en temps réel.
          </p>
        </div>

        {/* Quick Action Navigation */}
        <div className="flex items-center flex-wrap gap-2">
          <Link
            href="/quotes/new"
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-semibold shadow-sm transition-all"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-blue-500" />
            <span>+ Devis</span>
          </Link>

          <Link
            href="/invoices/new"
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-semibold shadow-sm transition-all"
          >
            <Receipt className="w-3.5 h-3.5 text-indigo-500" />
            <span>+ Facture</span>
          </Link>

          <Link
            href="/payments"
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-semibold shadow-sm transition-all"
          >
            <Wallet className="w-3.5 h-3.5 text-emerald-500" />
            <span>Paiements</span>
          </Link>

          <Link
            href="/reminders"
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 text-rose-600 dark:text-rose-400 rounded-xl text-xs font-semibold transition-all"
          >
            <BellRing className="w-3.5 h-3.5" />
            <span>Relances IA</span>
          </Link>

          <button
            onClick={() => setQuickActionModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold shadow-md shadow-indigo-600/20 transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Créer rapide</span>
          </button>
        </div>
      </div>

      {/* Demo Data Onboarding Box */}
      {!hasEntities && !loading && (
        <div className="p-6 rounded-3xl bg-gradient-to-r from-indigo-950/40 via-slate-900 to-blue-950/40 border border-indigo-500/30 shadow-lg relative overflow-hidden">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 relative z-10">
            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">
                  Bienvenue dans l&apos;espace {currentCompany?.name} !
                </h3>
                <p className="text-xs text-slate-300 mt-1 max-w-xl leading-relaxed">
                  Votre environnement est prêt. Vous pouvez charger le jeu de données démo complet Phase 3 (devis, factures, encaissements partiels, relances en FCFA) pour tester immédiatement le cycle commercial.
                </p>
              </div>
            </div>

            <button
              onClick={handleSeedDemoData}
              disabled={seedingDemo}
              className="flex-shrink-0 inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-semibold rounded-xl shadow-lg shadow-indigo-600/30 transition-all hover:scale-[1.02]"
            >
              {seedingDemo ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Génération des données...</span>
                </>
              ) : (
                <>
                  <RotateCw className="w-4 h-4" />
                  <span>Charger les données de démo Phase 3</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {demoLoadedSuccess && (
        <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
          <span>Données financières et commerciales de démonstration chargées avec succès !</span>
        </div>
      )}

      {/* 6 Real Financial KPIs Grid (Section 32) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {/* 1. Chiffre d'affaires facturé */}
        <StatCard
          title="CA Facturé"
          value={formatMoney(financialStats.totalInvoiced, currency)}
          subtitle="Factures émises"
          icon={Receipt}
          color="indigo"
        />

        {/* 2. Montant encaissé */}
        <StatCard
          title="Montant Encaissé"
          value={formatMoney(financialStats.totalCollected, currency)}
          subtitle="Règlements reçus"
          icon={TrendingUp}
          color="emerald"
        />

        {/* 3. Créances */}
        <StatCard
          title="Créances Clients"
          value={formatMoney(financialStats.totalReceivables, currency)}
          subtitle={`${financialStats.unpaidCount} facture(s) en attente`}
          icon={Wallet}
          color={financialStats.totalReceivables > 0 ? 'amber' : 'emerald'}
        />

        {/* 4. Factures en retard */}
        <StatCard
          title="Factures en retard"
          value={financialStats.overdueCount}
          subtitle={formatMoney(financialStats.overdueAmount, currency)}
          icon={AlertCircle}
          color={financialStats.overdueCount > 0 ? 'rose' : 'emerald'}
        />

        {/* 5. Devis en attente */}
        <StatCard
          title="Devis en attente"
          value={financialStats.pendingQuotesCount}
          subtitle={formatMoney(financialStats.pendingQuotesAmount, currency)}
          icon={FileSpreadsheet}
          color="blue"
        />

        {/* 6. Taux de conversion devis -> ventes */}
        <StatCard
          title="Conversion Devis"
          value={`${financialStats.quoteConversionRate}%`}
          subtitle={`${financialStats.acceptedQuotesCount} devis acceptés`}
          icon={Sparkles}
          color="blue"
        />
      </div>

      {/* Assistant Briefing & Action Center (Phase 4) */}
      <AssistantActionCenter
        items={actionCenterItems}
        briefing={dailyBriefing}
        weeklyBriefing={weeklyBriefing}
        currency={currency}
        loading={loading}
      />

      {/* Monthly Financial Charts (Section 32) */}
      <FinancialCharts monthlyData={monthlyChartData} currency={currency} />

      {/* Main Two Columns: Recommended Actions & Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-7 space-y-6">
          <RecommendedActions actions={recommendedActions} loading={loading} />
        </div>

        <div className="lg:col-span-5 space-y-6">
          <RecentActivity activities={activities} loading={loading} />
        </div>
      </div>

      {/* Quick Action Modal */}
      <QuickActionModal
        isOpen={quickActionModalOpen}
        onClose={() => setQuickActionModalOpen(false)}
        onSuccess={loadDashboardData}
      />
    </div>
  );
}
