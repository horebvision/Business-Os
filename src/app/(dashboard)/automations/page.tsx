'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { createClient } from '@/lib/supabase/client';
import { AutomationRule, AutomationTrigger, AutomationAction, AutomationConditionOperator } from '@/lib/types';
import { PRESET_AUTOMATIONS } from '@/lib/automations/engine';
import {
  Zap,
  Plus,
  Play,
  CheckCircle2,
  AlertCircle,
  Clock,
  Trash2,
  Edit2,
  History,
  Shield,
  Loader2,
  Sparkles,
  ToggleLeft,
  ToggleRight,
  ArrowRight,
  X,
} from 'lucide-react';

const TRIGGER_LABELS: Record<string, string> = {
  lead_created: 'Nouveau prospect créé',
  customer_created: 'Nouveau client enregistré',
  quote_sent: 'Devis envoyé au client',
  quote_accepted: 'Devis accepté par le client',
  quote_rejected: 'Devis refusé par le client',
  invoice_created: 'Nouvelle facture émise',
  invoice_due_soon: 'Facture proche de l\'échéance (J-3)',
  invoice_overdue: 'Facture en retard de paiement',
  payment_received: 'Paiement / Règlement enregistré',
  task_due_soon: 'Tâche proche de l\'échéance',
  task_overdue: 'Tâche en retard',
};

const ACTION_LABELS: Record<string, string> = {
  create_task: 'Créer une tâche opérationnelle',
  create_notification: 'Créer une notification',
  change_status: 'Modifier un statut',
  assign_user: 'Assigner un responsable',
  generate_message: 'Générer un message de relance IA',
  send_email: 'Envoyer un email (Resend)',
  create_reminder: 'Créer une relance client',
  create_activity: 'Ajouter une entrée au journal d\'audit',
};

export default function AutomationsPage() {
  const { currentCompany, user } = useAuth();
  const supabase = createClient();

  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [installingPresets, setInstallingPresets] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Form State for new/edit rule
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
  const [ruleName, setRuleName] = useState('');
  const [triggerEvent, setTriggerEvent] = useState<AutomationTrigger>('invoice_overdue');
  const [hasCondition, setHasCondition] = useState(true);
  const [conditionField, setConditionField] = useState('days_overdue');
  const [conditionOp, setConditionOp] = useState<AutomationConditionOperator>('greater_than');
  const [conditionVal, setConditionVal] = useState('7');
  const [actionType, setActionType] = useState<AutomationAction>('create_task');
  const [actionTitle, setActionTitle] = useState('Relancer le client pour règlement');
  const [executionMode, setExecutionMode] = useState<'assisted' | 'automatic'>('assisted');
  const [savingRule, setSavingRule] = useState(false);

  const fetchRules = async () => {
    if (!currentCompany?.id) return;
    setLoading(true);

    try {
      // 1. Fetch rules
      const { data: rulesData } = await supabase
        .from('automations')
        .select('*')
        .eq('company_id', currentCompany.id)
        .order('created_at', { ascending: false });

      // 2. Fetch run counts
      const { data: runsData } = await supabase
        .from('automation_runs')
        .select('automation_id, created_at')
        .eq('company_id', currentCompany.id);

      const runCountMap = new Map<string, { count: number; lastRun?: string }>();
      runsData?.forEach((run) => {
        const existing = runCountMap.get(run.automation_id) || { count: 0 };
        existing.count += 1;
        if (!existing.lastRun || new Date(run.created_at) > new Date(existing.lastRun)) {
          existing.lastRun = run.created_at;
        }
        runCountMap.set(run.automation_id, existing);
      });

      const mapped = (rulesData || []).map((r) => {
        const stats = runCountMap.get(r.id);
        return {
          ...r,
          run_count: stats?.count || 0,
          last_run_at: stats?.lastRun,
        };
      });

      setRules(mapped as AutomationRule[]);
    } catch (err) {
      console.error('Error fetching automations:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRules();
  }, [currentCompany?.id]);

  const handleToggleActive = async (rule: AutomationRule) => {
    try {
      const nextActive = !rule.is_active;
      await supabase.from('automations').update({ is_active: nextActive }).eq('id', rule.id);
      setRules((prev) => prev.map((r) => (r.id === rule.id ? { ...r, is_active: nextActive } : r)));
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDeleteRule = async (ruleId: string) => {
    if (!confirm('Voulez-vous vraiment supprimer cette règle d\'automatisation ?')) return;
    try {
      await supabase.from('automations').delete().eq('id', ruleId);
      setRules((prev) => prev.filter((r) => r.id !== ruleId));
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleInstallPresets = async () => {
    if (!currentCompany?.id) return;
    setInstallingPresets(true);

    try {
      for (const preset of PRESET_AUTOMATIONS) {
        await supabase.from('automations').insert({
          company_id: currentCompany.id,
          name: preset.name,
          trigger_event: preset.trigger_event,
          action_type: preset.action_type,
          action_config: preset.action_config,
          is_active: preset.is_active,
        });
      }
      setSuccessMsg('4 règles recommandées installées avec succès !');
      await fetchRules();
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setInstallingPresets(false);
    }
  };

  const handleSaveRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentCompany?.id) return;

    setSavingRule(true);
    try {
      const action_config: any = {
        mode: executionMode,
        description: `Exécuter "${ACTION_LABELS[actionType]}" quand "${TRIGGER_LABELS[triggerEvent]}"`,
        action_payload: {
          task_title: actionTitle,
          priority: 'Haute',
          due_in_days: 1,
        },
      };

      if (hasCondition) {
        action_config.condition = {
          field: conditionField,
          operator: conditionOp,
          value: conditionVal,
        };
      }

      if (editingRuleId) {
        await supabase
          .from('automations')
          .update({
            name: ruleName.trim(),
            trigger_event: triggerEvent,
            action_type: actionType,
            action_config,
          })
          .eq('id', editingRuleId);
      } else {
        await supabase.from('automations').insert({
          company_id: currentCompany.id,
          name: ruleName.trim(),
          trigger_event: triggerEvent,
          action_type: actionType,
          action_config,
          is_active: true,
        });
      }

      setIsModalOpen(false);
      setEditingRuleId(null);
      await fetchRules();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSavingRule(false);
    }
  };

  const openNewModal = () => {
    setEditingRuleId(null);
    setRuleName('Nouvelle règle intelligente');
    setTriggerEvent('invoice_overdue');
    setHasCondition(true);
    setConditionField('days_overdue');
    setConditionOp('greater_than');
    setConditionVal('7');
    setActionType('create_task');
    setActionTitle('Relancer le client pour règlement');
    setExecutionMode('assisted');
    setIsModalOpen(true);
  };

  const openEditModal = (rule: AutomationRule) => {
    setEditingRuleId(rule.id);
    setRuleName(rule.name);
    setTriggerEvent(rule.trigger_event as AutomationTrigger);
    setActionType(rule.action_type as AutomationAction);

    const cfg = rule.action_config || {};
    setExecutionMode(cfg.mode || 'assisted');
    if (cfg.condition) {
      setHasCondition(true);
      setConditionField(cfg.condition.field || 'amount');
      setConditionOp(cfg.condition.operator || 'greater_than');
      setConditionVal(String(cfg.condition.value || '0'));
    } else {
      setHasCondition(false);
    }
    setActionTitle(cfg.action_payload?.task_title || 'Action requise');
    setIsModalOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 font-bold">
              <Zap className="w-5 h-5" />
            </span>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              Centre d&apos;Automatisations
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Programmez des règles intelligentes (QUAND → SI → ALORS) en mode assisté ou automatique.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/automations/logs"
            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-slate-300 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-2xl shadow-sm transition-all"
          >
            <History className="w-4 h-4 text-indigo-500" />
            <span>Journal d&apos;exécution</span>
          </Link>

          <button
            onClick={openNewModal}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-2xl shadow-md shadow-indigo-600/20 transition-all hover:scale-[1.02]"
          >
            <Plus className="w-4 h-4" />
            <span>Nouvelle règle</span>
          </button>
        </div>
      </div>

      {/* Success alert */}
      {successMsg && (
        <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Preset Banner (if few or no rules) */}
      {rules.length === 0 && !loading && (
        <div className="p-6 rounded-3xl bg-gradient-to-r from-amber-500/10 via-indigo-500/10 to-blue-500/10 border border-amber-500/20 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-600 flex items-center justify-center flex-shrink-0">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
                Automatisez vos processus dès aujourd&apos;hui
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 max-w-xl">
                Installez en 1 clic les 4 règles d&apos;or recommandées pour PME : relance automatique de facture à J+7, rappel de prospect sans nouvelles, alerte devis accepté et confirmation de paiement.
              </p>
            </div>
          </div>

          <button
            onClick={handleInstallPresets}
            disabled={installingPresets}
            className="flex-shrink-0 inline-flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold rounded-xl shadow-md transition-all disabled:opacity-50"
          >
            {installingPresets ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Installation...</span>
              </>
            ) : (
              <>
                <Zap className="w-4 h-4" />
                <span>Installer les 4 règles</span>
              </>
            )}
          </button>
        </div>
      )}

      {/* Rules List */}
      {loading ? (
        <div className="p-16 text-center text-slate-400 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-indigo-500 mb-3" />
          <span className="text-xs font-medium">Chargement des automatisations...</span>
        </div>
      ) : rules.length === 0 ? (
        <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <Zap className="w-12 h-12 text-slate-300 dark:text-slate-700 mx-auto mb-3" />
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">Aucune automatisation active</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            Créez votre première règle pour automatiser les tâches et la surveillance de votre entreprise.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {rules.map((rule) => {
            const config = rule.action_config || {};
            const isAssisted = config.mode === 'assisted';

            return (
              <div
                key={rule.id}
                className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm hover:border-slate-300 dark:hover:border-slate-700 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                {/* Rule Info */}
                <div className="space-y-2 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-extrabold text-sm text-slate-900 dark:text-white">
                      {rule.name}
                    </span>

                    {/* Mode badge */}
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                        isAssisted
                          ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                          : 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20'
                      }`}
                    >
                      {isAssisted ? 'Mode Assisté (Validation requise)' : 'Mode Automatique'}
                    </span>
                  </div>

                  {/* QUAND -> SI -> ALORS Badges */}
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    {/* QUAND */}
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 font-semibold text-[11px]">
                      <span className="font-bold text-[9px] uppercase px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-white">
                        QUAND
                      </span>
                      <span>{TRIGGER_LABELS[rule.trigger_event] || rule.trigger_event}</span>
                    </div>

                    {/* SI */}
                    {config.condition && (
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-amber-500/10 text-amber-700 dark:text-amber-300 font-semibold text-[11px] border border-amber-500/20">
                        <span className="font-bold text-[9px] uppercase px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-800 dark:text-amber-200">
                          SI
                        </span>
                        <span>
                          {config.condition.field} {config.condition.operator === 'greater_than' ? '>' : config.condition.operator === 'less_than' ? '<' : '='} {config.condition.value}
                        </span>
                      </div>
                    )}

                    {/* ALORS */}
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 font-semibold text-[11px] border border-indigo-200 dark:border-indigo-800/40">
                      <span className="font-bold text-[9px] uppercase px-1.5 py-0.5 rounded bg-indigo-500 text-white">
                        ALORS
                      </span>
                      <span>{ACTION_LABELS[rule.action_type] || rule.action_type}</span>
                    </div>
                  </div>

                  {/* Execution Stats */}
                  <div className="text-[11px] text-slate-400 flex items-center gap-3 pt-1">
                    <span>Exécutions : <strong className="text-slate-700 dark:text-slate-300">{rule.run_count || 0}</strong></span>
                    {rule.last_run_at && (
                      <span>• Dernière exécution : {new Date(rule.last_run_at).toLocaleDateString('fr-FR')}</span>
                    )}
                  </div>
                </div>

                {/* Actions & Toggle */}
                <div className="flex items-center gap-3 self-end md:self-auto">
                  {/* Active Toggle */}
                  <button
                    onClick={() => handleToggleActive(rule)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                      rule.is_active
                        ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    <span className={`w-2 h-2 rounded-full ${rule.is_active ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                    <span>{rule.is_active ? 'Actif' : 'Désactivé'}</span>
                  </button>

                  {/* Edit */}
                  <button
                    onClick={() => openEditModal(rule)}
                    title="Modifier la règle"
                    className="p-2 rounded-xl text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-slate-800 transition-colors"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>

                  {/* Delete */}
                  <button
                    onClick={() => handleDeleteRule(rule.id)}
                    title="Supprimer la règle"
                    className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-slate-800 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create / Edit Rule Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setIsModalOpen(false)}
              className="absolute top-5 right-5 p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold">
                <Zap className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                  {editingRuleId ? 'Modifier l\'automatisation' : 'Nouvelle règle d\'automatisation'}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Définissez la logique événementielle de déclenchement
                </p>
              </div>
            </div>

            <form onSubmit={handleSaveRule} className="mt-5 space-y-4">
              {/* Name */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Nom de la règle *
                </label>
                <input
                  type="text"
                  required
                  value={ruleName}
                  onChange={(e) => setRuleName(e.target.value)}
                  placeholder="Ex : Relance facture 7 jours"
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white text-xs font-semibold focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              {/* QUAND : Trigger */}
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/80 space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900 dark:text-white">
                  <span className="px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-[10px] font-black uppercase">
                    QUAND
                  </span>
                  <span>Événement déclencheur</span>
                </div>
                <select
                  value={triggerEvent}
                  onChange={(e) => setTriggerEvent(e.target.value as AutomationTrigger)}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none font-medium"
                >
                  {Object.entries(TRIGGER_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </div>

              {/* SI : Condition */}
              <div className="p-3.5 rounded-2xl bg-amber-500/5 border border-amber-500/20 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-amber-900 dark:text-amber-300">
                    <span className="px-2 py-0.5 rounded bg-amber-500/20 text-[10px] font-black uppercase">
                      SI
                    </span>
                    <span>Condition spécifique</span>
                  </div>
                  <label className="flex items-center gap-2 text-[11px] text-slate-500 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={hasCondition}
                      onChange={(e) => setHasCondition(e.target.checked)}
                      className="rounded text-amber-600 focus:ring-amber-500"
                    />
                    <span>Activer condition</span>
                  </label>
                </div>

                {hasCondition && (
                  <div className="grid grid-cols-3 gap-2 pt-1">
                    <select
                      value={conditionField}
                      onChange={(e) => setConditionField(e.target.value)}
                      className="px-2 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs"
                    >
                      <option value="days_overdue">Jours de retard</option>
                      <option value="stale_days">Inactivité (jours)</option>
                      <option value="amount">Montant (FCFA)</option>
                    </select>

                    <select
                      value={conditionOp}
                      onChange={(e) => setConditionOp(e.target.value as AutomationConditionOperator)}
                      className="px-2 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs"
                    >
                      <option value="greater_than">Supérieur à (&gt;)</option>
                      <option value="less_than">Inférieur à (&lt;)</option>
                      <option value="equals">Égal à (=)</option>
                    </select>

                    <input
                      type="text"
                      value={conditionVal}
                      onChange={(e) => setConditionVal(e.target.value)}
                      placeholder="Valeur (ex: 7)"
                      className="px-2 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold"
                    />
                  </div>
                )}
              </div>

              {/* ALORS : Action */}
              <div className="p-3.5 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/40 space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-900 dark:text-indigo-300">
                  <span className="px-2 py-0.5 rounded bg-indigo-600 text-white text-[10px] font-black uppercase">
                    ALORS
                  </span>
                  <span>Action à exécuter</span>
                </div>
                <select
                  value={actionType}
                  onChange={(e) => setActionType(e.target.value as AutomationAction)}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none font-medium"
                >
                  {Object.entries(ACTION_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>

                <input
                  type="text"
                  value={actionTitle}
                  onChange={(e) => setActionTitle(e.target.value)}
                  placeholder="Intitulé de l'action / tâche..."
                  className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium focus:outline-none"
                />
              </div>

              {/* MODE : Assisté vs Automatique (Section 8) */}
              <div className="pt-2">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Mode d&apos;exécution
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setExecutionMode('assisted')}
                    className={`p-3 rounded-2xl border text-left transition-all ${
                      executionMode === 'assisted'
                        ? 'border-amber-500 bg-amber-500/10 text-amber-900 dark:text-amber-200'
                        : 'border-slate-200 dark:border-slate-800 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <span className="text-xs font-bold block">Mode Assisté</span>
                    <span className="text-[10px] text-slate-500 block mt-0.5">
                      Prépare l&apos;action. Confirmation requise de votre part.
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setExecutionMode('automatic')}
                    className={`p-3 rounded-2xl border text-left transition-all ${
                      executionMode === 'automatic'
                        ? 'border-indigo-500 bg-indigo-500/10 text-indigo-900 dark:text-indigo-200'
                        : 'border-slate-200 dark:border-slate-800 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <span className="text-xs font-bold block">Mode Automatique</span>
                    <span className="text-[10px] text-slate-500 block mt-0.5">
                      Exécution directe sans validation préalable.
                    </span>
                  </button>
                </div>
              </div>

              <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={savingRule || !ruleName.trim()}
                  className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs rounded-xl shadow-md shadow-indigo-600/20 transition-all flex items-center gap-2 disabled:opacity-50"
                >
                  {savingRule ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Enregistrement...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Enregistrer la règle</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
