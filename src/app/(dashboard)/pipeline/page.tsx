'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/context/AuthContext';
import { createClient } from '@/lib/supabase/client';
import { Lead, LeadStatus, LeadSource } from '@/lib/types';
import { 
  Kanban, 
  Plus, 
  Loader2, 
  Search, 
  Filter, 
  DollarSign, 
  TrendingUp, 
  CheckCircle2, 
  Phone, 
  Mail, 
  Calendar, 
  ExternalLink,
  UserCheck,
  Building,
  User
} from 'lucide-react';
import Link from 'next/link';
import LeadModal from '@/components/crm/LeadModal';
import ConvertLeadModal from '@/components/crm/ConvertLeadModal';

const COLUMNS: { id: LeadStatus; label: string; probability: number; color: string; ringColor: string }[] = [
  { id: 'Nouveau', label: 'Nouveau', probability: 0.1, color: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20', ringColor: 'ring-blue-500/30' },
  { id: 'Contacté', label: 'Contacté', probability: 0.2, color: 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20', ringColor: 'ring-sky-500/30' },
  { id: 'Qualifié', label: 'Qualifié', probability: 0.4, color: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20', ringColor: 'ring-purple-500/30' },
  { id: 'Proposition envoyée', label: 'Proposition envoyée', probability: 0.6, color: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20', ringColor: 'ring-amber-500/30' },
  { id: 'Négociation', label: 'Négociation', probability: 0.8, color: 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20', ringColor: 'ring-orange-500/30' },
  { id: 'Gagné', label: 'Gagné', probability: 1.0, color: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20', ringColor: 'ring-emerald-500/30' },
  { id: 'Perdu', label: 'Perdu', probability: 0.0, color: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20', ringColor: 'ring-rose-500/30' },
];

export default function PipelinePage() {
  const { currentCompany, user } = useAuth();
  const supabase = createClient();

  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [assigneeFilter, setAssigneeFilter] = useState('all');

  // Drag and drop states
  const [draggedLeadId, setDraggedLeadId] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<LeadStatus | null>(null);

  // Modals
  const [leadModalOpen, setLeadModalOpen] = useState(false);
  const [leadToEdit, setLeadToEdit] = useState<Lead | null>(null);
  const [convertModalOpen, setConvertModalOpen] = useState(false);
  const [leadToConvert, setLeadToConvert] = useState<Lead | null>(null);

  const fetchLeads = async () => {
    if (!currentCompany?.id) return;
    setLoading(true);
    const { data } = await supabase
      .from('leads')
      .select('*, assignee:assigned_to(id, full_name, email)')
      .eq('company_id', currentCompany.id)
      .order('created_at', { ascending: false });

    if (data) setLeads(data as Lead[]);
    setLoading(false);
  };

  useEffect(() => {
    fetchLeads();
  }, [currentCompany?.id]);

  // Compute metrics
  const stats = useMemo(() => {
    const total = leads.length;
    const totalPipelineAmount = leads.reduce((acc, l) => acc + (Number(l.potential_amount) || 0), 0);
    const wonCount = leads.filter((l) => l.status === 'Gagné').length;
    const activeCount = leads.filter((l) => !['Gagné', 'Perdu'].includes(l.status)).length;
    const conversionRate = total > 0 ? Math.round((wonCount / total) * 100) : 0;

    // Weighted value
    const weightedAmount = leads.reduce((acc, l) => {
      const col = COLUMNS.find((c) => c.id === l.status);
      const prob = col ? col.probability : 0;
      return acc + (Number(l.potential_amount) || 0) * prob;
    }, 0);

    return { total, totalPipelineAmount, weightedAmount, wonCount, activeCount, conversionRate };
  }, [leads]);

  // Drag & drop handlers
  const handleDragStart = (e: React.DragEvent, id: string) => {
    e.dataTransfer.setData('text/plain', id);
    setDraggedLeadId(id);
  };

  const handleDragOver = (e: React.DragEvent, columnId: LeadStatus) => {
    e.preventDefault();
    if (dragOverColumn !== columnId) {
      setDragOverColumn(columnId);
    }
  };

  const handleDragLeave = () => {
    setDragOverColumn(null);
  };

  const handleDrop = async (e: React.DragEvent, targetStatus: LeadStatus) => {
    e.preventDefault();
    setDragOverColumn(null);

    const leadId = e.dataTransfer.getData('text/plain') || draggedLeadId;
    if (!leadId) return;

    const lead = leads.find((l) => l.id === leadId);
    if (!lead || lead.status === targetStatus) return;

    const previousStatus = lead.status;

    // Optimistic UI update
    setLeads((prev) =>
      prev.map((l) => (l.id === leadId ? { ...l, status: targetStatus } : l))
    );

    try {
      const nowIso = new Date().toISOString();
      await supabase
        .from('leads')
        .update({
          status: targetStatus,
          updated_at: nowIso,
          last_interaction_at: nowIso,
        })
        .eq('id', leadId)
        .eq('company_id', currentCompany?.id);

      // Log status change activity
      await supabase.from('activities').insert({
        company_id: currentCompany?.id,
        user_id: user?.id,
        action: 'Changement de statut',
        entity_type: 'lead',
        entity_id: leadId,
        entity_title: lead.name,
        description: `Prospect déplacé de "${previousStatus}" à "${targetStatus}" dans le pipeline commercial`,
      });

      // If moved to 'Gagné', prompt conversion modal!
      if (targetStatus === 'Gagné') {
        setLeadToConvert(lead);
        setConvertModalOpen(true);
      }
    } catch (err) {
      console.error(err);
      fetchLeads(); // Rollback if error
    } finally {
      setDraggedLeadId(null);
    }
  };

  // Filtered leads
  const filteredLeads = useMemo(() => {
    return leads.filter((l) => {
      const matchSearch =
        l.name.toLowerCase().includes(search.toLowerCase()) ||
        (l.company_name && l.company_name.toLowerCase().includes(search.toLowerCase())) ||
        (l.phone && l.phone.toLowerCase().includes(search.toLowerCase())) ||
        (l.email && l.email.toLowerCase().includes(search.toLowerCase()));

      const matchAssignee =
        assigneeFilter === 'all' ||
        (assigneeFilter === 'unassigned' ? !l.assigned_to : l.assigned_to === assigneeFilter);

      return matchSearch && matchAssignee;
    });
  }, [leads, search, assigneeFilter]);

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Pipeline Commercial
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Glissez-déposez vos opportunités commerciales pour faire avancer vos négociations.
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-start sm:self-auto">
          <Link
            href="/leads"
            className="px-3.5 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-xl transition-all shadow-sm"
          >
            Vue tableau
          </Link>

          <button
            onClick={() => {
              setLeadToEdit(null);
              setLeadModalOpen(true);
            }}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl shadow-md shadow-indigo-600/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            <Plus className="w-4 h-4" />
            <span>Nouveau prospect</span>
          </button>
        </div>
      </div>

      {/* Pipeline Metrics Banner */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider block">
            Opportunités en cours
          </span>
          <span className="text-xl font-black text-slate-900 dark:text-white mt-1 block">
            {stats.activeCount} <span className="text-xs font-normal text-slate-400">/ {stats.total}</span>
          </span>
        </div>

        <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider block">
            Valeur du pipeline
          </span>
          <span className="text-xl font-black text-indigo-600 dark:text-indigo-400 mt-1 block truncate">
            {stats.totalPipelineAmount.toLocaleString('fr-FR')} {currentCompany?.currency || 'FCFA'}
          </span>
        </div>

        <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider block">
            Valeur pondérée
          </span>
          <span className="text-xl font-black text-slate-900 dark:text-white mt-1 block truncate">
            {Math.round(stats.weightedAmount).toLocaleString('fr-FR')} {currentCompany?.currency || 'FCFA'}
          </span>
        </div>

        <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider block">
            Gagnés
          </span>
          <span className="text-xl font-black text-emerald-600 dark:text-emerald-400 mt-1 block">
            {stats.wonCount}
          </span>
        </div>

        <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm col-span-2 lg:col-span-1">
          <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider block">
            Taux de conversion
          </span>
          <span className="text-xl font-black text-slate-900 dark:text-white mt-1 block">
            {stats.conversionRate}%
          </span>
        </div>
      </div>

      {/* Filter / Search Bar */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filtrer les cartes par nom, entreprise, téléphone..."
            className="w-full pl-10 pr-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
      </div>

      {/* Kanban Board Container */}
      {loading ? (
        <div className="p-16 text-center text-slate-400">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-indigo-500 mb-2" />
          <span className="text-xs">Chargement du pipeline commercial...</span>
        </div>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-6 pt-1 select-none">
          {COLUMNS.map((col) => {
            const colLeads = filteredLeads.filter((l) => l.status === col.id);
            const colTotal = colLeads.reduce((acc, l) => acc + (Number(l.potential_amount) || 0), 0);
            const isTarget = dragOverColumn === col.id;

            return (
              <div
                key={col.id}
                onDragOver={(e) => handleDragOver(e, col.id)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, col.id)}
                className={`w-72 flex-shrink-0 bg-slate-100/70 dark:bg-slate-900/60 border rounded-3xl p-3.5 flex flex-col transition-all duration-200 ${
                  isTarget
                    ? `border-indigo-500 bg-indigo-50/20 dark:bg-indigo-950/20 ring-2 ${col.ringColor}`
                    : 'border-slate-200 dark:border-slate-800'
                }`}
              >
                {/* Column Header */}
                <div className="flex items-center justify-between mb-3 px-1">
                  <div>
                    <h3 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                      <span>{col.label}</span>
                    </h3>
                    <span className="text-[10px] text-slate-400 font-medium block mt-0.5">
                      {colTotal.toLocaleString('fr-FR')} {currentCompany?.currency || 'FCFA'}
                    </span>
                  </div>
                  <span className="w-5 h-5 rounded-full bg-slate-200 dark:bg-slate-800 text-[10px] font-extrabold flex items-center justify-center text-slate-700 dark:text-slate-300">
                    {colLeads.length}
                  </span>
                </div>

                {/* Cards List */}
                <div className="space-y-2.5 flex-1 overflow-y-auto max-h-[calc(100vh-320px)] min-h-[160px] pr-1">
                  {colLeads.length === 0 ? (
                    <div className="h-full min-h-[120px] flex items-center justify-center border-2 border-dashed border-slate-200 dark:border-slate-800/80 rounded-2xl text-[11px] text-slate-400">
                      Glisser une opportunité ici
                    </div>
                  ) : (
                    colLeads.map((lead) => (
                      <div
                        key={lead.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, lead.id)}
                        className={`p-3.5 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/60 shadow-sm hover:shadow-md transition-all cursor-grab active:cursor-grabbing group ${
                          draggedLeadId === lead.id ? 'opacity-40 scale-95' : 'hover:-translate-y-0.5'
                        }`}
                      >
                        {/* Lead Header */}
                        <div className="flex items-start justify-between gap-2">
                          <Link
                            href={`/leads/${lead.id}`}
                            className="text-xs font-extrabold text-slate-900 dark:text-white hover:text-indigo-600 dark:hover:text-indigo-400 truncate block"
                          >
                            {lead.name}
                          </Link>

                          <Link
                            href={`/leads/${lead.id}`}
                            className="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-slate-400 hover:text-indigo-600"
                            title="Consulter"
                          >
                            <ExternalLink className="w-3 h-3" />
                          </Link>
                        </div>

                        {lead.company_name && (
                          <p className="text-[11px] text-slate-500 truncate mt-0.5 flex items-center gap-1">
                            <Building className="w-3 h-3 text-slate-400" />
                            <span>{lead.company_name}</span>
                          </p>
                        )}

                        {/* Amount & Source */}
                        <div className="mt-3 flex items-center justify-between text-xs pt-2 border-t border-slate-100 dark:border-slate-700/60">
                          <span className="font-black text-indigo-600 dark:text-indigo-400">
                            {Number(lead.potential_amount || 0).toLocaleString('fr-FR')}{' '}
                            <span className="text-[10px] font-bold text-slate-400">
                              {currentCompany?.currency || 'FCFA'}
                            </span>
                          </span>

                          <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                            {lead.source}
                          </span>
                        </div>

                        {/* Prochaine action if any */}
                        {lead.next_action && (
                          <div className="mt-2 text-[10px] text-amber-600 dark:text-amber-400 font-semibold flex items-center gap-1 truncate bg-amber-500/10 px-2 py-1 rounded-lg">
                            <Calendar className="w-3 h-3 flex-shrink-0" />
                            <span className="truncate">{lead.next_action}</span>
                          </div>
                        )}

                        {/* Convert button if in Gagné */}
                        {col.id === 'Gagné' && (
                          <button
                            onClick={() => {
                              setLeadToConvert(lead);
                              setConvertModalOpen(true);
                            }}
                            className="mt-2.5 w-full py-1.5 px-2 bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-600 dark:text-emerald-400 rounded-xl text-[11px] font-bold flex items-center justify-center gap-1.5 transition-colors"
                          >
                            <UserCheck className="w-3.5 h-3.5" />
                            <span>Convertir en client</span>
                          </button>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modals */}
      <LeadModal
        isOpen={leadModalOpen}
        onClose={() => setLeadModalOpen(false)}
        onSuccess={fetchLeads}
        leadToEdit={leadToEdit}
      />

      {leadToConvert && (
        <ConvertLeadModal
          isOpen={convertModalOpen}
          onClose={() => {
            setConvertModalOpen(false);
            setLeadToConvert(null);
          }}
          lead={leadToConvert}
          onSuccess={fetchLeads}
        />
      )}
    </div>
  );
}
