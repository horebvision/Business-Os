'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Quote, QuoteItem, Company } from '@/lib/types';
import { formatMoney } from '@/lib/finance/money';
import { 
  CheckCircle2, 
  XCircle, 
  Printer, 
  Building, 
  Calendar, 
  Loader2, 
  FileText, 
  AlertCircle,
  ThumbsUp,
  ThumbsDown
} from 'lucide-react';

export default function PublicQuoteViewPage() {
  const params = useParams();
  const token = params?.token as string;
  const supabase = createClient();

  const [quote, setQuote] = useState<Quote | null>(null);
  const [items, setItems] = useState<QuoteItem[]>([]);
  const [company, setCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [rejectionModalOpen, setRejectionModalOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (!token) return;

    const loadPublicQuote = async () => {
      setLoading(true);

      // Fetch quote by public_token OR by id (fallback)
      const { data: quoteData, error } = await supabase
        .from('quotes')
        .select('*, customer:customer_id(*), company:company_id(*)')
        .or(`public_token.eq.${token},id.eq.${token}`)
        .single();

      if (error || !quoteData) {
        setLoading(false);
        return;
      }

      setQuote(quoteData as Quote);
      setCompany(quoteData.company as Company);

      // Fetch items
      const { data: itemsData } = await supabase
        .from('quote_items')
        .select('*')
        .eq('quote_id', quoteData.id)
        .order('sort_order', { ascending: true });

      if (itemsData) setItems(itemsData as QuoteItem[]);

      // If status is 'Envoyé', automatically update to 'Consulté'
      if (quoteData.status === 'Envoyé') {
        await supabase
          .from('quotes')
          .update({
            status: 'Consulté',
            updated_at: new Date().toISOString(),
          })
          .eq('id', quoteData.id);

        await supabase.from('activities').insert({
          company_id: quoteData.company_id,
          action: 'Devis consulté',
          entity_type: 'quote',
          entity_id: quoteData.id,
          entity_title: `Devis ${quoteData.quote_number}`,
          customer_id: quoteData.customer_id,
          description: `Devis ${quoteData.quote_number} ouvert et consulté en ligne par le client`,
        });

        setQuote((prev) => (prev ? { ...prev, status: 'Consulté' } : prev));
      }

      setLoading(false);
    };

    loadPublicQuote();
  }, [token, supabase]);

  const handleAcceptQuote = async () => {
    if (!quote) return;
    setActionLoading(true);
    setFeedbackMsg(null);

    try {
      const nowIso = new Date().toISOString();
      const { error } = await supabase
        .from('quotes')
        .update({
          status: 'Accepté',
          accepted_at: nowIso,
          updated_at: nowIso,
        })
        .eq('id', quote.id);

      if (error) throw error;

      await supabase.from('activities').insert({
        company_id: quote.company_id,
        action: 'Devis accepté',
        entity_type: 'quote',
        entity_id: quote.id,
        entity_title: `Devis ${quote.quote_number}`,
        customer_id: quote.customer_id,
        description: `Le devis ${quote.quote_number} a été accepté en ligne par le client !`,
      });

      setQuote({ ...quote, status: 'Accepté', accepted_at: nowIso });
      setFeedbackMsg({
        type: 'success',
        text: 'Merci ! Vous avez accepté ce devis. Notre équipe prépare votre dossier et vous contactera rapidement.',
      });
    } catch (err: any) {
      setFeedbackMsg({ type: 'error', text: err.message || 'Une erreur est survenue lors de la validation.' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleRejectQuote = async () => {
    if (!quote) return;
    setActionLoading(true);
    setFeedbackMsg(null);

    try {
      const nowIso = new Date().toISOString();
      const { error } = await supabase
        .from('quotes')
        .update({
          status: 'Refusé',
          rejected_at: nowIso,
          rejected_reason: rejectionReason.trim() || null,
          updated_at: nowIso,
        })
        .eq('id', quote.id);

      if (error) throw error;

      await supabase.from('activities').insert({
        company_id: quote.company_id,
        action: 'Devis refusé',
        entity_type: 'quote',
        entity_id: quote.id,
        entity_title: `Devis ${quote.quote_number}`,
        customer_id: quote.customer_id,
        description: `Le devis ${quote.quote_number} a été décliné par le client. Motif : ${rejectionReason || 'Non précisé'}`,
      });

      setQuote({
        ...quote,
        status: 'Refusé',
        rejected_at: nowIso,
        rejected_reason: rejectionReason.trim(),
      });
      setRejectionModalOpen(false);
      setFeedbackMsg({
        type: 'success',
        text: 'Votre réponse a été transmise au prestataire. Merci pour votre retour.',
      });
    } catch (err: any) {
      setFeedbackMsg({ type: 'error', text: err.message || 'Une erreur est survenue lors du refus.' });
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="text-center text-slate-500">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-indigo-600 mb-2" />
          <span className="text-sm font-medium">Chargement de votre devis...</span>
        </div>
      </div>
    );
  }

  if (!quote || !company) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="max-w-md w-full p-8 bg-white rounded-3xl border border-slate-200 shadow-xl text-center">
          <AlertCircle className="w-12 h-12 text-rose-500 mx-auto mb-3" />
          <h2 className="text-lg font-bold text-slate-900">Document introuvable ou expiré</h2>
          <p className="text-xs text-slate-500 mt-1">
            Ce lien de consultation de devis est invalide ou a été révoqué. Veuillez contacter votre prestataire pour recevoir un nouveau lien.
          </p>
        </div>
      </div>
    );
  }

  const currency = quote.currency || company.currency || 'FCFA';
  const isDecided = ['Accepté', 'Refusé', 'Annulé'].includes(quote.status);

  return (
    <div className="min-h-screen bg-slate-100 py-8 px-4 sm:px-6 print:p-0 print:bg-white text-slate-900">
      {/* Top Banner Actions for Client */}
      <div className="max-w-4xl mx-auto mb-6 print:hidden">
        {feedbackMsg && (
          <div
            className={`p-4 rounded-2xl mb-4 text-xs font-semibold flex items-center gap-3 ${
              feedbackMsg.type === 'success'
                ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-800'
                : 'bg-rose-500/10 border border-rose-500/20 text-rose-800'
            }`}
          >
            <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
            <span>{feedbackMsg.text}</span>
          </div>
        )}

        <div className="p-4 sm:p-5 bg-white border border-slate-200 rounded-2xl shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-500">Statut actuel du devis :</span>
            <span
              className={`px-3 py-1 rounded-full text-xs font-bold ${
                quote.status === 'Accepté'
                  ? 'bg-emerald-100 text-emerald-700'
                  : quote.status === 'Refusé'
                  ? 'bg-rose-100 text-rose-700'
                  : 'bg-indigo-100 text-indigo-700'
              }`}
            >
              {quote.status}
            </span>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Imprimer</span>
            </button>

            {!isDecided && (
              <>
                <button
                  onClick={() => setRejectionModalOpen(true)}
                  disabled={actionLoading}
                  className="inline-flex items-center gap-1.5 px-4 py-2 border border-rose-200 hover:bg-rose-50 text-rose-600 rounded-xl text-xs font-bold transition-colors"
                >
                  <ThumbsDown className="w-3.5 h-3.5" />
                  <span>Refuser</span>
                </button>

                <button
                  onClick={handleAcceptQuote}
                  disabled={actionLoading}
                  className="inline-flex items-center gap-1.5 px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-extrabold shadow-md shadow-emerald-600/20 transition-all hover:scale-[1.02]"
                >
                  {actionLoading ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <ThumbsUp className="w-3.5 h-3.5" />
                  )}
                  <span>Accepter le devis</span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Main Quote Printable Sheet */}
      <div className="max-w-4xl mx-auto bg-white border border-slate-200 print:border-none rounded-3xl print:rounded-none p-8 sm:p-12 shadow-xl print:shadow-none space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start gap-6 border-b border-slate-200 pb-8">
          <div>
            <div className="flex items-center gap-3">
              {company.logo_url ? (
                <img src={company.logo_url} alt={company.name} className="h-12 w-auto object-contain" />
              ) : (
                <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white font-black text-xl flex items-center justify-center">
                  {company.name.charAt(0)}
                </div>
              )}
              <div>
                <h2 className="text-xl font-black text-slate-900 tracking-tight">{company.name}</h2>
                <p className="text-xs text-slate-500 font-medium">{company.sector || 'Entreprise'}</p>
              </div>
            </div>

            <div className="mt-4 space-y-1 text-xs text-slate-600">
              {company.address && <p>{company.address}</p>}
              <p>{company.city}, {company.country}</p>
              {company.phone && <p>Tél : {company.phone}</p>}
              {company.email && <p>Email : {company.email}</p>}
            </div>
          </div>

          <div className="text-left sm:text-right">
            <span className="text-3xl font-black text-indigo-600 tracking-tight block">
              DEVIS
            </span>
            <span className="text-sm font-bold text-slate-700 block mt-1">
              N° {quote.quote_number}
            </span>

            <div className="mt-4 space-y-1 text-xs text-slate-600">
              <p>
                <span className="text-slate-400">Date d&apos;émission : </span>
                <span className="font-semibold text-slate-900">
                  {new Date(quote.issue_date).toLocaleDateString('fr-FR')}
                </span>
              </p>
              <p>
                <span className="text-slate-400">Validité jusqu&apos;au : </span>
                <span className="font-semibold text-slate-900">
                  {new Date(quote.expiration_date).toLocaleDateString('fr-FR')}
                </span>
              </p>
            </div>
          </div>
        </div>

        {/* Client details */}
        <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100 flex flex-col sm:flex-row justify-between gap-6">
          <div>
            <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider block mb-2">
              Destinataire (Client)
            </span>
            <h3 className="text-sm font-extrabold text-slate-900">
              {quote.customer?.name || (quote as any).customer_name || 'Client sans nom'}
            </h3>
            {quote.customer?.company_name && (
              <p className="text-xs font-semibold text-slate-700 mt-0.5">{quote.customer.company_name}</p>
            )}
            {quote.customer?.address && <p className="text-xs text-slate-600 mt-1">{quote.customer.address}</p>}
            <p className="text-xs text-slate-600">{quote.customer?.city || 'Abidjan'}</p>
          </div>

          <div className="sm:text-right text-xs text-slate-600 space-y-1">
            {quote.customer?.phone && <p>Tél : {quote.customer.phone}</p>}
            {quote.customer?.email && <p>Email : {quote.customer.email}</p>}
          </div>
        </div>

        {/* Subject if any */}
        {quote.subject && (
          <div className="p-4 rounded-xl bg-indigo-50/50 border border-indigo-100 text-xs">
            <span className="font-bold text-indigo-900 block mb-0.5">Objet de la proposition :</span>
            <p className="text-slate-700">{quote.subject}</p>
          </div>
        )}

        {/* Items Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b-2 border-slate-900 text-slate-900 font-bold uppercase text-[10px] tracking-wider">
                <th className="py-3 px-2">Désignation</th>
                <th className="py-3 px-2 text-center">Quantité</th>
                <th className="py-3 px-2 text-right">Prix Unitaire</th>
                <th className="py-3 px-2 text-right">Total HT</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((item, idx) => (
                <tr key={idx} className="hover:bg-slate-50/50">
                  <td className="py-3.5 px-2">
                    <p className="font-bold text-slate-900">{item.description}</p>
                    {item.reference && (
                      <span className="text-[10px] text-slate-400 font-mono">Réf: {item.reference}</span>
                    )}
                  </td>
                  <td className="py-3.5 px-2 text-center text-slate-700 font-semibold">
                    {item.quantity} {item.unit || ''}
                  </td>
                  <td className="py-3.5 px-2 text-right text-slate-700">
                    {formatMoney(item.unit_price, currency)}
                  </td>
                  <td className="py-3.5 px-2 text-right font-bold text-slate-900">
                    {formatMoney(item.total, currency)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals */}
        <div className="flex justify-end pt-4 border-t border-slate-200">
          <div className="w-full sm:w-80 space-y-2 text-xs">
            <div className="flex justify-between text-slate-600">
              <span>Sous-total HT :</span>
              <span className="font-semibold text-slate-900">{formatMoney(quote.subtotal, currency)}</span>
            </div>

            {Number(quote.discount_amount) > 0 && (
              <div className="flex justify-between text-slate-600">
                <span>Remise :</span>
                <span className="font-semibold text-rose-600">-{formatMoney(quote.discount_amount, currency)}</span>
              </div>
            )}

            <div className="flex justify-between text-slate-600">
              <span>TVA (18%) :</span>
              <span className="font-semibold text-slate-900">{formatMoney(quote.tax_amount, currency)}</span>
            </div>

            <div className="flex justify-between text-sm font-black text-slate-900 pt-3 border-t-2 border-slate-900">
              <span>Total TTC :</span>
              <span className="text-indigo-600">{formatMoney(quote.total, currency)}</span>
            </div>
          </div>
        </div>

        {/* Terms */}
        {(quote.terms || quote.notes) && (
          <div className="pt-6 border-t border-slate-200 text-[11px] text-slate-500 space-y-2">
            {quote.terms && (
              <div>
                <span className="font-bold uppercase text-slate-400 block mb-1">Conditions de règlement :</span>
                <p className="whitespace-pre-wrap leading-relaxed">{quote.terms}</p>
              </div>
            )}
            {quote.notes && (
              <div className="mt-2">
                <span className="font-bold uppercase text-slate-400 block mb-1">Remarques :</span>
                <p className="whitespace-pre-wrap leading-relaxed">{quote.notes}</p>
              </div>
            )}
          </div>
        )}

        {/* Bottom acceptance banner if not decided */}
        {!isDecided && (
          <div className="pt-8 border-t border-slate-200 print:hidden text-center space-y-3">
            <p className="text-xs text-slate-500">
              Pour valider cette proposition commerciale, cliquez sur le bouton d&apos;acceptation ci-dessous.
            </p>
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={() => setRejectionModalOpen(true)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-rose-600"
              >
                Décliner l&apos;offre
              </button>
              <button
                onClick={handleAcceptQuote}
                disabled={actionLoading}
                className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-emerald-600/20"
              >
                Accepter le devis ({formatMoney(quote.total, currency)})
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Rejection Reason Modal */}
      {rejectionModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl">
            <h3 className="text-base font-bold text-slate-900 mb-1">Décliner le devis</h3>
            <p className="text-xs text-slate-500 mb-4">
              Veuillez indiquer le motif de votre refus afin d&apos;aider votre prestataire à adapter son offre (facultatif).
            </p>

            <textarea
              rows={3}
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="Ex : Tarif supérieur au budget, projet reporté..."
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-rose-500 resize-none"
            />

            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setRejectionModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleRejectQuote}
                disabled={actionLoading}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold shadow-md shadow-rose-600/20"
              >
                Confirmer le refus
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
