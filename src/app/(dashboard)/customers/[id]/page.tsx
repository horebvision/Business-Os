'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { createClient } from '@/lib/supabase/client';
import { Customer, Activity, Quote, Invoice, Payment, Task } from '@/lib/types';
import { 
  ArrowLeft, 
  Phone, 
  Mail, 
  MapPin, 
  Building, 
  DollarSign, 
  FileSpreadsheet, 
  Receipt, 
  CheckSquare, 
  Clock, 
  Edit3, 
  Trash2, 
  Plus, 
  Loader2, 
  AlertCircle, 
  CheckCircle2, 
  ExternalLink,
  MessageSquare,
  FileText,
  Send,
  Calendar,
  Save,
  CreditCard
} from 'lucide-react';
import Link from 'next/link';
import CustomerModal from '@/components/crm/CustomerModal';
import ActivityModal from '@/components/crm/ActivityModal';

type TabType = 'overview' | 'activities' | 'quotes' | 'invoices' | 'payments' | 'tasks' | 'notes';

export default function CustomerDetailPage() {
  const params = useParams();
  const router = useRouter();
  const customerId = params?.id as string;

  const { currentCompany, user } = useAuth();
  const supabase = createClient();

  const [customer, setCustomer] = useState<Customer | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  // Active Tab
  const [activeTab, setActiveTab] = useState<TabType>('overview');

  // Modals
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [activityModalOpen, setActivityModalOpen] = useState(false);

  // Quick inputs
  const [quickNote, setQuickNote] = useState('');
  const [quickNoteLoading, setQuickNoteLoading] = useState(false);

  // Notes tab editor
  const [notesContent, setNotesContent] = useState('');
  const [notesSaving, setNotesSaving] = useState(false);
  const [notesSavedSuccess, setNotesSavedSuccess] = useState(false);

  // Quick task
  const [taskTitle, setTaskTitle] = useState('');
  const [taskPriority, setTaskPriority] = useState<'Faible' | 'Normale' | 'Haute' | 'Urgente'>('Normale');
  const [taskDueDate, setTaskDueDate] = useState('');
  const [taskLoading, setTaskLoading] = useState(false);

  const fetchCustomerData = async () => {
    if (!currentCompany?.id || !customerId) return;
    setLoading(true);

    try {
      // 1. Fetch Customer
      const { data: custData, error: custError } = await supabase
        .from('customers')
        .select('*')
        .eq('id', customerId)
        .eq('company_id', currentCompany.id)
        .single();

      if (custError || !custData) {
        router.push('/customers');
        return;
      }
      setCustomer(custData as Customer);
      setNotesContent(custData.notes || '');

      // 2. Fetch Activities
      const { data: actData } = await supabase
        .from('activities')
        .select('*, user:user_id(id, full_name, email)')
        .eq('company_id', currentCompany.id)
        .or(`customer_id.eq.${customerId},entity_id.eq.${customerId}`)
        .order('created_at', { ascending: false });

      if (actData) setActivities(actData as Activity[]);

      // 3. Fetch Quotes
      const { data: quotesData } = await supabase
        .from('quotes')
        .select('*')
        .eq('company_id', currentCompany.id)
        .eq('customer_id', customerId)
        .order('created_at', { ascending: false });

      if (quotesData) setQuotes(quotesData as Quote[]);

      // 4. Fetch Invoices
      const { data: invData } = await supabase
        .from('invoices')
        .select('*')
        .eq('company_id', currentCompany.id)
        .eq('customer_id', customerId)
        .order('created_at', { ascending: false });

      if (invData) setInvoices(invData as Invoice[]);

      // 5. Fetch Payments
      const { data: payData } = await supabase
        .from('payments')
        .select('*, invoice:invoice_id(invoice_number)')
        .eq('company_id', currentCompany.id)
        .eq('customer_id', customerId)
        .order('created_at', { ascending: false });

      if (payData) setPayments(payData as Payment[]);

      // 6. Fetch Tasks
      const { data: taskData } = await supabase
        .from('tasks')
        .select('*, assignee:assigned_to(id, full_name, email)')
        .eq('company_id', currentCompany.id)
        .eq('customer_id', customerId)
        .order('created_at', { ascending: false });

      if (taskData) setTasks(taskData as Task[]);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomerData();
  }, [currentCompany?.id, customerId]);

  // Save notes tab content
  const handleSaveNotes = async () => {
    if (!customer || !currentCompany?.id) return;
    setNotesSaving(true);
    setNotesSavedSuccess(false);

    try {
      const { error } = await supabase
        .from('customers')
        .update({
          notes: notesContent.trim(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', customer.id);

      if (!error) {
        setCustomer({ ...customer, notes: notesContent.trim() });
        setNotesSavedSuccess(true);
        setTimeout(() => setNotesSavedSuccess(false), 2000);
      }
    } finally {
      setNotesSaving(false);
    }
  };

  // Quick note
  const handleAddQuickNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickNote.trim() || !currentCompany?.id || !user || !customer) return;
    setQuickNoteLoading(true);

    try {
      const nowIso = new Date().toISOString();
      await supabase.from('activities').insert({
        company_id: currentCompany.id,
        user_id: user.id,
        action: 'Note',
        entity_type: 'customer',
        entity_id: customer.id,
        entity_title: customer.name,
        customer_id: customer.id,
        description: quickNote.trim(),
        created_at: nowIso,
      });

      await supabase
        .from('customers')
        .update({
          last_activity_at: nowIso,
          updated_at: nowIso,
        })
        .eq('id', customer.id);

      setQuickNote('');
      fetchCustomerData();
    } finally {
      setQuickNoteLoading(false);
    }
  };

  // Quick Task Creation
  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskTitle.trim() || !currentCompany?.id || !user || !customer) return;
    setTaskLoading(true);

    try {
      const { error } = await supabase.from('tasks').insert({
        company_id: currentCompany.id,
        title: taskTitle.trim(),
        priority: taskPriority,
        due_date: taskDueDate || null,
        customer_id: customer.id,
        status: 'À faire',
        assigned_to: user.id,
        created_by: user.id,
      });

      if (!error) {
        setTaskTitle('');
        setTaskDueDate('');
        fetchCustomerData();
      }
    } finally {
      setTaskLoading(false);
    }
  };

  const handleDeleteCustomer = async () => {
    if (!customer || !currentCompany?.id) return;
    if (!confirm(`Supprimer définitivement le client "${customer.name}" et ses données rattachées ?`)) return;

    await supabase.from('customers').delete().eq('id', customer.id).eq('company_id', currentCompany.id);
    router.push('/customers');
  };

  // Operational metrics
  const activeQuotesCount = quotes.filter((q) => ['Brouillon', 'Envoyé', 'Consulté'].includes(q.status)).length;
  const overdueInvoicesCount = invoices.filter((i) => i.status === 'En retard').length;
  const openTasksCount = tasks.filter((t) => t.status !== 'Terminée').length;

  if (loading) {
    return (
      <div className="p-20 text-center text-slate-400">
        <Loader2 className="w-8 h-8 animate-spin mx-auto text-indigo-500 mb-2" />
        <span className="text-xs">Chargement de la fiche client 360°...</span>
      </div>
    );
  }

  if (!customer) return null;

  const due = Number(customer.total_due) || 0;
  const cleanPhoneForWa = customer.phone ? customer.phone.replace(/[^0-9]/g, '') : null;

  return (
    <div className="space-y-6">
      {/* Top Header & Breadcrumbs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/customers"
            className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400 font-medium">Clients</span>
              <span className="text-xs text-slate-300 dark:text-slate-700">/</span>
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                {customer.name}
              </span>
            </div>
            <div className="flex items-center gap-2.5 mt-0.5">
              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                {customer.name}
              </h1>
              {due > 0 ? (
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                  Solde dû
                </span>
              ) : (
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                  À jour
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Header Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/quotes?customer_id=${customer.id}`}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-xl shadow-sm transition-all"
          >
            <FileSpreadsheet className="w-4 h-4 text-indigo-500" />
            <span>+ Devis</span>
          </Link>

          <Link
            href={`/invoices?customer_id=${customer.id}`}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-xl shadow-sm transition-all"
          >
            <Receipt className="w-4 h-4 text-emerald-500" />
            <span>+ Facture</span>
          </Link>

          <button
            onClick={() => setActivityModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-xl shadow-sm transition-all"
          >
            <Clock className="w-4 h-4 text-blue-500" />
            <span>+ Activité</span>
          </button>

          <button
            onClick={() => setEditModalOpen(true)}
            className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
            title="Modifier le client"
          >
            <Edit3 className="w-4 h-4" />
          </button>

          <button
            onClick={handleDeleteCustomer}
            className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-400 hover:text-rose-500 transition-colors"
            title="Supprimer"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 6 KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider block">
            Total facturé
          </span>
          <span className="text-base font-black text-slate-900 dark:text-white mt-1 block truncate">
            {Number(customer.total_invoiced || 0).toLocaleString('fr-FR')} {currentCompany?.currency || 'FCFA'}
          </span>
        </div>

        <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider block">
            Total encaissé
          </span>
          <span className="text-base font-black text-emerald-600 dark:text-emerald-400 mt-1 block truncate">
            {Number(customer.total_paid || 0).toLocaleString('fr-FR')} {currentCompany?.currency || 'FCFA'}
          </span>
        </div>

        <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider block">
            Solde dû
          </span>
          <span className={`text-base font-black mt-1 block truncate ${
            due > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-900 dark:text-white'
          }`}>
            {due.toLocaleString('fr-FR')} {currentCompany?.currency || 'FCFA'}
          </span>
        </div>

        <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider block">
            Devis en cours
          </span>
          <span className="text-base font-black text-indigo-600 dark:text-indigo-400 mt-1 block">
            {activeQuotesCount}
          </span>
        </div>

        <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider block">
            Factures en retard
          </span>
          <span className={`text-base font-black mt-1 block ${
            overdueInvoicesCount > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-900 dark:text-white'
          }`}>
            {overdueInvoicesCount}
          </span>
        </div>

        <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider block">
            Tâches ouvertes
          </span>
          <span className="text-base font-black text-slate-900 dark:text-white mt-1 block">
            {openTasksCount}
          </span>
        </div>
      </div>

      {/* 7 Tabs Bar */}
      <div className="flex items-center gap-1 border-b border-slate-200 dark:border-slate-800 overflow-x-auto pb-px">
        {[
          { id: 'overview', label: 'Vue générale', count: null },
          { id: 'activities', label: 'Activité', count: activities.length },
          { id: 'quotes', label: 'Devis', count: quotes.length },
          { id: 'invoices', label: 'Factures', count: invoices.length },
          { id: 'payments', label: 'Paiements', count: payments.length },
          { id: 'tasks', label: 'Tâches', count: tasks.length },
          { id: 'notes', label: 'Notes', count: null },
        ].map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as TabType)}
              className={`px-4 py-3 text-xs font-semibold whitespace-nowrap transition-all border-b-2 flex items-center gap-1.5 ${
                isActive
                  ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 font-bold'
                  : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <span>{tab.label}</span>
              {tab.count !== null && (
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                    isActive
                      ? 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-400'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                  }`}
                >
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Tab 1: Vue générale */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Contact Details Card */}
          <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <h3 className="text-xs font-bold uppercase text-slate-400 tracking-wider">
              Coordonnées du client
            </h3>

            <div className="space-y-3.5 text-xs">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500">
                  <Building className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">
                    Entreprise / Société
                  </span>
                  <span className="font-bold text-slate-900 dark:text-white">
                    {customer.company_name || 'Particulier'}
                  </span>
                </div>
              </div>

              {customer.phone && (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500">
                      <Phone className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-bold block">
                        Téléphone
                      </span>
                      <a href={`tel:${customer.phone}`} className="font-bold text-indigo-600 dark:text-indigo-400 hover:underline">
                        {customer.phone}
                      </a>
                    </div>
                  </div>

                  {cleanPhoneForWa && (
                    <a
                      href={`https://wa.me/${cleanPhoneForWa}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-2.5 py-1 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-[11px] font-bold hover:bg-emerald-500/20 transition-colors flex items-center gap-1"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      <span>WhatsApp</span>
                    </a>
                  )}
                </div>
              )}

              {customer.email && (
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500">
                    <Mail className="w-4 h-4" />
                  </div>
                  <div className="truncate">
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">
                      Email
                    </span>
                    <a href={`mailto:${customer.email}`} className="font-bold text-indigo-600 dark:text-indigo-400 hover:underline truncate block">
                      {customer.email}
                    </a>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500">
                  <MapPin className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">
                    Localisation
                  </span>
                  <span className="font-semibold text-slate-900 dark:text-white">
                    {customer.address ? `${customer.address}, ` : ''}{customer.city || 'Abidjan'}
                  </span>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-400">
              Enregistré le {new Date(customer.created_at).toLocaleDateString('fr-FR')}
            </div>
          </div>

          {/* Financial Ratio & Summary */}
          <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <h3 className="text-xs font-bold uppercase text-slate-400 tracking-wider">
              Bilan des règlements
            </h3>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500">Taux de recouvrement</span>
                <span className="font-bold text-slate-900 dark:text-white">
                  {Number(customer.total_invoiced) > 0
                    ? Math.round((Number(customer.total_paid) / Number(customer.total_invoiced)) * 100)
                    : 100}%
                </span>
              </div>
              <div className="h-2.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden flex">
                <div
                  style={{
                    width: `${
                      Number(customer.total_invoiced) > 0
                        ? Math.min(100, Math.round((Number(customer.total_paid) / Number(customer.total_invoiced)) * 100))
                        : 100
                    }%`,
                  }}
                  className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                />
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-3 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Factures émises</span>
                <span className="font-bold text-slate-900 dark:text-white">{invoices.length}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Paiements enregistrés</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400">{payments.length}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Devis émis</span>
                <span className="font-bold text-slate-900 dark:text-white">{quotes.length}</span>
              </div>
            </div>
          </div>

          {/* Quick Tasks & Upcoming Actions */}
          <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase text-slate-400 tracking-wider">
                Tâches à traiter
              </h3>
              <button
                onClick={() => setActiveTab('tasks')}
                className="text-[11px] font-bold text-indigo-500 hover:underline"
              >
                Gérer ({openTasksCount})
              </button>
            </div>

            {tasks.filter((t) => t.status !== 'Terminée').length === 0 ? (
              <p className="text-xs text-slate-400 italic py-4">Toutes les tâches sont terminées.</p>
            ) : (
              <div className="space-y-2">
                {tasks
                  .filter((t) => t.status !== 'Terminée')
                  .slice(0, 3)
                  .map((task) => (
                    <div
                      key={task.id}
                      className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800 text-xs flex items-center justify-between"
                    >
                      <span className="font-semibold text-slate-900 dark:text-white truncate max-w-[180px]">
                        {task.title}
                      </span>
                      {task.due_date && (
                        <span className="text-[10px] text-slate-400">
                          {new Date(task.due_date).toLocaleDateString('fr-FR')}
                        </span>
                      )}
                    </div>
                  ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 2: Activité (Timeline) */}
      {activeTab === 'activities' && (
        <div className="space-y-6">
          <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
            <h3 className="text-xs font-bold uppercase text-slate-400 tracking-wider mb-3">
              Ajouter une note ou consigner un appel
            </h3>
            <form onSubmit={handleAddQuickNote} className="space-y-3">
              <textarea
                rows={2}
                value={quickNote}
                onChange={(e) => setQuickNote(e.target.value)}
                placeholder="Rédigez un compte-rendu ou une note..."
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 rounded-2xl text-slate-900 dark:text-white text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none resize-none"
              />
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setActivityModalOpen(true)}
                  className="text-xs font-bold text-indigo-500 hover:underline flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Options avancées (Type, relance...)</span>
                </button>
                <button
                  type="submit"
                  disabled={quickNoteLoading || !quickNote.trim()}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs rounded-xl shadow-sm transition-all flex items-center gap-1.5 disabled:opacity-50"
                >
                  {quickNoteLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                  <span>Enregistrer</span>
                </button>
              </div>
            </form>
          </div>

          <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
            <h3 className="text-sm font-extrabold text-slate-900 dark:text-white mb-4">
              Historique des interactions ({activities.length})
            </h3>

            {activities.length === 0 ? (
              <div className="py-12 text-center text-slate-400">
                <Clock className="w-8 h-8 mx-auto mb-2 opacity-60" />
                <p className="text-xs font-semibold">Aucune activité enregistrée</p>
              </div>
            ) : (
              <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200 dark:before:bg-slate-800">
                {activities.map((act) => (
                  <div key={act.id} className="relative">
                    <div className="absolute -left-6 top-1.5 w-5 h-5 rounded-full bg-white dark:bg-slate-900 border-2 border-indigo-500 flex items-center justify-center">
                      <div className="w-2 h-2 rounded-full bg-indigo-500" />
                    </div>

                    <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800">
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-xs text-slate-900 dark:text-white">{act.action}</span>
                          <span className="text-[10px] text-slate-400">par {act.user?.full_name || act.user?.email || 'Membre'}</span>
                        </div>
                        <span className="text-[10px] text-slate-400 font-medium">
                          {new Date(act.created_at).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}
                        </span>
                      </div>
                      <p className="text-xs text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">
                        {act.description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 3: Devis */}
      {activeTab === 'quotes' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-sm">
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Devis associés</h3>
            <Link
              href={`/quotes?customer_id=${customer.id}`}
              className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold transition-all inline-flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Nouveau devis</span>
            </Link>
          </div>

          {quotes.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-xs">
              Aucun devis créé pour ce client.
            </div>
          ) : (
            <table className="w-full text-left text-xs text-slate-700 dark:text-slate-300">
              <thead className="bg-slate-50 dark:bg-slate-800/60 uppercase text-[10px] font-bold text-slate-500 tracking-wider">
                <tr>
                  <th className="py-3.5 px-4">N° Devis</th>
                  <th className="py-3.5 px-4">Date</th>
                  <th className="py-3.5 px-4">Expiration</th>
                  <th className="py-3.5 px-4">Montant total</th>
                  <th className="py-3.5 px-4">Statut</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {quotes.map((q) => (
                  <tr key={q.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                    <td className="py-3.5 px-4 font-bold text-indigo-600 dark:text-indigo-400">
                      {q.quote_number}
                    </td>
                    <td className="py-3.5 px-4">{new Date(q.issue_date).toLocaleDateString('fr-FR')}</td>
                    <td className="py-3.5 px-4">{new Date(q.expiration_date).toLocaleDateString('fr-FR')}</td>
                    <td className="py-3.5 px-4 font-bold text-slate-900 dark:text-white">
                      {Number(q.total).toLocaleString('fr-FR')} {q.currency || currentCompany?.currency || 'FCFA'}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/10 text-indigo-600">
                        {q.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Tab 4: Factures */}
      {activeTab === 'invoices' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-sm">
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Factures associées</h3>
            <Link
              href={`/invoices?customer_id=${customer.id}`}
              className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold transition-all inline-flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Nouvelle facture</span>
            </Link>
          </div>

          {invoices.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-xs">
              Aucune facture émise pour ce client.
            </div>
          ) : (
            <table className="w-full text-left text-xs text-slate-700 dark:text-slate-300">
              <thead className="bg-slate-50 dark:bg-slate-800/60 uppercase text-[10px] font-bold text-slate-500 tracking-wider">
                <tr>
                  <th className="py-3.5 px-4">N° Facture</th>
                  <th className="py-3.5 px-4">Date</th>
                  <th className="py-3.5 px-4">Échéance</th>
                  <th className="py-3.5 px-4">Total</th>
                  <th className="py-3.5 px-4">Reste dû</th>
                  <th className="py-3.5 px-4">Statut</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {invoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                    <td className="py-3.5 px-4 font-bold text-indigo-600 dark:text-indigo-400">
                      {inv.invoice_number}
                    </td>
                    <td className="py-3.5 px-4">{new Date(inv.issue_date).toLocaleDateString('fr-FR')}</td>
                    <td className="py-3.5 px-4">{new Date(inv.due_date).toLocaleDateString('fr-FR')}</td>
                    <td className="py-3.5 px-4 font-bold text-slate-900 dark:text-white">
                      {Number(inv.total).toLocaleString('fr-FR')} {currentCompany?.currency || 'FCFA'}
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-amber-600">
                      {Number(inv.remaining_amount).toLocaleString('fr-FR')} {currentCompany?.currency || 'FCFA'}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-800">
                        {inv.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Tab 5: Paiements */}
      {activeTab === 'payments' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-sm">
          <div className="p-4 border-b border-slate-200 dark:border-slate-800">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Règlements reçus</h3>
          </div>

          {payments.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-xs">
              Aucun paiement enregistré pour ce client.
            </div>
          ) : (
            <table className="w-full text-left text-xs text-slate-700 dark:text-slate-300">
              <thead className="bg-slate-50 dark:bg-slate-800/60 uppercase text-[10px] font-bold text-slate-500 tracking-wider">
                <tr>
                  <th className="py-3.5 px-4">Date</th>
                  <th className="py-3.5 px-4">Facture</th>
                  <th className="py-3.5 px-4">Mode de règlement</th>
                  <th className="py-3.5 px-4">Référence</th>
                  <th className="py-3.5 px-4">Montant</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {payments.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                    <td className="py-3.5 px-4">{new Date(p.payment_date).toLocaleDateString('fr-FR')}</td>
                    <td className="py-3.5 px-4 font-semibold text-slate-900 dark:text-white">
                      {(p as any).invoice?.invoice_number || '—'}
                    </td>
                    <td className="py-3.5 px-4">{p.payment_method}</td>
                    <td className="py-3.5 px-4 text-slate-400">{p.reference || '—'}</td>
                    <td className="py-3.5 px-4 font-bold text-emerald-600 dark:text-emerald-400">
                      {Number(p.amount).toLocaleString('fr-FR')} {currentCompany?.currency || 'FCFA'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Tab 6: Tâches */}
      {activeTab === 'tasks' && (
        <div className="space-y-6">
          <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
            <h3 className="text-xs font-bold uppercase text-slate-400 tracking-wider mb-3">
              Créer une tâche pour ce client
            </h3>
            <form onSubmit={handleCreateTask} className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div className="sm:col-span-2">
                <input
                  type="text"
                  required
                  value={taskTitle}
                  onChange={(e) => setTaskTitle(e.target.value)}
                  placeholder="Intitulé de la tâche..."
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>
              <div>
                <input
                  type="date"
                  value={taskDueDate}
                  onChange={(e) => setTaskDueDate(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>
              <button
                type="submit"
                disabled={taskLoading || !taskTitle.trim()}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs rounded-xl shadow-sm transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                {taskLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                <span>Ajouter</span>
              </button>
            </form>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-sm">
            {tasks.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-xs">
                Aucune tâche associée à ce client.
              </div>
            ) : (
              <table className="w-full text-left text-xs text-slate-700 dark:text-slate-300">
                <thead className="bg-slate-50 dark:bg-slate-800/60 uppercase text-[10px] font-bold text-slate-500 tracking-wider">
                  <tr>
                    <th className="py-3.5 px-4">Tâche</th>
                    <th className="py-3.5 px-4">Priorité</th>
                    <th className="py-3.5 px-4">Échéance</th>
                    <th className="py-3.5 px-4">Statut</th>
                    <th className="py-3.5 px-4">Responsable</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {tasks.map((t) => (
                    <tr key={t.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                      <td className="py-3.5 px-4 font-semibold text-slate-900 dark:text-white">
                        {t.title}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 dark:bg-slate-800">
                          {t.priority}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        {t.due_date ? new Date(t.due_date).toLocaleDateString('fr-FR') : '—'}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          t.status === 'Terminée' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-amber-500/10 text-amber-600'
                        }`}>
                          {t.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-slate-500">
                        {t.assignee?.full_name || t.assignee?.email || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Tab 7: Notes */}
      {activeTab === 'notes' && (
        <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
                Bloc-notes confidentiel du compte
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Notez toutes les conditions particulières, mémos de négociation et préférences client.
              </p>
            </div>

            <button
              onClick={handleSaveNotes}
              disabled={notesSaving}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs rounded-xl shadow-sm transition-all flex items-center gap-1.5 disabled:opacity-50"
            >
              {notesSaving ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Enregistrement...</span>
                </>
              ) : notesSavedSuccess ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-300" />
                  <span>Enregistré !</span>
                </>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5" />
                  <span>Enregistrer les notes</span>
                </>
              )}
            </button>
          </div>

          <textarea
            rows={10}
            value={notesContent}
            onChange={(e) => setNotesContent(e.target.value)}
            placeholder="Écrivez vos notes ici..."
            className="w-full p-4 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl text-slate-900 dark:text-white text-xs leading-relaxed focus:ring-2 focus:ring-indigo-500 focus:outline-none resize-none font-mono"
          />
        </div>
      )}

      {/* Modals */}
      <CustomerModal
        isOpen={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        onSuccess={fetchCustomerData}
        customerToEdit={customer}
      />

      <ActivityModal
        isOpen={activityModalOpen}
        onClose={() => setActivityModalOpen(false)}
        onSuccess={fetchCustomerData}
        entityType="customer"
        entityId={customer.id}
        entityTitle={customer.name}
      />
    </div>
  );
}
