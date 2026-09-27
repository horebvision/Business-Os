'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/context/AuthContext';
import { createClient } from '@/lib/supabase/client';
import { Customer } from '@/lib/types';
import { 
  Users, 
  Plus, 
  Search, 
  Filter, 
  Loader2, 
  Phone, 
  Mail, 
  MapPin, 
  DollarSign, 
  TrendingUp, 
  AlertCircle, 
  CheckCircle2, 
  Eye, 
  Edit3, 
  Trash2,
  Receipt,
  FileSpreadsheet,
  Download,
  Upload
} from 'lucide-react';
import Link from 'next/link';
import CustomerModal from '@/components/crm/CustomerModal';
import CsvImportModal from '@/components/crm/CsvImportModal';

export default function CustomersPage() {
  const { currentCompany } = useAuth();
  const supabase = createClient();

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [balanceFilter, setBalanceFilter] = useState<'all' | 'unpaid' | 'paid'>('all');
  const [sortBy, setSortBy] = useState<'recent' | 'invoiced_desc' | 'due_desc' | 'name'>('recent');

  // Modals
  const [customerModalOpen, setCustomerModalOpen] = useState(false);
  const [customerToEdit, setCustomerToEdit] = useState<Customer | null>(null);
  const [importModalOpen, setImportModalOpen] = useState(false);

  const exportCustomersCsv = () => {
    if (customers.length === 0) return;
    const headers = ['Nom', 'Raison Sociale', 'Email', 'Téléphone', 'Adresse', 'Ville', 'Total Facturé', 'Total Réglé', 'Solde Dû'];
    const rows = filteredCustomers.map((c) => [
      `"${(c.name || '').replace(/"/g, '""')}"`,
      `"${(c.company_name || '').replace(/"/g, '""')}"`,
      `"${(c.email || '').replace(/"/g, '""')}"`,
      `"${(c.phone || '').replace(/"/g, '""')}"`,
      `"${(c.address || '').replace(/"/g, '""')}"`,
      `"${(c.city || '').replace(/"/g, '""')}"`,
      c.total_invoiced || 0,
      c.total_paid || 0,
      c.total_due || 0,
    ]);
    const csvContent = '\uFEFF' + [headers.join(';'), ...rows.map((r) => r.join(';'))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `clients-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const fetchCustomers = async () => {
    if (!currentCompany?.id) return;
    setLoading(true);
    const { data } = await supabase
      .from('customers')
      .select('*')
      .eq('company_id', currentCompany.id)
      .order('created_at', { ascending: false });

    if (data) setCustomers(data as Customer[]);
    setLoading(false);
  };

  useEffect(() => {
    fetchCustomers();
  }, [currentCompany?.id]);

  const handleDeleteCustomer = async (customerId: string, customerName: string) => {
    if (!confirm(`Supprimer définitivement la fiche de "${customerName}" ?`)) return;

    const { error } = await supabase
      .from('customers')
      .delete()
      .eq('id', customerId)
      .eq('company_id', currentCompany?.id);

    if (!error) {
      setCustomers((prev) => prev.filter((c) => c.id !== customerId));
    }
  };

  // KPIs
  const metrics = useMemo(() => {
    const total = customers.length;
    const totalInvoiced = customers.reduce((acc, c) => acc + (Number(c.total_invoiced) || 0), 0);
    const totalPaid = customers.reduce((acc, c) => acc + (Number(c.total_paid) || 0), 0);
    const totalDue = customers.reduce((acc, c) => acc + (Number(c.total_due) || 0), 0);
    return { total, totalInvoiced, totalPaid, totalDue };
  }, [customers]);

  // Filtering & Sorting
  const filteredCustomers = useMemo(() => {
    return customers
      .filter((c) => {
        const matchesSearch =
          c.name.toLowerCase().includes(search.toLowerCase()) ||
          (c.company_name && c.company_name.toLowerCase().includes(search.toLowerCase())) ||
          (c.email && c.email.toLowerCase().includes(search.toLowerCase())) ||
          (c.phone && c.phone.toLowerCase().includes(search.toLowerCase())) ||
          (c.city && c.city.toLowerCase().includes(search.toLowerCase()));

        const due = Number(c.total_due) || 0;
        let matchesBalance = true;
        if (balanceFilter === 'unpaid') matchesBalance = due > 0;
        if (balanceFilter === 'paid') matchesBalance = due === 0;

        return matchesSearch && matchesBalance;
      })
      .sort((a, b) => {
        if (sortBy === 'invoiced_desc') return (Number(b.total_invoiced) || 0) - (Number(a.total_invoiced) || 0);
        if (sortBy === 'due_desc') return (Number(b.total_due) || 0) - (Number(a.total_due) || 0);
        if (sortBy === 'name') return a.name.localeCompare(b.name);
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
  }, [customers, search, balanceFilter, sortBy]);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Clients
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Fiches clients 360°, suivi des créances, devis, factures et historique des paiements.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
          <button
            onClick={exportCustomersCsv}
            disabled={customers.length === 0}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Exporter</span>
          </button>

          <button
            onClick={() => setImportModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Importer CSV</span>
          </button>

          <button
            onClick={() => {
              setCustomerToEdit(null);
              setCustomerModalOpen(true);
            }}
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl shadow-md shadow-indigo-600/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            <Plus className="w-4 h-4" />
            <span>Nouveau client</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <span className="text-[11px] font-bold uppercase text-slate-400 tracking-wider">
            Total clients
          </span>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-2xl font-black text-slate-900 dark:text-white">
              {metrics.total}
            </span>
            <span className="text-xs text-indigo-500 font-semibold">Comptes actifs</span>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <span className="text-[11px] font-bold uppercase text-slate-400 tracking-wider">
            Chiffre d&apos;affaires facturé
          </span>
          <div className="mt-1">
            <span className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
              {metrics.totalInvoiced.toLocaleString('fr-FR')} {currentCompany?.currency || 'FCFA'}
            </span>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <span className="text-[11px] font-bold uppercase text-slate-400 tracking-wider">
            Total encaissé
          </span>
          <div className="mt-1">
            <span className="text-xl sm:text-2xl font-black text-emerald-600 dark:text-emerald-400">
              {metrics.totalPaid.toLocaleString('fr-FR')} {currentCompany?.currency || 'FCFA'}
            </span>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <span className="text-[11px] font-bold uppercase text-slate-400 tracking-wider">
            Créances en cours (Solde dû)
          </span>
          <div className="mt-1 flex items-baseline justify-between">
            <span className={`text-xl sm:text-2xl font-black ${
              metrics.totalDue > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-900 dark:text-white'
            }`}>
              {metrics.totalDue.toLocaleString('fr-FR')} {currentCompany?.currency || 'FCFA'}
            </span>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm space-y-3 sm:space-y-0 sm:flex sm:items-center sm:gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher par nom, entreprise, email, téléphone, ville..."
            className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div className="flex items-center gap-2">
          <select
            value={balanceFilter}
            onChange={(e) => setBalanceFilter(e.target.value as any)}
            className="px-3 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="all">Tous les règlements</option>
            <option value="unpaid">Avec solde impayé (&gt; 0)</option>
            <option value="paid">Entièrement à jour (0 solde)</option>
          </select>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="px-3 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="recent">Plus récents</option>
            <option value="invoiced_desc">Total facturé décroissant</option>
            <option value="due_desc">Solde dû décroissant</option>
            <option value="name">Nom A-Z</option>
          </select>
        </div>
      </div>

      {/* Main Customers List / Table */}
      {loading ? (
        <div className="p-16 text-center text-slate-400">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-indigo-500 mb-2" />
          <span className="text-xs font-medium">Chargement des clients...</span>
        </div>
      ) : filteredCustomers.length === 0 ? (
        <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <Users className="w-12 h-12 text-slate-400 mx-auto mb-3 opacity-60" />
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">Aucun client trouvé</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            {search || balanceFilter !== 'all'
              ? 'Aucun client ne correspond aux critères de recherche.'
              : 'Enregistrez votre première fiche client ou convertissez un prospect qualifié.'}
          </p>
          <button
            onClick={() => {
              setCustomerToEdit(null);
              setCustomerModalOpen(true);
            }}
            className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-semibold shadow hover:bg-indigo-500"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Ajouter un client</span>
          </button>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700 dark:text-slate-300">
              <thead className="bg-slate-50 dark:bg-slate-800/60 uppercase text-[10px] font-bold text-slate-500 tracking-wider border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="py-3.5 px-4">Client & Société</th>
                  <th className="py-3.5 px-4">Contact & Ville</th>
                  <th className="py-3.5 px-4">Total facturé</th>
                  <th className="py-3.5 px-4">Total encaissé</th>
                  <th className="py-3.5 px-4">Solde dû</th>
                  <th className="py-3.5 px-4">Dernière activité</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {filteredCustomers.map((c) => {
                  const due = Number(c.total_due) || 0;
                  const hasDue = due > 0;

                  return (
                    <tr
                      key={c.id}
                      className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors group"
                    >
                      <td className="py-3.5 px-4">
                        <Link
                          href={`/customers/${c.id}`}
                          className="font-bold text-slate-900 dark:text-white hover:text-indigo-600 dark:hover:text-indigo-400 block"
                        >
                          {c.name}
                        </Link>
                        <span className="text-[11px] text-slate-500 dark:text-slate-400">
                          {c.company_name || 'Particulier'}
                        </span>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                          <Phone className="w-3 h-3 text-slate-400" />
                          <span>{c.phone || '—'}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-[11px] text-slate-400 mt-0.5">
                          <MapPin className="w-3 h-3 text-slate-400" />
                          <span>{c.city || 'Abidjan'}</span>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 font-semibold text-slate-900 dark:text-white">
                        {Number(c.total_invoiced || 0).toLocaleString('fr-FR')}{' '}
                        {currentCompany?.currency || 'FCFA'}
                      </td>

                      <td className="py-3.5 px-4 font-semibold text-emerald-600 dark:text-emerald-400">
                        {Number(c.total_paid || 0).toLocaleString('fr-FR')}{' '}
                        {currentCompany?.currency || 'FCFA'}
                      </td>

                      <td className="py-3.5 px-4">
                        {hasDue ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                            {due.toLocaleString('fr-FR')} {currentCompany?.currency || 'FCFA'}
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                            À jour
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-slate-500 text-[11px]">
                        {c.last_activity_at
                          ? new Date(c.last_activity_at).toLocaleDateString('fr-FR')
                          : '—'}
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1 opacity-90 group-hover:opacity-100 transition-opacity">
                          <Link
                            href={`/customers/${c.id}`}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                            title="Voir la fiche client 360°"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </Link>

                          <button
                            onClick={() => {
                              setCustomerToEdit(c);
                              setCustomerModalOpen(true);
                            }}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                            title="Modifier"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => handleDeleteCustomer(c.id, c.name)}
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

      {/* Customer Create / Edit Modal */}
      <CustomerModal
        isOpen={customerModalOpen}
        onClose={() => setCustomerModalOpen(false)}
        onSuccess={fetchCustomers}
        customerToEdit={customerToEdit}
      />

      {/* CSV Import Modal */}
      <CsvImportModal
        isOpen={importModalOpen}
        onClose={() => setImportModalOpen(false)}
        onSuccess={fetchCustomers}
        type="customers"
      />
    </div>
  );
}
