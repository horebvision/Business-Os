import { SupabaseClient } from '@supabase/supabase-js';
import { AutomationRule, AutomationRun, AutomationTrigger } from '@/lib/types';

export interface AutomationTriggerContext {
  companyId: string;
  triggerEvent: AutomationTrigger;
  entityType: 'lead' | 'customer' | 'quote' | 'invoice' | 'payment' | 'task';
  entityId: string;
  entityTitle: string;
  amount?: number;
  daysOverdue?: number;
  staleDays?: number;
  userId?: string;
  metadata?: Record<string, any>;
}

export const PRESET_AUTOMATIONS = [
  {
    name: 'Relance facture en retard (7 jours)',
    trigger_event: 'invoice_overdue',
    action_type: 'create_task',
    action_config: {
      mode: 'assisted',
      condition: {
        field: 'days_overdue',
        operator: 'greater_than',
        value: 7,
      },
      action_payload: {
        task_title: 'Relancer le client pour règlement facture',
        priority: 'Haute',
        due_in_days: 1,
      },
      description: 'Quand une facture est en retard de plus de 7 jours, prépare une tâche de relance et notifie le responsable.',
    },
    is_active: true,
  },
  {
    name: 'Rappel prospect sans nouvelles (5 jours)',
    trigger_event: 'lead_created',
    action_type: 'create_task',
    action_config: {
      mode: 'automatic',
      condition: {
        field: 'stale_days',
        operator: 'greater_than',
        value: 5,
      },
      action_payload: {
        task_title: 'Relance commerciale du prospect sans contact',
        priority: 'Normale',
        due_in_days: 1,
      },
      description: 'Quand un prospect n\'a eu aucune interaction depuis 5 jours, crée une tâche de suivi.',
    },
    is_active: true,
  },
  {
    name: 'Alerte devis accepté & préparation facture',
    trigger_event: 'quote_accepted',
    action_type: 'create_notification',
    action_config: {
      mode: 'assisted',
      action_payload: {
        title: 'Devis accepté !',
        message: 'Le client a validé le devis. Cliquez pour générer la facture correspondante.',
      },
      description: 'Dès qu\'un devis est accepté, alerte l\'équipe et propose la création de la facture.',
    },
    is_active: true,
  },
  {
    name: 'Notification encaissement paiement reçu',
    trigger_event: 'payment_received',
    action_type: 'create_activity',
    action_config: {
      mode: 'automatic',
      action_payload: {
        action: 'Paiement encaissé et vérifié',
      },
      description: 'Dès qu\'un règlement est enregistré, crée une entrée au journal d\'audit et notifie le dirigeant.',
    },
    is_active: true,
  },
];

export function testCondition(
  condition: { field: string; operator: string; value: any } | undefined,
  context: AutomationTriggerContext
): boolean {
  if (!condition || !condition.field) return true;

  let actualValue: any = null;
  if (condition.field === 'amount') actualValue = context.amount || 0;
  else if (condition.field === 'days_overdue') actualValue = context.daysOverdue || 0;
  else if (condition.field === 'stale_days') actualValue = context.staleDays || 0;
  else if (context.metadata && context.metadata[condition.field] !== undefined) {
    actualValue = context.metadata[condition.field];
  }

  const targetValue = condition.value;

  switch (condition.operator) {
    case 'greater_than':
      return Number(actualValue) > Number(targetValue);
    case 'less_than':
      return Number(actualValue) < Number(targetValue);
    case 'equals':
      return String(actualValue).toLowerCase() === String(targetValue).toLowerCase();
    case 'not_equals':
      return String(actualValue).toLowerCase() !== String(targetValue).toLowerCase();
    case 'contains':
      return String(actualValue).toLowerCase().includes(String(targetValue).toLowerCase());
    default:
      return true;
  }
}

/**
 * Execute automation rules matching the trigger event
 */
export async function runAutomations(
  supabase: SupabaseClient,
  context: AutomationTriggerContext
): Promise<Array<{ ruleName: string; status: 'Réussie' | 'En attente' | 'Échouée'; error?: string }>> {
  const results: Array<{ ruleName: string; status: 'Réussie' | 'En attente' | 'Échouée'; error?: string }> = [];

  try {
    // 1. Fetch active rules for company and trigger
    const { data: rules, error: rulesErr } = await supabase
      .from('automations')
      .select('*')
      .eq('company_id', context.companyId)
      .eq('trigger_event', context.triggerEvent)
      .eq('is_active', true);

    if (rulesErr || !rules || rules.length === 0) {
      return results;
    }

    for (const rule of rules) {
      const config = rule.action_config || {};

      // 2. Test condition
      const matchesCondition = testCondition(config.condition, context);
      if (!matchesCondition) continue;

      const isAutomatic = config.mode === 'automatic';

      try {
        let runStatus: 'Réussie' | 'En attente' | 'Échouée' = isAutomatic ? 'Réussie' : 'En attente';

        if (isAutomatic) {
          // Execute automatic action directly
          if (rule.action_type === 'create_task') {
            const dueDays = config.action_payload?.due_in_days || 1;
            const dueD = new Date();
            dueD.setDate(dueD.getDate() + dueDays);

            await supabase.from('tasks').insert({
              company_id: context.companyId,
              title: `${config.action_payload?.task_title || 'Action requise'} — ${context.entityTitle}`,
              priority: config.action_payload?.priority || 'Normale',
              due_date: dueD.toISOString().split('T')[0],
              status: 'À faire',
              created_by: context.userId || null,
            });
          } else if (rule.action_type === 'create_notification') {
            await supabase.from('notifications').insert({
              company_id: context.companyId,
              user_id: context.userId || null,
              title: config.action_payload?.title || 'Notification BusinessOS',
              message: `${config.action_payload?.message || 'Nouvelle action'} : ${context.entityTitle}`,
              type: 'info',
              is_read: false,
            });
          } else if (rule.action_type === 'create_activity') {
            await supabase.from('activities').insert({
              company_id: context.companyId,
              user_id: context.userId || null,
              action: config.action_payload?.action || 'Automatisation exécutée',
              entity_type: context.entityType,
              entity_id: context.entityId,
              entity_title: context.entityTitle,
              description: `Action automatique déclenchée par règle "${rule.name}"`,
            });
          }
        } else {
          // Assisted mode: Create notification asking user for confirmation
          await supabase.from('notifications').insert({
            company_id: context.companyId,
            user_id: context.userId || null,
            title: `Action suggérée : ${rule.name}`,
            message: `BusinessOS a détecté : "${context.entityTitle}". Confirmez l'exécution de l'action.`,
            type: 'warning',
            link: `/automations/logs`,
            is_read: false,
          });
        }

        // 3. Log into automation_runs
        await supabase.from('automation_runs').insert({
          automation_id: rule.id,
          company_id: context.companyId,
          triggered_by: context.entityTitle,
          status: runStatus,
          details: {
            mode: config.mode,
            action_type: rule.action_type,
            context,
          },
        });

        results.push({ ruleName: rule.name, status: runStatus });
      } catch (err: any) {
        // Log failure safely without crashing app
        await supabase.from('automation_runs').insert({
          automation_id: rule.id,
          company_id: context.companyId,
          triggered_by: context.entityTitle,
          status: 'Échouée',
          details: { error: err.message, context },
        });

        results.push({ ruleName: rule.name, status: 'Échouée', error: err.message });
      }
    }
  } catch (globalErr: any) {
    console.error('Error running automations:', globalErr);
  }

  return results;
}
