'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Customer, Quote, Invoice, Payment } from '@/lib/types';
import { formatMoney } from '@/lib/finance/money';
import DocumentPrintView from '@/components/finance/DocumentPrintView';
import PaymentReceiptModal from '@/components/portal/PaymentReceiptModal';
import {
  Building2,
  FileSpreadsheet,
  Receipt,
  Wallet,
  Printer,
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
  Loader2,
  Check,
  X,
  CreditCard,
  User,
  ShieldCheck,
  ArrowRight,
  Info,
} from 'lucide-react';

export default function ClientPortalPage() {
  const params = useParams();
  const token = params?.token as string;
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [company, setCompany] = useState<any>(null);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);

  // Active Tab: 'quotes' | 'invoices' | 'payments' | 'profile'
  const [activeTab, setActiveTab] = useState<'quotes' | 'invoices' | 'payments' | 'profile'>('quotes');

  // Print view state
  const [printDocument, setPrintDocument] = useState<{
    type: 'quote' | 'invoice';
    quote?: Quote;
    invoice?: Invoice;
  } | null>(null);

  // Accept / Refuse Quote Modal
  const [actionQuote, setActionQuote] = useState<Quote | null>(null);
  const [actionType, setActionType] = useState<'accept' | 'refuse' | null>(null);
  const [refuseReason, setRefuseReason] = useState('');
  const [submittingAction, setSubmittingAction] = useState(false);
  const [actionSuccessMsg, setActionSuccessMsg] = useState<string | null>(null);

  // Online Payment Modal State
  const [payingInvoice, setPayingInvoice] = useState<Invoice | null>(null);
  const [selectedProvider, setSelectedProvider] = useState<'wave' | 'orange_money' | 'mtn_momo'>('wave');
  const [initiatingPayment, setInitiatingPayment] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);

  // Payment Receipt Modal State
  const [selectedReceiptPayment, setSelectedReceiptPayment] = useState<Payment | null>(null);

  const fetchPortalData = async () => {
    if (!token) return;
    setLoading(true);

    try {
      // 1. Find customer by portal_token OR id fallback
      let custData: any = null;

      const { data: byToken } = await supabase
        .from('customers')
        .select('*, company:companies(name, logo_url, address, city, country, phone, email, currency)')
        .eq('portal_token', token)
        .maybeSingle();

      if (byToken) {
        custData = byToken;
      } else {
        const { data: byId } = await supabase
          .from('customers')
          .select('*, company:companies(name, logo_url, address, city, country, phone, email, currency)')
          .eq('id', token)
          .maybeSingle();
        custData = byId;
      }

      if (!custData) {
        setCustomer(null);
        setLoading(false);
        return;
      }

      setCustomer(custData as Customer);
      setCompany(custData.company || { name: 'Entreprise Partenaire', currency: 'FCFA' });

      // 2. Fetch Customer Quotes
      const { data: quoteList } = await supabase
        .from('quotes')
        .select('*, items:quote_items(*)')
        .eq('customer_id', custData.id)
        .neq('status', 'Brouillon')
        .order('issue_date', { ascending: false });

      setQuotes((quoteList as Quote[]) || []);

      // 3. Fetch Customer Invoices
      const { data: invList } = await supabase
        .from('invoices')
        .select('*, items:invoice_items(*)')
        .eq('customer_id', custData.id)
        .neq('status', 'Brouillon')
        .neq('status', 'Annulée')
        .order('issue_date', { ascending: false });

      setInvoices((invList as Invoice[]) || []);

      // 4. Fetch Customer Payments
      const { data: payList } = await supabase
        .from('payments')
        .select('*')
        .eq('customer_id', custData.id)
        .order('payment_date', { ascending: false });

      setPayments((payList as Payment[]) || []);
    } catch (err) {
      console.error('Error loading portal data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPortalData();
  }, [token]);

  const currency = company?.currency || 'FCFA';

  // Handle Quote Accept or Refuse
  const handleConfirmQuoteDecision = async () => {
    if (!actionQuote || !actionType) return;
    setSubmittingAction(true);

    try {
      const nextStatus = actionType === 'accept' ? 'Accepté' : 'Refusé';

      await supabase
        .from('quotes')
        .update({
          status: nextStatus,
          terms: actionType === 'refuse' && refuseReason ? `Motif de refus : ${refuseReason}` : actionQuote.terms,
        })
        .eq('id', actionQuote.id);

      // Log activity
      await supabase.from('activities').insert({
        company_id: actionQuote.company_id,
        action: actionType === 'accept' ? 'Devis accepté sur le portail' : 'Devis refusé sur le portail',
        entity_type: 'quote',
        entity_id: actionQuote.id,
        entity_title: `Devis ${actionQuote.quote_number}`,
        customer_id: customer?.id,
        description:
          actionType === 'accept'
            ? `Le client ${customer?.name} a validé le devis en ligne.`
            : `Devis décliné par le client. Motif : "${refuseReason || 'Non spécifié'}"`,
      });

      setActionSuccessMsg(
        actionType === 'accept'
          ? 'Merci ! Votre acceptation a été enregistrée avec succès.'
          : 'Votre décision a bien été transmise à l\'entreprise.'
      );

      setActionQuote(null);
      setActionType(null);
      await fetchPortalData();
      setTimeout(() => setActionSuccessMsg(null), 4000);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSubmittingAction(false);
    }
  };

  // Handle Online Payment Initiation
  const handleInitiatePayment = async () => {
    if (!payingInvoice) return;
    setInitiatingPayment(true);
    setPaymentError(null);

    try {
      const res = await fetch('/api/portal/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          portalToken: token,
          invoiceId: payingInvoice.id,
          providerCode: selectedProvider,
        }),
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        setPaymentError(data.error || 'Erreur lors de l’initialisation du paiement.');
        return;
      }

      if (!data.configured) {
        setPaymentError(
          data.message ||
            "Le paiement en ligne n'est pas encore configuré pour cette entreprise. Veuillez contacter l'entreprise pour convenir d'un autre mode de règlement."
        );
        return;
      }

      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      }
    } catch (err: any) {
      setPaymentError(err.message || 'Erreur de connexion au service de paiement.');
    } finally {
      setInitiatingPayment(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-6 text-slate-500">
        <div className="text-center space-y-3">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-indigo-500" />
          <p className="text-xs font-medium">Chargement de votre espace client sécurisé...</p>
        </div>
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-6">
        <div className="max-w-md w-full p-8 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center shadow-lg space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-rose-500/10 text-rose-600 flex items-center justify-center mx-auto">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">Lien introuvable ou expiré</h2>
          <p className="text-xs text-slate-500 leading-relaxed">
            Ce lien de consultation est invalide ou a été révoqué. Veuillez contacter votre interlocuteur commercial pour recevoir un accès actualisé.
          </p>
        </div>
      </div>
    );
  }

  // Calculate client totals
  const totalInvoiced = invoices.reduce((acc, i) => acc + (Number(i.total) || 0), 0);
  const totalPaid = payments.reduce((acc, p) => acc + (Number(p.amount) || 0), 0);
  const totalDue = Math.max(0, totalInvoiced - totalPaid);

  const pendingQuotesCount = quotes.filter((q) => q.status === 'Envoyé' || q.status === 'Consulté' || (q.status as string) === 'En attente').length;
  const unpaidInvoicesCount = invoices.filter((i) => {
    const r = Number(i.remaining_amount) || (Number(i.total) - Number(i.paid_amount));
    return r > 0 && i.status !== 'Payée';
  }).length;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans pb-16">
      {/* Top Brand Bar */}
      <header className="border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-600 text-white flex items-center justify-center font-bold text-sm shadow-md">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <span className="font-extrabold text-sm tracking-tight block">
                {company.name}
              </span>
              <span className="text-[10px] text-slate-400 block font-medium">
                Espace Client Sécurisé V2
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-3 py-1.5 rounded-full font-bold">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Accès Protégé</span>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 pt-8 space-y-6">
        {/* Welcome Greeting Banner */}
        <div className="p-6 sm:p-8 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <span className="text-[11px] uppercase font-bold text-indigo-500 tracking-wider">
              Espace Client
            </span>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight mt-1 text-slate-900 dark:text-white">
              Bonjour, {customer.name}
            </h1>
            {customer.company_name && (
              <p className="text-sm font-semibold text-slate-600 dark:text-slate-300 mt-0.5">
                {customer.company_name}
              </p>
            )}
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-lg">
              Suivez l&apos;état de vos dossiers, validez vos devis et consultez l&apos;historique certifié de vos factures avec {company.name}.
            </p>
          </div>

          {/* Quick Balance Alert Card */}
          <div className="bg-slate-50 dark:bg-slate-800/60 p-4 sm:p-5 rounded-2xl border border-slate-100 dark:border-slate-800 flex flex-col items-start md:items-end justify-center min-w-[200px]">
            <span className="text-[10px] uppercase font-bold text-amber-500 block">Solde Restant Dû</span>
            <span className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-0.5">
              {formatMoney(totalDue, currency)}
            </span>
            <span className="text-[11px] text-slate-400 mt-1">
              {unpaidInvoicesCount} facture{unpaidInvoicesCount > 1 ? 's' : ''} en attente
            </span>
          </div>
        </div>

        {/* 4 Client KPI Dashboard Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase font-bold text-slate-400">Total Facturé</span>
              <Receipt className="w-4 h-4 text-indigo-500" />
            </div>
            <p className="text-base sm:text-lg font-black text-slate-900 dark:text-white mt-2">
              {formatMoney(totalInvoiced, currency)}
            </p>
            <span className="text-[10px] text-slate-400 block mt-1">
              {invoices.length} facture{invoices.length > 1 ? 's' : ''} émises
            </span>
          </div>

          <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase font-bold text-emerald-500">Règlements Reçus</span>
              <Wallet className="w-4 h-4 text-emerald-500" />
            </div>
            <p className="text-base sm:text-lg font-black text-emerald-600 dark:text-emerald-400 mt-2">
              {formatMoney(totalPaid, currency)}
            </p>
            <span className="text-[10px] text-slate-400 block mt-1">
              {payments.length} versement{payments.length > 1 ? 's' : ''} validé{payments.length > 1 ? 's' : ''}
            </span>
          </div>

          <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase font-bold text-blue-500">Devis à Valider</span>
              <FileSpreadsheet className="w-4 h-4 text-blue-500" />
            </div>
            <p className="text-base sm:text-lg font-black text-blue-600 dark:text-blue-400 mt-2">
              {pendingQuotesCount}
            </p>
            <span className="text-[10px] text-slate-400 block mt-1">
              En attente de votre accord
            </span>
          </div>

          <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase font-bold text-amber-500">Factures Ouvertes</span>
              <Clock className="w-4 h-4 text-amber-500" />
            </div>
            <p className="text-base sm:text-lg font-black text-amber-600 dark:text-amber-400 mt-2">
              {unpaidInvoicesCount}
            </p>
            <span className="text-[10px] text-slate-400 block mt-1">
              Reste {formatMoney(totalDue, currency)}
            </span>
          </div>
        </div>

        {/* Action success alert */}
        {actionSuccessMsg && (
          <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs flex items-center gap-2 shadow-sm animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            <span className="font-bold">{actionSuccessMsg}</span>
          </div>
        )}

        {/* Tabs Bar */}
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
          <button
            onClick={() => setActiveTab('quotes')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
              activeTab === 'quotes'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Devis ({quotes.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('invoices')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
              activeTab === 'invoices'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Receipt className="w-3.5 h-3.5" />
            <span>Factures ({invoices.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('payments')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
              activeTab === 'payments'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Wallet className="w-3.5 h-3.5" />
            <span>Règlements & Reçus ({payments.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('profile')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
              activeTab === 'profile'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <User className="w-3.5 h-3.5" />
            <span>Mon Profil</span>
          </button>
        </div>

        {/* TAB 1: DEVIS */}
        {activeTab === 'quotes' && (
          quotes.length === 0 ? (
            <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800">
              <FileSpreadsheet className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <p className="text-xs text-slate-500">Aucun devis pour votre compte à ce jour.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {quotes.map((q) => (
                <div
                  key={q.id}
                  className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-extrabold text-sm text-slate-900 dark:text-white">
                        {q.quote_number}
                      </span>
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          q.status === 'Accepté'
                            ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20'
                            : q.status === 'Refusé'
                            ? 'bg-rose-500/10 text-rose-600 border border-rose-500/20'
                            : 'bg-blue-500/10 text-blue-600 border border-blue-500/20'
                        }`}
                      >
                        {q.status}
                      </span>
                    </div>

                    <div className="text-xs text-slate-500 flex items-center gap-3">
                      <span>Émis le : {new Date(q.issue_date).toLocaleDateString('fr-FR')}</span>
                      {q.expiration_date && (
                        <span>• Validité : {new Date(q.expiration_date).toLocaleDateString('fr-FR')}</span>
                      )}
                    </div>

                    {q.subject && (
                      <p className="text-xs text-slate-700 dark:text-slate-300 font-medium">
                        Objet : {q.subject}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center gap-4 self-end md:self-auto">
                    <div className="text-left sm:text-right">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Montant Total</span>
                      <span className="text-lg font-black text-slate-900 dark:text-white">
                        {formatMoney(q.total, q.currency || currency)}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setPrintDocument({ type: 'quote', quote: q })}
                        className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 text-slate-600 dark:text-slate-300 transition-colors"
                        title="Imprimer / Télécharger PDF"
                      >
                        <Printer className="w-4 h-4" />
                      </button>

                      {q.status !== 'Accepté' && q.status !== 'Refusé' && (
                        <>
                          <button
                            onClick={() => {
                              setActionQuote(q);
                              setActionType('accept');
                            }}
                            className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow transition-all"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>Accepter</span>
                          </button>

                          <button
                            onClick={() => {
                              setActionQuote(q);
                              setActionType('refuse');
                            }}
                            className="px-3.5 py-2 border border-rose-300 text-rose-600 hover:bg-rose-50 font-semibold rounded-xl text-xs transition-colors"
                          >
                            <X className="w-3.5 h-3.5" />
                            <span>Refuser</span>
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )
        )}

        {/* TAB 2: FACTURES */}
        {activeTab === 'invoices' && (
          invoices.length === 0 ? (
            <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800">
              <Receipt className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <p className="text-xs text-slate-500">Aucune facture enregistrée pour votre compte.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {invoices.map((inv) => {
                const rem = Number(inv.remaining_amount) || (Number(inv.total) - Number(inv.paid_amount));
                const isPaid = rem <= 0 || inv.status === 'Payée';

                return (
                  <div
                    key={inv.id}
                    className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-sm text-slate-900 dark:text-white">
                          Facture {inv.invoice_number}
                        </span>
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            isPaid
                              ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20'
                              : inv.status === 'Partiellement payée'
                              ? 'bg-blue-500/10 text-blue-600 border border-blue-500/20'
                              : 'bg-amber-500/10 text-amber-600 border border-amber-500/20'
                          }`}
                        >
                          {inv.status}
                        </span>
                      </div>

                      <div className="text-xs text-slate-500 flex items-center gap-3">
                        <span>Émise le : {new Date(inv.issue_date).toLocaleDateString('fr-FR')}</span>
                        <span>• Échéance : {new Date(inv.due_date).toLocaleDateString('fr-FR')}</span>
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-center gap-4 self-end md:self-auto">
                      <div className="text-left sm:text-right">
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">
                          {rem > 0 ? 'Reste à régler' : 'Total Réglé'}
                        </span>
                        <span
                          className={`text-lg font-black ${
                            rem > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600'
                          }`}
                        >
                          {formatMoney(rem > 0 ? rem : inv.total, inv.currency || currency)}
                        </span>
                        {rem > 0 && (
                          <span className="text-[10px] text-slate-400 block">
                            sur {formatMoney(inv.total, inv.currency || currency)}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setPrintDocument({ type: 'invoice', invoice: inv })}
                          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 text-slate-700 dark:text-slate-300 text-xs font-semibold shadow-sm transition-all"
                        >
                          <Printer className="w-3.5 h-3.5 text-indigo-500" />
                          <span>PDF</span>
                        </button>

                        {/* Payer maintenant button */}
                        {!isPaid && (
                          <button
                            onClick={() => {
                              setPayingInvoice(inv);
                              setPaymentError(null);
                            }}
                            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold shadow transition-all"
                          >
                            <CreditCard className="w-3.5 h-3.5" />
                            <span>Payer maintenant</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )
        )}

        {/* TAB 3: PAIEMENTS */}
        {activeTab === 'payments' && (
          payments.length === 0 ? (
            <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800">
              <Wallet className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <p className="text-xs text-slate-500">Aucun paiement enregistré pour l&apos;instant.</p>
            </div>
          ) : (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-sm">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/60 uppercase text-[10px] font-bold text-slate-500 tracking-wider border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="py-4 px-5">Date</th>
                    <th className="py-4 px-5">Mode de règlement</th>
                    <th className="py-4 px-5">Référence</th>
                    <th className="py-4 px-5 text-right">Montant</th>
                    <th className="py-4 px-5 text-center">Reçu</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                  {payments.map((p) => (
                    <tr key={p.id}>
                      <td className="py-4 px-5 text-slate-500 font-medium">
                        {new Date(p.payment_date).toLocaleDateString('fr-FR')}
                      </td>
                      <td className="py-4 px-5 font-semibold text-slate-900 dark:text-white">
                        {p.payment_method}
                      </td>
                      <td className="py-4 px-5 font-mono text-[11px] text-slate-500">
                        {p.reference || '—'}
                      </td>
                      <td className="py-4 px-5 text-right font-black text-emerald-600 text-sm">
                        +{formatMoney(p.amount, currency)}
                      </td>
                      <td className="py-4 px-5 text-center">
                        <button
                          onClick={() => setSelectedReceiptPayment(p)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-[11px] font-bold text-indigo-600 dark:text-indigo-400 transition-colors"
                        >
                          <Receipt className="w-3 h-3" />
                          <span>Voir reçu</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}

        {/* TAB 4: PROFIL */}
        {activeTab === 'profile' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
              <div className="flex items-center gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
                <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 text-indigo-600 flex items-center justify-center font-bold">
                  <User className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm text-slate-900 dark:text-white">Mes Coordonnées</h3>
                  <p className="text-[11px] text-slate-400">Informations de facturation enregistrées</p>
                </div>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Nom / Contact</span>
                  <p className="font-semibold text-slate-900 dark:text-white">{customer.name}</p>
                </div>
                {customer.company_name && (
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Raison Sociale</span>
                    <p className="font-semibold text-slate-900 dark:text-white">{customer.company_name}</p>
                  </div>
                )}
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Adresse Email</span>
                  <p className="font-semibold text-slate-900 dark:text-white">{customer.email || '—'}</p>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Téléphone</span>
                  <p className="font-semibold text-slate-900 dark:text-white">{customer.phone || '—'}</p>
                </div>
                {customer.address && (
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Adresse</span>
                    <p className="font-semibold text-slate-900 dark:text-white">
                      {[customer.address, customer.city, (customer as any).country].filter(Boolean).join(', ')}
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
              <div className="flex items-center gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
                <div className="w-10 h-10 rounded-2xl bg-purple-500/10 text-purple-600 flex items-center justify-center font-bold">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm text-slate-900 dark:text-white">Entreprise Partenaire</h3>
                  <p className="text-[11px] text-slate-400">Prestataire émetteur de vos factures</p>
                </div>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Nom</span>
                  <p className="font-semibold text-slate-900 dark:text-white">{company.name}</p>
                </div>
                {company.email && (
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Contact Commercial</span>
                    <p className="font-semibold text-slate-900 dark:text-white">{company.email}</p>
                  </div>
                )}
                {company.phone && (
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Téléphone</span>
                    <p className="font-semibold text-slate-900 dark:text-white">{company.phone}</p>
                  </div>
                )}
                {company.address && (
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Siège</span>
                    <p className="font-semibold text-slate-900 dark:text-white">
                      {[company.address, company.city, company.country].filter(Boolean).join(', ')}
                    </p>
                  </div>
                )}
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Devise des Transactions</span>
                  <p className="font-semibold text-slate-900 dark:text-white">{currency}</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Online Payment Modal */}
      {payingInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl relative space-y-4">
            <button
              onClick={() => {
                setPayingInvoice(null);
                setPaymentError(null);
              }}
              className="absolute top-5 right-5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              <X className="w-5 h-5" />
            </button>

            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-500">
                Paiement Sécurisé
              </span>
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white mt-1">
                Régler la Facture {payingInvoice.invoice_number}
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Montant restant dû :{' '}
                <strong className="text-slate-900 dark:text-white">
                  {formatMoney(
                    Number(payingInvoice.remaining_amount) ||
                      Number(payingInvoice.total) - Number(payingInvoice.paid_amount),
                    payingInvoice.currency || currency
                  )}
                </strong>
              </p>
            </div>

            {/* Provider selection */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block">
                Sélectionnez votre moyen de paiement :
              </label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedProvider('wave')}
                  className={`p-3 rounded-2xl border text-center transition-all ${
                    selectedProvider === 'wave'
                      ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/30 text-indigo-600 font-bold'
                      : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  <span className="text-lg block">🌊</span>
                  <span className="text-[11px] block mt-1">Wave</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedProvider('orange_money')}
                  className={`p-3 rounded-2xl border text-center transition-all ${
                    selectedProvider === 'orange_money'
                      ? 'border-orange-500 bg-orange-50/50 dark:bg-orange-950/30 text-orange-600 font-bold'
                      : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  <span className="text-lg block">🍊</span>
                  <span className="text-[11px] block mt-1">Orange</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedProvider('mtn_momo')}
                  className={`p-3 rounded-2xl border text-center transition-all ${
                    selectedProvider === 'mtn_momo'
                      ? 'border-yellow-500 bg-yellow-50/50 dark:bg-yellow-950/30 text-yellow-600 font-bold'
                      : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  <span className="text-lg block">🟡</span>
                  <span className="text-[11px] block mt-1">MTN MoMo</span>
                </button>
              </div>
            </div>

            {paymentError && (
              <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-400 text-xs flex items-start gap-2 leading-relaxed">
                <Info className="w-4 h-4 flex-shrink-0 mt-0.5 text-amber-500" />
                <span>{paymentError}</span>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setPayingInvoice(null);
                  setPaymentError(null);
                }}
                className="px-4 py-2 border rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                Fermer
              </button>
              <button
                type="button"
                onClick={handleInitiatePayment}
                disabled={initiatingPayment}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow flex items-center gap-1.5 transition-all disabled:opacity-50"
              >
                {initiatingPayment && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Confirmer et Payer</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Decision Modal (Accept or Refuse Quote) */}
      {actionQuote && actionType && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl relative space-y-4">
            <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
              {actionType === 'accept'
                ? `Valider le devis ${actionQuote.quote_number} ?`
                : `Décliner le devis ${actionQuote.quote_number}`}
            </h3>

            {actionType === 'accept' ? (
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                En confirmant votre accord pour un montant de <strong>{formatMoney(actionQuote.total, actionQuote.currency || currency)}</strong>, l&apos;équipe de {company.name} sera immédiatement notifiée afin de lancer la prestation.
              </p>
            ) : (
              <div className="space-y-2">
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  Merci d&apos;indiquer la raison de votre refus afin d&apos;ajuster notre offre si possible :
                </p>
                <textarea
                  rows={3}
                  value={refuseReason}
                  onChange={(e) => setRefuseReason(e.target.value)}
                  placeholder="Ex : Tarif supérieur au budget, délai trop long..."
                  className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs"
                />
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setActionQuote(null);
                  setActionType(null);
                }}
                className="px-4 py-2 border rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleConfirmQuoteDecision}
                disabled={submittingAction}
                className={`px-5 py-2 text-white font-bold text-xs rounded-xl shadow transition-all ${
                  actionType === 'accept'
                    ? 'bg-emerald-600 hover:bg-emerald-500'
                    : 'bg-rose-600 hover:bg-rose-500'
                }`}
              >
                {submittingAction ? 'Enregistrement...' : 'Confirmer ma décision'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Payment Receipt Modal */}
      {selectedReceiptPayment && (
        <PaymentReceiptModal
          payment={selectedReceiptPayment}
          company={company}
          customer={customer}
          invoiceNumber={
            invoices.find((i) => i.id === selectedReceiptPayment.invoice_id)?.invoice_number
          }
          onClose={() => setSelectedReceiptPayment(null)}
        />
      )}

      {/* Printable Document Modal */}
      {printDocument && (printDocument.quote || printDocument.invoice) && (
        <DocumentPrintView
          type={printDocument.type}
          company={company}
          customer={customer}
          document={(printDocument.type === 'quote' ? printDocument.quote : printDocument.invoice)!}
          items={[]}
          onClose={() => setPrintDocument(null)}
        />
      )}
    </div>
  );
}
