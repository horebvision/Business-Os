'use client';

import React, { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import {
  UploadCloud,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  Loader2,
  X,
  ArrowRight,
  ExternalLink,
} from 'lucide-react';
import Link from 'next/link';

interface CsvImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  type: 'customers' | 'leads';
}

export default function CsvImportModal({
  isOpen,
  onClose,
  onSuccess,
  type,
}: CsvImportModalProps) {
  const { session } = useAuth();

  // Steps: 1 (Upload) -> 2 (Mapping) -> 3 (Preview & Confirm)
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [fileName, setFileName] = useState('');
  const [rawHeaders, setRawHeaders] = useState<string[]>([]);
  const [parsedRows, setParsedRows] = useState<Record<string, string>[]>([]);
  const [mapping, setMapping] = useState<{
    name: string;
    email: string;
    phone: string;
    company_name: string;
    city: string;
  }>({
    name: '',
    email: '',
    phone: '',
    company_name: '',
    city: '',
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [limitReached, setLimitReached] = useState(false);
  const [importResult, setImportResult] = useState<{
    importedCount: number;
    duplicatesCount: number;
    message: string;
  } | null>(null);

  if (!isOpen) return null;

  // Simple CSV parser supporting comma and semicolon
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (!text) return;

      const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
      if (lines.length < 2) {
        setError('Le fichier CSV est vide ou ne contient aucune ligne de données.');
        return;
      }

      // Detect separator: comma or semicolon
      const firstLine = lines[0];
      const sep = firstLine.includes(';') ? ';' : ',';

      const headers = firstLine.split(sep).map((h) => h.replace(/^["']|["']$/g, '').trim());
      setRawHeaders(headers);

      // Auto-guess mapping based on common column names
      const guessed: any = { name: '', email: '', phone: '', company_name: '', city: '' };
      headers.forEach((h) => {
        const lower = h.toLowerCase();
        if (!guessed.name && (lower.includes('nom') || lower.includes('name') || lower.includes('contact'))) {
          guessed.name = h;
        } else if (!guessed.email && (lower.includes('mail') || lower.includes('courriel'))) {
          guessed.email = h;
        } else if (!guessed.phone && (lower.includes('tel') || lower.includes('phone') || lower.includes('mobile'))) {
          guessed.phone = h;
        } else if (!guessed.company_name && (lower.includes('societ') || lower.includes('entreprise') || lower.includes('company'))) {
          guessed.company_name = h;
        } else if (!guessed.city && (lower.includes('ville') || lower.includes('city') || lower.includes('pays'))) {
          guessed.city = h;
        }
      });
      setMapping(guessed);

      // Parse data rows
      const rows: Record<string, string>[] = [];
      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(sep).map((c) => c.replace(/^["']|["']$/g, '').trim());
        const rowObj: Record<string, string> = {};
        headers.forEach((h, idx) => {
          rowObj[h] = cols[idx] || '';
        });
        rows.push(rowObj);
      }

      setParsedRows(rows);
      setStep(2);
    };

    reader.readAsText(file);
  };

  const handleExecuteImport = async () => {
    if (!session?.access_token) return;
    setLoading(true);
    setError(null);
    setLimitReached(false);

    try {
      // Map rows according to user mapping
      const mappedRecords = parsedRows.map((r) => ({
        name: mapping.name ? r[mapping.name] : '',
        email: mapping.email ? r[mapping.email] : '',
        phone: mapping.phone ? r[mapping.phone] : '',
        company_name: mapping.company_name ? r[mapping.company_name] : '',
        city: mapping.city ? r[mapping.city] : '',
      }));

      const res = await fetch('/api/crm/import', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          type,
          fileName,
          records: mappedRecords,
        }),
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        setError(data.error || 'Erreur lors de l’import.');
        if (data.limit_reached) setLimitReached(true);
        return;
      }

      setImportResult(data);
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Erreur réseau.');
    } finally {
      setLoading(false);
    }
  };

  const label = type === 'customers' ? 'Clients' : 'Prospects';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-lg w-full p-6 shadow-2xl relative space-y-5">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Title */}
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-500">
            Importation Sécurisée
          </span>
          <h3 className="text-base font-extrabold text-slate-900 dark:text-white mt-1">
            Importer des {label} via CSV
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Étape {step} sur 3 • Analyse, mappage des colonnes et détection des doublons.
          </p>
        </div>

        {importResult ? (
          <div className="space-y-4 pt-2">
            <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 text-xs space-y-1">
              <div className="flex items-center gap-2 font-bold">
                <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                <span>Importation terminée avec succès !</span>
              </div>
              <p className="text-[11px] text-emerald-700 dark:text-emerald-300">
                {importResult.message}
              </p>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={onClose}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold shadow"
              >
                Fermer
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* STEP 1: Upload File */}
            {step === 1 && (
              <div className="space-y-4">
                <label className="border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-3xl p-8 flex flex-col items-center justify-center cursor-pointer hover:border-indigo-500 transition-colors bg-slate-50/50 dark:bg-slate-800/40">
                  <UploadCloud className="w-10 h-10 text-indigo-500 mb-2" />
                  <span className="text-xs font-bold text-slate-900 dark:text-white">
                    Sélectionner un fichier .CSV
                  </span>
                  <span className="text-[11px] text-slate-400 mt-1">
                    Séparateur virgule (,) ou point-virgule (;)
                  </span>
                  <input
                    type="file"
                    accept=".csv,text/csv"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </label>

                {error && (
                  <div className="p-3 rounded-xl bg-rose-500/10 text-rose-600 text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    <span>{error}</span>
                  </div>
                )}
              </div>
            )}

            {/* STEP 2: Column Mapping */}
            {step === 2 && (
              <div className="space-y-4">
                <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-100 dark:border-slate-800 text-xs flex items-center justify-between">
                  <span className="font-semibold text-slate-700 dark:text-slate-300 truncate">
                    Fichier : {fileName}
                  </span>
                  <span className="text-slate-400 font-mono text-[11px]">
                    {parsedRows.length} ligne(s)
                  </span>
                </div>

                <div className="space-y-3 text-xs">
                  <div className="grid grid-cols-2 items-center gap-3">
                    <label className="font-semibold text-slate-700 dark:text-slate-300">
                      Nom / Contact *
                    </label>
                    <select
                      value={mapping.name}
                      onChange={(e) => setMapping({ ...mapping, name: e.target.value })}
                      className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs outline-none"
                    >
                      <option value="">-- Ignorer --</option>
                      {rawHeaders.map((h) => (
                        <option key={h} value={h}>
                          {h}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 items-center gap-3">
                    <label className="font-semibold text-slate-700 dark:text-slate-300">
                      Adresse Email
                    </label>
                    <select
                      value={mapping.email}
                      onChange={(e) => setMapping({ ...mapping, email: e.target.value })}
                      className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs outline-none"
                    >
                      <option value="">-- Ignorer --</option>
                      {rawHeaders.map((h) => (
                        <option key={h} value={h}>
                          {h}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 items-center gap-3">
                    <label className="font-semibold text-slate-700 dark:text-slate-300">
                      Téléphone
                    </label>
                    <select
                      value={mapping.phone}
                      onChange={(e) => setMapping({ ...mapping, phone: e.target.value })}
                      className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs outline-none"
                    >
                      <option value="">-- Ignorer --</option>
                      {rawHeaders.map((h) => (
                        <option key={h} value={h}>
                          {h}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 items-center gap-3">
                    <label className="font-semibold text-slate-700 dark:text-slate-300">
                      Raison Sociale
                    </label>
                    <select
                      value={mapping.company_name}
                      onChange={(e) => setMapping({ ...mapping, company_name: e.target.value })}
                      className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs outline-none"
                    >
                      <option value="">-- Ignorer --</option>
                      {rawHeaders.map((h) => (
                        <option key={h} value={h}>
                          {h}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2">
                  <button
                    onClick={() => setStep(1)}
                    className="px-4 py-2 border rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-50"
                  >
                    Retour
                  </button>
                  <button
                    onClick={() => setStep(3)}
                    disabled={!mapping.name && !mapping.company_name && !mapping.email}
                    className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow flex items-center gap-1.5 disabled:opacity-50"
                  >
                    <span>Prévisualiser</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}

            {/* STEP 3: Preview & Confirm */}
            {step === 3 && (
              <div className="space-y-4">
                <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden max-h-48 overflow-y-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 dark:bg-slate-800 text-[10px] uppercase font-bold text-slate-400">
                      <tr>
                        <th className="py-2.5 px-3">Nom</th>
                        <th className="py-2.5 px-3">Email</th>
                        <th className="py-2.5 px-3">Téléphone</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {parsedRows.slice(0, 5).map((r, i) => (
                        <tr key={i}>
                          <td className="py-2 px-3 font-semibold text-slate-900 dark:text-white truncate max-w-[120px]">
                            {mapping.name ? r[mapping.name] : '—'}
                          </td>
                          <td className="py-2 px-3 text-slate-500 truncate max-w-[140px]">
                            {mapping.email ? r[mapping.email] : '—'}
                          </td>
                          <td className="py-2 px-3 text-slate-500">
                            {mapping.phone ? r[mapping.phone] : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <p className="text-[11px] text-slate-400">
                  Affichage des 5 premières lignes sur un total de {parsedRows.length}. Les doublons par email seront automatiquement ignorés.
                </p>

                {error && (
                  <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-600 text-xs space-y-1.5">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                      <span>{error}</span>
                    </div>
                    {limitReached && (
                      <Link
                        href="/billing"
                        className="inline-flex items-center gap-1.5 font-bold text-indigo-600 dark:text-indigo-400 hover:underline pt-1 block"
                      >
                        <span>Mettre à niveau votre forfait SaaS</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </Link>
                    )}
                  </div>
                )}

                <div className="flex items-center justify-between pt-2">
                  <button
                    onClick={() => setStep(2)}
                    className="px-4 py-2 border rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-50"
                  >
                    Retour
                  </button>
                  <button
                    onClick={handleExecuteImport}
                    disabled={loading}
                    className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow flex items-center gap-1.5 transition-all disabled:opacity-50"
                  >
                    {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    <span>Valider et Importer ({parsedRows.length})</span>
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
