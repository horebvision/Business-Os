'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { 
  Building2, 
  User, 
  CheckSquare, 
  ArrowRight, 
  ArrowLeft, 
  Layers, 
  Sparkles, 
  CheckCircle2, 
  Loader2, 
  AlertCircle 
} from 'lucide-react';

export default function OnboardingPage() {
  const { user, profile, refreshUserData, loading: authLoading } = useAuth();
  const router = useRouter();
  const supabase = createClient();

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Step 1: Entreprise
  const [companyName, setCompanyName] = useState('');
  const [sector, setSector] = useState('Services & Conseil');
  const [companyPhone, setCompanyPhone] = useState('+225 ');
  const [companyEmail, setCompanyEmail] = useState('');
  const [address, setAddress] = useState('');
  const [country, setCountry] = useState('Côte d\'Ivoire');
  const [city, setCity] = useState('Abidjan');
  const [currency, setCurrency] = useState('FCFA');

  // Step 2: Profil
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [jobTitle, setJobTitle] = useState('Dirigeant / Fondateur');
  const [userPhone, setUserPhone] = useState('+225 ');

  // Step 3: Modules souhaités
  const [selectedModules, setSelectedModules] = useState<string[]>([
    'Clients',
    'Prospects',
    'Devis',
    'Factures',
    'Paiements',
    'Tâches',
    'Équipe',
  ]);

  useEffect(() => {
    if (user && !authLoading) {
      if (profile?.first_name) setFirstName(profile.first_name);
      if (profile?.last_name) setLastName(profile.last_name);
      if (profile?.phone) setUserPhone(profile.phone);
      if (user.email && !companyEmail) setCompanyEmail(user.email);
    }
  }, [user, profile, authLoading]);

  const toggleModule = (moduleName: string) => {
    setSelectedModules((prev) =>
      prev.includes(moduleName)
        ? prev.filter((m) => m !== moduleName)
        : [...prev, moduleName]
    );
  };

  const handleFinishOnboarding = async () => {
    if (!user) return;
    setLoading(true);
    setErrorMsg(null);

    try {
      // 1. Generate clean company slug
      const slug = companyName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)+/g, '') + '-' + Math.random().toString(36).substring(2, 6);

      // 2. Create Company
      const { data: newCompany, error: compErr } = await supabase
        .from('companies')
        .insert({
          name: companyName.trim(),
          slug,
          sector,
          phone: companyPhone.trim(),
          email: companyEmail.trim(),
          address: address.trim(),
          country,
          city,
          currency,
          managed_modules: selectedModules,
          onboarding_completed: true,
          created_by: user.id,
        })
        .select()
        .single();

      if (compErr) throw compErr;

      // 3. Create Membership as Owner
      const { error: memErr } = await supabase
        .from('memberships')
        .insert({
          company_id: newCompany.id,
          user_id: user.id,
          role: 'owner',
          is_active: true,
        });

      if (memErr) throw memErr;

      // 4. Update User Profile
      await supabase
        .from('users')
        .update({
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          job_title: jobTitle.trim(),
          phone: userPhone.trim(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);

      // 5. Create default initial notification
      await supabase
        .from('notifications')
        .insert({
          company_id: newCompany.id,
          user_id: user.id,
          title: 'Bienvenue sur BusinessOS 🎉',
          message: `Votre espace "${newCompany.name}" est configuré. Vous pouvez dès maintenant créer vos prospects, devis et factures.`,
          type: 'success',
          link: '/dashboard',
        });

      // 6. Refresh Auth Context and redirect
      if (typeof window !== 'undefined') {
        localStorage.setItem('businessos_active_company_id', newCompany.id);
      }
      await refreshUserData();
      router.push('/dashboard');
    } catch (err: any) {
      console.error('Onboarding error:', err);
      setErrorMsg(err.message || 'Une erreur est survenue lors de la création de votre espace.');
      setLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[450px] bg-indigo-600/15 rounded-full blur-[130px] pointer-events-none" />

      <div className="max-w-xl mx-auto w-full relative z-10">
        {/* Brand header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-blue-500 flex items-center justify-center shadow-lg shadow-indigo-500/25">
              <Layers className="w-5 h-5 text-white" />
            </div>
            <span className="text-2xl font-bold tracking-tight text-white">
              Business<span className="text-indigo-400">OS</span>
            </span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Configuration de votre espace
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Étape {step} sur 3 — Préparez votre cockpit d&apos;entreprise
          </p>

          {/* Stepper Indicator */}
          <div className="flex items-center justify-center gap-2 mt-6">
            <div className={`h-1.5 rounded-full transition-all duration-300 ${step >= 1 ? 'w-16 bg-indigo-500' : 'w-8 bg-slate-800'}`} />
            <div className={`h-1.5 rounded-full transition-all duration-300 ${step >= 2 ? 'w-16 bg-indigo-500' : 'w-8 bg-slate-800'}`} />
            <div className={`h-1.5 rounded-full transition-all duration-300 ${step >= 3 ? 'w-16 bg-indigo-500' : 'w-8 bg-slate-800'}`} />
          </div>
        </div>

        {/* Card */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 sm:p-10 shadow-2xl backdrop-blur-xl">
          {errorMsg && (
            <div className="mb-6 p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-rose-400 flex-shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* STEP 1: ENTREPRISE */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 pb-3 border-b border-slate-800">
                <div className="w-9 h-9 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">Votre entreprise</h2>
                  <p className="text-xs text-slate-400">Les coordonnées de votre entité professionnelle</p>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Nom de l&apos;entreprise *
                </label>
                <input
                  type="text"
                  required
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="Ex : Ivoire Conseil & Solutions SARL"
                  className="w-full px-4 py-2.5 bg-slate-800/80 border border-slate-700 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                    Secteur d&apos;activité
                  </label>
                  <select
                    value={sector}
                    onChange={(e) => setSector(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-800/80 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                  >
                    <option value="Services & Conseil">Services & Conseil</option>
                    <option value="Commerce & Distribution">Commerce & Distribution</option>
                    <option value="BTP & Construction">BTP & Construction</option>
                    <option value="Technologies & Digital">Technologies & Digital</option>
                    <option value="Santé & Pharmacie">Santé & Pharmacie</option>
                    <option value="Transport & Logistique">Transport & Logistique</option>
                    <option value="Autre">Autre</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                    Devise principale
                  </label>
                  <input
                    type="text"
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-800/80 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-semibold text-indigo-400"
                  />
                  <span className="text-[11px] text-slate-500 mt-1 block">XOF / FCFA par défaut</span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                    Téléphone professionnel
                  </label>
                  <input
                    type="tel"
                    value={companyPhone}
                    onChange={(e) => setCompanyPhone(e.target.value)}
                    placeholder="+225 07..."
                    className="w-full px-4 py-2.5 bg-slate-800/80 border border-slate-700 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                    Email de contact
                  </label>
                  <input
                    type="email"
                    value={companyEmail}
                    onChange={(e) => setCompanyEmail(e.target.value)}
                    placeholder="contact@entreprise.ci"
                    className="w-full px-4 py-2.5 bg-slate-800/80 border border-slate-700 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-1">
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                    Pays
                  </label>
                  <input
                    type="text"
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-800/80 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                  />
                </div>

                <div className="sm:col-span-1">
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                    Ville
                  </label>
                  <input
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="Abidjan"
                    className="w-full px-4 py-2.5 bg-slate-800/80 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                  />
                </div>

                <div className="sm:col-span-1">
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                    Adresse
                  </label>
                  <input
                    type="text"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="Plateau, Rue..."
                    className="w-full px-4 py-2.5 bg-slate-800/80 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  if (!companyName.trim()) {
                    setErrorMsg('Veuillez renseigner le nom de votre entreprise.');
                    return;
                  }
                  setErrorMsg(null);
                  setStep(2);
                }}
                className="w-full mt-6 flex items-center justify-center gap-2 py-3.5 px-4 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl shadow-lg shadow-indigo-600/30 transition-all"
              >
                <span>Continuer vers mon profil</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* STEP 2: PROFIL */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 pb-3 border-b border-slate-800">
                <div className="w-9 h-9 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center">
                  <User className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">Votre profil</h2>
                  <p className="text-xs text-slate-400">Vos informations personnelles en tant qu&apos;administrateur</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                    Prénom *
                  </label>
                  <input
                    type="text"
                    required
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="Prénom"
                    className="w-full px-4 py-2.5 bg-slate-800/80 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                    Nom *
                  </label>
                  <input
                    type="text"
                    required
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="Nom de famille"
                    className="w-full px-4 py-2.5 bg-slate-800/80 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                    Fonction / Rôle dans l&apos;entreprise
                  </label>
                  <input
                    type="text"
                    value={jobTitle}
                    onChange={(e) => setJobTitle(e.target.value)}
                    placeholder="Directeur Général"
                    className="w-full px-4 py-2.5 bg-slate-800/80 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                    Numéro de téléphone direct
                  </label>
                  <input
                    type="tel"
                    value={userPhone}
                    onChange={(e) => setUserPhone(e.target.value)}
                    placeholder="+225 07..."
                    className="w-full px-4 py-2.5 bg-slate-800/80 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                  />
                </div>
              </div>

              <div className="flex items-center gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl border border-slate-700 hover:bg-slate-800 text-slate-300 text-sm font-medium transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Retour</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    if (!firstName.trim()) {
                      setErrorMsg('Veuillez renseigner votre prénom.');
                      return;
                    }
                    setErrorMsg(null);
                    setStep(3);
                  }}
                  className="flex-1 flex items-center justify-center gap-2 py-3.5 px-4 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl shadow-lg shadow-indigo-600/30 transition-all"
                >
                  <span>Continuer</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: QUE SOUHAITEZ-VOUS GÉRER ? */}
          {step === 3 && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 pb-3 border-b border-slate-800">
                <div className="w-9 h-9 rounded-lg bg-teal-500/20 text-teal-400 flex items-center justify-center">
                  <CheckSquare className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">Que souhaitez-vous gérer ?</h2>
                  <p className="text-xs text-slate-400">Sélectionnez les modules actifs pour votre espace de travail</p>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-2 gap-3 pt-2">
                {[
                  { id: 'Clients', desc: 'Fiches et historique' },
                  { id: 'Prospects', desc: 'CRM & Pipeline commercial' },
                  { id: 'Devis', desc: 'Calcul auto et PDF en FCFA' },
                  { id: 'Factures', desc: 'Gestion des paiements et impayés' },
                  { id: 'Paiements', desc: 'Suivi des règlements et soldes' },
                  { id: 'Tâches', desc: 'Gestionnaire de tâches & priorités' },
                  { id: 'Équipe', desc: 'Collaborateurs & gestion des rôles' },
                ].map((item) => {
                  const isChecked = selectedModules.includes(item.id);
                  return (
                    <div
                      key={item.id}
                      onClick={() => toggleModule(item.id)}
                      className={`cursor-pointer p-3.5 rounded-2xl border transition-all flex items-start gap-3 select-none ${
                        isChecked
                          ? 'bg-indigo-950/40 border-indigo-500/80 shadow-md shadow-indigo-500/10'
                          : 'bg-slate-800/40 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <div
                        className={`w-5 h-5 rounded-md flex items-center justify-center mt-0.5 flex-shrink-0 transition-colors ${
                          isChecked ? 'bg-indigo-600 text-white' : 'border border-slate-600 bg-slate-800'
                        }`}
                      >
                        {isChecked && <CheckCircle2 className="w-3.5 h-3.5" />}
                      </div>
                      <div>
                        <div className={`text-sm font-semibold ${isChecked ? 'text-white' : 'text-slate-300'}`}>
                          {item.id}
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5 leading-tight">
                          {item.desc}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="flex items-center gap-3 pt-6">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  disabled={loading}
                  className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl border border-slate-700 hover:bg-slate-800 text-slate-300 text-sm font-medium transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Retour</span>
                </button>

                <button
                  type="button"
                  disabled={loading || selectedModules.length === 0}
                  onClick={handleFinishOnboarding}
                  className="flex-1 flex items-center justify-center gap-2 py-3.5 px-4 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 disabled:opacity-50 text-white font-semibold rounded-xl shadow-xl shadow-indigo-600/30 transition-all hover:scale-[1.01]"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Création de votre espace en cours...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      <span>Créer mon espace de travail</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
