'use client';

import React, { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { createClient } from '@/lib/supabase/client';
import { ActivityType } from '@/lib/types';
import { 
  X, 
  Phone, 
  Mail, 
  MessageSquare, 
  Users, 
  FileText, 
  MapPin, 
  MoreHorizontal, 
  Loader2, 
  CheckCircle2, 
  AlertCircle,
  Plus
} from 'lucide-react';

interface ActivityModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  entityType: 'lead' | 'customer';
  entityId: string;
  entityTitle: string;
}

const ACTIVITY_OPTIONS: { type: ActivityType; label: string; icon: any; color: string }[] = [
  { type: 'Appel', label: 'Appel téléphonique', icon: Phone, color: 'text-blue-500 bg-blue-500/10 border-blue-500/20' },
  { type: 'WhatsApp', label: 'Message WhatsApp', icon: MessageSquare, color: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20' },
  { type: 'Email', label: 'Email échangé', icon: Mail, color: 'text-indigo-500 bg-indigo-500/10 border-indigo-500/20' },
  { type: 'Réunion', label: 'Réunion / Rendez-vous', icon: Users, color: 'text-purple-500 bg-purple-500/10 border-purple-500/20' },
  { type: 'Visite', label: 'Visite sur site', icon: MapPin, color: 'text-amber-500 bg-amber-500/10 border-amber-500/20' },
  { type: 'Note', label: 'Note interne', icon: FileText, color: 'text-slate-500 bg-slate-500/10 border-slate-500/20' },
  { type: 'Autre', label: 'Autre interaction', icon: MoreHorizontal, color: 'text-slate-500 bg-slate-500/10 border-slate-500/20' },
];

export default function ActivityModal({
  isOpen,
  onClose,
  onSuccess,
  entityType,
  entityId,
  entityTitle,
}: ActivityModalProps) {
  const { currentCompany, user } = useAuth();
  const supabase = createClient();

  const [selectedType, setSelectedType] = useState<ActivityType>('Appel');
  const [description, setDescription] = useState('');
  const [nextFollowUp, setNextFollowUp] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentCompany?.id || !user) return;
    setLoading(true);
    setErrorMsg(null);

    try {
      const nowIso = new Date().toISOString();

      // 1. Insert into activities
      const { error: actError } = await supabase.from('activities').insert({
        company_id: currentCompany.id,
        user_id: user.id,
        action: selectedType,
        entity_type: entityType,
        entity_id: entityId,
        entity_title: entityTitle,
        description: description.trim(),
        customer_id: entityType === 'customer' ? entityId : null,
        metadata: {
          next_follow_up: nextFollowUp || null,
        },
        created_at: nowIso,
      });

      if (actError) throw actError;

      // 2. Update entity timestamp & next action if provided
      if (entityType === 'lead') {
        const updateLead: any = {
          last_interaction_at: nowIso,
          updated_at: nowIso,
        };
        if (nextFollowUp) {
          updateLead.next_action = nextFollowUp;
        }
        await supabase.from('leads').update(updateLead).eq('id', entityId);
      } else if (entityType === 'customer') {
        await supabase
          .from('customers')
          .update({ last_activity_at: nowIso, updated_at: nowIso })
          .eq('id', entityId);
      }

      setSuccessMsg('Activité consignée avec succès !');
      onSuccess();
      setTimeout(() => {
        setDescription('');
        setNextFollowUp('');
        setSuccessMsg(null);
        onClose();
      }, 900);
    } catch (err: any) {
      setErrorMsg(err.message || "Erreur lors de l'enregistrement de l'activité.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-lg w-full p-6 sm:p-7 shadow-2xl relative">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <h3 className="text-xl font-extrabold text-slate-900 dark:text-white tracking-tight">
          Consigner une activité
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          Historique d&apos;échange avec <span className="font-semibold text-slate-900 dark:text-white">{entityTitle}</span>
        </p>

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

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          {/* Interaction Type Badges */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
              Type d&apos;interaction *
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {ACTIVITY_OPTIONS.map((opt) => {
                const IconComponent = opt.icon;
                const isSelected = selectedType === opt.type;
                return (
                  <button
                    key={opt.type}
                    type="button"
                    onClick={() => setSelectedType(opt.type)}
                    className={`py-2 px-3 rounded-xl border text-xs font-medium flex items-center gap-2 transition-all ${
                      isSelected
                        ? `${opt.color} font-bold ring-2 ring-indigo-500/40`
                        : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    <IconComponent className="w-3.5 h-3.5" />
                    <span className="truncate">{opt.type}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Compte-rendu / Détails de l&apos;échange *
            </label>
            <textarea
              required
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Résumez la teneur de la conversation, les points clés abordés et les accords conclus..."
              className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none resize-none"
            />
          </div>

          {/* Optional Next action follow-up */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Prochaine action à programmer (facultatif)
            </label>
            <input
              type="text"
              value={nextFollowUp}
              onChange={(e) => setNextFollowUp(e.target.value)}
              placeholder="Ex : Rappeler le DG après réception du devis"
              className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            />
          </div>

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
                  <Plus className="w-4 h-4" />
                  <span>Consigner l&apos;activité</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
