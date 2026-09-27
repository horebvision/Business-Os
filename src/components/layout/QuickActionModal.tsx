'use client';

import React, { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { createClient } from '@/lib/supabase/client';
import { 
  X, 
  UserPlus, 
  Users, 
  FileSpreadsheet, 
  Receipt, 
  CheckSquare, 
  ArrowRight, 
  Loader2, 
  CheckCircle2, 
  AlertCircle 
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import DuplicateWarning from '@/components/crm/DuplicateWarning';

interface QuickActionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

type ActionType = 'lead' | 'customer' | 'task';

export default function QuickActionModal({ isOpen, onClose, onSuccess }: QuickActionModalProps) {
  const { currentCompany, user } = useAuth();
  const router = useRouter();
  const supabase = createClient();

  const [activeTab, setActiveTab] = useState<ActionType>('lead');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [duplicates, setDuplicates] = useState<any[]>([]);

  // Form fields
  const [name, setName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [phone, setPhone] = useState('+225 ');
  const [email, setEmail] = useState('');
  const [amount, setAmount] = useState('');
  const [taskTitle, setTaskTitle] = useState('');
  const [taskPriority, setTaskPriority] = useState('Normale');
  const [taskDueDate, setTaskDueDate] = useState('');
  const [notes, setNotes] = useState('');

  if (!isOpen) return null;

  const handleCheckDuplicates = async () => {
    if (!currentCompany?.id || activeTab === 'task') return;
    if (!email && (!phone || phone === '+225 ') && !name) return;

    const { checkDuplicates } = await import('@/lib/crm/duplicateCheck');
    const matches = await checkDuplicates(supabase, currentCompany.id, {
      email,
      phone: phone !== '+225 ' ? phone : undefined,
      name,
      companyName,
    });
    setDuplicates(matches);
  };

  const resetForm = () => {
    setName('');
    setCompanyName('');
    setPhone('+225 ');
    setEmail('');
    setAmount('');
    setTaskTitle('');
    setTaskPriority('Normale');
    setTaskDueDate('');
    setNotes('');
    setErrorMsg(null);
    setSuccessMsg(null);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentCompany?.id || !user) return;
    setLoading(true);
    setErrorMsg(null);

    try {
      if (activeTab === 'lead') {
        const { error } = await supabase.from('leads').insert({
          company_id: currentCompany.id,
          name: name.trim(),
          company_name: companyName.trim() || null,
          phone: phone.trim() || null,
          email: email.trim() || null,
          potential_amount: parseFloat(amount) || 0,
          status: 'Nouveau',
          notes: notes.trim() || null,
          created_by: user.id,
        });
        if (error) throw error;
        setSuccessMsg(`Prospect "${name}" créé avec succès !`);
      } else if (activeTab === 'customer') {
        const { error } = await supabase.from('customers').insert({
          company_id: currentCompany.id,
          name: name.trim(),
          company_name: companyName.trim() || null,
          phone: phone.trim() || null,
          email: email.trim() || null,
          notes: notes.trim() || null,
          created_by: user.id,
        });
        if (error) throw error;
        setSuccessMsg(`Client "${name}" créé avec succès !`);
      } else if (activeTab === 'task') {
        const { error } = await supabase.from('tasks').insert({
          company_id: currentCompany.id,
          title: taskTitle.trim(),
          description: notes.trim() || null,
          priority: taskPriority,
          due_date: taskDueDate || null,
          status: 'À faire',
          assigned_to: user.id,
          created_by: user.id,
        });
        if (error) throw error;
        setSuccessMsg(`Tâche "${taskTitle}" créée avec succès !`);
      }

      // Log activity
      await supabase.from('activities').insert({
        company_id: currentCompany.id,
        user_id: user.id,
        action: 'Création rapide',
        entity_type: activeTab,
        entity_title: activeTab === 'task' ? taskTitle : name,
        description: `Création rapide de ${activeTab === 'task' ? 'la tâche' : activeTab === 'lead' ? 'du prospect' : 'du client'} par ${user.email}`,
      });

      if (onSuccess) onSuccess();
      setTimeout(() => {
        resetForm();
        onClose();
      }, 1200);
    } catch (err: any) {
      setErrorMsg(err.message || 'Une erreur est survenue lors de la création.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-lg w-full p-6 shadow-2xl relative">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-1">
          Création rapide
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-6">
          Ajoutez un élément instantanément dans l&apos;espace {currentCompany?.name}.
        </p>

        {/* Tab Selection */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-2xl mb-6">
          <button
            type="button"
            onClick={() => { setActiveTab('lead'); setErrorMsg(null); setSuccessMsg(null); }}
            className={`flex-1 py-2 text-xs font-semibold rounded-xl flex items-center justify-center gap-2 transition-all ${
              activeTab === 'lead'
                ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <UserPlus className="w-4 h-4" />
            <span>Prospect</span>
          </button>

          <button
            type="button"
            onClick={() => { setActiveTab('customer'); setErrorMsg(null); setSuccessMsg(null); }}
            className={`flex-1 py-2 text-xs font-semibold rounded-xl flex items-center justify-center gap-2 transition-all ${
              activeTab === 'customer'
                ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Client</span>
          </button>

          <button
            type="button"
            onClick={() => { setActiveTab('task'); setErrorMsg(null); setSuccessMsg(null); }}
            className={`flex-1 py-2 text-xs font-semibold rounded-xl flex items-center justify-center gap-2 transition-all ${
              activeTab === 'task'
                ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <CheckSquare className="w-4 h-4" />
            <span>Tâche</span>
          </button>
        </div>

        {/* Notifications / Feedback */}
        {errorMsg && (
          <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}
        {successMsg && (
          <div className="mb-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        <div className="mb-4">
          <DuplicateWarning matches={duplicates} />
        </div>

        {/* Form Body */}
        <form onSubmit={handleCreate} className="space-y-4">
          {activeTab === 'task' ? (
            <>
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Intitulé de la tâche *
                </label>
                <input
                  type="text"
                  required
                  value={taskTitle}
                  onChange={(e) => setTaskTitle(e.target.value)}
                  placeholder="Ex : Relancer le client pour signature"
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Priorité
                  </label>
                  <select
                    value={taskPriority}
                    onChange={(e) => setTaskPriority(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  >
                    <option value="Faible">Faible</option>
                    <option value="Normale">Normale</option>
                    <option value="Haute">Haute</option>
                    <option value="Urgente">Urgente</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Date d&apos;échéance
                  </label>
                  <input
                    type="date"
                    value={taskDueDate}
                    onChange={(e) => setTaskDueDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Nom complet *
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    onBlur={handleCheckDuplicates}
                    placeholder="Nom du contact"
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Entreprise
                  </label>
                  <input
                    type="text"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    onBlur={handleCheckDuplicates}
                    placeholder="Société"
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Téléphone
                  </label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    onBlur={handleCheckDuplicates}
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onBlur={handleCheckDuplicates}
                    placeholder="contact@email.com"
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              {activeTab === 'lead' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Montant potentiel ({currentCompany?.currency || 'FCFA'})
                  </label>
                  <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="Ex : 500000"
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
              )}
            </>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Notes complémentaires
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Détails ou contexte..."
              className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none resize-none"
            />
          </div>

          <div className="pt-2 flex items-center justify-between gap-3 border-t border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  onClose();
                  router.push('/quotes');
                }}
                className="text-[11px] text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 font-medium flex items-center gap-1"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>Nouveau devis</span>
              </button>
              <span className="text-slate-300 dark:text-slate-700">•</span>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  router.push('/invoices');
                }}
                className="text-[11px] text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 font-medium flex items-center gap-1"
              >
                <Receipt className="w-3.5 h-3.5" />
                <span>Nouvelle facture</span>
              </button>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="py-2.5 px-5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs rounded-xl shadow-md shadow-indigo-600/20 transition-all flex items-center gap-2 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Enregistrement...</span>
                </>
              ) : (
                <>
                  <span>Créer</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
