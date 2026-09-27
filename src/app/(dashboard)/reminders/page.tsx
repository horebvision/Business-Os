'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { createClient } from '@/lib/supabase/client';
import { Invoice, Reminder } from '@/lib/types';
import { formatMoney, getDaysOverdue } from '@/lib/finance/money';
import ReminderModal from '@/components/finance/ReminderModal';
import {
  BellRing,
  AlertTriangle,
  Clock,
  Sparkles,
  Send,
  MessageSquare,
  CheckCircle2,
  Calendar,
  Building2,
  FileText,
  Loader2,
  Search,
  Filter,
  ArrowRight,
  ShieldAlert,
  ChevronRight,
  ExternalLink,
} from 'lucide-react';

export default function RemindersPage() {
  const { currentCompany } = useAuth();
  const supabase = createClient();

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [remindersHistory, setRemindersHistory] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);

  // Active Tab
  const [activeTab, setActiveTab] = useState<'overdue' | 'today' | 'history'>('overdue');
  const [searchQuery, setSearchQuery] = useState('');

  // Selected invoice for Reminder Modal
  const [selectedInvoiceForReminder, setSelectedInvoiceForReminder] = useState<Invoice | null>(null);
  const [isReminderModalOpen, setIsReminderModalOpen] = useState(false);

  const fetchInvoicesAndReminders = async () => {
    if (!currentCompany?.id) return;
    setLoading(true);

    try {
      // 1. Fetch unpaid invoices with customer info
      const { data: invData, error: invError } = await supabase
        .from('invoices')
        .select(`
          *,
          customer:customers(id, name, company_name, email, phone)
        `)
        .eq('company_id', currentCompany.id)
        .not('status', 'in', '("Payée","Annulée")')
        .order('due_date', { ascending: true });

      if (invError) throw invError;
      setInvoices((invData as Invoice[]) || []);

      // 2. Fetch reminders history from reminders table if exists, or activities fallback
      const { data: remData, error: remError } = await supabase
        .from('reminders')
        .select(`
          *,
          customer:customers(name, company_name),
          invoice:invoices(invoice_number, remaining_amount, currency)
        `)
        .eq('company_id', currentCompany.id)
        .order('created_at', { ascending: false });

      if (!remError && remData) {
        setRemindersHistory(remData as Reminder[]);
      } else {
        // Fallback: fetch from activities
        const { data: actData } = await supabase
          .from('activities')
          .select('*')
          .eq('company_id', currentCompany.id)
          .ilike('action', '%relance%')
          .order('created_at', { ascending: false });

        if (actData) {
          const mapped = actData.map((act) => ({
            id: act.id,
            company_id: act.company_id,
            invoice_id: act.entity_id,
            customer_id: act.customer_id,
            channel: (act.metadata?.channel || 'ia_manual') as any,
            status: 'sent' as any,
            scheduled_date: act.created_at,
            sent_at: act.created_at,
            message_content: act.description,
            created_at: act.created_at,
            customer: { name: act.metadata?.customer_name || 'Client' },
            invoice: {
              invoice_number: act.entity_title?.replace('Facture ', '') || 'FAC',
              remaining_amount: act.metadata?.amount || 0,
              currency: currentCompany.currency || 'FCFA',
            },
          }));
          setRemindersHistory(mapped as any);
        }
      }
    } catch (err) {
      console.error('Erreur chargement relances:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInvoicesAndReminders();
  }, [currentCompany?.id]);

  const currency = currentCompany?.currency || 'FCFA';

  // Categorize invoices
  const todayStr = new Date().toISOString().split('T')[0];

  const overdueInvoices = useMemo(() => {
    return invoices
      .filter((inv) => inv.due_date && inv.due_date < todayStr && (inv.remaining_amount || inv.total) > 0)
      .map((inv) => ({
        ...inv,
        daysOverdue: getDaysOverdue(inv.due_date),
      }))
      .sort((a, b) => b.daysOverdue - a.daysOverdue);
  }, [invoices, todayStr]);

  const dueTodayInvoices = useMemo(() => {
    return invoices.filter((inv) => inv.due_date === todayStr && (inv.remaining_amount || inv.total) > 0);
  }, [invoices, todayStr]);

  const totalOverdueAmount = useMemo(() => {
    return overdueInvoices.reduce((acc, inv) => acc + (Number(inv.remaining_amount) || 0), 0);
  }, [overdueInvoices]);

  const filteredOverdue = useMemo(() => {
    if (!searchQuery.trim()) return overdueInvoices;
    const q = searchQuery.toLowerCase().trim();
    return overdueInvoices.filter(
      (inv) =>
        inv.invoice_number.toLowerCase().includes(q) ||
        (inv.customer?.name || '').toLowerCase().includes(q) ||
        (inv.customer?.company_name || '').toLowerCase().includes(q)
    );
  }, [overdueInvoices, searchQuery]);

  const filteredHistory = useMemo(() => {
    if (!searchQuery.trim()) return remindersHistory;
    const q = searchQuery.toLowerCase().trim();
    return remindersHistory.filter(
      (rem) =>
        (rem.invoice?.invoice_number || '').toLowerCase().includes(q) ||
        (rem.customer?.name || '').toLowerCase().includes(q) ||
        (rem.message_content || rem.message || '').toLowerCase().includes(q)
    );
  }, [remindersHistory, searchQuery]);

  const openReminderFor = (inv: Invoice) => {
    setSelectedInvoiceForReminder(inv);
    setIsReminderModalOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 font-bold">
              <BellRing className="w-5 h-5" />
            </span>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              Relances & Recouvrement
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
              Assistant IA
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Générez des messages de relance personnalisés (courtois, ferme, mise en demeure) et accélérez vos règlements.
          </p>
        </div>
      </div>

      {/* Warning/Info Banner on Real Sending */}
      <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-300 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-start sm:items-center gap-2.5">
          <ShieldAlert className="w-5 h-5 text-amber-500 flex-shrink-0" />
          <div>
            <span className="font-bold">Contrôle humain strict : </span>
            <span>
              Les messages générés par l&apos;IA sont modifiables avant expédition. L&apos;envoi WhatsApp s&apos;effectue via WhatsApp Web/App et l&apos;email requiert un compte SMTP/Resend configuré.
            </span>
          </div>
        </div>
        <span className="text-[11px] font-mono text-amber-600 dark:text-amber-400 whitespace-nowrap px-2.5 py-1 rounded-lg bg-amber-500/15 border border-amber-500/20 self-start sm:self-auto">
          Aucun envoi fantôme
        </span>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Total Overdue */}
        <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden group hover:border-rose-500/40 transition-all">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider">Créances en Retard</span>
            <span className="p-2 rounded-2xl bg-rose-500/10 text-rose-600 dark:text-rose-400">
              <AlertTriangle className="w-4 h-4" />
            </span>
          </div>
          <div className="text-2xl font-black text-rose-600 dark:text-rose-400 tracking-tight">
            {formatMoney(totalOverdueAmount, currency)}
          </div>
          <div className="mt-2 text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
            <span>{overdueInvoices.length} facture(s) échue(s)</span>
          </div>
        </div>

        {/* Due Today */}
        <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden group hover:border-amber-500/40 transition-all">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider">Échéance Aujourd&apos;hui</span>
            <span className="p-2 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <Clock className="w-4 h-4" />
            </span>
          </div>
          <div className="text-2xl font-black text-amber-600 dark:text-amber-400 tracking-tight">
            {dueTodayInvoices.length}
          </div>
          <div className="mt-2 text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
            <span>Rappels de courtoisie recommandés</span>
          </div>
        </div>

        {/* Reminders sent */}
        <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden group hover:border-indigo-500/40 transition-all">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider">Relances Traitées</span>
            <span className="p-2 rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
              <Send className="w-4 h-4" />
            </span>
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
            {remindersHistory.length}
          </div>
          <div className="mt-2 text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
            <span>Historique des relances enregistrées</span>
          </div>
        </div>
      </div>

      {/* Tabs & Search */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-3">
        <div className="flex items-center gap-2 overflow-x-auto">
          <button
            onClick={() => setActiveTab('overdue')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-2 ${
              activeTab === 'overdue'
                ? 'bg-rose-600 text-white shadow-md shadow-rose-600/20'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Factures en retard ({overdueInvoices.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('today')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-2 ${
              activeTab === 'today'
                ? 'bg-amber-600 text-white shadow-md shadow-amber-600/20'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>À relancer aujourd&apos;hui ({dueTodayInvoices.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('history')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-2 ${
              activeTab === 'history'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Historique ({remindersHistory.length})</span>
          </button>
        </div>

        <div className="relative min-w-[240px]">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filtrer client ou facture..."
            className="w-full pl-9 pr-3 py-1.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
      </div>

      {/* Main Content Area */}
      {loading ? (
        <div className="p-16 text-center text-slate-400 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-indigo-500 mb-3" />
          <span className="text-xs font-medium">Analyse des échéances et factures...</span>
        </div>
      ) : activeTab === 'overdue' ? (
        filteredOverdue.length === 0 ? (
          <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Excellente nouvelle !</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              Aucune facture en retard de règlement trouvée pour votre entreprise.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredOverdue.map((inv) => (
              <div
                key={inv.id}
                className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 shadow-sm transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                {/* Left: Invoice & Customer Info */}
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href={`/invoices/${inv.id}`}
                      className="font-extrabold text-sm text-slate-900 dark:text-white hover:text-indigo-600 dark:hover:text-indigo-400 flex items-center gap-1.5"
                    >
                      <FileText className="w-4 h-4 text-indigo-500" />
                      <span>{inv.invoice_number}</span>
                    </Link>

                    {/* Overdue badge */}
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase ${
                        inv.daysOverdue > 15
                          ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30'
                          : inv.daysOverdue > 7
                          ? 'bg-orange-500/15 text-orange-600 dark:text-orange-400 border border-orange-500/30'
                          : 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30'
                      }`}
                    >
                      {inv.daysOverdue} {inv.daysOverdue === 1 ? 'jour de retard' : 'jours de retard'}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600 dark:text-slate-400">
                    <span className="font-semibold text-slate-900 dark:text-white">
                      {inv.customer?.name}
                    </span>
                    {inv.customer?.company_name && (
                      <span className="text-slate-400">• {inv.customer.company_name}</span>
                    )}
                    {inv.customer?.phone && (
                      <span className="text-slate-500 font-mono text-[11px]">
                        📞 {inv.customer.phone}
                      </span>
                    )}
                    {inv.customer?.email && (
                      <span className="text-slate-500 font-mono text-[11px]">
                        ✉️ {inv.customer.email}
                      </span>
                    )}
                  </div>

                  <div className="text-[11px] text-slate-400 flex items-center gap-2">
                    <span>Échéance prévue :</span>
                    <span className="font-semibold text-slate-700 dark:text-slate-300">
                      {new Date(inv.due_date).toLocaleDateString('fr-FR')}
                    </span>
                  </div>
                </div>

                {/* Right: Amounts & Action Button */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 self-end md:self-auto">
                  <div className="text-left sm:text-right">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Reste dû</span>
                    <span className="text-lg font-black text-rose-600 dark:text-rose-400">
                      {formatMoney(inv.remaining_amount, inv.currency)}
                    </span>
                    <span className="text-[10px] text-slate-400 block">
                      sur {formatMoney(inv.total, inv.currency)}
                    </span>
                  </div>

                  <button
                    onClick={() => openReminderFor(inv)}
                    className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-2xl shadow-md shadow-indigo-600/20 transition-all"
                  >
                    <Sparkles className="w-4 h-4 text-indigo-200" />
                    <span>Relancer avec IA</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )
      ) : activeTab === 'today' ? (
        dueTodayInvoices.length === 0 ? (
          <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <Clock className="w-12 h-12 text-slate-300 dark:text-slate-700 mx-auto mb-3" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Aucune facture à échéance aujourd&apos;hui</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              Toutes les factures dues pour la journée sont déjà réglées ou aucune n&apos;arrive à terme ce jour.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {dueTodayInvoices.map((inv) => (
              <div
                key={inv.id}
                className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-sm text-slate-900 dark:text-white">
                      {inv.invoice_number}
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                      Échéance du jour
                    </span>
                  </div>
                  <div className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                    Client : <span className="font-semibold text-slate-900 dark:text-white">{inv.customer?.name}</span>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Montant</span>
                    <span className="text-base font-extrabold text-slate-900 dark:text-white">
                      {formatMoney(inv.remaining_amount, inv.currency)}
                    </span>
                  </div>

                  <button
                    onClick={() => openReminderFor(inv)}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold rounded-2xl shadow-md shadow-amber-600/20 transition-all"
                  >
                    <Sparkles className="w-4 h-4 text-amber-200" />
                    <span>Rappel courtois IA</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )
      ) : (
        /* History */
        filteredHistory.length === 0 ? (
          <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <CheckCircle2 className="w-12 h-12 text-slate-300 dark:text-slate-700 mx-auto mb-3" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Aucun historique de relance</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              Les relances effectuées avec l&apos;assistant IA s&apos;afficheront ici chronologiquement.
            </p>
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
                    <th className="py-4 px-5">Canal</th>
                    <th className="py-4 px-5">Contenu du message</th>
                    <th className="py-4 px-5 text-right">Statut</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                  {filteredHistory.map((rem) => (
                    <tr key={rem.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="py-4 px-5 text-slate-500 whitespace-nowrap">
                        {new Date(rem.created_at).toLocaleDateString('fr-FR', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                      <td className="py-4 px-5 font-bold text-slate-900 dark:text-white">
                        {rem.invoice?.invoice_number || 'FAC'}
                      </td>
                      <td className="py-4 px-5 font-medium text-slate-800 dark:text-slate-200">
                        {rem.customer?.name || 'Client'}
                      </td>
                      <td className="py-4 px-5">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                          {rem.channel === 'whatsapp' ? '💬 WhatsApp' : rem.channel === 'email' ? '✉️ Email' : '🤖 Assistant IA'}
                        </span>
                      </td>
                      <td className="py-4 px-5 max-w-md text-slate-600 dark:text-slate-400 truncate">
                        {rem.message_content || rem.message || 'Relance effectuée'}
                      </td>
                      <td className="py-4 px-5 text-right">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                          Envoyé / Notifié
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      )}

      {/* Reminder Modal */}
      {selectedInvoiceForReminder && (
        <ReminderModal
          isOpen={isReminderModalOpen}
          onClose={() => {
            setIsReminderModalOpen(false);
            setSelectedInvoiceForReminder(null);
          }}
          onSuccess={() => {
            fetchInvoicesAndReminders();
          }}
          invoice={selectedInvoiceForReminder}
        />
      )}
    </div>
  );
}
