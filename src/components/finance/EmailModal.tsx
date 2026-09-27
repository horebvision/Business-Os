'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { EMAIL_TEMPLATES, renderEmailTemplate } from '@/lib/email/templates';
import { X, Mail, Send, AlertTriangle, CheckCircle2, Loader2, RefreshCw } from 'lucide-react';

interface EmailModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  recipientEmail?: string | null;
  customerName?: string | null;
  entityType: 'invoice' | 'quote';
  entityId: string;
  entityNumber: string;
  amount: string;
  dueDate?: string;
  publicUrl?: string;
}

export default function EmailModal({
  isOpen,
  onClose,
  onSuccess,
  recipientEmail,
  customerName,
  entityType,
  entityId,
  entityNumber,
  amount,
  dueDate,
  publicUrl,
}: EmailModalProps) {
  const { currentCompany } = useAuth();

  const [to, setTo] = useState(recipientEmail || '');
  const [templateKey, setTemplateKey] = useState(
    entityType === 'invoice' ? 'invoice_overdue' : 'quote_sent'
  );
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [isConfigured, setIsConfigured] = useState<boolean | null>(null);
  const [sending, setSending] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Check email service status
  useEffect(() => {
    if (!isOpen) return;
    setTo(recipientEmail || '');
    setErrorMsg(null);
    setSuccessMsg(null);

    const checkConfig = async () => {
      try {
        const res = await fetch('/api/email/send');
        const data = await res.json();
        setIsConfigured(data.configured);
      } catch {
        setIsConfigured(false);
      }
    };
    checkConfig();
  }, [isOpen, recipientEmail]);

  // Update subject and body when template changes
  useEffect(() => {
    if (!currentCompany) return;

    const vars: Record<string, string> = {
      client_name: customerName || 'Madame, Monsieur',
      company_name: currentCompany.name || 'Notre Entreprise',
      quote_number: entityNumber,
      invoice_number: entityNumber,
      amount,
      issue_date: new Date().toLocaleDateString('fr-FR'),
      due_date: dueDate ? new Date(dueDate).toLocaleDateString('fr-FR') : 'échéance convenue',
      link: publicUrl || `${window.location.origin}/quote/view/sample`,
    };

    const rendered = renderEmailTemplate(templateKey, vars);
    setSubject(rendered.subject);
    setBody(rendered.body);
  }, [templateKey, currentCompany, customerName, entityNumber, amount, dueDate, publicUrl]);

  if (!isOpen) return null;

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentCompany?.id) return;

    setSending(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await fetch('/api/email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId: currentCompany.id,
          to: to.trim(),
          subject: subject.trim(),
          body: body.trim(),
          entityType,
          entityId,
          customerName,
        }),
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.error || "Erreur lors de l'expédition de l'email.");
      }

      setSuccessMsg('Email expédié avec succès via Resend !');
      if (onSuccess) onSuccess();
      setTimeout(() => {
        onClose();
      }, 1200);
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setSending(false);
    }
  };

  const availableTemplates = Object.values(EMAIL_TEMPLATES).filter(
    (t) => t.category === entityType
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-xl w-full p-6 sm:p-8 shadow-2xl relative max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Title */}
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold">
            <Mail className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              Envoyer par email
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Prévisualisez et personnalisez le message avant transmission
            </p>
          </div>
        </div>

        {/* Status banner on configuration */}
        {isConfigured === false && (
          <div className="mt-4 p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-300 text-xs flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5 text-amber-500" />
            <div className="space-y-1">
              <span className="font-bold block">SERVICE EMAIL NON CONFIGURÉ</span>
              <p className="text-[11px] leading-relaxed">
                Aucune clé <code className="font-mono bg-amber-500/20 px-1 py-0.5 rounded">RESEND_API_KEY</code> n&apos;est active sur le serveur. Vous pouvez prévisualiser le message ou le copier, mais l&apos;envoi réel sera refusé pour éviter toute simulation fictive.
              </p>
            </div>
          </div>
        )}

        {isConfigured === true && (
          <div className="mt-4 p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            <span>Service Resend connecté et prêt pour l&apos;envoi réel.</span>
          </div>
        )}

        {errorMsg && (
          <div className="mt-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs">
            {errorMsg}
          </div>
        )}

        {successMsg && (
          <div className="mt-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        <form onSubmit={handleSend} className="mt-5 space-y-4">
          {/* Template Selection */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Modèle d&apos;email
            </label>
            <select
              value={templateKey}
              onChange={(e) => setTemplateKey(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            >
              {availableTemplates.map((tpl) => (
                <option key={tpl.id} value={tpl.id}>
                  {tpl.name}
                </option>
              ))}
            </select>
          </div>

          {/* Recipient */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Destinataire *
            </label>
            <input
              type="email"
              required
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder="client@domaine.com"
              className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            />
          </div>

          {/* Subject */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Objet de l&apos;email *
            </label>
            <input
              type="text"
              required
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white text-xs font-semibold focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            />
          </div>

          {/* Body */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Contenu du message *
            </label>
            <textarea
              rows={7}
              required
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white text-xs font-mono leading-relaxed focus:ring-2 focus:ring-indigo-500 focus:outline-none resize-none"
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
              disabled={sending}
              className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs rounded-xl shadow-md shadow-indigo-600/20 transition-all flex items-center gap-2 disabled:opacity-50"
            >
              {sending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Envoi en cours...</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>Envoyer l&apos;email</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
