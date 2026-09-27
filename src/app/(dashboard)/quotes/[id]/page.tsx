'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { createClient } from '@/lib/supabase/client';
import { Quote, QuoteItem, QuoteStatus, Activity } from '@/lib/types';
import { formatMoney } from '@/lib/finance/money';
import { 
  ArrowLeft, 
  Printer, 
  Share2, 
  Receipt, 
  Edit3, 
  Trash2, 
  Loader2, 
  CheckCircle2, 
  XCircle, 
  Send, 
  Clock, 
  FileText, 
  Building, 
  Copy, 
  ExternalLink,
  MessageSquare,
  AlertTriangle,
  Mail
} from 'lucide-react';
import Link from 'next/link';
import DocumentPrintView from '@/components/finance/DocumentPrintView';
import EmailModal from '@/components/finance/EmailModal';

const STATUS_OPTIONS: QuoteStatus[] = [
  'Brouillon',
  'Envoyé',
  'Consulté',
  'Accepté',
  'Refusé',
  'Expiré',
  'Annulé',
];

const STATUS_COLORS: Record<QuoteStatus, string> = {
  'Brouillon': 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20',
  'Envoyé': 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
  'Consulté': 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20',
  'Accepté': 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
  'Refusé': 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20',
  'Expiré': 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
  'Annulé': 'bg-slate-400/10 text-slate-400 border-slate-400/20',
};

export default function QuoteDetailPage() {
  const params = useParams();
  const router = useRouter();
  const quoteId = params?.id as string;

  const { currentCompany, user } = useAuth();
  const supabase = createClient();

  const [quote, setQuote] = useState<Quote | null>(null);
  const [items, setItems] = useState<QuoteItem[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPrintView, setShowPrintView] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [emailModalOpen, setEmailModalOpen] = useState(false);

  const fetchQuote = async () => {
    if (!currentCompany?.id || !quoteId) return;
    setLoading(true);

    try {
      // 1. Fetch Quote
      const { data: quoteData, error: quoteError } = await supabase
        .from('quotes')
        .select('*, customer:customer_id(*), assignee:assigned_to(full_name, email)')
        .eq('id', quoteId)
        .eq('company_id', currentCompany.id)
        .single();

      if (quoteError || !quoteData) {
        router.push('/quotes');
        return;
      }
      setQuote(quoteData as Quote);

      // 2. Fetch Items
      const { data: itemsData } = await supabase
        .from('quote_items')
        .select('*')
        .eq('quote_id', quoteId)
        .order('sort_order', { ascending: true });

      if (itemsData) setItems(itemsData as QuoteItem[]);

      // 3. Fetch Activities
      const { data: actData } = await supabase
        .from('activities')
        .select('*, user:user_id(full_name, email)')
        .eq('company_id', currentCompany.id)
        .eq('entity_id', quoteId)
        .order('created_at', { ascending: false });

      if (actData) setActivities(actData as Activity[]);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQuote();
  }, [currentCompany?.id, quoteId]);

  const handleStatusChange = async (newStatus: QuoteStatus) => {
    if (!quote || !currentCompany?.id || !user) return;
    const oldStatus = quote.status;
    if (oldStatus === newStatus) return;

    setQuote({ ...quote, status: newStatus });

    const updatePayload: any = {
      status: newStatus,
      updated_at: new Date().toISOString(),
    };
    if (newStatus === 'Accepté') updatePayload.accepted_at = new Date().toISOString();
    if (newStatus === 'Refusé') updatePayload.rejected_at = new Date().toISOString();

    await supabase.from('quotes').update(updatePayload).eq('id', quote.id);

    // Log Activity
    await supabase.from('activities').insert({
      company_id: currentCompany.id,
      user_id: user.id,
      action: 'Changement de statut',
      entity_type: 'quote',
      entity_id: quote.id,
      entity_title: `Devis ${quote.quote_number}`,
      customer_id: quote.customer_id,
      description: `Devis ${quote.quote_number} : passage de "${oldStatus}" à "${newStatus}" par ${user.email}`,
    });

    fetchQuote();
  };

  const handleCopyPublicLink = () => {
    if (!quote) return;
    const token = quote.public_token || quote.id;
    const url = `${window.location.origin}/quote/view/${token}`;
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  if (loading) {
    return (
      <div className="p-20 text-center text-slate-400">
        <Loader2 className="w-8 h-8 animate-spin mx-auto text-indigo-500 mb-2" />
        <span className="text-xs">Chargement du devis...</span>
      </div>
    );
  }

  if (!quote || !currentCompany) return null;

  if (showPrintView) {
    return (
      <DocumentPrintView
        type="quote"
        company={currentCompany}
        document={quote}
        customer={quote.customer}
        items={items}
        onClose={() => setShowPrintView(false)}
      />
    );
  }

  const cleanPhone = quote.customer?.phone ? quote.customer.phone.replace(/[^0-9]/g, '') : null;
  const token = quote.public_token || quote.id;
  const publicUrl = typeof window !== 'undefined' ? `${window.location.origin}/quote/view/${token}` : '';
  const whatsappUrl = cleanPhone
    ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(
        `Bonjour ${quote.customer?.name || 'Client'},\nVeuillez trouver votre devis n° ${quote.quote_number} d'un montant de ${formatMoney(
          quote.total,
          quote.currency
        )} consultable en ligne ici : ${publicUrl}`
      )}`
    : null;

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/quotes"
            className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400 font-medium">Devis</span>
              <span className="text-xs text-slate-300 dark:text-slate-700">/</span>
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                {quote.quote_number}
              </span>
            </div>
            <div className="flex items-center gap-3 mt-0.5">
              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                Devis {quote.quote_number}
              </h1>
              <select
                value={quote.status}
                onChange={(e) => handleStatusChange(e.target.value as QuoteStatus)}
                className={`px-3 py-1 rounded-xl text-xs font-bold border transition-all ${
                  STATUS_COLORS[quote.status]
                }`}
              >
                {STATUS_OPTIONS.map((st) => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {quote.status === 'Accepté' && (
            <Link
              href={`/invoices/new?from_quote_id=${quote.id}`}
              className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow-md shadow-emerald-600/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              <Receipt className="w-4 h-4" />
              <span>Créer la facture</span>
            </Link>
          )}

          <button
            onClick={() => setShowPrintView(true)}
            className="inline-flex items-center gap-2 px-3.5 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-slate-300 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-xl shadow-sm transition-all"
          >
            <Printer className="w-4 h-4 text-indigo-500" />
            <span>Imprimer / PDF</span>
          </button>

          <button
            onClick={handleCopyPublicLink}
            className="inline-flex items-center gap-2 px-3.5 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-slate-300 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-xl shadow-sm transition-all"
            title="Lien public pour consultation par le client"
          >
            <Share2 className="w-4 h-4 text-blue-500" />
            <span>{copiedLink ? 'Lien copié !' : 'Partager'}</span>
          </button>

          <button
            onClick={() => setEmailModalOpen(true)}
            className="inline-flex items-center gap-2 px-3.5 py-2 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/60 hover:bg-indigo-100 text-indigo-700 dark:text-indigo-300 text-xs font-semibold rounded-xl transition-all"
          >
            <Mail className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            <span>Envoyer par email</span>
          </button>

          {whatsappUrl && (
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 rounded-xl text-xs font-semibold hover:bg-emerald-100 transition-colors"
            >
              <MessageSquare className="w-4 h-4" />
              <span>WhatsApp</span>
            </a>
          )}
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Details & Items (2 spans) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Card: Client & Subject */}
          <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                  Destinataire
                </span>
                <Link
                  href={`/customers/${quote.customer_id}`}
                  className="text-base font-extrabold text-slate-900 dark:text-white hover:text-indigo-600 block"
                >
                  {quote.customer?.name || (quote as any).customer_name || 'Client sans nom'}
                </Link>
                {quote.customer?.company_name && (
                  <p className="text-xs text-slate-500">{quote.customer.company_name}</p>
                )}
              </div>

              <div className="text-left sm:text-right text-xs space-y-1 text-slate-600 dark:text-slate-400">
                <p>Émis le : <strong className="text-slate-900 dark:text-white">{new Date(quote.issue_date).toLocaleDateString('fr-FR')}</strong></p>
                <p>Échéance le : <strong className="text-slate-900 dark:text-white">{new Date(quote.expiration_date).toLocaleDateString('fr-FR')}</strong></p>
              </div>
            </div>

            {quote.subject && (
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Objet</span>
                <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">{quote.subject}</p>
              </div>
            )}
          </div>

          {/* Card: Items Table */}
          <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <h2 className="text-sm font-extrabold text-slate-900 dark:text-white uppercase tracking-wider">
              Lignes de prestations ({items.length})
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
                        {formatMoney(it.unit_price, quote.currency)}
                      </td>
                      <td className="py-3.5 px-2 text-right font-black text-slate-900 dark:text-white">
                        {formatMoney(it.total, quote.currency)}
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
                    {formatMoney(quote.subtotal, quote.currency)}
                  </span>
                </div>

                {Number(quote.discount_amount) > 0 && (
                  <div className="flex justify-between text-rose-500 font-semibold">
                    <span>Remise ({quote.discount_rate}%) :</span>
                    <span>-{formatMoney(quote.discount_amount, quote.currency)}</span>
                  </div>
                )}

                <div className="flex justify-between text-slate-600 dark:text-slate-400">
                  <span>TVA ({quote.tax_rate}%) :</span>
                  <span className="font-semibold text-slate-900 dark:text-white">
                    {formatMoney(quote.tax_amount, quote.currency)}
                  </span>
                </div>

                <div className="flex justify-between text-sm font-black text-slate-900 dark:text-white pt-2 border-t border-slate-200 dark:border-slate-700">
                  <span>Total TTC :</span>
                  <span className="text-indigo-600 dark:text-indigo-400 font-black">
                    {formatMoney(quote.total, quote.currency)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Terms & Notes */}
          {(quote.terms || quote.notes) && (
            <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3 text-xs">
              {quote.terms && (
                <div>
                  <span className="text-[10px] font-bold uppercase text-slate-400 block mb-1">
                    Conditions de règlement & validité
                  </span>
                  <p className="whitespace-pre-wrap text-slate-600 dark:text-slate-300 leading-relaxed">
                    {quote.terms}
                  </p>
                </div>
              )}
              {quote.notes && (
                <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                  <span className="text-[10px] font-bold uppercase text-slate-400 block mb-1">
                    Notes
                  </span>
                  <p className="whitespace-pre-wrap text-slate-600 dark:text-slate-300 leading-relaxed">
                    {quote.notes}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Column: Actions & Activity Timeline */}
        <div className="space-y-6">
          {/* Public Link Card */}
          <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
            <h3 className="text-xs font-bold uppercase text-slate-400 tracking-wider">
              Lien de consultation client
            </h3>
            <p className="text-[11px] text-slate-500">
              Permet au client de visualiser, accepter ou refuser le devis en ligne sans être connecté.
            </p>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={publicUrl}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-[11px] text-slate-600 dark:text-slate-300 font-mono truncate"
              />
              <button
                type="button"
                onClick={handleCopyPublicLink}
                className="p-2 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-xl hover:bg-indigo-100 transition-colors flex-shrink-0"
                title="Copier le lien"
              >
                <Copy className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Timeline */}
          <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
              Historique du devis ({activities.length})
            </h3>

            {activities.length === 0 ? (
              <p className="text-xs text-slate-400 italic py-4 text-center">Aucune activité enregistrée.</p>
            ) : (
              <div className="relative pl-5 space-y-4 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200 dark:before:bg-slate-800">
                {activities.map((act) => (
                  <div key={act.id} className="relative">
                    <div className="absolute -left-5 top-1.5 w-3.5 h-3.5 rounded-full bg-indigo-500 ring-4 ring-white dark:ring-slate-900" />
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

      {/* Email Modal */}
      {emailModalOpen && (
        <EmailModal
          isOpen={true}
          onClose={() => setEmailModalOpen(false)}
          onSuccess={fetchQuote}
          recipientEmail={quote.customer?.email}
          customerName={quote.customer?.name}
          entityType="quote"
          entityId={quote.id}
          entityNumber={quote.quote_number}
          amount={formatMoney(quote.total, quote.currency)}
          dueDate={quote.expiration_date}
          publicUrl={publicUrl}
        />
      )}
    </div>
  );
}
