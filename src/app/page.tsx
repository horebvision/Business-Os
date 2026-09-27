'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { 
  ArrowRight, 
  CheckCircle2, 
  ShieldCheck, 
  Zap, 
  FileText, 
  Users, 
  BarChart3, 
  BellRing, 
  Bot, 
  ChevronRight, 
  Sparkles,
  Layers,
  Clock,
  ChevronDown,
  Building2,
  DollarSign
} from 'lucide-react';

export default function LandingPage() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const toggleFaq = (index: number) => {
    setOpenFaq(openFaq === index ? null : index);
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 selection:bg-indigo-500 selection:text-white">
      {/* Navigation */}
      <header className="sticky top-0 z-50 border-b border-slate-800 bg-slate-950/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-blue-500 flex items-center justify-center shadow-lg shadow-indigo-500/25">
              <Layers className="w-5 h-5 text-white" />
            </div>
            <span className="text-2xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white via-slate-200 to-indigo-200">
              Business<span className="text-indigo-400">OS</span>
            </span>
          </div>

          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-300">
            <a href="#features" className="hover:text-white transition-colors">Fonctionnalités</a>
            <a href="#solution" className="hover:text-white transition-colors">Solution</a>
            <a href="#how-it-works" className="hover:text-white transition-colors">Comment ça marche</a>
            <a href="#pricing" className="hover:text-white transition-colors">Tarifs</a>
            <a href="#faq" className="hover:text-white transition-colors">FAQ</a>
          </nav>

          <div className="flex items-center gap-4">
            <Link 
              href="/login" 
              className="text-sm font-medium text-slate-300 hover:text-white px-3 py-2 rounded-lg transition-colors"
            >
              Connexion
            </Link>
            <Link 
              href="/register" 
              className="inline-flex items-center gap-2 text-sm font-medium bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white px-5 py-2.5 rounded-xl shadow-lg shadow-indigo-600/30 transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              <span>Démarrer gratuit</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden pt-20 pb-32 lg:pt-32 lg:pb-40">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[500px] bg-gradient-to-tr from-indigo-600/20 via-blue-600/15 to-purple-600/10 rounded-full blur-[120px] pointer-events-none" />
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-indigo-500/30 bg-indigo-500/10 text-indigo-300 text-xs font-semibold mb-8 backdrop-blur-md">
            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
            <span>Assistant Administratif & Commercial Intelligent</span>
          </div>

          <h1 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight text-white max-w-4xl mx-auto leading-[1.15]">
            Gérez votre entreprise. <br />
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 via-blue-400 to-teal-300">
              Automatisez le reste.
            </span>
          </h1>

          <p className="mt-8 text-lg sm:text-xl text-slate-400 max-w-2xl mx-auto leading-relaxed">
            BusinessOS centralise vos clients, devis, factures, tâches et relances pour vous faire gagner du temps chaque jour.
          </p>

          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link 
              href="/register" 
              className="w-full sm:w-auto inline-flex items-center justify-center gap-3 text-base font-semibold bg-indigo-600 hover:bg-indigo-500 text-white px-8 py-4 rounded-xl shadow-xl shadow-indigo-600/30 transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              <span>Commencer gratuitement</span>
              <ArrowRight className="w-5 h-5" />
            </Link>
            <a 
              href="#how-it-works" 
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 text-base font-semibold bg-slate-800/80 hover:bg-slate-800 text-slate-200 border border-slate-700 px-8 py-4 rounded-xl transition-all"
            >
              <span>Voir comment ça fonctionne</span>
            </a>
          </div>

          {/* Social Proof Stats */}
          <div className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-6 max-w-4xl mx-auto pt-10 border-t border-slate-800/80 text-left">
            <div>
              <div className="text-3xl font-extrabold text-white">100%</div>
              <div className="text-sm text-slate-400 mt-1">Conforme devises FCFA / XOF</div>
            </div>
            <div>
              <div className="text-3xl font-extrabold text-indigo-400">+12h</div>
              <div className="text-sm text-slate-400 mt-1">Économisées par semaine</div>
            </div>
            <div>
              <div className="text-3xl font-extrabold text-white">0</div>
              <div className="text-sm text-slate-400 mt-1">Facture impayée oubliée</div>
            </div>
            <div>
              <div className="text-3xl font-extrabold text-blue-400">1 Clic</div>
              <div className="text-sm text-slate-400 mt-1">Devis converti en facture</div>
            </div>
          </div>
        </div>
      </section>

      {/* Le Problème Section */}
      <section className="py-24 bg-slate-950 border-t border-slate-800/80 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto">
            <h2 className="text-xs uppercase tracking-wider font-semibold text-rose-400 mb-3">Le Problème</h2>
            <p className="text-3xl sm:text-4xl font-bold text-white">
              L&apos;enfer administratif qui freine votre croissance
            </p>
            <p className="mt-4 text-slate-400">
              En tant qu&apos;entrepreneur, vous passez plus de temps à courir après des papiers qu&apos;à développer vos ventes.
            </p>
          </div>

          <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-slate-900/60 border border-rose-900/30 p-8 rounded-2xl relative overflow-hidden">
              <div className="w-12 h-12 rounded-xl bg-rose-500/10 text-rose-400 flex items-center justify-center mb-6">
                <Clock className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-white">Factures en retard non relancées</h3>
              <p className="mt-3 text-slate-400 text-sm leading-relaxed">
                Des millions de FCFA restent dehors parce que relancer manuellement chaque client est chronophage et inconfortable.
              </p>
            </div>

            <div className="bg-slate-900/60 border border-amber-900/30 p-8 rounded-2xl relative overflow-hidden">
              <div className="w-12 h-12 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center mb-6">
                <Users className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-white">Prospects perdus dans la nature</h3>
              <p className="mt-3 text-slate-400 text-sm leading-relaxed">
                Entre les messages WhatsApp, les carnets et les emails, 60% des prospects qualifiés ne reçoivent jamais de deuxième relance.
              </p>
            </div>

            <div className="bg-slate-900/60 border border-indigo-900/30 p-8 rounded-2xl relative overflow-hidden">
              <div className="w-12 h-12 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center mb-6">
                <FileText className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-white">Outils dispersés et Excel chaotique</h3>
              <p className="mt-3 text-slate-400 text-sm leading-relaxed">
                Un fichier Excel pour les devis, un groupe WhatsApp pour l&apos;équipe, des captures pour les paiements Mobile Money. Rien n&apos;est connecté.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* La Solution Section */}
      <section id="solution" className="py-24 bg-slate-900 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto">
            <h2 className="text-xs uppercase tracking-wider font-semibold text-indigo-400 mb-3">La Solution</h2>
            <p className="text-3xl sm:text-4xl font-bold text-white">
              BusinessOS : Votre cockpit d&apos;entreprise tout-en-un
            </p>
            <p className="mt-4 text-slate-400">
              Un système d&apos;exploitation complet conçu pour les indépendants et les PME d&apos;Afrique francophone et du monde entier.
            </p>
          </div>

          <div className="mt-16 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <div className="p-8 rounded-2xl bg-slate-800/50 border border-slate-700/60 hover:border-indigo-500/50 transition-all">
              <div className="w-12 h-12 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center mb-5">
                <Users className="w-6 h-6" />
              </div>
              <h4 className="text-lg font-bold text-white">CRM & Pipeline Commercial</h4>
              <p className="mt-2 text-sm text-slate-400">
                Suivez vos prospects de la prise de contact jusqu&apos;à la signature avec un Kanban glisser-déposer intuitif.
              </p>
            </div>

            <div className="p-8 rounded-2xl bg-slate-800/50 border border-slate-700/60 hover:border-indigo-500/50 transition-all">
              <div className="w-12 h-12 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center mb-5">
                <FileText className="w-6 h-6" />
              </div>
              <h4 className="text-lg font-bold text-white">Devis & Factures Professionnels</h4>
              <p className="mt-2 text-sm text-slate-400">
                Générez des devis soignés en FCFA en 30 secondes. Convertissez-les en facture en un clic dès acceptation.
              </p>
            </div>

            <div className="p-8 rounded-2xl bg-slate-800/50 border border-slate-700/60 hover:border-indigo-500/50 transition-all">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center mb-5">
                <DollarSign className="w-6 h-6" />
              </div>
              <h4 className="text-lg font-bold text-white">Suivi des Paiements</h4>
              <p className="mt-2 text-sm text-slate-400">
                Enregistrez les règlements (Virement, Espèces, Mobile Money Wave/Orange/MTN) avec calcul automatique des soldes restants.
              </p>
            </div>

            <div className="p-8 rounded-2xl bg-slate-800/50 border border-slate-700/60 hover:border-indigo-500/50 transition-all">
              <div className="w-12 h-12 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center mb-5">
                <BellRing className="w-6 h-6" />
              </div>
              <h4 className="text-lg font-bold text-white">Relances Intelligentes</h4>
              <p className="mt-2 text-sm text-slate-400">
                Soyez alerté dès qu&apos;une facture est en retard ou qu&apos;un prospect dort. Relancez en un clic avec nos modèles prêts à l&apos;emploi.
              </p>
            </div>

            <div className="p-8 rounded-2xl bg-slate-800/50 border border-slate-700/60 hover:border-indigo-500/50 transition-all">
              <div className="w-12 h-12 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center mb-5">
                <Bot className="w-6 h-6" />
              </div>
              <h4 className="text-lg font-bold text-white">Assistant BusinessOS AI</h4>
              <p className="mt-2 text-sm text-slate-400">
                Dictez simplement vos actions : &quot;Crée une tâche pour relancer Koffi demain à 10h&quot;. L&apos;IA prépare tout sans inventer de données.
              </p>
            </div>

            <div className="p-8 rounded-2xl bg-slate-800/50 border border-slate-700/60 hover:border-indigo-500/50 transition-all">
              <div className="w-12 h-12 rounded-xl bg-teal-500/20 text-teal-400 flex items-center justify-center mb-5">
                <BarChart3 className="w-6 h-6" />
              </div>
              <h4 className="text-lg font-bold text-white">Rapports & Pilotage Visuel</h4>
              <p className="mt-2 text-sm text-slate-400">
                Visualisez votre chiffre d&apos;affaires réel, les montants dus, vos meilleurs clients et votre taux de conversion en temps réel.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Comment ça fonctionne */}
      <section id="how-it-works" className="py-24 bg-slate-950 border-t border-slate-800/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto">
            <h2 className="text-xs uppercase tracking-wider font-semibold text-blue-400 mb-3">Simplicité</h2>
            <p className="text-3xl sm:text-4xl font-bold text-white">
              Prêt en moins de 3 minutes
            </p>
          </div>

          <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-8 relative">
            <div className="bg-slate-900/60 border border-slate-800 p-8 rounded-2xl relative">
              <div className="text-5xl font-black text-indigo-500/30 mb-4">01</div>
              <h3 className="text-xl font-bold text-white">Créez votre entreprise</h3>
              <p className="mt-2 text-slate-400 text-sm">
                Inscrivez-vous et personnalisez votre profil entreprise en 3 étapes guidées avec votre devise locale (FCFA par défaut).
              </p>
            </div>

            <div className="bg-slate-900/60 border border-slate-800 p-8 rounded-2xl relative">
              <div className="text-5xl font-black text-blue-500/30 mb-4">02</div>
              <h3 className="text-xl font-bold text-white">Gérez vos premiers flux</h3>
              <p className="mt-2 text-slate-400 text-sm">
                Ajoutez vos prospects, générez vos premiers devis professionnels et attribuez des tâches à vos collaborateurs.
              </p>
            </div>

            <div className="bg-slate-900/60 border border-slate-800 p-8 rounded-2xl relative">
              <div className="text-5xl font-black text-teal-500/30 mb-4">03</div>
              <h3 className="text-xl font-bold text-white">Automatisez & Encaissez</h3>
              <p className="mt-2 text-slate-400 text-sm">
                Laissez BusinessOS identifier les retards de paiement, planifier les relances et piloter votre rentabilité.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Tarification */}
      <section id="pricing" className="py-24 bg-slate-900 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto">
            <h2 className="text-xs uppercase tracking-wider font-semibold text-indigo-400 mb-3">Tarifs Transparents</h2>
            <p className="text-3xl sm:text-4xl font-bold text-white">
              Des forfaits adaptés à chaque étape de votre aventure
            </p>
            <p className="mt-4 text-slate-400">
              Commencez gratuitement, passez au forfait supérieur quand votre activité grandit.
            </p>
          </div>

          <div className="mt-16 grid grid-cols-1 lg:grid-cols-3 gap-8 items-stretch">
            {/* Plan FREE */}
            <div className="bg-slate-950/80 border border-slate-800 p-8 rounded-3xl flex flex-col justify-between">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400 bg-slate-800 px-3 py-1 rounded-full">
                  Découverte
                </span>
                <h3 className="text-2xl font-bold text-white mt-4">FREE</h3>
                <p className="text-slate-400 text-sm mt-2">Pour découvrir BusinessOS sans aucun engagement.</p>
                <div className="mt-6 mb-8">
                  <span className="text-4xl font-extrabold text-white">0 FCFA</span>
                  <span className="text-slate-400 text-sm"> / toujours</span>
                </div>

                <ul className="space-y-3.5 text-sm text-slate-300">
                  <li className="flex items-center gap-3">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                    <span>Jusqu&apos;à 15 clients & prospects</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                    <span>5 devis & factures par mois</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                    <span>Gestion des tâches de base</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                    <span>1 utilisateur</span>
                  </li>
                </ul>
              </div>

              <Link 
                href="/register" 
                className="mt-8 block text-center py-3 px-4 rounded-xl border border-slate-700 hover:bg-slate-800 text-white font-medium transition-colors"
              >
                Créer un compte gratuit
              </Link>
            </div>

            {/* Plan PRO */}
            <div className="bg-gradient-to-b from-indigo-950/60 to-slate-950 border-2 border-indigo-500/80 p-8 rounded-3xl flex flex-col justify-between relative shadow-2xl shadow-indigo-600/20">
              <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-indigo-500 text-white text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider shadow">
                Recommandé
              </div>
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-indigo-400 bg-indigo-950/60 px-3 py-1 rounded-full">
                  Populaire
                </span>
                <h3 className="text-2xl font-bold text-white mt-4">PRO</h3>
                <p className="text-slate-300 text-sm mt-2">Pour entrepreneurs et petites entreprises en forte activité.</p>
                <div className="mt-6 mb-8">
                  <span className="text-4xl font-extrabold text-white">15 000 FCFA</span>
                  <span className="text-slate-400 text-sm"> / mois</span>
                </div>

                <ul className="space-y-3.5 text-sm text-slate-200">
                  <li className="flex items-center gap-3">
                    <CheckCircle2 className="w-4 h-4 text-indigo-400 flex-shrink-0" />
                    <span>Clients & prospects illimités</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <CheckCircle2 className="w-4 h-4 text-indigo-400 flex-shrink-0" />
                    <span>Devis & factures illimités avec PDF</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <CheckCircle2 className="w-4 h-4 text-indigo-400 flex-shrink-0" />
                    <span>Module de relances automatiques</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <CheckCircle2 className="w-4 h-4 text-indigo-400 flex-shrink-0" />
                    <span>Assistant BusinessOS AI inclus</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <CheckCircle2 className="w-4 h-4 text-indigo-400 flex-shrink-0" />
                    <span>Jusqu&apos;à 3 collaborateurs</span>
                  </li>
                </ul>
              </div>

              <Link 
                href="/register" 
                className="mt-8 block text-center py-3.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold shadow-lg shadow-indigo-600/30 transition-all"
              >
                Démarrer l&apos;essai gratuit 14 jours
              </Link>
            </div>

            {/* Plan BUSINESS */}
            <div className="bg-slate-950/80 border border-slate-800 p-8 rounded-3xl flex flex-col justify-between">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400 bg-slate-800 px-3 py-1 rounded-full">
                  Équipe & Scale
                </span>
                <h3 className="text-2xl font-bold text-white mt-4">BUSINESS</h3>
                <p className="text-slate-400 text-sm mt-2">Pour PME et agences avec équipes et gestion de rôles avancée.</p>
                <div className="mt-6 mb-8">
                  <span className="text-4xl font-extrabold text-white">35 000 FCFA</span>
                  <span className="text-slate-400 text-sm"> / mois</span>
                </div>

                <ul className="space-y-3.5 text-sm text-slate-300">
                  <li className="flex items-center gap-3">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                    <span>Tout le plan PRO inclus</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                    <span>Utilisateurs illimités avec rôles (Comptable, Employé, Admin)</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                    <span>Multi-entreprises sous un seul compte</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                    <span>Rapports financiers exportables</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                    <span>Support prioritaire dédié 24/7</span>
                  </li>
                </ul>
              </div>

              <Link 
                href="/register" 
                className="mt-8 block text-center py-3 px-4 rounded-xl border border-slate-700 hover:bg-slate-800 text-white font-medium transition-colors"
              >
                Contacter pour l&apos;offre Business
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section id="faq" className="py-24 bg-slate-950 border-t border-slate-800/80">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-xs uppercase tracking-wider font-semibold text-indigo-400 mb-3">FAQ</h2>
            <p className="text-3xl font-bold text-white">Questions fréquentes</p>
          </div>

          <div className="space-y-4">
            {[
              {
                q: "Est-ce adapté aux devises de l'Afrique de l'Ouest (FCFA / XOF) ?",
                a: "Absolument. BusinessOS est conçu par défaut avec la devise FCFA (XOF), avec calcul automatique de la TVA (18%) et gestion des remises. Vous pouvez également configurer d'autres devises si vous travaillez à l'international."
              },
              {
                q: "Mes données d'entreprise sont-elles bien isolées et sécurisées ?",
                a: "Oui. BusinessOS applique une isolation multi-tenant stricte au niveau de la base de données PostgreSQL (Row-Level Security). Vos devis, clients et factures ne peuvent jamais être visualisés par une autre entreprise."
              },
              {
                q: "Puis-je inviter mon comptable ou mes commerciaux ?",
                a: "Oui. Vous pouvez définir des rôles précis : Administrateur, Employé (accès aux tâches et projets) et Comptable (accès aux devis, factures, encaissements et rapports financiers)."
              },
              {
                q: "Puis-je tester avec des données de démonstration sans polluer mon compte ?",
                a: "Exactement. Lorsque vous créez votre espace, vous démarrez avec un tableau de bord propre. Un bouton vous permet de charger des données d'exemple quand vous le souhaitez, et de les réinitialiser à volonté."
              }
            ].map((faq, i) => (
              <div 
                key={i} 
                className="border border-slate-800 rounded-2xl overflow-hidden bg-slate-900/40"
              >
                <button
                  onClick={() => toggleFaq(i)}
                  className="w-full text-left px-6 py-5 flex items-center justify-between font-semibold text-white hover:text-indigo-400 transition-colors"
                >
                  <span>{faq.q}</span>
                  <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform ${openFaq === i ? 'rotate-180 text-indigo-400' : ''}`} />
                </button>
                {openFaq === i && (
                  <div className="px-6 pb-5 text-sm text-slate-400 leading-relaxed border-t border-slate-800/60 pt-4">
                    {faq.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-20 bg-gradient-to-b from-slate-900 to-indigo-950/60 relative overflow-hidden border-t border-slate-800/80">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
          <h2 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight">
            Prêt à transformer la gestion de votre entreprise ?
          </h2>
          <p className="mt-4 text-slate-300 text-lg max-w-2xl mx-auto">
            Rejoignez les entrepreneurs qui automatisent leurs corvées administratives avec BusinessOS.
          </p>
          <div className="mt-10">
            <Link 
              href="/register" 
              className="inline-flex items-center gap-3 text-base font-semibold bg-white text-slate-950 hover:bg-slate-100 px-8 py-4 rounded-xl shadow-2xl transition-all hover:scale-[1.02]"
            >
              <span>Créer mon espace BusinessOS gratuit</span>
              <ArrowRight className="w-5 h-5 text-indigo-600" />
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-800 bg-slate-950 py-12 text-sm text-slate-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center">
              <Layers className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-white text-base">BusinessOS</span>
            <span className="text-xs ml-2 text-slate-400">© 2026 BusinessOS Inc. Tous droits réservés.</span>
          </div>

          <div className="flex items-center gap-6">
            <a href="#features" className="hover:text-slate-300">Fonctionnalités</a>
            <a href="#pricing" className="hover:text-slate-300">Tarifs</a>
            <Link href="/login" className="hover:text-slate-300">Connexion</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
