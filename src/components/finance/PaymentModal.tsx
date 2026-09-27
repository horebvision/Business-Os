'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { createClient } from '@/lib/supabase/client';
import { Invoice, PaymentMethod } from '@/lib/types';
import { formatMoney } from '@/lib/finance/money';
import { X, CreditCard, DollarSign, Loader2, CheckCircle2, AlertCircle, ArrowRight } from 'lucide-react';

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  invoice?: Invoice | null;
  customerId?: string | null;
}

const PAYMENT_METHODS: PaymentMethod[] = [
  'Espèces',
  'Virement bancaire',
  'Mobile Money',
  'Chèque',
  'Carte',
  'Autre',
];

export default function PaymentModal({
  isOpen,
  onClose,
  onSuccess,
  invoice,
  customerId,
}: PaymentModalProps) {
  const { currentCompany, user } = useAuth();
  const supabase = createClient();

  const [invoicesList, setInvoicesList] = useState<Invoice[]>([]);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string>('');
  const [amount, setAmount] = useState<string>('');
  const [paymentDate, setPaymentDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Virement bancaire');
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // If invoice passed, select it, otherwise load unpaid invoices for the company or customer
  useEffect(() => {
    if (invoice) {
      setSelectedInvoiceId(invoice.id);
      setAmount(String(invoice.remaining_amount || ''));
    } else if (isOpen && currentCompany?.id) {
      const fetchUnpaid = async () => {
        let query = supabase
          .from('invoices')
          .select('*, customer:customer_id(name, company_name)')
          .eq('company_id', currentCompany.id)
          .not('status', 'in', '("Payée","Annulée")')
          .order('due_date', { ascending: true });

        if (customerId) {
          query = query.eq('customer_id', customerId);
        }

        const { data } = await query;
        if (data && data.length > 0) {
          setInvoicesList(data as Invoice[]);
          setSelectedInvoiceId(data[0].id);
          setAmount(String(data[0].remaining_amount || ''));
        }
      };
      fetchUnpaid();
    }
    setErrorMsg(null);
    setSuccessMsg(null);
  }, [invoice, isOpen, currentCompany?.id, customerId, supabase]);

  if (!isOpen) return null;

  const currentSelectedInvoice = invoice || invoicesList.find((i) => i.id === selectedInvoiceId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentCompany?.id || !user || !currentSelectedInvoice) return;

    const numericAmount = parseFloat(amount);
    if (!numericAmount || numericAmount <= 0) {
      setErrorMsg('Veuillez saisir un montant de paiement valide supérieur à zéro.');
      return;
    }

    if (numericAmount > (currentSelectedInvoice.remaining_amount || currentSelectedInvoice.total)) {
      setErrorMsg(
        `Le montant saisi (${formatMoney(numericAmount, currentSelectedInvoice.currency)}) dépasse le reste à payer sur cette facture (${formatMoney(currentSelectedInvoice.remaining_amount, currentSelectedInvoice.currency)}).`
      );
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    try {
      // 1. Insert payment into payments table
      const { data: newPayment, error: payError } = await supabase
        .from('payments')
        .insert({
          company_id: currentCompany.id,
          invoice_id: currentSelectedInvoice.id,
          customer_id: currentSelectedInvoice.customer_id,
          amount: numericAmount,
          payment_date: paymentDate,
          payment_method: paymentMethod,
          reference: reference.trim() || null,
          notes: notes.trim() || null,
          created_by: user.id,
        })
        .select()
        .single();

      if (payError) throw payError;

      // 2. Note: The Postgres trigger `update_invoice_payment_stats` automatically recalculates
      // paid_amount, remaining_amount, and updates status ('Payée' or 'Partiellement payée')
      // as well as customer totals!

      // 3. Log activity
      await supabase.from('activities').insert({
        company_id: currentCompany.id,
        user_id: user.id,
        action: 'Paiement enregistré',
        entity_type: 'invoice',
        entity_id: currentSelectedInvoice.id,
        entity_title: `Facture ${currentSelectedInvoice.invoice_number}`,
        customer_id: currentSelectedInvoice.customer_id,
        description: `Règlement de ${formatMoney(numericAmount, currentSelectedInvoice.currency)} reçu par ${paymentMethod} (Réf: ${reference || 'Aucune'})`,
        metadata: {
          payment_id: newPayment.id,
          amount: numericAmount,
          payment_method: paymentMethod,
        },
      });

      setSuccessMsg(`Paiement de ${formatMoney(numericAmount, currentSelectedInvoice.currency)} enregistré avec succès !`);
      onSuccess();
      setTimeout(() => {
        onClose();
      }, 1000);
    } catch (err: any) {
      setErrorMsg(err.message || "Erreur lors de l'enregistrement du règlement.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl relative max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
            <CreditCard className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              Enregistrer un paiement
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Saisissez l&apos;encaissement d&apos;un règlement total ou partiel
            </p>
          </div>
        </div>

        {errorMsg && (
          <div className="mt-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}
        {successMsg && (
          <div className="mt-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          {/* Invoice Selection */}
          {!invoice && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Sélectionner la facture à régler *
              </label>
              {invoicesList.length === 0 ? (
                <p className="text-xs text-slate-400 italic">Aucune facture en attente de paiement.</p>
              ) : (
                <select
                  value={selectedInvoiceId}
                  onChange={(e) => {
                    setSelectedInvoiceId(e.target.value);
                    const inv = invoicesList.find((i) => i.id === e.target.value);
                    if (inv) setAmount(String(inv.remaining_amount));
                  }}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                >
                  {invoicesList.map((inv) => (
                    <option key={inv.id} value={inv.id}>
                      {inv.invoice_number} — {(inv as any).customer?.name || 'Client'} (Reste : {formatMoney(inv.remaining_amount, inv.currency)})
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

          {currentSelectedInvoice && (
            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 flex items-center justify-between text-xs">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Facture ciblée</span>
                <span className="font-extrabold text-slate-900 dark:text-white">
                  {currentSelectedInvoice.invoice_number}
                </span>
              </div>
              <div className="text-right">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Reste à payer</span>
                <span className="font-black text-amber-600 dark:text-amber-400">
                  {formatMoney(currentSelectedInvoice.remaining_amount, currentSelectedInvoice.currency)}
                </span>
              </div>
            </div>
          )}

          {/* Amount & Date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Montant perçu ({currentCompany?.currency || 'FCFA'}) *
              </label>
              <input
                type="number"
                min="1"
                step="1"
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="Ex : 500000"
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white text-xs font-bold focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Date du règlement *
              </label>
              <input
                type="date"
                required
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Method & Reference */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Mode de règlement *
              </label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              >
                {PAYMENT_METHODS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Référence (N° virement, chèque, reçu)
              </label>
              <input
                type="text"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="Ex : VIR-928174"
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Commentaire / Notes
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Détails du règlement..."
              className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none resize-none"
            />
          </div>

          <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={loading || !currentSelectedInvoice}
              className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs rounded-xl shadow-md shadow-emerald-600/20 transition-all flex items-center gap-2 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Enregistrement...</span>
                </>
              ) : (
                <>
                  <CreditCard className="w-4 h-4" />
                  <span>Valider l&apos;encaissement</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
