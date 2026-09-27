'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { createClient } from '@/lib/supabase/client';
import { Invoice } from '@/lib/types';
import { formatMoney, getDaysOverdue } from '@/lib/finance/money';
import { generateReminderMessage, ReminderTone } from '@/lib/finance/reminderAi';
import { 
  X, 
  Send, 
  Sparkles, 
  MessageSquare, 
  Mail, 
  AlertTriangle, 
  Clock, 
  CheckCircle2, 
  Loader2, 
  Copy,
  ExternalLink 
} from 'lucide-react';

interface ReminderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  invoice: Invoice;
}

export default function ReminderModal({
  isOpen,
  onClose,
  onSuccess,
  invoice,
}: ReminderModalProps) {
  const { currentCompany, user } = useAuth();
  const supabase = createClient();

  const daysOverdue = getDaysOverdue(invoice.due_date);
  const [tone, setTone] = useState<ReminderTone>(daysOverdue > 15 ? 'ferme' : 'courtois');
  const [channel, setChannel] = useState<'email' | 'whatsapp' | 'manuel'>('whatsapp');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Generate initial message
  useEffect(() => {
    if (invoice && currentCompany) {
      const generated = generateReminderMessage({
        customerName: (invoice.customer?.name || (invoice as any).customer_name || 'Client'),
        invoiceNumber: invoice.invoice_number,
        remainingAmount: invoice.remaining_amount || invoice.total,
        currency: invoice.currency || currentCompany.currency || 'FCFA',
        dueDate: invoice.due_date,
        daysOverdue,
        companyName: currentCompany.name,
        tone,
      });
      setMessage(generated);
    }
  }, [invoice, currentCompany, tone, daysOverdue]);

  if (!isOpen) return null;

  const handleRegenerate = (newTone: ReminderTone) => {
    setTone(newTone);
    if (invoice && currentCompany) {
      const generated = generateReminderMessage({
        customerName: (invoice.customer?.name || (invoice as any).customer_name || 'Client'),
        invoiceNumber: invoice.invoice_number,
        remainingAmount: invoice.remaining_amount || invoice.total,
        currency: invoice.currency || currentCompany.currency || 'FCFA',
        dueDate: invoice.due_date,
        daysOverdue,
        companyName: currentCompany.name,
        tone: newTone,
      });
      setMessage(generated);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(message);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRecordReminder = async () => {
    if (!currentCompany?.id || !user) return;
    setLoading(true);

    try {
      const nowIso = new Date().toISOString();

      // 1. Update invoice last_reminder_sent_at
      await supabase
        .from('invoices')
        .update({
          last_reminder_sent_at: nowIso,
          updated_at: nowIso,
        })
        .eq('id', invoice.id);

      // 2. Insert into activities
      await supabase.from('activities').insert({
        company_id: currentCompany.id,
        user_id: user.id,
        action: 'Relance facture',
        entity_type: 'invoice',
        entity_id: invoice.id,
        entity_title: `Facture ${invoice.invoice_number}`,
        customer_id: invoice.customer_id,
        description: `Relance (${tone}, canal: ${channel}) envoyée à ${invoice.customer?.name || 'Client'} pour un solde de ${formatMoney(invoice.remaining_amount, invoice.currency)}`,
        metadata: {
          tone,
          channel,
          days_overdue: daysOverdue,
          message_excerpt: message.slice(0, 100),
        },
      });

      // 3. Try inserting into reminders table if available
      try {
        await supabase.from('reminders').insert({
          company_id: currentCompany.id,
          invoice_id: invoice.id,
          customer_id: invoice.customer_id,
          reminder_type: channel === 'whatsapp' ? 'whatsapp' : channel === 'email' ? 'email' : 'manuel',
          channel,
          status: 'envoyé',
          scheduled_for: nowIso.split('T')[0],
          sent_at: nowIso,
          days_overdue: daysOverdue,
          message: message.trim(),
          created_by: user.id,
        });
      } catch (e) {
        // Table might be pending migration, non-blocking
      }

      setSuccessMsg('Relance consignée avec succès dans le journal de suivi !');
      onSuccess();
      setTimeout(() => {
        onClose();
      }, 1000);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const cleanPhone = invoice.customer?.phone ? invoice.customer.phone.replace(/[^0-9]/g, '') : null;
  const whatsappUrl = cleanPhone
    ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`
    : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-xl w-full p-6 sm:p-8 shadow-2xl relative max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              Relance de facture
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {invoice.invoice_number} • Solde : <strong className="text-amber-600">{formatMoney(invoice.remaining_amount, invoice.currency)}</strong>
              {daysOverdue > 0 && <span className="ml-2 text-rose-500 font-bold">({daysOverdue} jours de retard)</span>}
            </p>
          </div>
        </div>

        {successMsg && (
          <div className="mt-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        <div className="mt-5 space-y-4">
          {/* AI Tone Selection Bar */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
                <span>Génération du message par IA — Tonalité :</span>
              </label>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {(['courtois', 'ferme', 'urgent'] as ReminderTone[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => handleRegenerate(t)}
                  className={`py-2 px-3 rounded-xl border text-xs font-bold capitalize transition-all ${
                    tone === t
                      ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 shadow-sm'
                      : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50'
                  }`}
                >
                  {t === 'courtois' ? '😊 Courtois' : t === 'ferme' ? '⚖️ Ferme' : '🚨 Urgent'}
                </button>
              ))}
            </div>
          </div>

          {/* Editable Message Box */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Message de relance (modifiable)
              </label>
              <button
                type="button"
                onClick={handleCopy}
                className="text-[11px] font-bold text-indigo-500 hover:underline flex items-center gap-1"
              >
                <Copy className="w-3 h-3" />
                <span>{copied ? 'Copié !' : 'Copier'}</span>
              </button>
            </div>
            <textarea
              rows={7}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="w-full p-3.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl text-slate-900 dark:text-white text-xs leading-relaxed focus:ring-2 focus:ring-indigo-500 focus:outline-none resize-none font-sans"
            />
          </div>

          {/* Channel selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
              Canal d&apos;envoi
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setChannel('whatsapp')}
                className={`p-2.5 rounded-xl border text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
                  channel === 'whatsapp'
                    ? 'border-emerald-500 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold'
                    : 'border-slate-200 dark:border-slate-800 text-slate-600'
                }`}
              >
                <MessageSquare className="w-4 h-4" />
                <span>WhatsApp</span>
              </button>

              <button
                type="button"
                onClick={() => setChannel('email')}
                className={`p-2.5 rounded-xl border text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
                  channel === 'email'
                    ? 'border-indigo-500 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-bold'
                    : 'border-slate-200 dark:border-slate-800 text-slate-600'
                }`}
              >
                <Mail className="w-4 h-4" />
                <span>Email</span>
              </button>

              <button
                type="button"
                onClick={() => setChannel('manuel')}
                className={`p-2.5 rounded-xl border text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
                  channel === 'manuel'
                    ? 'border-slate-800 bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white font-bold'
                    : 'border-slate-200 dark:border-slate-800 text-slate-600'
                }`}
              >
                <span>Autre / Manuel</span>
              </button>
            </div>
          </div>

          {/* Channel specific notices */}
          {channel === 'email' && (
            <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-300 text-xs flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
              <div>
                <span className="font-bold block">FOURNISSEUR EMAIL NON CONFIGURÉ</span>
                <span className="text-[11px] leading-snug">
                  L&apos;API d&apos;envoi d&apos;email (ex: Resend ou SMTP) sera connectée prochainement. Vous pouvez copier le message ci-dessus pour l&apos;envoyer depuis votre messagerie professionnelle.
                </span>
              </div>
            </div>
          )}

          {channel === 'whatsapp' && (
            <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-800 dark:text-emerald-300 text-xs flex items-center justify-between gap-2">
              <div>
                <span className="font-bold block">Envoi WhatsApp direct</span>
                <span className="text-[11px]">
                  {cleanPhone ? `Destinataire : ${invoice.customer?.phone}` : 'Numéro client non renseigné'}
                </span>
              </div>
              {whatsappUrl && (
                <a
                  href={whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-colors inline-flex items-center gap-1.5 shadow-sm"
                >
                  <span>Ouvrir WhatsApp</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}
            </div>
          )}

          {/* Modal Actions */}
          <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            >
              Fermer
            </button>
            <button
              type="button"
              onClick={handleRecordReminder}
              disabled={loading}
              className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs rounded-xl shadow-md shadow-indigo-600/20 transition-all flex items-center gap-2 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Enregistrement...</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>Consigner cette relance</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
