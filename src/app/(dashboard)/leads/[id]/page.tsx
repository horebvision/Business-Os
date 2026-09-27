'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { createClient } from '@/lib/supabase/client';
import { Lead, Activity, LeadStatus, LeadSource } from '@/lib/types';
import { 
  ArrowLeft, 
  Phone, 
  Mail, 
  MessageSquare, 
  Calendar, 
  UserCheck, 
  Edit3, 
  Trash2, 
  Plus, 
  Loader2, 
  Building, 
  Clock, 
  CheckCircle2, 
  AlertCircle,
  FileText,
  User,
  ExternalLink,
  Send,
  MoreVertical,
  DollarSign
} from 'lucide-react';
import Link from 'next/link';
import LeadModal from '@/components/crm/LeadModal';
import ActivityModal from '@/components/crm/ActivityModal';
import ConvertLeadModal from '@/components/crm/ConvertLeadModal';

const STATUS_OPTIONS: LeadStatus[] = [
  'Nouveau',
  'Contacté',
  'Qualifié',
  'Proposition envoyée',
  'Négociation',
  'Gagné',
  'Perdu',
];

const STATUS_COLORS: Record<LeadStatus, string> = {
  'Nouveau': 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
  'Contacté': 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20',
  'Qualifié': 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20',
  'Proposition envoyée': 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
  'Négociation': 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20',
  'Gagné': 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
  'Perdu': 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20',
};

export default function LeadDetailPage() {
  const params = useParams();
  const router = useRouter();
  const leadId = params?.id as string;

  const { currentCompany, user } = useAuth();
  const supabase = createClient();

  const [lead, setLead] = useState<Lead | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [quickNote, setQuickNote] = useState('');
  const [quickNoteLoading, setQuickNoteLoading] = useState(false);

  // Modals
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [activityModalOpen, setActivityModalOpen] = useState(false);
  const [convertModalOpen, setConvertModalOpen] = useState(false);

  const fetchLeadData = async () => {
    if (!currentCompany?.id || !leadId) return;
    setLoading(true);

    try {
      // 1. Fetch Lead
      const { data: leadData, error: leadError } = await supabase
        .from('leads')
        .select('*, assignee:assigned_to(id, full_name, email)')
        .eq('id', leadId)
        .eq('company_id', currentCompany.id)
        .single();

      if (leadError || !leadData) {
        router.push('/leads');
        return;
      }
      setLead(leadData as Lead);

      // 2. Fetch Activities linked to this lead
      const { data: actData } = await supabase
        .from('activities')
        .select('*, user:user_id(id, full_name, email)')
        .eq('company_id', currentCompany.id)
        .eq('entity_id', leadId)
        .order('created_at', { ascending: false });

      if (actData) setActivities(actData as Activity[]);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeadData();
  }, [currentCompany?.id, leadId]);

  const handleStatusChange = async (newStatus: LeadStatus) => {
    if (!lead || !currentCompany?.id || !user) return;
    const oldStatus = lead.status;
    if (oldStatus === newStatus) return;

    setLead({ ...lead, status: newStatus });

    await supabase
      .from('leads')
      .update({
        status: newStatus,
        updated_at: new Date().toISOString(),
        last_interaction_at: new Date().toISOString(),
      })
      .eq('id', lead.id);

    // Log status change activity
    await supabase.from('activities').insert({
      company_id: currentCompany.id,
      user_id: user.id,
      action: 'Changement de statut',
      entity_type: 'lead',
      entity_id: lead.id,
      entity_title: lead.name,
      description: `Statut modifié de "${oldStatus}" à "${newStatus}" par ${user.email}`,
    });

    fetchLeadData();
  };

  const handleAddQuickNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickNote.trim() || !currentCompany?.id || !user || !lead) return;
    setQuickNoteLoading(true);

    try {
      const nowIso = new Date().toISOString();
      await supabase.from('activities').insert({
        company_id: currentCompany.id,
        user_id: user.id,
        action: 'Note',
        entity_type: 'lead',
        entity_id: lead.id,
        entity_title: lead.name,
        description: quickNote.trim(),
        created_at: nowIso,
      });

      await supabase
        .from('leads')
        .update({
          last_interaction_at: nowIso,
          updated_at: nowIso,
        })
        .eq('id', lead.id);

      setQuickNote('');
      fetchLeadData();
    } catch (err) {
      console.error(err);
    } finally {
      setQuickNoteLoading(false);
    }
  };

  const handleDeleteLead = async () => {
    if (!lead || !currentCompany?.id) return;
    if (!confirm(`Supprimer définitivement le prospect "${lead.name}" ?`)) return;

    await supabase.from('leads').delete().eq('id', lead.id).eq('company_id', currentCompany.id);
    router.push('/leads');
  };

  if (loading) {
    return (
      <div className="p-20 text-center text-slate-400">
        <Loader2 className="w-8 h-8 animate-spin mx-auto text-indigo-500 mb-2" />
        <span className="text-xs">Chargement de la fiche prospect...</span>
      </div>
    );
  }

  if (!lead) return null;

  const cleanPhoneForWa = lead.phone ? lead.phone.replace(/[^0-9]/g, '') : null;

  return (
    <div className="space-y-6">
      {/* Top Breadcrumb & Actions Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/leads"
            className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400 font-medium">Prospects</span>
              <span className="text-xs text-slate-300 dark:text-slate-700">/</span>
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                {lead.name}
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight mt-0.5">
              {lead.name}
            </h1>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Status selector */}
          <select
            value={lead.status}
            onChange={(e) => handleStatusChange(e.target.value as LeadStatus)}
            className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all ${
              STATUS_COLORS[lead.status]
            }`}
          >
            {STATUS_OPTIONS.map((st) => (
              <option key={st} value={st}>
                {st}
              </option>
            ))}
          </select>

          {/* Add Activity Button */}
          <button
            onClick={() => setActivityModalOpen(true)}
            className="inline-flex items-center gap-2 px-3.5 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-xl shadow-sm transition-all"
          >
            <Plus className="w-4 h-4 text-indigo-500" />
            <span>Activité</span>
          </button>

          {/* Convert to Customer Button */}
          {lead.status !== 'Gagné' && (
            <button
              onClick={() => setConvertModalOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-xl shadow-md shadow-emerald-600/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              <UserCheck className="w-4 h-4" />
              <span>Convertir en client</span>
            </button>
          )}

          {/* Edit */}
          <button
            onClick={() => setEditModalOpen(true)}
            className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
            title="Modifier"
          >
            <Edit3 className="w-4 h-4" />
          </button>

          {/* Delete */}
          <button
            onClick={handleDeleteLead}
            className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-400 hover:text-rose-500 transition-colors"
            title="Supprimer"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Grid: Info Cards (Left) & Activity Timeline (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Details & Information */}
        <div className="space-y-6">
          {/* Card: Opportunity Overview */}
          <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <h3 className="text-xs font-bold uppercase text-slate-400 tracking-wider">
              Valeur de l&apos;opportunité
            </h3>

            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black text-indigo-600 dark:text-indigo-400">
                {Number(lead.potential_amount || 0).toLocaleString('fr-FR')}
              </span>
              <span className="text-sm font-bold text-slate-400">
                {currentCompany?.currency || 'FCFA'}
              </span>
            </div>

            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Source d&apos;acquisition</span>
                <span className="font-semibold text-slate-900 dark:text-white px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800">
                  {lead.source}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-400">Responsable</span>
                <span className="font-semibold text-slate-900 dark:text-white">
                  {lead.assignee?.full_name || lead.assignee?.email || 'Non assigné'}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-400">Créé le</span>
                <span className="text-slate-600 dark:text-slate-300">
                  {new Date(lead.created_at).toLocaleDateString('fr-FR')}
                </span>
              </div>
            </div>
          </div>

          {/* Card: Contact Details */}
          <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <h3 className="text-xs font-bold uppercase text-slate-400 tracking-wider">
              Coordonnées
            </h3>

            <div className="space-y-3 text-xs">
              {lead.company_name && (
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500">
                    <Building className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">
                      Entreprise
                    </span>
                    <span className="font-bold text-slate-900 dark:text-white">
                      {lead.company_name}
                    </span>
                  </div>
                </div>
              )}

              {lead.phone && (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500">
                      <Phone className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-bold block">
                        Téléphone
                      </span>
                      <a
                        href={`tel:${lead.phone}`}
                        className="font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
                      >
                        {lead.phone}
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

              {lead.email && (
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500">
                    <Mail className="w-4 h-4" />
                  </div>
                  <div className="truncate">
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">
                      Email
                    </span>
                    <a
                      href={`mailto:${lead.email}`}
                      className="font-bold text-indigo-600 dark:text-indigo-400 hover:underline truncate block"
                    >
                      {lead.email}
                    </a>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Card: Prochaine Action & Notes */}
          <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <h3 className="text-xs font-bold uppercase text-slate-400 tracking-wider">
              Prochaine action prévue
            </h3>

            {lead.next_action ? (
              <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-200 text-xs flex items-start gap-2.5">
                <Calendar className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                <span className="font-semibold">{lead.next_action}</span>
              </div>
            ) : (
              <p className="text-xs text-slate-400 italic">Aucune action programmée.</p>
            )}

            <div className="pt-3 border-t border-slate-100 dark:border-slate-800">
              <span className="text-xs font-bold uppercase text-slate-400 tracking-wider block mb-2">
                Notes & Remarques
              </span>
              <p className="text-xs text-slate-600 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">
                {lead.notes || 'Aucune note pour ce prospect.'}
              </p>
            </div>
          </div>
        </div>

        {/* Right Column: 360° Activity Timeline */}
        <div className="lg:col-span-2 space-y-6">
          {/* Quick Note / Activity Input Box */}
          <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
            <h3 className="text-xs font-bold uppercase text-slate-400 tracking-wider mb-3">
              Ajouter une note ou un mémo rapide
            </h3>
            <form onSubmit={handleAddQuickNote} className="space-y-3">
              <textarea
                rows={2}
                value={quickNote}
                onChange={(e) => setQuickNote(e.target.value)}
                placeholder="Ex : Le prospect a demandé à être rappelé jeudi après-midi..."
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 rounded-2xl text-slate-900 dark:text-white text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none resize-none"
              />
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-slate-400">
                  Visible par tous les membres de l&apos;équipe
                </span>
                <button
                  type="submit"
                  disabled={quickNoteLoading || !quickNote.trim()}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs rounded-xl shadow-sm transition-all flex items-center gap-1.5 disabled:opacity-50"
                >
                  {quickNoteLoading ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Send className="w-3.5 h-3.5" />
                  )}
                  <span>Enregistrer la note</span>
                </button>
              </div>
            </form>
          </div>

          {/* Activity Timeline */}
          <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
                  Historique des activités ({activities.length})
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Timeline chronologique des appels, réunions, notes et changements de statut.
                </p>
              </div>

              <button
                onClick={() => setActivityModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 text-xs font-semibold rounded-xl hover:bg-indigo-100 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Consigner</span>
              </button>
            </div>

            {activities.length === 0 ? (
              <div className="py-12 text-center text-slate-400">
                <Clock className="w-8 h-8 mx-auto mb-2 opacity-60" />
                <p className="text-xs font-semibold">Aucune activité enregistrée</p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Enregistrez un appel téléphonique ou ajoutez une note pour démarrer le suivi.
                </p>
              </div>
            ) : (
              <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200 dark:before:bg-slate-800">
                {activities.map((act) => (
                  <div key={act.id} className="relative group">
                    {/* Dot on timeline */}
                    <div className="absolute -left-6 top-1.5 w-5 h-5 rounded-full bg-white dark:bg-slate-900 border-2 border-indigo-500 flex items-center justify-center">
                      <div className="w-2 h-2 rounded-full bg-indigo-500" />
                    </div>

                    <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800 hover:shadow-sm transition-all">
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-xs text-slate-900 dark:text-white">
                            {act.action}
                          </span>
                          <span className="text-[10px] text-slate-400 font-medium">
                            par {act.user?.full_name || act.user?.email || 'Utilisateur'}
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-400 font-medium">
                          {new Date(act.created_at).toLocaleString('fr-FR', {
                            dateStyle: 'short',
                            timeStyle: 'short',
                          })}
                        </span>
                      </div>

                      <p className="text-xs text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">
                        {act.description}
                      </p>

                      {act.metadata?.next_follow_up && (
                        <div className="mt-2 text-[11px] text-amber-600 dark:text-amber-400 font-semibold flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          <span>Relance prévue : {act.metadata.next_follow_up}</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modals */}
      <LeadModal
        isOpen={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        onSuccess={fetchLeadData}
        leadToEdit={lead}
      />

      <ActivityModal
        isOpen={activityModalOpen}
        onClose={() => setActivityModalOpen(false)}
        onSuccess={fetchLeadData}
        entityType="lead"
        entityId={lead.id}
        entityTitle={lead.name}
      />

      <ConvertLeadModal
        isOpen={convertModalOpen}
        onClose={() => setConvertModalOpen(false)}
        lead={lead}
        onSuccess={fetchLeadData}
      />
    </div>
  );
}
