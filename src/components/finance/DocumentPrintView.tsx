'use client';

import React from 'react';
import { Company, Customer, Quote, Invoice, QuoteItem, InvoiceItem } from '@/lib/types';
import { formatMoney } from '@/lib/finance/money';
import { Printer, Download, ArrowLeft, Mail, Phone, MapPin, Building } from 'lucide-react';

interface DocumentPrintViewProps {
  type: 'quote' | 'invoice';
  company: Company;
  document: Quote | Invoice;
  customer?: Customer | null;
  items: (QuoteItem | InvoiceItem)[];
  onClose?: () => void;
}

export default function DocumentPrintView({
  type,
  company,
  document,
  customer,
  items,
  onClose,
}: DocumentPrintViewProps) {
  const isQuote = type === 'quote';
  const quote = isQuote ? (document as Quote) : null;
  const invoice = !isQuote ? (document as Invoice) : null;

  const docNumber = isQuote ? quote?.quote_number : invoice?.invoice_number;
  const docTitle = isQuote ? 'DEVIS' : 'FACTURE';
  const currency = document.currency || company.currency || 'FCFA';

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 p-4 sm:p-8 print:p-0 print:bg-white text-slate-900">
      {/* Top action toolbar (hidden on print) */}
      <div className="max-w-4xl mx-auto mb-6 flex items-center justify-between print:hidden">
        {onClose && (
          <button
            onClick={onClose}
            className="inline-flex items-center gap-2 px-3.5 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 transition-colors shadow-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Retour</span>
          </button>
        )}

        <div className="flex items-center gap-3">
          <button
            onClick={handlePrint}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-600/20 transition-all"
          >
            <Printer className="w-4 h-4" />
            <span>Imprimer / Télécharger en PDF</span>
          </button>
        </div>
      </div>

      {/* Printable Sheet (A4 format) */}
      <div className="max-w-4xl mx-auto bg-white border border-slate-200 print:border-none rounded-3xl print:rounded-none p-8 sm:p-12 shadow-xl print:shadow-none space-y-8 text-slate-900">
        {/* Header: Company & Document Title */}
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
              {docTitle}
            </span>
            <span className="text-sm font-bold text-slate-700 block mt-1">
              N° {docNumber}
            </span>

            <div className="mt-4 space-y-1 text-xs text-slate-600">
              <p>
                <span className="text-slate-400">Date d&apos;émission : </span>
                <span className="font-semibold text-slate-900">
                  {new Date(document.issue_date).toLocaleDateString('fr-FR')}
                </span>
              </p>
              {isQuote ? (
                <p>
                  <span className="text-slate-400">Date d&apos;expiration : </span>
                  <span className="font-semibold text-slate-900">
                    {new Date(quote!.expiration_date).toLocaleDateString('fr-FR')}
                  </span>
                </p>
              ) : (
                <p>
                  <span className="text-slate-400">Date d&apos;échéance : </span>
                  <span className="font-semibold text-slate-900">
                    {new Date(invoice!.due_date).toLocaleDateString('fr-FR')}
                  </span>
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Client Details */}
        <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100 flex flex-col sm:flex-row justify-between gap-6">
          <div>
            <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider block mb-2">
              Destinataire (Client)
            </span>
            <h3 className="text-sm font-extrabold text-slate-900">
              {customer?.name || (document as any).customer_name || 'Client sans nom'}
            </h3>
            {customer?.company_name && (
              <p className="text-xs font-semibold text-slate-700 mt-0.5">{customer.company_name}</p>
            )}
            {customer?.address && <p className="text-xs text-slate-600 mt-1">{customer.address}</p>}
            <p className="text-xs text-slate-600">{customer?.city || 'Abidjan'}</p>
          </div>

          <div className="sm:text-right text-xs text-slate-600 space-y-1">
            {customer?.phone && <p>Tél : {customer.phone}</p>}
            {customer?.email && <p>Email : {customer.email}</p>}
          </div>
        </div>

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

        {/* Totals Summary */}
        <div className="flex justify-end pt-4 border-t border-slate-200">
          <div className="w-full sm:w-80 space-y-2 text-xs">
            <div className="flex justify-between text-slate-600">
              <span>Sous-total HT :</span>
              <span className="font-semibold text-slate-900">{formatMoney(document.subtotal, currency)}</span>
            </div>

            {Number(document.discount_amount) > 0 && (
              <div className="flex justify-between text-slate-600">
                <span>Remise :</span>
                <span className="font-semibold text-rose-600">-{formatMoney(document.discount_amount, currency)}</span>
              </div>
            )}

            <div className="flex justify-between text-slate-600">
              <span>TVA (18%) :</span>
              <span className="font-semibold text-slate-900">{formatMoney(document.tax_amount, currency)}</span>
            </div>

            <div className="flex justify-between text-sm font-black text-slate-900 pt-3 border-t-2 border-slate-900">
              <span>Total TTC :</span>
              <span className="text-indigo-600">{formatMoney(document.total, currency)}</span>
            </div>

            {/* Paid & Remaining for invoices */}
            {!isQuote && (
              <>
                <div className="flex justify-between text-slate-600 pt-2 border-t border-slate-100">
                  <span>Montant réglé :</span>
                  <span className="font-bold text-emerald-600">{formatMoney(invoice!.paid_amount, currency)}</span>
                </div>
                <div className="flex justify-between text-xs font-black pt-1">
                  <span>Solde restant à payer :</span>
                  <span className={invoice!.remaining_amount > 0 ? 'text-amber-600' : 'text-slate-900'}>
                    {formatMoney(invoice!.remaining_amount, currency)}
                  </span>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Terms & Notes */}
        {(document.terms || document.notes) && (
          <div className="pt-6 border-t border-slate-200 text-[11px] text-slate-500 space-y-2">
            {document.terms && (
              <div>
                <span className="font-bold uppercase text-slate-400 block mb-1">Conditions de règlement :</span>
                <p className="whitespace-pre-wrap leading-relaxed">{document.terms}</p>
              </div>
            )}
            {document.notes && (
              <div className="mt-2">
                <span className="font-bold uppercase text-slate-400 block mb-1">Remarques :</span>
                <p className="whitespace-pre-wrap leading-relaxed">{document.notes}</p>
              </div>
            )}
          </div>
        )}

        {/* Footer Legal Mentions */}
        <div className="pt-8 border-t border-slate-200 text-center text-[10px] text-slate-400">
          <p>{company.name} — Siège social : {company.city}, {company.country}</p>
          <p className="mt-0.5">Document généré automatiquement via BusinessOS.</p>
        </div>
      </div>
    </div>
  );
}
