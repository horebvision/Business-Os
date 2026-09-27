// ==============================================================================
// BUSINESSOS — CORE TYPESCRIPT DEFINITIONS (PHASE 1 & PHASE 2 CRM)
// ==============================================================================

export type UserRole = 'owner' | 'admin' | 'manager' | 'commercial' | 'accountant' | 'comptable' | 'employee';

export interface UserProfile {
  id: string;
  email: string;
  first_name?: string | null;
  last_name?: string | null;
  full_name?: string | null;
  phone?: string | null;
  job_title?: string | null;
  avatar_url?: string | null;
  created_at: string;
  updated_at: string;
}

export interface Company {
  id: string;
  name: string;
  slug: string;
  logo_url?: string | null;
  sector?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  country: string;
  city: string;
  currency: string;
  plan: 'free' | 'pro' | 'business';
  managed_modules: string[];
  onboarding_completed: boolean;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
}

export interface Membership {
  id: string;
  company_id: string;
  user_id: string;
  role: UserRole;
  is_active: boolean;
  invited_email?: string | null;
  created_at: string;
  updated_at: string;
  company?: Company;
  user?: UserProfile;
}

export type LeadStatus = 
  | 'Nouveau' 
  | 'Contacté' 
  | 'Qualifié' 
  | 'Proposition envoyée' 
  | 'Négociation' 
  | 'Gagné' 
  | 'Perdu';

export type LeadSource = 
  | 'WhatsApp'
  | 'Facebook'
  | 'Instagram'
  | 'Site web'
  | 'Téléphone'
  | 'Email'
  | 'Recommandation'
  | 'Salon / événement'
  | 'Autre';

export interface Lead {
  id: string;
  company_id: string;
  name: string;
  company_name?: string | null;
  phone?: string | null;
  email?: string | null;
  source: string;
  status: LeadStatus;
  potential_amount: number;
  assigned_to?: string | null;
  next_action?: string | null;
  last_interaction_at?: string | null;
  notes?: string | null;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
  assignee?: UserProfile;
}

export interface Customer {
  id: string;
  company_id: string;
  name: string;
  company_name?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  city?: string | null;
  notes?: string | null;
  total_invoiced: number;
  total_paid: number;
  total_due: number;
  last_activity_at: string;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
  assigned_to?: string | null;
  assignee?: UserProfile;
}

export type ActivityType = 
  | 'Appel'
  | 'Email'
  | 'WhatsApp'
  | 'Réunion'
  | 'Note'
  | 'Visite'
  | 'Changement de statut'
  | 'Conversion client'
  | 'Autre';

export interface Activity {
  id: string;
  company_id: string;
  user_id?: string | null;
  action: string;
  entity_type: 'lead' | 'customer' | 'quote' | 'invoice' | 'payment' | 'task' | 'general';
  entity_id?: string | null;
  entity_title?: string | null;
  description: string;
  customer_id?: string | null;
  metadata?: Record<string, any>;
  created_at: string;
  user?: UserProfile;
}

export type QuoteStatus = 'Brouillon' | 'Envoyé' | 'Consulté' | 'Accepté' | 'Refusé' | 'Expiré' | 'Annulé';

export interface QuoteItem {
  id?: string;
  quote_id?: string;
  description: string;
  reference?: string | null;
  quantity: number;
  unit?: string | null;
  unit_price: number;
  discount_rate?: number;
  tax_rate?: number;
  total: number;
  sort_order?: number;
}

export interface Quote {
  id: string;
  company_id: string;
  customer_id?: string | null;
  quote_number: string;
  subject?: string | null;
  issue_date: string;
  quote_date?: string;
  expiration_date: string;
  expiry_date?: string;
  subtotal: number;
  discount_rate: number;
  discount_amount: number;
  tax_rate: number;
  tax_amount: number;
  total: number;
  currency: string;
  status: QuoteStatus;
  terms?: string | null;
  notes?: string | null;
  assigned_to?: string | null;
  public_token?: string | null;
  accepted_at?: string | null;
  rejected_at?: string | null;
  rejected_reason?: string | null;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
  customer?: Customer;
  assignee?: UserProfile;
  items?: QuoteItem[];
}

export type InvoiceStatus = 'Brouillon' | 'Envoyée' | 'Partiellement payée' | 'Payée' | 'En retard' | 'Annulée';

export interface InvoiceItem {
  id?: string;
  invoice_id?: string;
  description: string;
  reference?: string | null;
  quantity: number;
  unit?: string | null;
  unit_price: number;
  discount_rate?: number;
  tax_rate?: number;
  total: number;
  sort_order?: number;
}

export interface Invoice {
  id: string;
  company_id: string;
  customer_id?: string | null;
  quote_id?: string | null;
  invoice_number: string;
  subject?: string | null;
  issue_date: string;
  due_date: string;
  subtotal: number;
  discount_amount: number;
  tax_amount: number;
  total: number;
  paid_amount: number;
  remaining_amount: number;
  currency: string;
  status: InvoiceStatus;
  payment_terms?: string | null;
  notes?: string | null;
  terms?: string | null;
  assigned_to?: string | null;
  public_token?: string | null;
  last_reminder_sent_at?: string | null;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
  customer?: Customer;
  quote?: Quote;
  assignee?: UserProfile;
  items?: InvoiceItem[];
}

export type PaymentMethod = 'Espèces' | 'Virement bancaire' | 'Chèque' | 'Mobile Money' | 'Carte' | 'Autre';

export interface Payment {
  id: string;
  company_id: string;
  invoice_id: string;
  customer_id?: string | null;
  amount: number;
  payment_date: string;
  payment_method: PaymentMethod;
  reference?: string | null;
  notes?: string | null;
  created_by?: string | null;
  created_at: string;
  invoice?: Invoice;
  customer?: Customer;
}

export interface Reminder {
  id: string;
  company_id: string;
  invoice_id: string;
  customer_id?: string | null;
  reminder_type: 'email' | 'whatsapp' | 'sms' | 'manuel';
  channel: string;
  status: 'en_attente' | 'envoyé' | 'annulé';
  scheduled_for: string;
  sent_at?: string | null;
  days_overdue?: number;
  message?: string;
  message_content?: string;
  created_by?: string | null;
  created_at: string;
  invoice?: Invoice;
  customer?: Customer;
}

export type TaskPriority = 'Faible' | 'Normale' | 'Haute' | 'Urgente';
export type TaskStatus = 'À faire' | 'En cours' | 'Terminée';

export interface Task {
  id: string;
  company_id: string;
  title: string;
  description?: string | null;
  assigned_to?: string | null;
  priority: TaskPriority;
  due_date?: string | null;
  customer_id?: string | null;
  project_name?: string | null;
  status: TaskStatus;
  completed_at?: string | null;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
  assignee?: UserProfile;
  customer?: Customer;
}

export interface AppNotification {
  id: string;
  company_id: string;
  user_id?: string | null;
  title: string;
  message: string;
  type:
    | 'info'
    | 'success'
    | 'warning'
    | 'danger'
    | 'commercial'
    | 'task'
    | 'subscription'
    | 'automation'
    | 'financial'
    | 'system'
    | 'team';
  link?: string | null;
  is_read: boolean;
  created_at: string;
}

export interface RecommendedAction {
  id: string;
  type: 'danger' | 'warning' | 'info' | 'success';
  icon: string;
  message: string;
  count: number;
  link: string;
  actionLabel: string;
}

export interface DashboardMetrics {
  totalRevenue: number;
  unpaidInvoicesAmount: number;
  unpaidInvoicesCount: number;
  pendingQuotesCount: number;
  pendingQuotesAmount: number;
  newLeadsCount: number;
  tasksDueTodayCount: number;
  overdueInvoicesCount: number;
  staleLeadsCount: number;
  totalCustomersCount?: number;
  activeOpportunitiesAmount?: number;
}

export interface DuplicateCheckMatch {
  id: string;
  name: string;
  type: 'lead' | 'customer';
  matchedField: 'email' | 'phone' | 'name_company';
  link: string;
}

// ======================== PHASE 4 TYPES ========================

export type AutomationTrigger =
  | 'lead_created'
  | 'customer_created'
  | 'quote_sent'
  | 'quote_accepted'
  | 'quote_rejected'
  | 'invoice_created'
  | 'invoice_due_soon'
  | 'invoice_overdue'
  | 'payment_received'
  | 'task_due_soon'
  | 'task_overdue';

export type AutomationAction =
  | 'create_task'
  | 'create_notification'
  | 'change_status'
  | 'assign_user'
  | 'generate_message'
  | 'send_email'
  | 'create_reminder'
  | 'create_activity';

export type AutomationConditionOperator =
  | 'equals'
  | 'not_equals'
  | 'greater_than'
  | 'less_than'
  | 'contains'
  | 'after'
  | 'before';

export interface AutomationCondition {
  field: string;
  operator: AutomationConditionOperator;
  value: string | number;
}

export interface AutomationConfig {
  condition?: AutomationCondition;
  mode: 'assisted' | 'automatic';
  action_payload?: Record<string, any>;
  description?: string;
}

export interface AutomationRule {
  id: string;
  company_id: string;
  name: string;
  trigger_event: string;
  action_type: string;
  action_config: AutomationConfig | any;
  is_active: boolean;
  created_at: string;
  updated_at?: string;
  run_count?: number;
  last_run_at?: string;
}

export interface AutomationRun {
  id: string;
  automation_id: string;
  company_id: string;
  triggered_by: string;
  status: 'Réussie' | 'En attente' | 'Échouée';
  details?: Record<string, any>;
  created_at: string;
  automation?: {
    name: string;
    trigger_event: string;
    action_type: string;
  };
}

export type PriorityScore = 'Urgent' | 'Important' | 'À surveiller';

export interface ActionCenterItem {
  id: string;
  priority: PriorityScore;
  title: string;
  subtitle: string;
  entityType: 'invoice' | 'lead' | 'quote' | 'task';
  entityId: string;
  amount?: number;
  daysOverdue?: number;
  actionLabel: string;
  actionUrl: string;
}

export interface AiChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
  actionProposal?: {
    type: 'create_task' | 'create_lead' | 'create_invoice' | 'send_reminder' | 'create_activity';
    title: string;
    description?: string;
    payload: Record<string, any>;
    status?: 'pending' | 'confirmed' | 'cancelled';
  };
  quickActions?: Array<{
    label: string;
    link?: string;
    actionType?: string;
    payload?: any;
  }>;
}

export interface EmailTemplate {
  id: string;
  category: 'quote' | 'invoice';
  name: string;
  subject: string;
  body: string;
  variables: string[];
}

// ==============================================================================
// BUSINESSOS — PHASE 5 SaaS, PLANS, PERMISSIONS & ANALYTICS TYPES
// ==============================================================================

export type PlanTier = 'starter' | 'business' | 'pro';
export type SubscriptionStatus = 'trialing' | 'active' | 'past_due' | 'paused' | 'canceled' | 'expired';
export type BillingInterval = 'monthly' | 'yearly';

export interface PlanLimits {
  max_users: number;
  max_customers: number;
  max_leads: number;
  max_invoices_per_month: number;
  max_quotes_per_month: number;
  max_automations: number;
  ai_credits_per_month: number;
}

export interface PlanFeatures {
  crm: boolean;
  quotes: boolean;
  invoices: boolean;
  payments: boolean;
  email_resend: boolean;
  whatsapp_link: boolean;
  whatsapp_cloud: boolean;
  ai_basic: boolean;
  ai_advanced: boolean;
  client_portal: boolean;
  advanced_analytics: boolean;
  api_webhooks: boolean;
  custom_export: boolean;
  priority_support?: boolean;
  audit_logs?: boolean;
}

export interface Plan {
  id: string;
  name: string;
  slug: PlanTier;
  description: string;
  price_monthly: number;
  price_yearly: number;
  currency: string;
  trial_days: number;
  is_active: boolean;
  features: PlanFeatures;
  limits: PlanLimits;
  created_at?: string;
  updated_at?: string;
}

export interface Subscription {
  id: string;
  company_id: string;
  plan_tier: PlanTier;
  plan_id?: string | null;
  status: SubscriptionStatus;
  billing_interval: BillingInterval;
  trial_start?: string | null;
  trial_end?: string | null;
  current_period_start: string;
  current_period_end: string;
  cancel_at_period_end: boolean;
  canceled_at?: string | null;
  provider: string;
  provider_customer_id?: string | null;
  provider_subscription_id?: string | null;
  created_at: string;
  updated_at: string;
  plan?: Plan;
}

export type AppPermission =
  | 'company.view'
  | 'company.update'
  | 'team.view'
  | 'team.invite'
  | 'team.manage'
  | 'leads.view'
  | 'leads.create'
  | 'leads.update'
  | 'leads.delete'
  | 'customers.view'
  | 'customers.create'
  | 'customers.update'
  | 'customers.delete'
  | 'quotes.view'
  | 'quotes.create'
  | 'quotes.update'
  | 'quotes.send'
  | 'quotes.accept'
  | 'invoices.view'
  | 'invoices.create'
  | 'invoices.update'
  | 'invoices.send'
  | 'payments.view'
  | 'payments.create'
  | 'reports.view'
  | 'automations.view'
  | 'automations.manage'
  | 'ai.use'
  | 'billing.view'
  | 'billing.manage'
  | 'analytics.view'
  | 'audit.view';

export interface Invitation {
  id: string;
  company_id: string;
  email: string;
  role: UserRole;
  token: string;
  expires_at: string;
  accepted_at?: string | null;
  invited_by?: string | null;
  created_at: string;
  inviter?: UserProfile;
  company?: Company;
}

export interface AuditLog {
  id: string;
  company_id: string;
  user_id?: string | null;
  action: string;
  entity_type: string;
  entity_id?: string | null;
  old_values?: Record<string, any> | null;
  new_values?: Record<string, any> | null;
  ip_address?: string | null;
  user_agent?: string | null;
  created_at: string;
  user?: UserProfile;
}

export interface PaymentTransaction {
  id: string;
  company_id: string;
  subscription_id?: string | null;
  invoice_id?: string | null;
  provider: 'wave' | 'orange_money' | 'mtn_momo' | 'manual' | 'card';
  amount: number;
  currency: string;
  status: 'pending' | 'completed' | 'failed' | 'cancelled';
  provider_tx_id?: string | null;
  customer_phone?: string | null;
  customer_email?: string | null;
  reference?: string | null;
  metadata?: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface UsageRecord {
  id: string;
  company_id: string;
  metric: string;
  current_value: number;
  period_start: string;
  period_end: string;
  updated_at: string;
}


