'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { createClient } from '@/lib/supabase/client';
import { Customer, DuplicateCheckMatch } from '@/lib/types';
import { checkDuplicates } from '@/lib/crm/duplicateCheck';
import DuplicateWarning from './DuplicateWarning';
import { X, Users, Loader2, CheckCircle2, AlertCircle, Save } from 'lucide-react';

interface CustomerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (customer?: Customer) => void;
  customerToEdit?: Customer | null;
}

export default function CustomerModal({
  isOpen,
  onClose,
  onSuccess,
  customerToEdit,
}: CustomerModalProps) {
  const { currentCompany, user } = useAuth();
  const supabase = createClient();

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [duplicates, setDuplicates] = useState<DuplicateCheckMatch[]>([]);

  // Form fields
  const [name, setName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [phone, setPhone] = useState('+225 ');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('Abidjan');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (customerToEdit) {
      setName(customerToEdit.name || '');
      setCompanyName(customerToEdit.company_name || '');
      setPhone(customerToEdit.phone || '+225 ');
      setEmail(customerToEdit.email || '');
      setAddress(customerToEdit.address || '');
      setCity(customerToEdit.city || 'Abidjan');
      setNotes(customerToEdit.notes || '');
    } else {
      setName('');
      setCompanyName('');
      setPhone('+225 ');
      setEmail('');
      setAddress('');
      setCity('Abidjan');
      setNotes('');
    }
    setDuplicates([]);
    setErrorMsg(null);
    setSuccessMsg(null);
  }, [customerToEdit, isOpen]);

  if (!isOpen) return null;

  const handleCheckDuplicates = async () => {
    if (!currentCompany?.id) return;
    if (!email && (!phone || phone === '+225 ') && !name) return;

    const matches = await checkDuplicates(supabase, currentCompany.id, {
      email,
      phone: phone !== '+225 ' ? phone : undefined,
      name,
      companyName,
      currentId: customerToEdit?.id,
    });
    setDuplicates(matches);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentCompany?.id || !user) return;
    setLoading(true);
    setErrorMsg(null);

    try {
      const payload = {
        company_id: currentCompany.id,
        name: name.trim(),
        company_name: companyName.trim() || null,
        phone: phone.trim() !== '+225 ' ? phone.trim() : null,
        email: email.trim() || null,
        address: address.trim() || null,
        city: city.trim() || 'Abidjan',
        notes: notes.trim() || null,
        updated_at: new Date().toISOString(),
      };

      let resultCustomer: Customer | undefined;

      if (customerToEdit) {
        // UPDATE
        const { data, error } = await supabase
          .from('customers')
          .update(payload)
          .eq('id', customerToEdit.id)
          .eq('company_id', currentCompany.id)
          .select()
          .single();

        if (error) throw error;
        resultCustomer = data as Customer;

        // Log activity
        await supabase.from('activities').insert({
          company_id: currentCompany.id,
          user_id: user.id,
          action: 'Modification client',
          entity_type: 'customer',
          entity_id: customerToEdit.id,
          entity_title: name,
          description: `Fiche client "${name}" mise à jour par ${user.email}`,
          customer_id: customerToEdit.id,
        });

        setSuccessMsg(`Client "${name}" mis à jour avec succès !`);
      } else {
        // INSERT
        const { data, error } = await supabase
          .from('customers')
          .insert({
            ...payload,
            created_by: user.id,
            total_invoiced: 0,
            total_paid: 0,
            total_due: 0,
          })
          .select()
          .single();

        if (error) throw error;
        resultCustomer = data as Customer;

        // Log activity
        await supabase.from('activities').insert({
          company_id: currentCompany.id,
          user_id: user.id,
          action: 'Création client',
          entity_type: 'customer',
          entity_id: data.id,
          entity_title: name,
          description: `Nouveau client "${name}" ajouté par ${user.email}`,
          customer_id: data.id,
        });

        setSuccessMsg(`Client "${name}" créé avec succès !`);
      }

      onSuccess(resultCustomer);
      setTimeout(() => {
        onClose();
      }, 1000);
    } catch (err: any) {
      setErrorMsg(err.message || "Erreur lors de l'enregistrement du client.");
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
            <Users className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              {customerToEdit ? 'Modifier le client' : 'Nouveau client'}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {customerToEdit ? `Mise à jour des coordonnées de ${customerToEdit.name}` : 'Créez une fiche client complète pour la facturation et le suivi'}
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Nom complet / Contact principal *
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                onBlur={handleCheckDuplicates}
                placeholder="Ex : Aminata Koné"
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Raison sociale / Société
              </label>
              <input
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                onBlur={handleCheckDuplicates}
                placeholder="Ex : Koné & Associés SARL"
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Téléphone principal
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                onBlur={handleCheckDuplicates}
                placeholder="+225 0500000000"
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
                placeholder="contact@koneassocies.ci"
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Adresse postale / physique
              </label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Ex : Deux-Plateaux Vallon, Rue des Jardins"
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Ville
              </label>
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="Abidjan"
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Notes & Remarques sur le compte
            </label>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Conditions de paiement négociées, interlocuteurs privilégiés, particularités..."
              className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none resize-none"
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
                  <Save className="w-4 h-4" />
                  <span>{customerToEdit ? 'Enregistrer les modifications' : 'Créer le client'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
