'use client';

import React from 'react';
import { Payment, Customer } from '@/lib/types';
import { formatMoney } from '@/lib/finance/money';
import { CheckCircle2, Printer, X, Building2, ShieldCheck } from 'lucide-react';

interface PaymentReceiptModalProps {
  payment: Payment;
  company: {
    name: string;
    address?: string;
    city?: string;
    country?: string;
    phone?: string;
    email?: string;
    logo_url?: string;
    currency?: string;
  };
  customer: Customer;
  invoiceNumber?: string;
  onClose: () => void;
}

export default function PaymentReceiptModal({
  payment,
  company,
  customer,
  invoiceNumber,
  onClose,
}: PaymentReceiptModalProps) {
  const currency = company.currency || 'FCFA';

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl relative space-y-6 print:m-0 print:p-0 print:border-none print:shadow-none print:w-full">
        {/* Close Button (Hidden on Print) */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors print:hidden"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Receipt Header */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center font-bold">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                Reçu de Paiement
              </h3>
              <p className="text-xs text-slate-400 font-mono">
                Réf : {payment.reference || `REC-${payment.id.slice(0, 8).toUpperCase()}`}
              </p>
            </div>
          </div>
          <span className="px-3 py-1 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
            Payé & Confirmé
          </span>
        </div>

        {/* Company & Client Details */}
        <div className="grid grid-cols-2 gap-4 text-xs">
          <div className="space-y-1">
            <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
              Émetteur
            </span>
            <p className="font-bold text-slate-900 dark:text-white">{company.name}</p>
            {company.address && <p className="text-slate-500">{company.address}</p>}
            {(company.city || company.country) && (
              <p className="text-slate-500">
                {[company.city, company.country].filter(Boolean).join(', ')}
              </p>
            )}
            {company.email && <p className="text-slate-500">{company.email}</p>}
          </div>

          <div className="space-y-1 text-right">
            <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
              Bénéficiaire / Client
            </span>
            <p className="font-bold text-slate-900 dark:text-white">
              {customer.company_name || customer.name}
            </p>
            {customer.email && <p className="text-slate-500">{customer.email}</p>}
            {customer.phone && <p className="text-slate-500">{customer.phone}</p>}
          </div>
        </div>

        {/* Transaction Details Box */}
        <div className="bg-slate-50 dark:bg-slate-800/60 rounded-2xl p-5 border border-slate-100 dark:border-slate-800 space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-500">Date du règlement</span>
            <span className="font-semibold text-slate-900 dark:text-white">
              {new Date(payment.payment_date).toLocaleDateString('fr-FR', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
            </span>
          </div>

          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-500">Moyen de paiement</span>
            <span className="font-semibold text-slate-900 dark:text-white">
              {payment.payment_method}
            </span>
          </div>

          {invoiceNumber && (
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500">Facture liée</span>
              <span className="font-mono font-semibold text-slate-900 dark:text-white">
                Facture {invoiceNumber}
              </span>
            </div>
          )}

          {payment.notes && (
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500">Note</span>
              <span className="text-slate-700 dark:text-slate-300 italic">{payment.notes}</span>
            </div>
          )}

          <div className="border-t border-slate-200 dark:border-slate-700 pt-3 flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Montant Encaissé
            </span>
            <span className="text-xl font-black text-emerald-600 dark:text-emerald-400">
              {formatMoney(payment.amount, currency)}
            </span>
          </div>
        </div>

        {/* Security & Verification Note */}
        <div className="flex items-center gap-2 text-[11px] text-slate-400">
          <ShieldCheck className="w-4 h-4 text-emerald-500 flex-shrink-0" />
          <span>Ce document certifie le règlement intégral ou partiel effectué auprès de {company.name}.</span>
        </div>

        {/* Actions (Hidden on Print) */}
        <div className="flex items-center justify-end gap-3 pt-2 print:hidden">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            Fermer
          </button>
          <button
            type="button"
            onClick={handlePrint}
            className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow flex items-center gap-2 transition-all"
          >
            <Printer className="w-4 h-4" />
            <span>Imprimer / PDF</span>
          </button>
        </div>
      </div>
    </div>
  );
}
