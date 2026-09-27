'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { createClient } from '@/lib/supabase/client';
import { Membership } from '@/lib/types';
import {
  Users,
  Plus,
  Mail,
  Shield,
  Loader2,
  MoreVertical,
  CheckCircle2,
  AlertCircle,
  Clock,
  Trash2,
  Copy,
  Check,
  X,
  ExternalLink,
  Crown,
  Briefcase,
  Calculator,
  UserCheck,
} from 'lucide-react';
import Link from 'next/link';

const ROLE_LABELS: Record<string, { label: string; desc: string; icon: any; color: string }> = {
  owner: {
    label: 'Propriétaire',
    desc: 'Accès total à l’entreprise, finances et paramètres SaaS.',
    icon: Crown,
    color: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
  },
  admin: {
    label: 'Administrateur',
    desc: 'Gestion opérationnelle, équipe, invitations et finances.',
    icon: Shield,
    color: 'bg-indigo-500/10 text-indigo-600 border-indigo-500/20',
  },
  manager: {
    label: 'Manager',
    desc: 'Supervision commerciale et financière de l’activité.',
    icon: Briefcase,
    color: 'bg-purple-500/10 text-purple-600 border-purple-500/20',
  },
  commercial: {
    label: 'Commercial',
    desc: 'Gestion des prospects, clients, devis et opportunités.',
    icon: UserCheck,
    color: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
  },
  accountant: {
    label: 'Comptable',
    desc: 'Gestion des factures, paiements et rapports financiers.',
    icon: Calculator,
    color: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
  },
  comptable: {
    label: 'Comptable',
    desc: 'Gestion des factures, paiements et rapports financiers.',
    icon: Calculator,
    color: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
  },
  employee: {
    label: 'Employé',
    desc: 'Accès limité aux tâches et activités assignées.',
    icon: Users,
    color: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700',
  },
};

export default function TeamPage() {
  const { currentCompany, currentRole, session } = useAuth();
  const supabase = createClient();

  const [members, setMembers] = useState<Membership[]>([]);
  const [invitations, setInvitations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Invite Modal State
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('commercial');
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [limitReached, setLimitReached] = useState(false);
  const [inviteSuccessLink, setInviteSuccessLink] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  // Role Edit Modal State
  const [editingMember, setEditingMember] = useState<Membership | null>(null);
  const [newRole, setNewRole] = useState('');
  const [updatingRole, setUpdatingRole] = useState(false);

  const fetchTeam = async () => {
    if (!currentCompany?.id) return;
    setLoading(true);

    try {
      // 1. Fetch active memberships
      const { data: memData } = await supabase
        .from('memberships')
        .select('*, user:users(*)')
        .eq('company_id', currentCompany.id);

      if (memData) setMembers(memData as unknown as Membership[]);

      // 2. Fetch pending invitations
      if (session?.access_token) {
        const invRes = await fetch('/api/team/invitations', {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        if (invRes.ok) {
          const invJson = await invRes.json();
          setInvitations(invJson.invitations || []);
        }
      }
    } catch (err) {
      console.error('Error loading team data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTeam();
  }, [currentCompany?.id, session?.access_token]);

  const canManageTeam = currentRole === 'owner' || currentRole === 'admin';

  // Send invitation handler
  const handleSendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session?.access_token || !inviteEmail) return;

    setInviting(true);
    setInviteError(null);
    setLimitReached(false);
    setInviteSuccessLink(null);

    try {
      const res = await fetch('/api/team/invite', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        setInviteError(data.error || 'Erreur lors de l’envoi de l’invitation.');
        if (data.limit_reached) {
          setLimitReached(true);
        }
        return;
      }

      setInviteSuccessLink(data.invitation?.invite_url || `${window.location.origin}/invite/${data.invitation?.token}`);
      setInviteEmail('');
      await fetchTeam();
    } catch (err: any) {
      setInviteError(err.message || 'Erreur de connexion.');
    } finally {
      setInviting(false);
    }
  };

  // Change member role handler
  const handleUpdateRole = async () => {
    if (!editingMember || !newRole || !session?.access_token) return;
    setUpdatingRole(true);

    try {
      const res = await fetch(`/api/team/members/${editingMember.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ role: newRole }),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        alert(data.error || 'Erreur lors de la modification du rôle.');
      } else {
        setEditingMember(null);
        await fetchTeam();
      }
    } catch (err: any) {
      alert(err.message);
    } finally {
      setUpdatingRole(false);
    }
  };

  // Revoke invitation handler
  const handleRevokeInvitation = async (id: string) => {
    if (!session?.access_token || !confirm('Révoquer cette invitation ?')) return;

    try {
      const res = await fetch(`/api/team/invitations?id=${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (res.ok) {
        await fetchTeam();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Delete member handler
  const handleDeleteMember = async (memberId: string, role: string) => {
    if (role === 'owner') {
      alert('Impossible de supprimer le propriétaire.');
      return;
    }
    if (!session?.access_token || !confirm('Retirer ce collaborateur de l’entreprise ?')) return;

    try {
      const res = await fetch(`/api/team/members/${memberId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (res.ok) {
        await fetchTeam();
      } else {
        const data = await res.json();
        alert(data.error || 'Erreur de suppression.');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              Collaborateurs & Équipe
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-500/10 text-indigo-600 border border-indigo-500/20">
              {members.length} membre{members.length > 1 ? 's' : ''}
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Gérez les accès, rôles opérationnels et invitations de votre organisation dans {currentCompany?.name}.
          </p>
        </div>

        {canManageTeam && (
          <button
            onClick={() => {
              setInviteModalOpen(true);
              setInviteError(null);
              setInviteSuccessLink(null);
              setLimitReached(false);
            }}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl shadow-md shadow-indigo-600/20 transition-all self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" />
            <span>Inviter un collaborateur</span>
          </button>
        )}
      </div>

      {loading ? (
        <div className="p-12 text-center text-slate-400">
          <Loader2 className="w-7 h-7 animate-spin mx-auto text-indigo-500 mb-2" />
          <span className="text-xs">Chargement de l&apos;équipe...</span>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Active Members Table */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-sm">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <h2 className="text-xs font-extrabold uppercase tracking-wider text-slate-500">
                Membres Actifs ({members.length})
              </h2>
            </div>

            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {members.map((mem) => {
                const roleMeta = ROLE_LABELS[mem.role] || ROLE_LABELS.employee;
                const Icon = roleMeta.icon;

                return (
                  <div key={mem.id} className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3.5">
                      <div className="w-10 h-10 rounded-2xl bg-indigo-600/10 text-indigo-600 font-bold flex items-center justify-center text-sm shadow-inner">
                        {mem.user?.first_name ? mem.user.first_name[0] : (mem.user?.email?.[0] || 'U').toUpperCase()}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                            {mem.user?.full_name || mem.user?.email || 'Membre'}
                          </h4>
                          {mem.role === 'owner' && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded-full">
                              <Crown className="w-3 h-3" />
                              <span>Owner</span>
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          {mem.user?.email}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 self-end sm:self-auto">
                      <div className="text-right hidden md:block">
                        <span className="text-[10px] text-slate-400 block">Permissions</span>
                        <span className="text-[11px] text-slate-500 max-w-[200px] truncate block">
                          {roleMeta.desc}
                        </span>
                      </div>

                      <span
                        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold border ${roleMeta.color}`}
                      >
                        <Icon className="w-3.5 h-3.5" />
                        <span>{roleMeta.label}</span>
                      </span>

                      {canManageTeam && mem.role !== 'owner' && (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => {
                              setEditingMember(mem);
                              setNewRole(mem.role);
                            }}
                            className="px-2.5 py-1 text-[11px] font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                          >
                            Modifier rôle
                          </button>
                          <button
                            onClick={() => handleDeleteMember(mem.id, mem.role)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg transition-colors"
                            title="Retirer le collaborateur"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Pending Invitations Section */}
          {invitations.length > 0 && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-sm">
              <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-amber-500" />
                  <h2 className="text-xs font-extrabold uppercase tracking-wider text-slate-500">
                    Invitations en Attente ({invitations.length})
                  </h2>
                </div>
              </div>

              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {invitations.map((inv) => (
                  <div key={inv.id} className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-900 dark:text-white">
                          {inv.email}
                        </span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-600 border border-amber-500/20">
                          En attente
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400">
                        Rôle prévu : <strong className="capitalize">{inv.role}</strong> • Expire le{' '}
                        {new Date(inv.expires_at).toLocaleDateString('fr-FR')}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-auto">
                      <button
                        onClick={() => copyToClipboard(`${window.location.origin}/invite/${inv.token}`)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 transition-colors"
                      >
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copier lien</span>
                      </button>

                      {canManageTeam && (
                        <button
                          onClick={() => handleRevokeInvitation(inv.id)}
                          className="px-3 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-xl transition-colors"
                        >
                          Révoquer
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Invite Member Modal */}
      {inviteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl relative space-y-4">
            <button
              onClick={() => setInviteModalOpen(false)}
              className="absolute top-5 right-5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              <X className="w-5 h-5" />
            </button>

            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-500">
                Gestion des Accès
              </span>
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white mt-1">
                Inviter un Nouveau Collaborateur
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Le collaborateur recevra un lien sécurisé pour rejoindre l’espace de {currentCompany?.name}.
              </p>
            </div>

            {inviteSuccessLink ? (
              <div className="space-y-4 pt-2">
                <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                  <span className="font-bold">Invitation créée avec succès !</span>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block">
                    Lien d&apos;invitation direct :
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value={inviteSuccessLink}
                      className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono select-all"
                    />
                    <button
                      type="button"
                      onClick={() => copyToClipboard(inviteSuccessLink)}
                      className="p-2.5 rounded-xl bg-indigo-600 text-white hover:bg-indigo-500 shadow flex-shrink-0 transition-colors"
                      title="Copier"
                    >
                      {copiedLink ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="pt-2 flex justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      setInviteModalOpen(false);
                      setInviteSuccessLink(null);
                    }}
                    className="px-5 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold shadow hover:bg-indigo-500"
                  >
                    Fermer
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSendInvite} className="space-y-4 pt-2">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Adresse Email professionnelle
                  </label>
                  <input
                    type="email"
                    required
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="collaborateur@entreprise.com"
                    className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Rôle & Permissions
                  </label>
                  <select
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value)}
                    className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 outline-none"
                  >
                    <option value="admin">Administrateur (Gestion équipe, CRM et Finances)</option>
                    <option value="manager">Manager (Supervision commerciale & financière)</option>
                    <option value="commercial">Commercial (Clients, Prospects, Devis)</option>
                    <option value="comptable">Comptable (Factures, Paiements, Rapports)</option>
                    <option value="employee">Employé (Accès restreint aux tâches)</option>
                  </select>
                </div>

                {inviteError && (
                  <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-600 text-xs space-y-2">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                      <span>{inviteError}</span>
                    </div>
                    {limitReached && (
                      <Link
                        href="/billing"
                        className="inline-flex items-center gap-1.5 font-bold text-indigo-600 dark:text-indigo-400 hover:underline pt-1 block"
                      >
                        <span>Voir les abonnements pour augmenter votre quota</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </Link>
                    )}
                  </div>
                )}

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setInviteModalOpen(false)}
                    className="px-4 py-2 border rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-50"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    disabled={inviting}
                    className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow flex items-center gap-1.5 transition-all disabled:opacity-50"
                  >
                    {inviting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    <span>Envoyer l&apos;invitation</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Role Edit Modal */}
      {editingMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl relative space-y-4">
            <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
              Modifier le rôle de {editingMember.user?.full_name || editingMember.user?.email}
            </h3>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block">
                Nouveau rôle opérationnel :
              </label>
              <select
                value={newRole}
                onChange={(e) => setNewRole(e.target.value)}
                className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 outline-none"
              >
                <option value="admin">Administrateur</option>
                <option value="manager">Manager</option>
                <option value="commercial">Commercial</option>
                <option value="comptable">Comptable</option>
                <option value="employee">Employé</option>
              </select>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEditingMember(null)}
                className="px-4 py-2 border rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleUpdateRole}
                disabled={updatingRole}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow flex items-center gap-1.5 transition-all disabled:opacity-50"
              >
                {updatingRole && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Enregistrer</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
