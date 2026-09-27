'use client';

import React from 'react';
import { useAuth } from '@/context/AuthContext';
import { FolderOpen, Plus, FileText, CheckCircle2 } from 'lucide-react';

export default function DocumentsPage() {
  const { currentCompany } = useAuth();

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Documents
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Bibliothèque centralisée des devis, factures, contrats et reçus de l&apos;entreprise.
          </p>
        </div>

        <button className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl shadow-md shadow-indigo-600/20 transition-all self-start sm:self-auto">
          <Plus className="w-4 h-4" />
          <span>Ajouter un document</span>
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {['Devis', 'Factures', 'Contrats', 'Reçus'].map((cat) => (
          <div
            key={cat}
            className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm hover:border-indigo-500/50 transition-all cursor-pointer"
          >
            <FolderOpen className="w-6 h-6 text-indigo-500 mb-2" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">{cat}</h3>
            <p className="text-[11px] text-slate-400 mt-0.5">Dossier d&apos;archives</p>
          </div>
        ))}
      </div>
    </div>
  );
}
