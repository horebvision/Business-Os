'use client';

import React from 'react';
import { DuplicateCheckMatch } from '@/lib/types';
import { AlertTriangle, ExternalLink } from 'lucide-react';
import Link from 'next/link';

interface DuplicateWarningProps {
  matches: DuplicateCheckMatch[];
  onDismiss?: () => void;
}

export default function DuplicateWarning({ matches }: DuplicateWarningProps) {
  if (!matches || matches.length === 0) return null;

  return (
    <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-200 text-xs animate-in fade-in duration-200">
      <div className="flex items-start gap-2.5">
        <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <p className="font-bold text-amber-800 dark:text-amber-300">
            Doublon potentiel détecté ({matches.length})
          </p>
          <p className="text-[11px] text-amber-700/80 dark:text-amber-300/80 mt-0.5">
            Un ou plusieurs enregistrements similaires existent déjà dans votre espace :
          </p>
          <div className="mt-2 space-y-1.5">
            {matches.map((m, idx) => (
              <div
                key={`${m.id}-${idx}`}
                className="flex items-center justify-between py-1 px-2.5 rounded-xl bg-amber-500/15 border border-amber-500/20 text-[11px]"
              >
                <div className="flex items-center gap-2 truncate">
                  <span
                    className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${
                      m.type === 'customer'
                        ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                        : 'bg-indigo-500/20 text-indigo-600 dark:text-indigo-400'
                    }`}
                  >
                    {m.type === 'customer' ? 'Client' : 'Prospect'}
                  </span>
                  <span className="font-semibold truncate">{m.name}</span>
                  <span className="text-[10px] text-amber-600 dark:text-amber-400">
                    ({m.matchedField === 'email' ? 'Email identique' : m.matchedField === 'phone' ? 'Téléphone identique' : 'Nom similaire'})
                  </span>
                </div>
                <Link
                  href={m.link}
                  target="_blank"
                  className="inline-flex items-center gap-1 font-bold text-amber-700 dark:text-amber-300 hover:underline ml-2"
                >
                  <span>Voir</span>
                  <ExternalLink className="w-3 h-3" />
                </Link>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
