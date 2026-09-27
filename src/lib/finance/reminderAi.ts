import { formatMoney } from './money';

export type ReminderTone = 'courtois' | 'ferme' | 'urgent';

interface ReminderTemplateParams {
  customerName: string;
  invoiceNumber: string;
  remainingAmount: number;
  currency: string;
  dueDate: string;
  daysOverdue: number;
  companyName: string;
  tone?: ReminderTone;
}

export function generateReminderMessage(params: ReminderTemplateParams): string {
  const {
    customerName,
    invoiceNumber,
    remainingAmount,
    currency,
    dueDate,
    daysOverdue,
    companyName,
    tone = 'courtois',
  } = params;

  const formattedAmount = formatMoney(remainingAmount, currency);
  const formattedDate = new Date(dueDate).toLocaleDateString('fr-FR');

  if (tone === 'courtois') {
    return `Bonjour ${customerName},

Nous vous contactons concernant la facture ${invoiceNumber} d'un montant de ${formattedAmount}, arrivée à échéance le ${formattedDate}.

Sauf erreur de notre part, cette facture reste actuellement en attente de règlement.

Nous vous remercions par avance de bien vouloir procéder à son règlement ou de nous informer si un virement a déjà été émis.

Restant à votre entière disposition pour tout renseignement complémentaire.

Cordialement,
Le service comptabilité — ${companyName}`;
  }

  if (tone === 'ferme') {
    return `Bonjour ${customerName},

Malgré nos précédentes communications, nous constatons que la facture ${invoiceNumber} d'un montant de ${formattedAmount} présente à ce jour un retard de paiement de ${daysOverdue} jour(s) (échéance le ${formattedDate}).

Nous vous prions de régulariser cette situation dans les plus brefs délais afin d'éviter toute suspension de nos services.

Merci de nous faire parvenir la preuve de paiement dès exécution du règlement.

Bien cordialement,
Direction financière — ${companyName}`;
  }

  // Urgent
  return `URGENT — DERNIÈRE RELANCE AVANT MISE EN RECOUVREMENT

Bonjour ${customerName},

Votre compte présente un solde impayé de ${formattedAmount} au titre de la facture ${invoiceNumber}, échue depuis le ${formattedDate} (${daysOverdue} jours de retard).

Sans règlement ou confirmation de paiement de votre part sous 48 heures, nous serons contraints de transmettre ce dossier à notre service contentieux et de suspendre l'ensemble de vos prestations.

Comptant sur votre prompte réactivité pour solutionner ce dossier à l'amiable.

Direction Administrative & Financière — ${companyName}`;
}
