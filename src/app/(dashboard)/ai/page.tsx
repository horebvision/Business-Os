'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { AiChatMessage } from '@/lib/types';
import {
  Bot,
  Send,
  Sparkles,
  Check,
  X,
  ArrowRight,
  Loader2,
  User,
  CheckSquare,
  HelpCircle,
  TrendingUp,
  AlertTriangle,
  Receipt,
  Users,
  MessageSquare,
  ShieldAlert,
} from 'lucide-react';

const SUGGESTIONS = [
  'Combien mes clients me doivent ?',
  'Quelles factures sont en retard ?',
  'Quels prospects dois-je relancer ?',
  'Crée une tâche pour appeler Jean demain à 10h',
  'Résume mon activité cette semaine',
];

export default function AssistantPage() {
  const { currentCompany } = useAuth();

  const [messages, setMessages] = useState<AiChatMessage[]>([
    {
      id: 'welcome',
      sender: 'assistant',
      text: `Bonjour ! Je suis **BusinessOS AI**, votre assistant opérationnel connecté en temps réel aux données de votre entreprise.

Je peux analyser vos créances, surveiller vos échéances ou exécuter des actions pour vous. Que souhaitez-vous faire ?`,
      timestamp: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
      quickActions: [
        { label: 'Combien mes clients me doivent ?' },
        { label: 'Quelles factures sont en retard ?' },
        { label: 'Quels prospects dois-je relancer ?' },
      ],
    },
  ]);

  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [confirmingActionId, setConfirmingActionId] = useState<string | null>(null);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const sendMessage = async (textToSend: string, actionConfirmation?: any) => {
    if (!textToSend.trim() || !currentCompany?.id) return;

    const userMsg: AiChatMessage = {
      id: Date.now().toString(),
      sender: 'user',
      text: textToSend,
      timestamp: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const res = await fetch('/api/assistant/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: textToSend,
          companyId: currentCompany.id,
          actionConfirmation,
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || 'Erreur lors du traitement de la requête.');
      }

      const assistantMsg: AiChatMessage = {
        id: (Date.now() + 1).toString(),
        sender: 'assistant',
        text: json.reply,
        timestamp: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
        actionProposal: json.actionProposal,
        quickActions: json.quickActions,
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          sender: 'assistant',
          text: `Désolé, une erreur est survenue : ${err.message}`,
          timestamp: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmAction = async (msgId: string, actionProposal: any) => {
    setConfirmingActionId(msgId);
    try {
      await sendMessage('Action confirmée', {
        type: actionProposal.type,
        payload: actionProposal.payload,
      });

      // Mark action proposal as confirmed in local messages
      setMessages((prev) =>
        prev.map((m) =>
          m.id === msgId && m.actionProposal
            ? { ...m, actionProposal: { ...m.actionProposal, status: 'confirmed' } }
            : m
        )
      );
    } finally {
      setConfirmingActionId(null);
    }
  };

  const handleCancelAction = (msgId: string) => {
    setMessages((prev) =>
      prev.map((m) =>
        m.id === msgId && m.actionProposal
          ? { ...m, actionProposal: { ...m.actionProposal, status: 'cancelled' } }
          : m
      )
    );
  };

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col lg:flex-row gap-6 max-w-6xl mx-auto">
      {/* Sidebar: Suggestions & Security Guarantee */}
      <div className="hidden lg:flex flex-col w-72 space-y-4">
        <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 font-bold">
              <Sparkles className="w-4 h-4" />
            </span>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white">
              Suggestions directes
            </h3>
          </div>
          <p className="text-[11px] text-slate-500 leading-relaxed">
            Cliquez sur une invite pour interroger immédiatement votre base de données.
          </p>

          <div className="space-y-1.5 pt-1">
            {SUGGESTIONS.map((s, idx) => (
              <button
                key={idx}
                onClick={() => sendMessage(s)}
                className="w-full text-left p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 hover:bg-purple-500/10 hover:text-purple-600 dark:hover:text-purple-300 text-slate-700 dark:text-slate-300 text-[11px] font-medium transition-all"
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Security & Multi-tenant banner */}
        <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-[11px] text-slate-500 space-y-1.5">
          <div className="flex items-center gap-1.5 text-slate-900 dark:text-white font-bold text-xs">
            <ShieldAlert className="w-3.5 h-3.5 text-emerald-500" />
            <span>Sécurité & Vérité terrain</span>
          </div>
          <p className="leading-relaxed">
            BusinessOS AI accède exclusivement aux données de <strong>{currentCompany?.name}</strong>. Aucune donnée n&apos;est inventée et toute action sensible requiert votre validation.
          </p>
        </div>
      </div>

      {/* Main Chat Conversation Area */}
      <div className="flex-1 flex flex-col bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-sm overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-purple-600/20">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-extrabold text-slate-900 dark:text-white tracking-tight">
                  BusinessOS AI
                </h1>
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                  Connecté
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Votre assistant pour gérer votre entreprise.
              </p>
            </div>
          </div>
        </div>

        {/* Message Stream */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {messages.map((m) => (
            <div
              key={m.id}
              className={`flex items-start gap-3 ${
                m.sender === 'user' ? 'flex-row-reverse' : ''
              }`}
            >
              <div
                className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                  m.sender === 'user'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-purple-600/10 text-purple-600 dark:text-purple-400'
                }`}
              >
                {m.sender === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
              </div>

              <div className={`max-w-xl space-y-2`}>
                <div
                  className={`p-4 rounded-2xl text-xs leading-relaxed ${
                    m.sender === 'user'
                      ? 'bg-indigo-600 text-white rounded-tr-none'
                      : 'bg-slate-100 dark:bg-slate-800/80 text-slate-900 dark:text-slate-100 rounded-tl-none whitespace-pre-wrap'
                  }`}
                >
                  {m.text}

                  {/* Action Confirmation Proposal Box (Section 14 & 34) */}
                  {m.actionProposal && m.actionProposal.status !== 'confirmed' && m.actionProposal.status !== 'cancelled' && (
                    <div className="mt-3 p-3.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-2.5">
                      <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-bold">
                        <CheckSquare className="w-4 h-4" />
                        <span>Confirmation requise : {m.actionProposal.title}</span>
                      </div>
                      {m.actionProposal.description && (
                        <p className="text-[11px] text-slate-500">
                          {m.actionProposal.description}
                        </p>
                      )}
                      <div className="flex items-center gap-2 pt-1">
                        <button
                          onClick={() => handleConfirmAction(m.id, m.actionProposal)}
                          disabled={confirmingActionId === m.id}
                          className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg text-xs flex items-center gap-1.5 shadow transition-all disabled:opacity-50"
                        >
                          {confirmingActionId === m.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Check className="w-3.5 h-3.5" />
                          )}
                          <span>Confirmer l&apos;action</span>
                        </button>
                        <button
                          onClick={() => handleCancelAction(m.id)}
                          className="px-3 py-1.5 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 font-semibold rounded-lg text-xs transition-colors"
                        >
                          Annuler
                        </button>
                      </div>
                    </div>
                  )}

                  {m.actionProposal?.status === 'confirmed' && (
                    <div className="mt-2 text-[11px] font-bold text-emerald-600 flex items-center gap-1">
                      <Check className="w-3.5 h-3.5" />
                      <span>Action validée et exécutée avec succès</span>
                    </div>
                  )}

                  {m.actionProposal?.status === 'cancelled' && (
                    <div className="mt-2 text-[11px] font-bold text-slate-400 flex items-center gap-1">
                      <X className="w-3.5 h-3.5" />
                      <span>Action annulée par l&apos;utilisateur</span>
                    </div>
                  )}
                </div>

                {/* Quick Actions Attached to Message (Section 37) */}
                {m.quickActions && m.quickActions.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    {m.quickActions.map((qa, qIdx) => (
                      qa.link ? (
                        <Link
                          key={qIdx}
                          href={qa.link}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 hover:bg-indigo-100 text-indigo-700 dark:text-indigo-300 font-semibold text-[10px] border border-indigo-200 dark:border-indigo-800/40 transition-colors"
                        >
                          <span>{qa.label}</span>
                          <ArrowRight className="w-3 h-3" />
                        </Link>
                      ) : (
                        <button
                          key={qIdx}
                          onClick={() => sendMessage(qa.label)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 font-semibold text-[10px] transition-colors"
                        >
                          <span>{qa.label}</span>
                        </button>
                      )
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex items-center gap-2 text-xs text-slate-400 p-2 animate-pulse">
              <Loader2 className="w-4 h-4 animate-spin text-purple-500" />
              <span>BusinessOS AI consulte vos données en direct...</span>
            </div>
          )}
          <div ref={chatBottomRef} />
        </div>

        {/* Input Bar */}
        <div className="p-3.5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              sendMessage(input);
            }}
            className="relative"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Que puis-je faire pour vous ? (ex : Crée une tâche pour demain à 10h)"
              className="w-full pl-4 pr-24 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500 shadow-sm"
            />
            <button
              type="submit"
              disabled={!input.trim() || loading}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 py-2 px-4 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:opacity-40 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow transition-all"
            >
              <span>Envoyer</span>
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
