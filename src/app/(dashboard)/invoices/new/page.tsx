'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { createClient } from '@/lib/supabase/client';
import { Customer, Quote, QuoteItem } from '@/lib/types';
import { 
  calculateTotals, 
  formatMoney, 
  generateSequenceNumber, 
  calculateDueDate 
} from '@/lib/finance/money';
import { 
  ArrowLeft, 
  Plus, 
  Trash2, 
  Save, 
  Loader2, 
  AlertCircle, 
  Receipt,
  FileSpreadsheet
} from 'lucide-react';
import Link from 'next/link';
import CustomerModal from '@/components/crm/CustomerModal';

interface FormItem {
  id: string;
  description: string;
  reference: string;
  quantity: number;
  unit: string;
  unit_price: number;
  discount_rate: number;
  tax_rate: number;
}

export default function NewInvoicePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const fromQuoteId = searchParams?.get('from_quote_id');
  const preselectedCustomerId = searchParams?.get('customer_id');

  const { currentCompany, user } = useAuth();
  const supabase = createClient();

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [teamMembers, setTeamMembers] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Form fields
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [customerId, setCustomerId] = useState(preselectedCustomerId || '');
  const [subject, setSubject] = useState('');
  const [issueDate, setIssueDate] = useState(new Date().toISOString().split('T')[0]);
  const [paymentTerms, setPaymentTerms] = useState('15 jours');
  const [dueDate, setDueDate] = useState(() => calculateDueDate(new Date().toISOString().split('T')[0], '15 jours'));
  const [assignedTo, setAssignedTo] = useState(user?.id || '');
  const [globalDiscountRate, setGlobalDiscountRate] = useState(0);
  const [defaultTaxRate, setDefaultTaxRate] = useState(18);
  const [terms, setTerms] = useState(
    'Règlement par virement bancaire ou Mobile Money à réception de facture.\nTout retard de paiement donnera lieu au versement de pénalités de retard.'
  );
  const [notes, setNotes] = useState('');
  const [linkedQuote, setLinkedQuote] = useState<Quote | null>(null);

  // Items
  const [items, setItems] = useState<FormItem[]>([
    {
      id: '1',
      description: 'Prestation de services',
      reference: 'FAC-01',
      quantity: 1,
      unit: 'prestation',
      unit_price: 200000,
      discount_rate: 0,
      tax_rate: 18,
    },
  ]);

  const [newCustomerModalOpen, setNewCustomerModalOpen] = useState(false);

  // Handle terms change to recompute due date
  const handlePaymentTermsChange = (newTerms: string) => {
    setPaymentTerms(newTerms);
    setDueDate(calculateDueDate(issueDate, newTerms));
  };

  const handleIssueDateChange = (newDate: string) => {
    setIssueDate(newDate);
    setDueDate(calculateDueDate(newDate, paymentTerms));
  };

  // Init data and fetch quote if converting
  useEffect(() => {
    if (!currentCompany?.id) return;

    const initData = async () => {
      // 1. Customers
      const { data: custData } = await supabase
        .from('customers')
        .select('*')
        .eq('company_id', currentCompany.id)
        .order('name', { ascending: true });

      if (custData) setCustomers(custData as Customer[]);

      // 2. Team
      const { data: teamData } = await supabase
        .from('memberships')
        .select('user_id, users:user_id(id, full_name, email)')
        .eq('company_id', currentCompany.id)
        .eq('is_active', true);

      if (teamData) {
        setTeamMembers(
          teamData.map((m: any) => ({
            id: m.users?.id || m.user_id,
            name: m.users?.full_name || m.users?.email || 'Membre',
          }))
        );
      }

      // 3. Count invoices for sequential number
      const { count } = await supabase
        .from('invoices')
        .select('id', { count: 'exact', head: true })
        .eq('company_id', currentCompany.id);

      setInvoiceNumber(generateSequenceNumber('FAC', count || 0));

      // 4. If creating from quote, load quote & lines
      if (fromQuoteId) {
        const { data: quoteData } = await supabase
          .from('quotes')
          .select('*, customer:customer_id(*)')
          .eq('id', fromQuoteId)
          .eq('company_id', currentCompany.id)
          .single();

        if (quoteData) {
          setLinkedQuote(quoteData as Quote);
          if (quoteData.customer_id) setCustomerId(quoteData.customer_id);
          setSubject(`Facture relative au devis ${quoteData.quote_number}${quoteData.subject ? ` — ${quoteData.subject}` : ''}`);
          if (quoteData.assigned_to) setAssignedTo(quoteData.assigned_to);

          const { data: qItems } = await supabase
            .from('quote_items')
            .select('*')
            .eq('quote_id', fromQuoteId)
            .order('sort_order', { ascending: true });

          if (qItems && qItems.length > 0) {
            setItems(
              qItems.map((qi: any, idx: number) => ({
                id: (idx + 1).toString(),
                description: qi.description,
                reference: qi.reference || '',
                quantity: Number(qi.quantity) || 1,
                unit: qi.unit || 'unité',
                unit_price: Number(qi.unit_price) || 0,
                discount_rate: Number(qi.discount_rate) || 0,
                tax_rate: Number(qi.tax_rate) || 18,
              }))
            );
          }
        }
      }
    };

    initData();
  }, [currentCompany?.id, fromQuoteId, supabase]);

  const handleAddItem = () => {
    const newItem: FormItem = {
      id: Date.now().toString(),
      description: '',
      reference: '',
      quantity: 1,
      unit: 'unité',
      unit_price: 0,
      discount_rate: 0,
      tax_rate: defaultTaxRate,
    };
    setItems((prev) => [...prev, newItem]);
  };

  const handleUpdateItem = (id: string, field: keyof FormItem, val: any) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: val } : item))
    );
  };

  const handleRemoveItem = (id: string) => {
    if (items.length <= 1) return;
    setItems((prev) => prev.filter((item) => item.id !== id));
  };

  const totals = calculateTotals(items, globalDiscountRate, defaultTaxRate);
  const currency = currentCompany?.currency || 'FCFA';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentCompany?.id || !user) return;

    if (!customerId) {
      setErrorMsg('Veuillez sélectionner un client.');
      return;
    }

    if (items.length === 0 || !items.some((i) => i.description.trim())) {
      setErrorMsg('Veuillez renseigner au moins une ligne de facturation avec description.');
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    try {
      const publicToken = typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID().replace(/-/g, '')
        : Math.random().toString(36).substring(2) + Date.now().toString(36);

      // 1. Insert Invoice
      const invoicePayload: any = {
        company_id: currentCompany.id,
        customer_id: customerId,
        quote_id: linkedQuote?.id || null,
        invoice_number: invoiceNumber.trim(),
        subject: subject.trim() || null,
        issue_date: issueDate,
        due_date: dueDate,
        subtotal: totals.subtotal,
        discount_amount: totals.discountAmount,
        tax_amount: totals.taxAmount,
        total: totals.total,
        paid_amount: 0,
        currency,
        status: 'Brouillon',
        payment_terms: paymentTerms,
        terms: terms.trim() || null,
        notes: notes.trim() || null,
        assigned_to: assignedTo || user.id,
        public_token: publicToken,
        created_by: user.id,
      };

      const { data: invoiceData, error: invoiceError } = await supabase
        .from('invoices')
        .insert(invoicePayload)
        .select()
        .single();

      if (invoiceError) throw invoiceError;

      // 2. Insert Invoice Items
      const itemsPayload = items
        .filter((it) => it.description.trim())
        .map((it, idx) => ({
          invoice_id: invoiceData.id,
          description: it.description.trim(),
          reference: it.reference.trim() || null,
          quantity: Number(it.quantity) || 1,
          unit: it.unit || 'unité',
          unit_price: Number(it.unit_price) || 0,
          discount_rate: Number(it.discount_rate) || 0,
          tax_rate: Number(it.tax_rate) || 18,
          total: Math.round((Number(it.quantity) || 1) * (Number(it.unit_price) || 0) * (1 - (Number(it.discount_rate) || 0) / 100)),
          sort_order: idx,
        }));

      const { error: itemsError } = await supabase.from('invoice_items').insert(itemsPayload);
      if (itemsError) throw itemsError;

      // 3. Log Activity
      const selectedCustomer = customers.find((c) => c.id === customerId);
      await supabase.from('activities').insert({
        company_id: currentCompany.id,
        user_id: user.id,
        action: 'Facture créée',
        entity_type: 'invoice',
        entity_id: invoiceData.id,
        entity_title: `Facture ${invoiceNumber}`,
        customer_id: customerId,
        description: `Facture ${invoiceNumber} d'un montant de ${formatMoney(totals.total, currency)} émise pour ${selectedCustomer?.name || 'Client'}${linkedQuote ? ` (depuis devis ${linkedQuote.quote_number})` : ''}`,
      });

      router.push(`/invoices/${invoiceData.id}`);
    } catch (err: any) {
      setErrorMsg(err.message || 'Erreur lors de la création de la facture.');
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/invoices"
            className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <span className="text-xs text-slate-400 font-medium">Factures / Nouvelle</span>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              {linkedQuote ? `Facturer le devis ${linkedQuote.quote_number}` : 'Créer une facture client'}
            </h1>
          </div>
        </div>
      </div>

      {linkedQuote && (
        <div className="p-4 rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200/80 dark:border-indigo-800 text-xs flex items-center gap-3 text-indigo-900 dark:text-indigo-200">
          <FileSpreadsheet className="w-5 h-5 text-indigo-600 flex-shrink-0" />
          <div>
            <span className="font-bold">Facture préremplie depuis le devis {linkedQuote.quote_number}</span>
            <p className="text-[11px] text-indigo-700/80 dark:text-indigo-300 mt-0.5">
              Les articles, quantités et conditions ont été importés automatiquement. Vous pouvez ajuster les informations avant enregistrement.
            </p>
          </div>
        </div>
      )}

      {errorMsg && (
        <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Section 1: Info */}
        <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <h2 className="text-sm font-extrabold text-slate-900 dark:text-white uppercase tracking-wider">
            1. Informations de facturation
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Numéro de facture *
              </label>
              <input
                type="text"
                required
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white text-xs font-mono font-bold focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Objet / Intitulé de la facture
              </label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Ex : Facture d'acompte / Solde de projet"
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
            <div className="sm:col-span-2">
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Client à facturer *
                </label>
                <button
                  type="button"
                  onClick={() => setNewCustomerModalOpen(true)}
                  className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" />
                  <span>Nouveau client</span>
                </button>
              </div>

              <select
                required
                value={customerId}
                onChange={(e) => setCustomerId(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              >
                <option value="">-- Choisir un client --</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.company_name ? `(${c.company_name})` : ''} — {c.city || 'Abidjan'}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Responsable
              </label>
              <select
                value={assignedTo}
                onChange={(e) => setAssignedTo(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              >
                {teamMembers.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Date d&apos;émission *
              </label>
              <input
                type="date"
                required
                value={issueDate}
                onChange={(e) => handleIssueDateChange(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Délai de règlement
              </label>
              <select
                value={paymentTerms}
                onChange={(e) => handlePaymentTermsChange(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              >
                <option value="comptant">Comptant (à réception)</option>
                <option value="7 jours">7 jours</option>
                <option value="15 jours">15 jours</option>
                <option value="30 jours">30 jours</option>
                <option value="45 jours">45 jours</option>
                <option value="60 jours">60 jours</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Date d&apos;échéance de paiement *
              </label>
              <input
                type="date"
                required
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white text-xs font-bold focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Section 2: Items Table */}
        <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-extrabold text-slate-900 dark:text-white uppercase tracking-wider">
              2. Lignes de facturation
            </h2>
            <button
              type="button"
              onClick={handleAddItem}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-xl text-xs font-bold hover:bg-indigo-100 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Ajouter une ligne</span>
            </button>
          </div>

          <div className="space-y-3">
            {items.map((item) => {
              const lineTotal =
                (Number(item.quantity) || 0) *
                (Number(item.unit_price) || 0) *
                (1 - (Number(item.discount_rate) || 0) / 100);

              return (
                <div
                  key={item.id}
                  className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 space-y-3"
                >
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-start">
                    <div className="sm:col-span-6">
                      <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                        Désignation *
                      </label>
                      <input
                        type="text"
                        required
                        value={item.description}
                        onChange={(e) => handleUpdateItem(item.id, 'description', e.target.value)}
                        placeholder="Description..."
                        className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                        Réf.
                      </label>
                      <input
                        type="text"
                        value={item.reference}
                        onChange={(e) => handleUpdateItem(item.id, 'reference', e.target.value)}
                        placeholder="Réf"
                        className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white text-xs font-mono focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                        Unité
                      </label>
                      <select
                        value={item.unit}
                        onChange={(e) => handleUpdateItem(item.id, 'unit', e.target.value)}
                        className="w-full px-2.5 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                      >
                        <option value="prestation">prestation</option>
                        <option value="unité">unité</option>
                        <option value="forfait">forfait</option>
                        <option value="jour">jour</option>
                        <option value="heure">heure</option>
                        <option value="lot">lot</option>
                      </select>
                    </div>

                    <div className="sm:col-span-2 flex items-center justify-end pt-5">
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(item.id)}
                        disabled={items.length <= 1}
                        className="p-2 text-slate-400 hover:text-rose-500 disabled:opacity-30 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1 border-t border-slate-200/60 dark:border-slate-700/40">
                    <div>
                      <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">
                        Quantité
                      </label>
                      <input
                        type="number"
                        min="0.01"
                        step="any"
                        required
                        value={item.quantity}
                        onChange={(e) => handleUpdateItem(item.id, 'quantity', parseFloat(e.target.value) || 0)}
                        className="w-full px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">
                        Prix Unitaire ({currency})
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="any"
                        required
                        value={item.unit_price}
                        onChange={(e) => handleUpdateItem(item.id, 'unit_price', parseFloat(e.target.value) || 0)}
                        className="w-full px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">
                        Remise (%)
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={item.discount_rate}
                        onChange={(e) => handleUpdateItem(item.id, 'discount_rate', parseFloat(e.target.value) || 0)}
                        className="w-full px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:outline-none"
                      />
                    </div>

                    <div className="flex flex-col justify-end text-right">
                      <span className="text-[10px] uppercase font-bold text-slate-400">Total HT</span>
                      <span className="text-xs font-bold text-slate-900 dark:text-white mt-1">
                        {formatMoney(lineTotal, currency)}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Totals */}
          <div className="flex justify-end pt-4 border-t border-slate-100 dark:border-slate-800">
            <div className="w-full sm:w-80 space-y-2 text-xs">
              <div className="flex justify-between text-slate-600 dark:text-slate-400">
                <span>Sous-total HT :</span>
                <span className="font-semibold text-slate-900 dark:text-white">
                  {formatMoney(totals.subtotal, currency)}
                </span>
              </div>

              <div className="flex items-center justify-between text-slate-600 dark:text-slate-400 gap-2">
                <span>Remise globale (%) :</span>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={globalDiscountRate}
                  onChange={(e) => setGlobalDiscountRate(parseFloat(e.target.value) || 0)}
                  className="w-16 px-2 py-1 text-right bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs"
                />
              </div>

              {totals.discountAmount > 0 && (
                <div className="flex justify-between text-rose-500 font-semibold">
                  <span>Montant remise :</span>
                  <span>-{formatMoney(totals.discountAmount, currency)}</span>
                </div>
              )}

              <div className="flex items-center justify-between text-slate-600 dark:text-slate-400 gap-2">
                <span>TVA (%) :</span>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={defaultTaxRate}
                  onChange={(e) => setDefaultTaxRate(parseFloat(e.target.value) || 0)}
                  className="w-16 px-2 py-1 text-right bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs"
                />
              </div>

              <div className="flex justify-between text-slate-600 dark:text-slate-400">
                <span>TVA :</span>
                <span className="font-semibold text-slate-900 dark:text-white">
                  {formatMoney(totals.taxAmount, currency)}
                </span>
              </div>

              <div className="flex justify-between text-sm font-extrabold text-slate-900 dark:text-white pt-2 border-t border-slate-200 dark:border-slate-700">
                <span>Total TTC à payer :</span>
                <span className="text-indigo-600 dark:text-indigo-400 font-black">
                  {formatMoney(totals.total, currency)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Section 3: Terms */}
        <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <h2 className="text-sm font-extrabold text-slate-900 dark:text-white uppercase tracking-wider">
            3. Conditions & Coordonnées bancaires
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Conditions de paiement
              </label>
              <textarea
                rows={3}
                value={terms}
                onChange={(e) => setTerms(e.target.value)}
                className="w-full p-3 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none resize-none leading-relaxed"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Notes ou informations de règlement (IBAN, Mobile Money...)
              </label>
              <textarea
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Ex : Virement sur compte BOA CI CI032... ou Wave au 07..."
                className="w-full p-3 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none resize-none leading-relaxed"
              />
            </div>
          </div>
        </div>

        {/* Bottom Actions */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <Link
            href="/invoices"
            className="px-5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
          >
            Annuler
          </Link>
          <button
            type="submit"
            disabled={loading}
            className="px-8 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs rounded-xl shadow-md shadow-indigo-600/20 transition-all flex items-center gap-2 disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Création de la facture...</span>
              </>
            ) : (
              <>
                <Receipt className="w-4 h-4" />
                <span>Émettre la facture</span>
              </>
            )}
          </button>
        </div>
      </form>

      <CustomerModal
        isOpen={newCustomerModalOpen}
        onClose={() => setNewCustomerModalOpen(false)}
        onSuccess={(newCust) => {
          if (newCust) {
            setCustomers((prev) => [newCust, ...prev]);
            setCustomerId(newCust.id);
          }
        }}
      />
    </div>
  );
}
