'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { createClient } from '@/lib/supabase/client';
import { Invoice, InvoiceItem, Payment, InvoiceStatus, Activity } from '@/lib/types';
import { formatMoney, getDaysOverdue } from '@/lib/finance/money';
import { 
  ArrowLeft, 
  Printer, 
  CreditCard, 
  Send, 
  Receipt, 
  Loader2, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  FileText, 
  Building, 
  DollarSign, 
  Copy, 
  Mail,
  MessageSquare
} from 'lucide-react';
import Link from 'next/link';
import { buildWhatsAppLink, WHATSAPP_TEMPLATES } from '@/lib/integrations/whatsapp';
import EmailModal from '@/components/finance/EmailModal';
import DocumentPrintView from '@/components/finance/DocumentPrintView';
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

export default function InvoiceDetailPage() {
  const params = useParams();
  const router = useRouter();
  const invoiceId = params?.id as string;

  const { currentCompany, user } = useAuth();
  const supabase = createClient();

  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [items, setItems] = useState<InvoiceItem[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals
  const [showPrintView, setShowPrintView] = useState(false);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [reminderModalOpen, setReminderModalOpen] = useState(false);
  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const fetchInvoice = async () => {
    if (!currentCompany?.id || !invoiceId) return;
    setLoading(true);

    try {
      // 1. Fetch Invoice
      const { data: invData, error: invError } = await supabase
        .from('invoices')
        .select('*, customer:customer_id(*), quote:quote_id(*), assignee:assigned_to(full_name, email)')
        .eq('id', invoiceId)
        .eq('company_id', currentCompany.id)
        .single();

      if (invError || !invData) {
        router.push('/invoices');
        return;
      }
      setInvoice(invData as Invoice);

      // 2. Fetch Items
      const { data: itemsData } = await supabase
        .from('invoice_items')
        .select('*')
        .eq('invoice_id', invoiceId)
        .order('sort_order', { ascending: true });

      if (itemsData) setItems(itemsData as InvoiceItem[]);

      // 3. Fetch Payments
      const { data: payData } = await supabase
        .from('payments')
        .select('*')
        .eq('invoice_id', invoiceId)
        .order('payment_date', { ascending: false });

      if (payData) setPayments(payData as Payment[]);

      // 4. Fetch Activities
      const { data: actData } = await supabase
        .from('activities')
        .select('*, user:user_id(full_name, email)')
        .eq('company_id', currentCompany.id)
        .eq('entity_id', invoiceId)
        .order('created_at', { ascending: false });

      if (actData) setActivities(actData as Activity[]);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInvoice();
  }, [currentCompany?.id, invoiceId]);

  const handleStatusChange = async (newStatus: InvoiceStatus) => {
    if (!invoice || !currentCompany?.id || !user) return;
    const oldStatus = invoice.status;
    if (oldStatus === newStatus) return;

    await supabase
      .from('invoices')
      .update({
        status: newStatus,
        updated_at: new Date().toISOString(),
      })
      .eq('id', invoice.id);

    await supabase.from('activities').insert({
      company_id: currentCompany.id,
      user_id: user.id,
      action: 'Changement de statut',
      entity_type: 'invoice',
      entity_id: invoice.id,
      entity_title: `Facture ${invoice.invoice_number}`,
      customer_id: invoice.customer_id,
      description: `Facture ${invoice.invoice_number} : passage de "${oldStatus}" à "${newStatus}" par ${user.email}`,
    });

    fetchInvoice();
  };

  if (loading) {
    return (
      <div className="p-20 text-center text-slate-400">
        <Loader2 className="w-8 h-8 animate-spin mx-auto text-indigo-500 mb-2" />
        <span className="text-xs">Chargement de la facture...</span>
      </div>
    );
  }

  if (!invoice || !currentCompany) return null;

  if (showPrintView) {
    return (
      <DocumentPrintView
        type="invoice"
        company={currentCompany}
        document={invoice}
        customer={invoice.customer}
        items={items}
        onClose={() => setShowPrintView(false)}
      />
    );
  }

  const daysOverdue = getDaysOverdue(invoice.due_date);
  const isOverdue = daysOverdue > 0 && invoice.status !== 'Payée' && invoice.status !== 'Annulée';
  const badge = STATUS_BADGES[invoice.status] || STATUS_BADGES['Brouillon'];
  const remaining = Number(invoice.remaining_amount) || 0;

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/invoices"
            className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400 font-medium">Factures</span>
              <span className="text-xs text-slate-300 dark:text-slate-700">/</span>
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                {invoice.invoice_number}
              </span>
            </div>
            <div className="flex items-center gap-3 mt-0.5">
              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                Facture {invoice.invoice_number}
              </h1>
              <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${badge.class}`}>
                {isOverdue && invoice.status !== 'En retard' ? 'En retard' : badge.label}
              </span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {remaining > 0 && invoice.status !== 'Annulée' && (
            <>
              <button
                onClick={() => setPaymentModalOpen(true)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow-md shadow-emerald-600/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
              >
                <CreditCard className="w-4 h-4" />
                <span>Enregistrer un paiement</span>
              </button>

              <button
                onClick={() => setReminderModalOpen(true)}
                className="inline-flex items-center gap-2 px-3.5 py-2 bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30 text-xs font-bold rounded-xl transition-all"
              >
                <Send className="w-4 h-4 text-amber-500" />
                <span>Relancer (IA)</span>
              </button>
            </>
          )}

          <button
            onClick={() => setShowPrintView(true)}
            className="inline-flex items-center gap-2 px-3.5 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-slate-300 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-xl shadow-sm transition-all"
          >
            <Printer className="w-4 h-4 text-indigo-500" />
            <span>Imprimer / PDF</span>
          </button>

          <button
            onClick={() => setEmailModalOpen(true)}
            className="inline-flex items-center gap-2 px-3.5 py-2 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/60 hover:bg-indigo-100 text-indigo-700 dark:text-indigo-300 text-xs font-semibold rounded-xl transition-all"
          >
            <Mail className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            <span>Envoyer par email</span>
          </button>

          {invoice.customer?.phone && (
            <a
              href={buildWhatsAppLink(
                invoice.customer.phone,
                WHATSAPP_TEMPLATES.invoiceReminder({
                  customerName: invoice.customer.name,
                  invoiceNumber: invoice.invoice_number,
                  amount: formatMoney(remaining, invoice.currency),
                  dueDate: invoice.due_date ? new Date(invoice.due_date).toLocaleDateString('fr-FR') : 'immédiate',
                  companyName: currentCompany?.name || 'Notre Entreprise',
                  portalUrl: typeof window !== 'undefined' ? `${window.location.origin}/portal/${invoice.customer_id}` : undefined,
                })
              )}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-3.5 py-2 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 hover:bg-emerald-100 text-emerald-700 dark:text-emerald-300 text-xs font-semibold rounded-xl transition-all"
            >
              <MessageSquare className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>Ouvrir WhatsApp</span>
            </a>
          )}

          {invoice.status !== 'Annulée' && invoice.status !== 'Payée' && (
            <button
              onClick={() => {
                if (confirm('Voulez-vous vraiment annuler cette facture ?')) {
                  handleStatusChange('Annulée');
                }
              }}
              className="px-3 py-2 text-xs font-semibold text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl transition-colors"
            >
              Annuler la facture
            </button>
          )}
        </div>
      </div>

      {/* Financial Health Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">
            Montant Total TTC
          </span>
          <span className="text-2xl font-black text-slate-900 dark:text-white mt-1 block">
            {formatMoney(invoice.total, invoice.currency)}
          </span>
        </div>

        <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">
            Montant Réglé
          </span>
          <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1 block">
            {formatMoney(invoice.paid_amount, invoice.currency)}
          </span>
        </div>

        <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">
            Reste à Encaisser
          </span>
          <div className="mt-1 flex items-baseline justify-between">
            <span className={`text-2xl font-black ${
              remaining > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-900 dark:text-white'
            }`}>
              {formatMoney(remaining, invoice.currency)}
            </span>
            {isOverdue && (
              <span className="text-xs font-bold text-rose-500">
                {daysOverdue}j de retard
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Main Grid: Details & Payments */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Card: Client & Dates */}
          <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                  Client facturé
                </span>
                <Link
                  href={`/customers/${invoice.customer_id}`}
                  className="text-base font-extrabold text-slate-900 dark:text-white hover:text-indigo-600 block"
                >
                  {invoice.customer?.name || (invoice as any).customer_name || 'Client sans nom'}
                </Link>
                {invoice.customer?.company_name && (
                  <p className="text-xs text-slate-500">{invoice.customer.company_name}</p>
                )}
              </div>

              <div className="text-left sm:text-right text-xs space-y-1 text-slate-600 dark:text-slate-400">
                <p>Date d&apos;émission : <strong className="text-slate-900 dark:text-white">{new Date(invoice.issue_date).toLocaleDateString('fr-FR')}</strong></p>
                <p>Échéance : <strong className={isOverdue ? 'text-rose-600 dark:text-rose-400' : 'text-slate-900 dark:text-white'}>
                  {new Date(invoice.due_date).toLocaleDateString('fr-FR')}
                </strong></p>
                {invoice.payment_terms && <p>Conditions : {invoice.payment_terms}</p>}
              </div>
            </div>

            {invoice.subject && (
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Objet</span>
                <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">{invoice.subject}</p>
              </div>
            )}
          </div>

          {/* Card: Items Table */}
          <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <h2 className="text-sm font-extrabold text-slate-900 dark:text-white uppercase tracking-wider">
              Détail des prestations ({items.length})
            </h2>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 uppercase text-[10px] font-bold">
                    <th className="py-3 px-2">Désignation</th>
                    <th className="py-3 px-2 text-center">Quantité</th>
                    <th className="py-3 px-2 text-right">P.U HT</th>
                    <th className="py-3 px-2 text-right">Total HT</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {items.map((it) => (
                    <tr key={it.id || it.description} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                      <td className="py-3.5 px-2">
                        <p className="font-bold text-slate-900 dark:text-white">{it.description}</p>
                        {it.reference && (
                          <span className="text-[10px] text-slate-400 font-mono">Réf: {it.reference}</span>
                        )}
                      </td>
                      <td className="py-3.5 px-2 text-center text-slate-700 dark:text-slate-300 font-semibold">
                        {it.quantity} {it.unit || ''}
                      </td>
                      <td className="py-3.5 px-2 text-right text-slate-700 dark:text-slate-300">
                        {formatMoney(it.unit_price, invoice.currency)}
                      </td>
                      <td className="py-3.5 px-2 text-right font-black text-slate-900 dark:text-white">
                        {formatMoney(it.total, invoice.currency)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Totals */}
            <div className="flex justify-end pt-4 border-t border-slate-100 dark:border-slate-800">
              <div className="w-full sm:w-72 space-y-2 text-xs">
                <div className="flex justify-between text-slate-600 dark:text-slate-400">
                  <span>Sous-total HT :</span>
                  <span className="font-semibold text-slate-900 dark:text-white">
                    {formatMoney(invoice.subtotal, invoice.currency)}
                  </span>
                </div>

                {Number(invoice.discount_amount) > 0 && (
                  <div className="flex justify-between text-rose-500 font-semibold">
                    <span>Remise :</span>
                    <span>-{formatMoney(invoice.discount_amount, invoice.currency)}</span>
                  </div>
                )}

                <div className="flex justify-between text-slate-600 dark:text-slate-400">
                  <span>TVA (18%) :</span>
                  <span className="font-semibold text-slate-900 dark:text-white">
                    {formatMoney(invoice.tax_amount, invoice.currency)}
                  </span>
                </div>

                <div className="flex justify-between text-sm font-black text-slate-900 dark:text-white pt-2 border-t border-slate-200 dark:border-slate-700">
                  <span>Total TTC :</span>
                  <span className="text-indigo-600 dark:text-indigo-400 font-black">
                    {formatMoney(invoice.total, invoice.currency)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Card: Payments Received List */}
          <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-extrabold text-slate-900 dark:text-white uppercase tracking-wider">
                Règlements enregistrés ({payments.length})
              </h2>

              {remaining > 0 && invoice.status !== 'Annulée' && (
                <button
                  onClick={() => setPaymentModalOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 rounded-xl text-xs font-bold hover:bg-emerald-100 transition-colors"
                >
                  <CreditCard className="w-3.5 h-3.5" />
                  <span>Ajouter un règlement</span>
                </button>
              )}
            </div>

            {payments.length === 0 ? (
              <p className="text-xs text-slate-400 italic py-4 text-center">
                Aucun paiement enregistré pour cette facture.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-700 dark:text-slate-300">
                  <thead>
                    <tr className="border-b border-slate-100 dark:border-slate-800 text-slate-400 uppercase text-[10px] font-bold">
                      <th className="py-2.5 px-3">Date</th>
                      <th className="py-2.5 px-3">Mode</th>
                      <th className="py-2.5 px-3">Référence</th>
                      <th className="py-2.5 px-3 text-right">Montant</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {payments.map((p) => (
                      <tr key={p.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                        <td className="py-3 px-3 font-semibold text-slate-900 dark:text-white">
                          {new Date(p.payment_date).toLocaleDateString('fr-FR')}
                        </td>
                        <td className="py-3 px-3">
                          <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-[10px] font-bold">
                            {p.payment_method}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-slate-400 font-mono text-[11px]">
                          {p.reference || '—'}
                        </td>
                        <td className="py-3 px-3 text-right font-black text-emerald-600 dark:text-emerald-400">
                          {formatMoney(p.amount, invoice.currency)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Timeline & Terms */}
        <div className="space-y-6">
          {/* Card: Linked Quote if any */}
          {invoice.quote && (
            <div className="p-5 rounded-3xl bg-indigo-50/60 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/50 text-xs space-y-2">
              <span className="font-bold text-indigo-950 dark:text-indigo-200 block">
                Devis d&apos;origine
              </span>
              <p className="text-slate-600 dark:text-slate-400">
                Cette facture a été générée depuis le devis{' '}
                <Link href={`/quotes/${invoice.quote.id}`} className="font-bold text-indigo-600 underline">
                  {invoice.quote.quote_number}
                </Link>
                .
              </p>
            </div>
          )}

          {/* Timeline */}
          <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
              Historique de la facture ({activities.length})
            </h3>

            {activities.length === 0 ? (
              <p className="text-xs text-slate-400 italic py-4 text-center">Aucune activité enregistrée.</p>
            ) : (
              <div className="relative pl-5 space-y-4 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200 dark:before:bg-slate-800">
                {activities.map((act) => (
                  <div key={act.id} className="relative">
                    <div className="absolute -left-5 top-1.5 w-3.5 h-3.5 rounded-full bg-emerald-500 ring-4 ring-white dark:ring-slate-900" />
                    <div className="text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-900 dark:text-white">{act.action}</span>
                        <span className="text-[10px] text-slate-400">
                          {new Date(act.created_at).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}
                        </span>
                      </div>
                      <p className="text-slate-600 dark:text-slate-300 text-[11px] mt-0.5 leading-snug">
                        {act.description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modals */}
      {paymentModalOpen && (
        <PaymentModal
          isOpen={true}
          invoice={invoice}
          onClose={() => setPaymentModalOpen(false)}
          onSuccess={fetchInvoice}
        />
      )}

      {reminderModalOpen && (
        <ReminderModal
          isOpen={true}
          invoice={invoice}
          onClose={() => setReminderModalOpen(false)}
          onSuccess={fetchInvoice}
        />
      )}

      {emailModalOpen && (
        <EmailModal
          isOpen={true}
          onClose={() => setEmailModalOpen(false)}
          onSuccess={fetchInvoice}
          recipientEmail={invoice.customer?.email}
          customerName={invoice.customer?.name}
          entityType="invoice"
          entityId={invoice.id}
          entityNumber={invoice.invoice_number}
          amount={formatMoney(invoice.remaining_amount || invoice.total, invoice.currency)}
          dueDate={invoice.due_date}
          publicUrl={typeof window !== 'undefined' ? `${window.location.origin}/portal/${invoice.customer_id}` : undefined}
        />
      )}
    </div>
  );
}
