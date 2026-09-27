/**
 * BusinessOS — Modèles d'emails transactionnels (Phases 4 & 5)
 * Supporte le modal EmailModal des factures/devis et les alertes SaaS / invitations
 */

export interface EmailTemplateDefinition {
  id: string;
  name: string;
  category: 'invoice' | 'quote';
  subject: string;
  body: string;
}

export const EMAIL_TEMPLATES: Record<string, EmailTemplateDefinition> = {
  // Factures
  invoice_sent: {
    id: 'invoice_sent',
    name: 'Nouvelle facture disponible',
    category: 'invoice',
    subject: 'Facture {invoice_number} de {company_name}',
    body: `Bonjour {client_name},

Veuillez trouver ci-joint votre facture {invoice_number} émise par {company_name} d'un montant de {amount}.

Date d'échéance : {due_date}

Vous pouvez consulter et régler votre facture en ligne sur votre portail client sécurisé :
{link}

Restant à votre entière disposition pour tout renseignement complémentaire.

Cordialement,
{company_name}`,
  },
  invoice_reminder_soft: {
    id: 'invoice_reminder_soft',
    name: 'Rappel d’échéance bienveillant',
    category: 'invoice',
    subject: 'Rappel : Facture {invoice_number} à échéance proche',
    body: `Bonjour {client_name},

Sauf erreur ou omission de notre part, nous vous informons que la facture {invoice_number} d'un montant de {amount} arrive à échéance le {due_date}.

Pour faciliter votre règlement en ligne :
{link}

Si votre virement a déjà été effectué entre-temps, nous vous prions de ne pas tenir compte de ce rappel.

Bien cordialement,
{company_name}`,
  },
  invoice_overdue: {
    id: 'invoice_overdue',
    name: 'Relance facture impayée',
    category: 'invoice',
    subject: 'URGENT : Retard de règlement — Facture {invoice_number}',
    body: `Bonjour {client_name},

Nous constatons à ce jour que la facture {invoice_number} d'un montant de {amount}, échue le {due_date}, demeure impayée sur notre relevé.

Nous vous prions de bien vouloir régulariser cette situation dans les meilleurs délais via le lien sécurisé suivant :
{link}

Si vous rencontrez la moindre difficulté ou contestation, merci de contacter notre service comptable immédiatement.

Cordialement,
{company_name}`,
  },

  // Devis
  quote_sent: {
    id: 'quote_sent',
    name: 'Envoi de proposition commerciale / devis',
    category: 'quote',
    subject: 'Proposition commerciale : Devis {quote_number} de {company_name}',
    body: `Bonjour {client_name},

Nous avons le plaisir de vous transmettre notre proposition commerciale {quote_number} d'un montant total de {amount}.

Consultez le détail des prestations et validez votre devis directement en ligne en un clic :
{link}

Ce devis est valable jusqu'au {due_date}.

Dans l'attente de votre retour, nous restons disponibles pour toute question.

Cordialement,
{company_name}`,
  },
  quote_followup: {
    id: 'quote_followup',
    name: 'Suivi de devis sans réponse',
    category: 'quote',
    subject: 'Suivi de votre projet — Devis {quote_number}',
    body: `Bonjour {client_name},

Nous souhaitions prendre de vos nouvelles suite à l'envoi de notre devis {quote_number} ({amount}).

Avez-vous eu l'opportunité de l'étudier ?
Vous pouvez le consulter et l'accepter directement sur votre portail :
{link}

Si vous souhaitez ajuster certains éléments techniques ou budgétaires, nous sommes à votre écoute pour organiser un court échange téléphonique.

Bien à vous,
{company_name}`,
  },
};

export function renderEmailTemplate(
  templateKey: string,
  variables: Record<string, string>
): { subject: string; body: string } {
  const tpl = EMAIL_TEMPLATES[templateKey] || EMAIL_TEMPLATES.invoice_sent;
  let subject = tpl.subject;
  let body = tpl.body;

  Object.entries(variables).forEach(([k, v]) => {
    const regex = new RegExp(`{${k}}`, 'g');
    subject = subject.replace(regex, v || '');
    body = body.replace(regex, v || '');
  });

  return { subject, body };
}

export interface EmailTemplatePayload {
  to: string;
  subject: string;
  body: string;
}

/**
 * Phase 5 SaaS Transactional Templates
 */
export const EmailTemplates = {
  // 1. Bienvenue SaaS
  welcome: (userName: string, companyName: string, trialDays = 14): EmailTemplatePayload => ({
    to: '',
    subject: `Bienvenue sur BusinessOS — ${companyName}`,
    body: `Bonjour ${userName},

Félicitations pour la création de votre compte BusinessOS pour ${companyName} !

Votre période d'essai gratuit de ${trialDays} jours est dès à présent active. Elle vous donne accès à l'ensemble des fonctionnalités :
- Gestion complète de vos clients et prospects (CRM)
- Création et envoi de devis et factures conformes
- Relances automatiques et paiements Mobile Money
- Assistant IA et tableau de bord dirigeant

Connectez-vous pour commencer la configuration de votre espace :
${process.env.NEXT_PUBLIC_APP_URL || 'https://app.businessos.com'}/dashboard

L'équipe BusinessOS`,
  }),

  // 2. Invitation Collaborateur
  teamInvitation: (
    inviterName: string,
    companyName: string,
    role: string,
    inviteUrl: string
  ): EmailTemplatePayload => ({
    to: '',
    subject: `${inviterName} vous invite à rejoindre ${companyName} sur BusinessOS`,
    body: `Bonjour,

${inviterName} vous invite à collaborer au sein de l'organisation "${companyName}" sur la plateforme BusinessOS en tant que ${role}.

Pour accepter cette invitation et configurer votre accès sécurisé, cliquez sur le lien ci-dessous :
${inviteUrl}

Ce lien est strictement confidentiel et reste valable pendant 7 jours.

L'équipe BusinessOS`,
  }),

  // 3. Essai bientôt terminé
  trialExpiringSoon: (
    userName: string,
    daysRemaining: number,
    billingUrl: string
  ): EmailTemplatePayload => ({
    to: '',
    subject: `Votre période d'essai BusinessOS se termine dans ${daysRemaining} jour${daysRemaining > 1 ? 's' : ''}`,
    body: `Bonjour ${userName},

Votre période d'essai gratuit sur BusinessOS touche à sa fin dans ${daysRemaining} jour${daysRemaining > 1 ? 's' : ''}.

Pour continuer à piloter vos clients, factures et automatisations sans aucune interruption de service, nous vous invitons à choisir un abonnement adapté à votre entreprise :
${billingUrl}

Nos plans (Starter, Business, Pro) s'adaptent à la taille de votre équipe avec facturation mensuelle ou annuelle.

L'équipe BusinessOS`,
  }),

  // 4. Essai terminé
  trialExpired: (userName: string, billingUrl: string): EmailTemplatePayload => ({
    to: '',
    subject: `Votre période d'essai BusinessOS est arrivée à expiration`,
    body: `Bonjour ${userName},

Votre période d'essai gratuit de 14 jours est désormais terminée.

Vos données sont conservées en toute sécurité. Pour réactiver l'accès complet à votre CRM, vos documents et l'assistant IA, choisissez votre formule d'abonnement :
${billingUrl}

Si vous avez la moindre question, répondez simplement à cet email.

L'équipe BusinessOS`,
  }),

  // 5. Abonnement activé
  subscriptionActivated: (
    userName: string,
    companyName: string,
    planName: string,
    amount: string
  ): EmailTemplatePayload => ({
    to: '',
    subject: `Confirmation d'abonnement BusinessOS : Plan ${planName}`,
    body: `Bonjour ${userName},

Votre souscription au plan ${planName} pour ${companyName} est maintenant active !

Montant : ${amount}
Votre reçu de paiement et vos détails de facturation sont consultables à tout moment sur votre console :
${process.env.NEXT_PUBLIC_APP_URL || 'https://app.businessos.com'}/billing

Merci de votre confiance.

L'équipe BusinessOS`,
  }),

  // 6. Changement de rôle collaborateur
  roleChanged: (userName: string, companyName: string, newRole: string): EmailTemplatePayload => ({
    to: '',
    subject: `Mise à jour de vos autorisations sur ${companyName}`,
    body: `Bonjour ${userName},

Votre rôle opérationnel au sein de ${companyName} sur BusinessOS a été mis à jour.
Votre nouveau rôle est : ${newRole}.

Vos accès et permissions dans l'application ont été actualisés en conséquence.

L'équipe BusinessOS`,
  }),
};
