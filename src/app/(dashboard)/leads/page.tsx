'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/context/AuthContext';
import { createClient } from '@/lib/supabase/client';
import { Lead, LeadSource, LeadStatus } from '@/lib/types';
import { 
  UserPlus, 
  Plus, 
  Search, 
  Filter, 
  Loader2, 
  Kanban, 
  Phone, 
  Mail, 
  TrendingUp, 
  DollarSign, 
  CheckCircle2, 
  ArrowUpDown, 
  Eye, 
  Edit3, 
  UserCheck, 
  Trash2,
  Calendar,
  Sparkles,
  Download,
  Upload
} from 'lucide-react';
import Link from 'next/link';
import LeadModal from '@/components/crm/LeadModal';
import ConvertLeadModal from '@/components/crm/ConvertLeadModal';
import CsvImportModal from '@/components/crm/CsvImportModal';

const STATUS_COLORS: Record<LeadStatus, string> = {
  'Nouveau': 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
  'Contacté': 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20',
  'Qualifié': 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20',
  'Proposition envoyée': 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
  'Négociation': 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20',
  'Gagné': 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
  'Perdu': 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20',
};

const SOURCE_COLORS: Record<string, string> = {
  'WhatsApp': 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  'Facebook': 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  'Instagram': 'bg-pink-500/10 text-pink-600 dark:text-pink-400',
  'Site web': 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400',
  'Téléphone': 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400',
  'Email': 'bg-violet-500/10 text-violet-600 dark:text-violet-400',
  'Recommandation': 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  'Salon / événement': 'bg-teal-500/10 text-teal-600 dark:text-teal-400',
  'Autre': 'bg-slate-500/10 text-slate-600 dark:text-slate-400',
};

export default function LeadsPage() {
  const { currentCompany } = useAuth();
  const supabase = createClient();

  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'recent' | 'amount_desc' | 'amount_asc' | 'name'>('recent');

  // Modals state
  const [leadModalOpen, setLeadModalOpen] = useState(false);
  const [leadToEdit, setLeadToEdit] = useState<Lead | null>(null);
  const [convertModalOpen, setConvertModalOpen] = useState(false);
  const [leadToConvert, setLeadToConvert] = useState<Lead | null>(null);
  const [importModalOpen, setImportModalOpen] = useState(false);

  const exportLeadsCsv = () => {
    if (leads.length === 0) return;
    const headers = ['Nom', 'Raison Sociale', 'Email', 'Téléphone', 'Statut', 'Source', 'Montant Potentiel'];
    const rows = filteredLeads.map((l) => [
      `"${(l.name || '').replace(/"/g, '""')}"`,
      `"${(l.company_name || '').replace(/"/g, '""')}"`,
      `"${(l.email || '').replace(/"/g, '""')}"`,
      `"${(l.phone || '').replace(/"/g, '""')}"`,
      `"${l.status}"`,
      `"${l.source || ''}"`,
      l.potential_amount || 0,
    ]);
    const csvContent = '\uFEFF' + [headers.join(';'), ...rows.map((r) => r.join(';'))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `prospects-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

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

  const handleDeleteLead = async (leadId: string, leadName: string) => {
    if (!confirm(`Êtes-vous sûr de vouloir supprimer définitivement le prospect "${leadName}" ?`)) {
      return;
    }

    const { error } = await supabase
      .from('leads')
      .delete()
      .eq('id', leadId)
      .eq('company_id', currentCompany?.id);

    if (!error) {
      setLeads((prev) => prev.filter((l) => l.id !== leadId));
    }
  };

  // Filtered & Sorted leads
  const filteredLeads = useMemo(() => {
    return leads
      .filter((lead) => {
        const matchesSearch =
          lead.name.toLowerCase().includes(search.toLowerCase()) ||
          (lead.company_name && lead.company_name.toLowerCase().includes(search.toLowerCase())) ||
          (lead.email && lead.email.toLowerCase().includes(search.toLowerCase())) ||
          (lead.phone && lead.phone.toLowerCase().includes(search.toLowerCase()));

        const matchesStatus = statusFilter === 'all' || lead.status === statusFilter;
        const matchesSource = sourceFilter === 'all' || lead.source === sourceFilter;

        return matchesSearch && matchesStatus && matchesSource;
      })
      .sort((a, b) => {
        if (sortBy === 'amount_desc') return (b.potential_amount || 0) - (a.potential_amount || 0);
        if (sortBy === 'amount_asc') return (a.potential_amount || 0) - (b.potential_amount || 0);
        if (sortBy === 'name') return a.name.localeCompare(b.name);
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
  }, [leads, search, statusFilter, sourceFilter, sortBy]);

  // Statistics
  const stats = useMemo(() => {
    const total = leads.length;
    const totalAmount = leads.reduce((acc, l) => acc + (Number(l.potential_amount) || 0), 0);
    const wonCount = leads.filter((l) => l.status === 'Gagné').length;
    const activeCount = leads.filter((l) => !['Gagné', 'Perdu'].includes(l.status)).length;
    const conversionRate = total > 0 ? Math.round((wonCount / total) * 100) : 0;

    return { total, totalAmount, wonCount, activeCount, conversionRate };
  }, [leads]);

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Prospects & Opportunités
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Gérez vos cycles de vente, qualifiez vos contacts et convertissez-les en clients fidèles.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
          <button
            onClick={exportLeadsCsv}
            disabled={leads.length === 0}
            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shadow-sm disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Exporter</span>
          </button>

          <button
            onClick={() => setImportModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shadow-sm"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Importer CSV</span>
          </button>

          <Link
            href="/pipeline"
            className="inline-flex items-center gap-2 px-3.5 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-xl transition-all shadow-sm"
          >
            <Kanban className="w-4 h-4 text-indigo-500" />
            <span>Vue Pipeline</span>
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

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <span className="text-[11px] font-bold uppercase text-slate-400 tracking-wider">
            Total prospects
          </span>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-2xl font-black text-slate-900 dark:text-white">
              {stats.total}
            </span>
            <span className="text-xs text-indigo-500 font-semibold">
              {stats.activeCount} actifs
            </span>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <span className="text-[11px] font-bold uppercase text-slate-400 tracking-wider">
            Valeur du pipeline
          </span>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-xl sm:text-2xl font-black text-indigo-600 dark:text-indigo-400">
              {stats.totalAmount.toLocaleString('fr-FR')} {currentCompany?.currency || 'FCFA'}
            </span>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <span className="text-[11px] font-bold uppercase text-slate-400 tracking-wider">
            Prospects gagnés
          </span>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
              {stats.wonCount}
            </span>
            <span className="text-xs text-emerald-500 font-semibold flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Convertis</span>
            </span>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <span className="text-[11px] font-bold uppercase text-slate-400 tracking-wider">
            Taux de conversion
          </span>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-2xl font-black text-slate-900 dark:text-white">
              {stats.conversionRate}%
            </span>
            <span className="text-xs text-indigo-500 font-semibold flex items-center gap-1">
              <TrendingUp className="w-3.5 h-3.5" />
              <span>Performance</span>
            </span>
          </div>
        </div>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm space-y-3 sm:space-y-0 sm:flex sm:items-center sm:gap-3">
        {/* Search Input */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher par nom, entreprise, email, téléphone..."
            className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        {/* Filter by Status */}
        <div className="flex items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="all">Tous les statuts</option>
            <option value="Nouveau">Nouveau</option>
            <option value="Contacté">Contacté</option>
            <option value="Qualifié">Qualifié</option>
            <option value="Proposition envoyée">Proposition envoyée</option>
            <option value="Négociation">Négociation</option>
            <option value="Gagné">Gagné</option>
            <option value="Perdu">Perdu</option>
          </select>

          {/* Filter by Source */}
          <select
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value)}
            className="px-3 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="all">Toutes les sources</option>
            <option value="WhatsApp">WhatsApp</option>
            <option value="Facebook">Facebook</option>
            <option value="Instagram">Instagram</option>
            <option value="Site web">Site web</option>
            <option value="Téléphone">Téléphone</option>
            <option value="Email">Email</option>
            <option value="Recommandation">Recommandation</option>
            <option value="Salon / événement">Salon / événement</option>
            <option value="Autre">Autre</option>
          </select>

          {/* Sort By */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="px-3 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="recent">Plus récents</option>
            <option value="amount_desc">Montant décroissant</option>
            <option value="amount_asc">Montant croissant</option>
            <option value="name">Nom A-Z</option>
          </select>
        </div>
      </div>

      {/* Main Table Content */}
      {loading ? (
        <div className="p-16 text-center text-slate-400">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-indigo-500 mb-2" />
          <span className="text-xs font-medium">Chargement des prospects...</span>
        </div>
      ) : filteredLeads.length === 0 ? (
        <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <UserPlus className="w-12 h-12 text-slate-400 mx-auto mb-3 opacity-60" />
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">Aucun prospect trouvé</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            {search || statusFilter !== 'all' || sourceFilter !== 'all'
              ? 'Aucun résultat ne correspond à vos critères de recherche.'
              : 'Ajoutez votre première opportunité commerciale dès maintenant.'}
          </p>
          <button
            onClick={() => {
              setLeadToEdit(null);
              setLeadModalOpen(true);
            }}
            className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-semibold shadow hover:bg-indigo-500"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Ajouter un prospect</span>
          </button>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700 dark:text-slate-300">
              <thead className="bg-slate-50 dark:bg-slate-800/60 uppercase text-[10px] font-bold text-slate-500 tracking-wider border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="py-3.5 px-4">Prospect & Société</th>
                  <th className="py-3.5 px-4">Contact</th>
                  <th className="py-3.5 px-4">Source</th>
                  <th className="py-3.5 px-4">Montant potentiel</th>
                  <th className="py-3.5 px-4">Statut</th>
                  <th className="py-3.5 px-4">Prochaine action</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {filteredLeads.map((lead) => {
                  const statusClass = STATUS_COLORS[lead.status] || STATUS_COLORS['Nouveau'];
                  const sourceClass = SOURCE_COLORS[lead.source] || SOURCE_COLORS['Autre'];

                  return (
                    <tr
                      key={lead.id}
                      className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors group"
                    >
                      <td className="py-3.5 px-4">
                        <Link
                          href={`/leads/${lead.id}`}
                          className="font-bold text-slate-900 dark:text-white hover:text-indigo-600 dark:hover:text-indigo-400 block"
                        >
                          {lead.name}
                        </Link>
                        <span className="text-[11px] text-slate-500 dark:text-slate-400">
                          {lead.company_name || 'Particulier'}
                        </span>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                          <Phone className="w-3 h-3 text-slate-400" />
                          <span>{lead.phone || '—'}</span>
                        </div>
                        {lead.email && (
                          <div className="flex items-center gap-1.5 text-[11px] text-slate-400 mt-0.5 truncate max-w-[160px]">
                            <Mail className="w-3 h-3 text-slate-400" />
                            <span className="truncate">{lead.email}</span>
                          </div>
                        )}
                      </td>

                      <td className="py-3.5 px-4">
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-semibold ${sourceClass}`}>
                          {lead.source}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 font-bold text-indigo-600 dark:text-indigo-400">
                        {Number(lead.potential_amount || 0).toLocaleString('fr-FR')}{' '}
                        {currentCompany?.currency || 'FCFA'}
                      </td>

                      <td className="py-3.5 px-4">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border ${statusClass}`}>
                          {lead.status}
                        </span>
                      </td>

                      <td className="py-3.5 px-4">
                        {lead.next_action ? (
                          <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-300 text-[10px] font-medium max-w-[180px] truncate">
                            <Calendar className="w-3 h-3 text-amber-500 flex-shrink-0" />
                            <span className="truncate">{lead.next_action}</span>
                          </div>
                        ) : (
                          <span className="text-slate-400 text-[11px]">—</span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1 opacity-90 group-hover:opacity-100 transition-opacity">
                          <Link
                            href={`/leads/${lead.id}`}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                            title="Voir la fiche détaillée"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </Link>

                          <button
                            onClick={() => {
                              setLeadToEdit(lead);
                              setLeadModalOpen(true);
                            }}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                            title="Modifier"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>

                          {lead.status !== 'Gagné' && (
                            <button
                              onClick={() => {
                                setLeadToConvert(lead);
                                setConvertModalOpen(true);
                              }}
                              className="p-1.5 rounded-lg text-emerald-500 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition-colors"
                              title="Convertir en client"
                            >
                              <UserCheck className="w-3.5 h-3.5" />
                            </button>
                          )}

                          <button
                            onClick={() => handleDeleteLead(lead.id, lead.name)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                            title="Supprimer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Lead Create / Edit Modal */}
      <LeadModal
        isOpen={leadModalOpen}
        onClose={() => setLeadModalOpen(false)}
        onSuccess={fetchLeads}
        leadToEdit={leadToEdit}
      />

      {/* Convert to Customer Modal */}
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

      {/* CSV Import Modal */}
      <CsvImportModal
        isOpen={importModalOpen}
        onClose={() => setImportModalOpen(false)}
        onSuccess={fetchLeads}
        type="leads"
      />
    </div>
  );
}
