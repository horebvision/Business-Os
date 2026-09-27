import { Invoice, Lead, Quote, Task, Customer, Payment, ActionCenterItem, PriorityScore } from '@/lib/types';
import { formatMoney, getDaysOverdue } from '@/lib/finance/money';

export interface DailyBriefing {
  date: string;
  tasksCount: number;
  invoicesToRemindCount: number;
  leadsToContactCount: number;
  quotesExpiringCount: number;
  topPriorityMessage: string;
  topPriorityAction?: {
    label: string;
    link: string;
  };
}

export interface WeeklyBriefing {
  totalRevenue: number;
  totalCollected: number;
  newLeadsCount: number;
  newCustomersCount: number;
  quotesSentCount: number;
  quotesAcceptedCount: number;
  unpaidAmount: number;
  completedTasksCount: number;
  attentionItems: string[];
}

export function computeActionCenterItems(
  invoices: Invoice[],
  leads: Lead[],
  quotes: Quote[],
  tasks: Task[],
  currency: string = 'FCFA'
): ActionCenterItem[] {
  const items: ActionCenterItem[] = [];
  const todayStr = new Date().toISOString().split('T')[0];

  // 1. Overdue Invoices
  invoices.forEach((inv) => {
    if (inv.status === 'Payée' || inv.status === 'Annulée') return;
    if (!inv.due_date) return;

    const daysOverdue = getDaysOverdue(inv.due_date);
    const amount = Number(inv.remaining_amount) || Number(inv.total) || 0;

    if (daysOverdue > 0) {
      let priority: PriorityScore = 'À surveiller';
      if (daysOverdue >= 15 || amount >= 2000000) priority = 'Urgent';
      else if (daysOverdue >= 5 || amount >= 500000) priority = 'Important';

      items.push({
        id: `act_inv_${inv.id}`,
        priority,
        title: `Facture ${inv.invoice_number} de ${formatMoney(amount, currency)}`,
        subtitle: `${inv.customer?.name || 'Client'} • En retard de ${daysOverdue} jour(s)`,
        entityType: 'invoice',
        entityId: inv.id,
        amount,
        daysOverdue,
        actionLabel: 'Relancer avec IA',
        actionUrl: `/invoices/${inv.id}`,
      });
    }
  });

  // 2. Stale Leads (no contact for >= 5 days)
  const fiveDaysAgo = new Date();
  fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);

  leads.forEach((l) => {
    if (l.status === 'Gagné' || l.status === 'Perdu') return;
    const lastDate = l.last_interaction_at ? new Date(l.last_interaction_at) : new Date(l.created_at);

    if (lastDate <= fiveDaysAgo) {
      const staleDays = Math.floor((Date.now() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
      const potential = Number(l.potential_amount || (l as any).estimated_value) || 0;
      const priority: PriorityScore = potential >= 5000000 ? 'Urgent' : staleDays >= 10 ? 'Important' : 'À surveiller';

      items.push({
        id: `act_lead_${l.id}`,
        priority,
        title: `Prospect ${l.name || 'Sans nom'} (${l.company_name || 'Sans entreprise'})`,
        subtitle: `Sans échange depuis ${staleDays} jours • Potentiel : ${formatMoney(potential, currency)}`,
        entityType: 'lead',
        entityId: l.id,
        amount: potential,
        actionLabel: 'Contacter',
        actionUrl: `/leads/${l.id}`,
      });
    }
  });

  // 3. Quotes expiring soon (within 3 days or expired)
  quotes.forEach((q) => {
    if (q.status !== 'Envoyé' && q.status !== 'Consulté') return;
    const expDate = q.expiration_date || q.expiry_date;
    if (!expDate) return;

    const diffDays = Math.ceil((new Date(expDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    const amount = Number(q.total) || 0;

    if (diffDays <= 3) {
      const priority: PriorityScore = diffDays < 0 ? 'Urgent' : 'Important';
      items.push({
        id: `act_quote_${q.id}`,
        priority,
        title: `Devis ${q.quote_number} de ${formatMoney(amount, currency)}`,
        subtitle: diffDays < 0 ? `Expiré depuis ${Math.abs(diffDays)} jour(s)` : `Expire dans ${diffDays} jour(s)`,
        entityType: 'quote',
        entityId: q.id,
        amount,
        actionLabel: 'Suivre le devis',
        actionUrl: `/quotes/${q.id}`,
      });
    }
  });

  // 4. Tasks due today or overdue
  tasks.forEach((t) => {
    if (t.status === 'Terminée') return;
    if (!t.due_date) return;

    if (t.due_date < todayStr) {
      items.push({
        id: `act_task_${t.id}`,
        priority: 'Urgent',
        title: `Tâche en retard : ${t.title}`,
        subtitle: `Échéance dépassée le ${new Date(t.due_date).toLocaleDateString('fr-FR')}`,
        entityType: 'task',
        entityId: t.id,
        actionLabel: 'Terminer',
        actionUrl: `/tasks`,
      });
    } else if (t.due_date === todayStr) {
      items.push({
        id: `act_task_${t.id}`,
        priority: 'Important',
        title: `Tâche du jour : ${t.title}`,
        subtitle: `Prévue pour aujourd'hui`,
        entityType: 'task',
        entityId: t.id,
        actionLabel: 'Voir la tâche',
        actionUrl: `/tasks`,
      });
    }
  });

  // Priority sorting: Urgent first, then Important, then À surveiller
  const scoreMap: Record<PriorityScore, number> = {
    Urgent: 3,
    Important: 2,
    'À surveiller': 1,
  };

  return items.sort((a, b) => {
    if (scoreMap[b.priority] !== scoreMap[a.priority]) {
      return scoreMap[b.priority] - scoreMap[a.priority];
    }
    return (b.amount || 0) - (a.amount || 0);
  });
}

export function computeDailyBriefing(
  items: ActionCenterItem[],
  invoices: Invoice[],
  leads: Lead[],
  tasks: Task[],
  quotes: Quote[],
  currency: string = 'FCFA'
): DailyBriefing {
  const todayStr = new Date().toISOString().split('T')[0];

  const tasksCount = tasks.filter((t) => t.status !== 'Terminée' && (!t.due_date || t.due_date <= todayStr)).length;
  const overdueInvs = invoices.filter((i) => i.status !== 'Payée' && i.status !== 'Annulée' && i.due_date && i.due_date < todayStr);
  const staleLeads = leads.filter((l) => l.status === 'Nouveau' || l.status === 'Contacté');
  const quotesExpiring = quotes.filter((q) => (q.status === 'Envoyé' || q.status === 'Consulté'));

  const urgentItem = items.find((i) => i.priority === 'Urgent') || items[0];

  return {
    date: new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
    tasksCount,
    invoicesToRemindCount: overdueInvs.length,
    leadsToContactCount: staleLeads.length,
    quotesExpiringCount: quotesExpiring.length,
    topPriorityMessage: urgentItem
      ? `${urgentItem.title} — ${urgentItem.subtitle}`
      : 'Aucune anomalie critique détectée aujourd\'hui. Votre activité est sous contrôle.',
    topPriorityAction: urgentItem
      ? { label: urgentItem.actionLabel, link: urgentItem.actionUrl }
      : undefined,
  };
}

export function computeWeeklyBriefing(
  invoices: Invoice[],
  payments: Payment[],
  quotes: Quote[],
  leads: Lead[],
  customers: Customer[],
  tasks: Task[],
  currency: string = 'FCFA'
): WeeklyBriefing {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const sevenDaysAgoIso = sevenDaysAgo.toISOString();

  // Chiffre d'affaires facturé cette semaine
  const totalRevenue = invoices
    .filter((inv) => inv.created_at >= sevenDaysAgoIso && inv.status !== 'Annulée')
    .reduce((sum, inv) => sum + (Number(inv.total) || 0), 0);

  // Encaissements réels cette semaine
  const totalCollected = payments
    .filter((p) => p.created_at >= sevenDaysAgoIso || (p.payment_date && p.payment_date >= sevenDaysAgoIso.split('T')[0]))
    .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

  // Nouveaux contacts
  const newLeadsCount = leads.filter((l) => l.created_at >= sevenDaysAgoIso).length;
  const newCustomersCount = customers.filter((c) => c.created_at >= sevenDaysAgoIso).length;

  // Devis
  const quotesSentCount = quotes.filter((q) => q.created_at >= sevenDaysAgoIso || q.status === 'Envoyé').length;
  const quotesAcceptedCount = quotes.filter((q) => q.status === 'Accepté' && q.updated_at && q.updated_at >= sevenDaysAgoIso).length;

  // Total des créances en cours (factures impayées)
  const unpaidInvoices = invoices.filter((i) => i.status !== 'Payée' && i.status !== 'Annulée');
  const unpaidAmount = unpaidInvoices.reduce((sum, i) => sum + (Number(i.remaining_amount) || Number(i.total) || 0), 0);

  // Tâches achevées cette semaine
  const completedTasksCount = tasks.filter((t) => t.status === 'Terminée' && t.updated_at && t.updated_at >= sevenDaysAgoIso).length;

  // Points d'attention intelligents
  const attentionItems: string[] = [];

  const overdueInvs = unpaidInvoices.filter((i) => i.due_date && getDaysOverdue(i.due_date) > 0);
  if (overdueInvs.length > 0) {
    const overdueTotal = overdueInvs.reduce((s, i) => s + (Number(i.remaining_amount) || Number(i.total) || 0), 0);
    attentionItems.push(
      `${overdueInvs.length} facture(s) en retard pour un montant total de ${formatMoney(overdueTotal, currency)}. Relance prioritaire requise.`
    );
  }

  const staleLeads = leads.filter((l) => {
    if (l.status === 'Gagné' || l.status === 'Perdu') return false;
    const lastDate = l.last_interaction_at ? new Date(l.last_interaction_at) : new Date(l.created_at);
    return lastDate <= sevenDaysAgo;
  });
  if (staleLeads.length > 0) {
    attentionItems.push(
      `${staleLeads.length} prospect(s) n'ont fait l'objet d'aucun contact depuis plus de 7 jours.`
    );
  }

  const pendingQuotes = quotes.filter((q) => q.status === 'Envoyé' || q.status === 'Consulté');
  if (pendingQuotes.length > 0) {
    const quotesTotal = pendingQuotes.reduce((s, q) => s + (Number(q.total) || 0), 0);
    attentionItems.push(
      `${pendingQuotes.length} devis en attente (${formatMoney(quotesTotal, currency)}) pourraient être convertis cette semaine.`
    );
  }

  if (attentionItems.length === 0) {
    attentionItems.push('Tous vos dossiers financiers et commerciaux sont parfaitement à jour cette semaine.');
  }

  return {
    totalRevenue,
    totalCollected,
    newLeadsCount,
    newCustomersCount,
    quotesSentCount,
    quotesAcceptedCount,
    unpaidAmount,
    completedTasksCount,
    attentionItems,
  };
}

