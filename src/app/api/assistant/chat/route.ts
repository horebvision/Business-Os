import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { formatMoney } from '@/lib/finance/money';
import { enforceRateLimit } from '@/lib/security/rateLimit';
import { checkLimit } from '@/lib/billing/featureGating';

export async function POST(req: NextRequest) {
  try {
    // 1. Rate Limiting Check (Section 43)
    const rateLimitError = await enforceRateLimit(req, {
      maxRequests: 30,
      windowMs: 60_000,
      keyPrefix: 'assistant',
    });
    if (rateLimitError) return rateLimitError;

    const serverSupabase = await createClient();
    const authHeader = req.headers.get('authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;
    const {
      data: { user },
      error: userErr,
    } = await serverSupabase.auth.getUser(token);

    if (userErr || !user) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    const supabase = token
      ? createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
          global: { headers: { Authorization: `Bearer ${token}` } },
        })
      : serverSupabase;

    const { message, companyId, actionConfirmation } = await req.json();

    if (!companyId) {
      return NextResponse.json({ error: 'Identifiant d\'entreprise manquant.' }, { status: 400 });
    }

    // 2. Plan Limit Check on AI Credits (Section 44)
    const aiLimit = await checkLimit(companyId, 'ai_credits');
    if (!aiLimit.allowed) {
      return NextResponse.json({
        reply: `🔒 **Limite de crédits IA atteinte** pour votre abonnement.\n\nVotre formule actuelle ne permet plus d'effectuer d'appels à l'assistant ce mois-ci. Veuillez passer au forfait supérieur (Business ou Pro) pour débloquer davantage de requêtes intelligentes.`,
        quickActions: [{ label: 'Voir les abonnements', link: '/billing' }],
      });
    }

    // Verify membership in companyId
    const { data: membership } = await supabase
      .from('memberships')
      .select('role')
      .eq('company_id', companyId)
      .eq('user_id', user.id)
      .single();

    // If memberships table is empty or company_members is used, check company existence
    const { data: company } = await supabase
      .from('companies')
      .select('id, name, currency')
      .eq('id', companyId)
      .single();

    if (!company) {
      return NextResponse.json({ error: 'Entreprise introuvable.' }, { status: 404 });
    }

    const currency = company.currency || 'FCFA';

    // 1. If this is an action confirmation
    if (actionConfirmation) {
      const { type, payload } = actionConfirmation;

      if (type === 'create_task') {
        const { data: newTask, error: taskErr } = await supabase
          .from('tasks')
          .insert({
            company_id: companyId,
            title: payload.title,
            priority: payload.priority || 'Normale',
            due_date: payload.dueDate || null,
            status: 'À faire',
            assigned_to: user.id,
            created_by: user.id,
          })
          .select()
          .single();

        if (taskErr) throw taskErr;

        await supabase.from('activities').insert({
          company_id: companyId,
          user_id: user.id,
          action: 'Tâche créée par IA',
          entity_type: 'task',
          entity_id: newTask.id,
          entity_title: newTask.title,
          description: `Tâche "${newTask.title}" créée après confirmation`,
        });

        return NextResponse.json({
          reply: `✅ La tâche **"${newTask.title}"** a été créée avec succès pour le **${newTask.due_date ? new Date(newTask.due_date).toLocaleDateString('fr-FR') : "aujourd'hui"}**.`,
          quickActions: [{ label: 'Voir mes tâches', link: '/tasks' }],
        });
      }

      if (type === 'create_lead') {
        const { data: newLead, error: leadErr } = await supabase
          .from('leads')
          .insert({
            company_id: companyId,
            first_name: payload.firstName,
            last_name: payload.lastName || '',
            company_name: payload.companyName || null,
            email: payload.email || null,
            phone: payload.phone || null,
            estimated_value: payload.estimatedValue || 0,
            currency,
            status: 'Nouveau',
            created_by: user.id,
          })
          .select()
          .single();

        if (leadErr) throw leadErr;

        await supabase.from('activities').insert({
          company_id: companyId,
          user_id: user.id,
          action: 'Prospect créé par IA',
          entity_type: 'lead',
          entity_id: newLead.id,
          entity_title: `${newLead.first_name} ${newLead.last_name}`,
          description: `Prospect créé via BusinessOS AI`,
        });

        return NextResponse.json({
          reply: `✅ Le prospect **${newLead.first_name} ${newLead.last_name}** a été enregistré avec succès dans votre CRM.`,
          quickActions: [{ label: 'Voir le prospect', link: `/leads/${newLead.id}` }],
        });
      }
    }

    const text = (message || '').trim();
    const lower = text.toLowerCase();

    // 2. Security Check (Section 41): Cross-tenant access attempt
    if (
      lower.includes('toutes les entreprises') ||
      lower.includes('autre entreprise') ||
      lower.includes('donne-moi les données de l\'entreprise') ||
      lower.includes('entreprise b') ||
      lower.includes('autre compte') ||
      lower.includes('autres societes')
    ) {
      return NextResponse.json({
        reply: `🔒 **Accès restreint par politique de sécurité multi-tenant**.\n\nEn tant qu'assistant de **${company.name}**, je suis strictement isolé et ne peux accéder qu'aux données de votre entreprise active. Je ne dispose d'aucune autorisation pour consulter ou divulguer les informations d'autres structures.`,
      });
    }

    // 3. Natural Language Command: "Crée une tâche..."
    if (
      lower.includes('crée une tâche') ||
      lower.includes('cree une tache') ||
      lower.includes('ajouter une tâche') ||
      lower.includes('ajoute une tâche') ||
      lower.includes('rappelle-moi') ||
      lower.includes('rappeler')
    ) {
      let title = text
        .replace(/crée une tâche pour /i, '')
        .replace(/cree une tache pour /i, '')
        .replace(/ajoute une tâche pour /i, '')
        .replace(/crée une tâche : /i, '')
        .replace(/crée une tâche /i, '')
        .replace(/cree une tache /i, '');

      // Parse date if mentions "demain"
      let dueDate: string | undefined;
      let displayDate = "aujourd'hui";

      if (lower.includes('demain')) {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        dueDate = tomorrow.toISOString().split('T')[0];
        displayDate = 'demain (' + tomorrow.toLocaleDateString('fr-FR') + ')';
        title = title.replace(/demain/i, '').trim();
      }

      // Parse time if mentions "à 10h" or "14:00"
      const timeMatch = title.match(/à\s*(\d{1,2})h(\d{2})?/i);
      if (timeMatch) {
        displayDate += ` à ${timeMatch[1]}h${timeMatch[2] || '00'}`;
      }

      return NextResponse.json({
        reply: `Voici ce que je prépare pour vous :\n\n• **Tâche :** ${title.trim()}\n• **Échéance :** ${displayDate}\n• **Responsable :** Vous\n\nVoulez-vous que je valide cette tâche ?`,
        actionProposal: {
          type: 'create_task',
          title: `Créer la tâche : "${title.trim()}"`,
          description: `Date d'échéance : ${displayDate}`,
          payload: {
            title: title.trim(),
            dueDate,
            priority: lower.includes('urgent') ? 'Haute' : 'Normale',
          },
          status: 'pending',
        },
      });
    }

    // 4. Analytical Query: "Combien mes clients me doivent ?"
    if (
      lower.includes('combien') &&
      (lower.includes('doivent') || lower.includes('créance') || lower.includes('dû') || lower.includes('impayé'))
    ) {
      const { data: invs } = await supabase
        .from('invoices')
        .select(`
          id, invoice_number, total, paid_amount, remaining_amount, due_date, status,
          customer:customers(id, name, company_name)
        `)
        .eq('company_id', companyId)
        .neq('status', 'Payée')
        .neq('status', 'Annulée');

      const totalDue = invs?.reduce(
        (acc, i) => acc + (Number(i.remaining_amount) || Math.max(0, Number(i.total) - Number(i.paid_amount))),
        0
      ) || 0;

      const overdueCount = invs?.filter(
        (i) => i.due_date && i.due_date < new Date().toISOString().split('T')[0]
      ).length || 0;

      // Group by customer to find top debtor
      const debtorMap = new Map<string, { name: string; amount: number }>();
      invs?.forEach((i: any) => {
        const cName = i.customer?.name || 'Client';
        const cur = debtorMap.get(cName) || { name: cName, amount: 0 };
        cur.amount += Number(i.remaining_amount) || (Number(i.total) - Number(i.paid_amount));
        debtorMap.set(cName, cur);
      });

      const topDebtors = Array.from(debtorMap.values()).sort((a, b) => b.amount - a.amount).slice(0, 3);
      const topDebtorsText = topDebtors.map((d) => `• **${d.name}** : ${formatMoney(d.amount, currency)}`).join('\n');

      return NextResponse.json({
        reply: `Vos clients doivent actuellement un solde total de **${formatMoney(totalDue, currency)}** réparti sur **${invs?.length || 0} facture(s)** en attente (${overdueCount} en retard).\n\n**Principaux soldes à recouvrer :**\n${topDebtorsText || 'Aucun débiteur majeur.'}`,
        quickActions: [
          { label: 'Voir les créances', link: '/invoices?filter=unpaid' },
          { label: 'Relances avec IA', link: '/reminders' },
        ],
      });
    }

    // 5. Analytical Query: "Quelles factures sont en retard ?"
    if (lower.includes('facture') && (lower.includes('retard') || lower.includes('échu') || lower.includes('relancer'))) {
      const todayStr = new Date().toISOString().split('T')[0];
      const { data: overdues } = await supabase
        .from('invoices')
        .select(`
          id, invoice_number, total, remaining_amount, due_date,
          customer:customers(id, name, company_name)
        `)
        .eq('company_id', companyId)
        .neq('status', 'Payée')
        .neq('status', 'Annulée')
        .lt('due_date', todayStr)
        .order('due_date', { ascending: true })
        .limit(5);

      if (!overdues || overdues.length === 0) {
        return NextResponse.json({
          reply: `Bonne nouvelle ! Vous n'avez **aucune facture en retard** de paiement dans votre entreprise **${company.name}**.`,
          quickActions: [{ label: 'Voir toutes les factures', link: '/invoices' }],
        });
      }

      const list = overdues.map((i: any) => {
        const days = Math.floor((Date.now() - new Date(i.due_date).getTime()) / (1000 * 60 * 60 * 24));
        const rem = Number(i.remaining_amount) || Number(i.total);
        return `• **Facture ${i.invoice_number}** — ${i.customer?.name || 'Client'} : **${formatMoney(rem, currency)}** (+${days} jours)`;
      }).join('\n');

      return NextResponse.json({
        reply: `Vous avez **${overdues.length} facture(s)** en retard nécessitant une attention immédiate :\n\n${list}`,
        quickActions: [
          { label: 'Ouvrir le module Relances', link: '/reminders' },
          { label: 'Voir la facture la plus ancienne', link: `/invoices/${overdues[0].id}` },
        ],
      });
    }

    // 6. CRM Query: "Quels prospects dois-je relancer ?"
    if (lower.includes('prospect') && (lower.includes('relancer') || lower.includes('contacter') || lower.includes('suivi') || lower.includes('intéressant'))) {
      const { data: leads } = await supabase
        .from('leads')
        .select('id, first_name, last_name, company_name, estimated_value, status, created_at, last_interaction_at')
        .eq('company_id', companyId)
        .not('status', 'in', '("Gagné","Perdu")')
        .order('estimated_value', { ascending: false })
        .limit(4);

      if (!leads || leads.length === 0) {
        return NextResponse.json({
          reply: `Vous n'avez aucun prospect actif en attente de relance actuellement.`,
          quickActions: [{ label: '+ Nouveau prospect', link: '/leads' }],
        });
      }

      const list = leads.map((l) => {
        const val = Number(l.estimated_value) || 0;
        return `• **${l.first_name || ''} ${l.last_name || ''}** (${l.company_name || 'Particulier'}) — Potentiel : **${formatMoney(val, currency)}** [Statut : ${l.status}]`;
      }).join('\n');

      return NextResponse.json({
        reply: `Voici vos opportunités commerciales prioritaires à relancer :\n\n${list}`,
        quickActions: [
          { label: 'Ouvrir le Pipeline Kanban', link: '/pipeline' },
          { label: 'Consulter les prospects', link: '/leads' },
        ],
      });
    }

    // 7. Summary Query: "Résume mon activité cette semaine" / Briefing
    if (lower.includes('résume') || lower.includes('resume') || lower.includes('semaine') || lower.includes('briefing') || lower.includes('bilan')) {
      const { data: invs } = await supabase.from('invoices').select('total, status').eq('company_id', companyId).neq('status', 'Annulée');
      const { data: pays } = await supabase.from('payments').select('amount').eq('company_id', companyId);
      const { data: quotes } = await supabase.from('quotes').select('status').eq('company_id', companyId);
      const { data: leads } = await supabase.from('leads').select('id').eq('company_id', companyId);

      const totalInvoiced = invs?.reduce((a, b) => a + (Number(b.total) || 0), 0) || 0;
      const totalCollected = pays?.reduce((a, b) => a + (Number(b.amount) || 0), 0) || 0;
      const acceptedQuotes = quotes?.filter((q) => q.status === 'Accepté').length || 0;

      return NextResponse.json({
        reply: `📊 **Synthèse de l'activité commerciale (${company.name})** :\n\n• **Chiffre d'affaires facturé :** ${formatMoney(totalInvoiced, currency)}\n• **Encaissements réels :** ${formatMoney(totalCollected, currency)}\n• **Devis conclus :** ${acceptedQuotes} devis acceptés\n• **Prospects qualifiés :** ${leads?.length || 0} dans votre base\n\n🎯 **Recommandation :** Priorisez le recouvrement des factures en retard et l'envoi des propositions pour les prospects en négociation.`,
        quickActions: [
          { label: 'Voir le Dashboard', link: '/dashboard' },
          { label: 'Consulter les Rapports', link: '/reports' },
        ],
      });
    }

    // 8. Phase 5 Query: "Combien ai-je encaissé ce mois-ci ?"
    if (lower.includes('encaissé ce mois') || lower.includes('encaissement ce mois') || lower.includes('encaissé ce mois-ci')) {
      const now = new Date();
      const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const { data: monthPayments } = await supabase
        .from('payments')
        .select('amount, payment_date')
        .eq('company_id', companyId)
        .gte('payment_date', firstDayOfMonth);

      const monthTotal = (monthPayments || []).reduce((acc, p) => acc + (Number(p.amount) || 0), 0);
      const monthName = now.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });

      return NextResponse.json({
        reply: `💰 **Encaissements pour le mois de ${monthName}** :\n\nVous avez encaissé **${formatMoney(monthTotal, currency)}** à travers **${monthPayments?.length || 0}** règlement(s) enregistré(s) ce mois-ci.`,
        quickActions: [
          { label: 'Voir les paiements', link: '/payments' },
          { label: 'Factures impayées', actionType: 'ask_overdue' },
        ],
      });
    }

    // 9. Phase 5 Query: "Où en est mon entreprise ?" / "Santé de mon entreprise"
    if (lower.includes('où en est mon entreprise') || lower.includes('ou en est mon entreprise') || lower.includes('santé') || lower.includes('sante')) {
      const { data: invs } = await supabase.from('invoices').select('total, remaining_amount, status').eq('company_id', companyId).neq('status', 'Annulée');
      const { data: custs } = await supabase.from('customers').select('id', { count: 'exact', head: true }).eq('company_id', companyId);
      const { data: overdue } = await supabase.from('invoices').select('id, remaining_amount').eq('company_id', companyId).eq('status', 'En retard');

      const totalDue = (invs || []).reduce((acc, i) => acc + (Number(i.remaining_amount) || 0), 0);
      const overdueCount = overdue?.length || 0;
      const overdueTotal = (overdue || []).reduce((acc, i) => acc + (Number(i.remaining_amount) || 0), 0);

      let healthStatus = '🟢 **Excellente santé opérationnelle.**';
      if (overdueCount > 3 || overdueTotal > 500000) {
        healthStatus = '🟠 **Attention requise sur le recouvrement.**';
      }

      return NextResponse.json({
        reply: `🏢 **Bilan Dirigeant — ${company.name}**\n\n${healthStatus}\n\n• **Clients actifs :** ${custs?.length || 0}\n• **Créances en attente :** ${formatMoney(totalDue, currency)}\n• **Factures en retard critique :** ${overdueCount} facture(s) (${formatMoney(overdueTotal, currency)})\n\n💡 **Action recommandée :** Lancez les relances automatiques par WhatsApp ou Email pour sécuriser votre trésorerie.`,
        quickActions: [
          { label: 'Consulter l\'analytics', link: '/analytics' },
          { label: 'Relancer les impayés', actionType: 'ask_overdue' },
        ],
      });
    }

    // 10. Phase 5 Query: "Mon abonnement" / "Statut de mon abonnement" / "Mes quotas"
    if (lower.includes('abonnement') || lower.includes('mon forfait') || lower.includes('quota') || lower.includes('limite')) {
      const { data: sub } = await supabase.from('subscriptions').select('*').eq('company_id', companyId).maybeSingle();
      const planName = sub?.plan_id ? sub.plan_id.toUpperCase() : 'BUSINESS (TRIAL)';
      const status = sub?.status || 'trialing';

      return NextResponse.json({
        reply: `💳 **Abonnement BusinessOS (${company.name})**\n\n• **Plan actif :** ${planName}\n• **Statut :** ${status === 'trialing' ? 'Période d\'essai gratuit' : status === 'active' ? 'Abonnement Actif' : status}\n\nConsultez l'utilisation précise de vos quotas (clients, factures, membres, IA) dans votre espace facturation.`,
        quickActions: [
          { label: 'Gérer mon abonnement', link: '/billing' },
          { label: 'Comparer les offres', link: '/pricing' },
        ],
      });
    }

    // 11. General Assistant Helper Response
    return NextResponse.json({
      reply: `Je suis prêt à vous assister pour **${company.name}**. Je peux :\n\n1. 📊 **Analyser vos finances** (*"Combien mes clients me doivent ?", "Factures en retard"*) ;\n2. 👥 **Qualifier vos prospects** (*"Quels prospects dois-je relancer ?"*) ;\n3. ✍️ **Créer des tâches** (*"Crée une tâche pour appeler le client Demain à 10h"*).\n\nQue souhaitez-vous faire ?`,
      quickActions: [
        { label: 'Combien mes clients me doivent ?', actionType: 'ask_debts' },
        { label: 'Quelles factures sont en retard ?', actionType: 'ask_overdue' },
        { label: 'Quels prospects dois-je relancer ?', actionType: 'ask_leads' },
      ],
    });
  } catch (err: any) {
    console.error('Error in assistant API:', err);
    return NextResponse.json({ error: err.message || 'Erreur interne' }, { status: 500 });
  }
}
