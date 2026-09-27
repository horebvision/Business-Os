'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { Building2, Shield, CheckCircle2, AlertCircle, Loader2, ArrowRight } from 'lucide-react';
import Link from 'next/link';

export default function InviteAcceptancePage() {
  const params = useParams();
  const token = params?.token as string;
  const router = useRouter();
  const { user, session } = useAuth();

  const [loading, setLoading] = useState(true);
  const [invitation, setInvitation] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [accepting, setAccepting] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;

    const verifyToken = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/team/invite/verify?token=${token}`);
        const data = await res.json();

        if (!res.ok || data.error) {
          setError(data.error || 'Invitation invalide.');
        } else {
          setInvitation(data.invitation);
        }
      } catch (err: any) {
        setError('Erreur de communication avec le serveur.');
      } finally {
        setLoading(false);
      }
    };

    verifyToken();
  }, [token]);

  const handleAccept = async () => {
    if (!session?.access_token) return;
    setAccepting(true);
    setError(null);

    try {
      const res = await fetch('/api/team/invite/accept', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ token }),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        setError(data.error || 'Erreur lors de l’acceptation de l’invitation.');
      } else {
        setSuccessMsg(data.message || 'Invitation acceptée ! Redirection en cours...');
        setTimeout(() => {
          router.push('/dashboard');
        }, 1500);
      }
    } catch (err: any) {
      setError(err.message || 'Erreur réseau.');
    } finally {
      setAccepting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-6">
        <div className="text-center space-y-3">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-indigo-500" />
          <p className="text-xs text-slate-500 font-medium">Vérification de l&apos;invitation...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-8 shadow-xl space-y-6 text-center">
        <div className="w-14 h-14 rounded-2xl bg-indigo-600/10 text-indigo-600 flex items-center justify-center mx-auto shadow-inner">
          <Building2 className="w-7 h-7" />
        </div>

        {error ? (
          <div className="space-y-3">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-500/10 text-rose-600">
              <AlertCircle className="w-4 h-4" />
              <span>Invitation Invalide</span>
            </div>
            <h2 className="text-xl font-extrabold text-slate-900 dark:text-white">
              Impossible d&apos;accéder à cette invitation
            </h2>
            <p className="text-xs text-slate-500 leading-relaxed">{error}</p>
            <div className="pt-4">
              <Link
                href="/login"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 text-white text-xs font-bold shadow hover:bg-indigo-500 transition-all"
              >
                <span>Retour à la connexion</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        ) : invitation?.isAccepted ? (
          <div className="space-y-3">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-600">
              <CheckCircle2 className="w-4 h-4" />
              <span>Déjà Acceptée</span>
            </div>
            <h2 className="text-xl font-extrabold text-slate-900 dark:text-white">
              Invitation déjà utilisée
            </h2>
            <p className="text-xs text-slate-500 leading-relaxed">
              Cette invitation pour rejoindre <strong>{invitation.company?.name}</strong> a déjà été acceptée.
            </p>
            <div className="pt-4">
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 text-white text-xs font-bold shadow hover:bg-indigo-500 transition-all"
              >
                <span>Accéder à mon espace</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        ) : invitation?.isExpired ? (
          <div className="space-y-3">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/10 text-amber-600">
              <AlertCircle className="w-4 h-4" />
              <span>Invitation Expirée</span>
            </div>
            <h2 className="text-xl font-extrabold text-slate-900 dark:text-white">
              Délai dépassé
            </h2>
            <p className="text-xs text-slate-500 leading-relaxed">
              Ce lien d&apos;invitation a expiré. Veuillez contacter un administrateur de {invitation.company?.name} pour recevoir une nouvelle invitation.
            </p>
          </div>
        ) : (
          <div className="space-y-5">
            <div>
              <span className="text-[11px] uppercase font-bold text-indigo-500 tracking-wider">
                Invitation d&apos;équipe
              </span>
              <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white mt-1">
                Rejoignez {invitation.company?.name}
              </h2>
              <p className="text-xs text-slate-500 mt-2">
                Vous avez été invité à collaborer sur BusinessOS avec le rôle :
              </p>
              <div className="mt-3 inline-block px-3.5 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider bg-slate-100 dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                {invitation.role}
              </div>
            </div>

            {successMsg ? (
              <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 text-xs font-bold flex items-center justify-center gap-2">
                <CheckCircle2 className="w-4 h-4" />
                <span>{successMsg}</span>
              </div>
            ) : user ? (
              <div className="space-y-3 pt-2">
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  Connecté en tant que <strong>{user.email}</strong>
                </p>
                <button
                  type="button"
                  onClick={handleAccept}
                  disabled={accepting}
                  className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-2xl shadow-lg shadow-indigo-600/20 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                >
                  {accepting && <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>Accepter et Rejoindre l&apos;Entreprise</span>
                </button>
              </div>
            ) : (
              <div className="space-y-3 pt-2">
                <p className="text-xs text-slate-500">
                  Connectez-vous ou créez un compte pour accepter cette invitation.
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <Link
                    href={`/login?email=${encodeURIComponent(invitation.email)}&next=/invite/${token}`}
                    className="py-2.5 px-3 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 transition-colors"
                  >
                    Se connecter
                  </Link>
                  <Link
                    href={`/register?email=${encodeURIComponent(invitation.email)}&next=/invite/${token}`}
                    className="py-2.5 px-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold shadow transition-all"
                  >
                    Créer un compte
                  </Link>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
