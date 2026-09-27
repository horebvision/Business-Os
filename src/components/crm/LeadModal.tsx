'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { createClient } from '@/lib/supabase/client';
import { Lead, LeadSource, LeadStatus, DuplicateCheckMatch, UserProfile } from '@/lib/types';
import { checkDuplicates } from '@/lib/crm/duplicateCheck';
import DuplicateWarning from './DuplicateWarning';
import { X, UserPlus, Loader2, CheckCircle2, AlertCircle, Save } from 'lucide-react';

interface LeadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  leadToEdit?: Lead | null;
}

const SOURCES: LeadSource[] = [
  'WhatsApp',
  'Facebook',
  'Instagram',
  'Site web',
  'Téléphone',
  'Email',
  'Recommandation',
  'Salon / événement',
  'Autre',
];

const STATUSES: LeadStatus[] = [
  'Nouveau',
  'Contacté',
  'Qualifié',
  'Proposition envoyée',
  'Négociation',
  'Gagné',
  'Perdu',
];

export default function LeadModal({ isOpen, onClose, onSuccess, leadToEdit }: LeadModalProps) {
  const { currentCompany, user } = useAuth();
  const supabase = createClient();

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [duplicates, setDuplicates] = useState<DuplicateCheckMatch[]>([]);
  const [teamMembers, setTeamMembers] = useState<{ id: string; name: string }[]>([]);

  // Form states
  const [name, setName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [phone, setPhone] = useState('+225 ');
  const [email, setEmail] = useState('');
  const [source, setSource] = useState<LeadSource>('WhatsApp');
  const [status, setStatus] = useState<LeadStatus>('Nouveau');
  const [potentialAmount, setPotentialAmount] = useState<string>('0');
  const [assignedTo, setAssignedTo] = useState<string>('');
  const [nextAction, setNextAction] = useState('');
  const [notes, setNotes] = useState('');

  // Fetch team members for assignee dropdown
  useEffect(() => {
    if (!currentCompany?.id || !isOpen) return;

    const fetchTeam = async () => {
      const { data } = await supabase
        .from('memberships')
        .select('user_id, role, users:user_id(id, full_name, email)')
        .eq('company_id', currentCompany.id)
        .eq('is_active', true);

      if (data) {
        const members = data.map((m: any) => ({
          id: m.users?.id || m.user_id,
          name: m.users?.full_name || m.users?.email || 'Membre',
        }));
        setTeamMembers(members);
      }
    };

    fetchTeam();
  }, [currentCompany?.id, isOpen, supabase]);

  // Pre-fill fields if editing
  useEffect(() => {
    if (leadToEdit) {
      setName(leadToEdit.name || '');
      setCompanyName(leadToEdit.company_name || '');
      setPhone(leadToEdit.phone || '+225 ');
      setEmail(leadToEdit.email || '');
      setSource((leadToEdit.source as LeadSource) || 'Autre');
      setStatus(leadToEdit.status || 'Nouveau');
      setPotentialAmount(String(leadToEdit.potential_amount || 0));
      setAssignedTo(leadToEdit.assigned_to || '');
      setNextAction(leadToEdit.next_action || '');
      setNotes(leadToEdit.notes || '');
    } else {
      setName('');
      setCompanyName('');
      setPhone('+225 ');
      setEmail('');
      setSource('WhatsApp');
      setStatus('Nouveau');
      setPotentialAmount('0');
      setAssignedTo(user?.id || '');
      setNextAction('');
      setNotes('');
    }
    setDuplicates([]);
    setErrorMsg(null);
    setSuccessMsg(null);
  }, [leadToEdit, isOpen, user?.id]);

  if (!isOpen) return null;

  // Real-time duplicate check when user finishes entering contact info
  const handleCheckDuplicates = async () => {
    if (!currentCompany?.id) return;
    if (!email && (!phone || phone === '+225 ') && !name) return;

    const matches = await checkDuplicates(supabase, currentCompany.id, {
      email,
      phone: phone !== '+225 ' ? phone : undefined,
      name,
      companyName,
      currentId: leadToEdit?.id,
    });
    setDuplicates(matches);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentCompany?.id || !user) return;
    setLoading(true);
    setErrorMsg(null);

    try {
      const leadPayload = {
        company_id: currentCompany.id,
        name: name.trim(),
        company_name: companyName.trim() || null,
        phone: phone.trim() !== '+225 ' ? phone.trim() : null,
        email: email.trim() || null,
        source,
        status,
        potential_amount: parseFloat(potentialAmount) || 0,
        assigned_to: assignedTo || null,
        next_action: nextAction.trim() || null,
        notes: notes.trim() || null,
        updated_at: new Date().toISOString(),
      };

      if (leadToEdit) {
        // UPDATE
        const { error } = await supabase
          .from('leads')
          .update(leadPayload)
          .eq('id', leadToEdit.id)
          .eq('company_id', currentCompany.id);

        if (error) throw error;

        // Log activity
        await supabase.from('activities').insert({
          company_id: currentCompany.id,
          user_id: user.id,
          action: 'Modification prospect',
          entity_type: 'lead',
          entity_id: leadToEdit.id,
          entity_title: name,
          description: `Prospect "${name}" mis à jour par ${user.email}`,
        });

        setSuccessMsg(`Prospect "${name}" mis à jour avec succès !`);
      } else {
        // INSERT
        const { data: newLead, error } = await supabase
          .from('leads')
          .insert({
            ...leadPayload,
            created_by: user.id,
          })
          .select('id')
          .single();

        if (error) throw error;

        // Log activity
        await supabase.from('activities').insert({
          company_id: currentCompany.id,
          user_id: user.id,
          action: 'Création prospect',
          entity_type: 'lead',
          entity_id: newLead.id,
          entity_title: name,
          description: `Nouveau prospect "${name}" (${source}) ajouté par ${user.email}`,
        });

        setSuccessMsg(`Prospect "${name}" créé avec succès !`);
      }

      onSuccess();
      setTimeout(() => {
        onClose();
      }, 1000);
    } catch (err: any) {
      setErrorMsg(err.message || "Erreur lors de l'enregistrement du prospect.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl relative max-h-[90vh] overflow-y-auto">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold">
            <UserPlus className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              {leadToEdit ? 'Modifier le prospect' : 'Nouveau prospect'}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {leadToEdit ? `Mise à jour des informations de ${leadToEdit.name}` : "Enregistrez une nouvelle opportunité d'affaires"}
            </p>
          </div>
        </div>

        {/* Notifications & Warning */}
        {errorMsg && (
          <div className="mt-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}
        {successMsg && (
          <div className="mt-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        <div className="mt-4">
          <DuplicateWarning matches={duplicates} />
        </div>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          {/* Identity */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                placeholder="Ex : Koffi Kouassi"
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Entreprise / Société
              </label>
              <input
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                onBlur={handleCheckDuplicates}
                placeholder="Ex : SOTRA Distribution"
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Contact Details */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Numéro de téléphone / WhatsApp
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                onBlur={handleCheckDuplicates}
                placeholder="+225 0700000000"
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Adresse email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onBlur={handleCheckDuplicates}
                placeholder="contact@entreprise.ci"
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Qualification & Pipeline */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Source d&apos;acquisition
              </label>
              <select
                value={source}
                onChange={(e) => setSource(e.target.value as LeadSource)}
                className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              >
                {SOURCES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Statut dans le cycle
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as LeadStatus)}
                className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              >
                {STATUSES.map((st) => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Valeur potentielle ({currentCompany?.currency || 'FCFA'})
              </label>
              <input
                type="number"
                min="0"
                step="1000"
                value={potentialAmount}
                onChange={(e) => setPotentialAmount(e.target.value)}
                placeholder="500000"
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white text-xs font-semibold focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Assignment & Next Action */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Responsable du dossier
              </label>
              <select
                value={assignedTo}
                onChange={(e) => setAssignedTo(e.target.value)}
                className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              >
                <option value="">Non assigné</option>
                {teamMembers.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Prochaine action à mener
              </label>
              <input
                type="text"
                value={nextAction}
                onChange={(e) => setNextAction(e.target.value)}
                placeholder="Ex : Envoyer proposition commerciale vendredi"
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Notes & Contexte commercial
            </label>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Besoins du prospect, budget envisagé, historique de discussion..."
              className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none resize-none"
            />
          </div>

          {/* Footer Actions */}
          <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs rounded-xl shadow-md shadow-indigo-600/20 transition-all flex items-center gap-2 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Enregistrement...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>{leadToEdit ? 'Enregistrer les modifications' : 'Créer le prospect'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
