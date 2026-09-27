'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { createClient } from '@/lib/supabase/client';
import { AppNotification } from '@/lib/types';
import {
  Bell,
  CheckCircle2,
  Filter,
  Receipt,
  FileSpreadsheet,
  CheckSquare,
  Bot,
  Info,
  Users,
  CreditCard,
  ExternalLink,
  Loader2,
  Trash2,
  Clock,
} from 'lucide-react';
import Link from 'next/link';

type NotificationFilterType =
  | 'all'
  | 'financial'
  | 'commercial'
  | 'task'
  | 'automation'
  | 'system'
  | 'team'
  | 'subscription';

const TYPE_CONFIG: Record<
  string,
  { label: string; icon: any; color: string; defaultLink: string }
> = {
  financial: {
    label: 'Finance',
    icon: Receipt,
    color: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
    defaultLink: '/invoices',
  },
  commercial: {
    label: 'Commercial',
    icon: FileSpreadsheet,
    color: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
    defaultLink: '/quotes',
  },
  task: {
    label: 'Tâche',
    icon: CheckSquare,
    color: 'bg-purple-500/10 text-purple-600 border-purple-500/20',
    defaultLink: '/dashboard',
  },
  automation: {
    label: 'Automatisation',
    icon: Bot,
    color: 'bg-indigo-500/10 text-indigo-600 border-indigo-500/20',
    defaultLink: '/automations',
  },
  team: {
    label: 'Équipe',
    icon: Users,
    color: 'bg-cyan-500/10 text-cyan-600 border-cyan-500/20',
    defaultLink: '/team',
  },
  subscription: {
    label: 'Abonnement',
    icon: CreditCard,
    color: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
    defaultLink: '/billing',
  },
  system: {
    label: 'Système',
    icon: Info,
    color: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700',
    defaultLink: '/dashboard',
  },
};

export default function NotificationsCenterPage() {
  const { currentCompany } = useAuth();
  const supabase = createClient();

  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<NotificationFilterType>('all');
  const [markingAll, setMarkingAll] = useState(false);

  const fetchNotifications = async () => {
    if (!currentCompany?.id) return;
    setLoading(true);

    try {
      const { data } = await supabase
        .from('notifications')
        .select('*')
        .eq('company_id', currentCompany.id)
        .order('created_at', { ascending: false });

      if (data) {
        setNotifications(data as AppNotification[]);
      }
    } catch (err) {
      console.error('Error fetching notifications:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, [currentCompany?.id]);

  // Mark all as read
  const handleMarkAllRead = async () => {
    if (!currentCompany?.id) return;
    setMarkingAll(true);

    try {
      await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('company_id', currentCompany.id)
        .eq('is_read', false);

      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    } catch (err) {
      console.error(err);
    } finally {
      setMarkingAll(false);
    }
  };

  // Toggle single notification read state
  const handleToggleRead = async (id: string, currentRead: boolean) => {
    try {
      await supabase
        .from('notifications')
        .update({ is_read: !currentRead })
        .eq('id', id);

      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: !currentRead } : n))
      );
    } catch (err) {
      console.error(err);
    }
  };

  const filteredNotifications = notifications.filter((n) => {
    if (activeFilter === 'all') return true;
    return n.type === activeFilter;
  });

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
              Centre de Notifications
            </h1>
            {unreadCount > 0 && (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-500/10 text-indigo-600 border border-indigo-500/20">
                {unreadCount} non lue{unreadCount > 1 ? 's' : ''}
              </span>
            )}
          </div>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Événements opérationnels, alertes financières, relances et activité d&apos;équipe.
          </p>
        </div>

        {unreadCount > 0 && (
          <button
            onClick={handleMarkAllRead}
            disabled={markingAll}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-300 transition-colors self-start sm:self-auto disabled:opacity-50"
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-indigo-500" />
            <span>{markingAll ? 'Mise à jour...' : 'Tout marquer comme lu'}</span>
          </button>
        )}
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
        <button
          onClick={() => setActiveFilter('all')}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
            activeFilter === 'all'
              ? 'bg-indigo-600 text-white shadow'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          Tous ({notifications.length})
        </button>

        <button
          onClick={() => setActiveFilter('financial')}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
            activeFilter === 'financial'
              ? 'bg-indigo-600 text-white shadow'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Receipt className="w-3.5 h-3.5" />
          <span>Finances</span>
        </button>

        <button
          onClick={() => setActiveFilter('commercial')}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
            activeFilter === 'commercial'
              ? 'bg-indigo-600 text-white shadow'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <FileSpreadsheet className="w-3.5 h-3.5" />
          <span>Commercial</span>
        </button>

        <button
          onClick={() => setActiveFilter('team')}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
            activeFilter === 'team'
              ? 'bg-indigo-600 text-white shadow'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          <span>Équipe</span>
        </button>

        <button
          onClick={() => setActiveFilter('subscription')}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
            activeFilter === 'subscription'
              ? 'bg-indigo-600 text-white shadow'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <CreditCard className="w-3.5 h-3.5" />
          <span>Abonnement</span>
        </button>

        <button
          onClick={() => setActiveFilter('task')}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
            activeFilter === 'task'
              ? 'bg-indigo-600 text-white shadow'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <CheckSquare className="w-3.5 h-3.5" />
          <span>Tâches</span>
        </button>

        <button
          onClick={() => setActiveFilter('automation')}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
            activeFilter === 'automation'
              ? 'bg-indigo-600 text-white shadow'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Bot className="w-3.5 h-3.5" />
          <span>Automatisations</span>
        </button>
      </div>

      {loading ? (
        <div className="p-16 text-center text-slate-400">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-indigo-500 mb-3" />
          <p className="text-xs">Chargement de vos notifications...</p>
        </div>
      ) : filteredNotifications.length === 0 ? (
        <div className="p-12 text-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl">
          <Bell className="w-10 h-10 text-slate-300 mx-auto mb-2" />
          <h3 className="text-xs font-bold text-slate-700 dark:text-slate-300">
            Aucune notification dans cette catégorie
          </h3>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Vous serez alerté ici des événements importants de votre entreprise.
          </p>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-sm divide-y divide-slate-100 dark:divide-slate-800">
          {filteredNotifications.map((notif) => {
            const config = TYPE_CONFIG[notif.type] || TYPE_CONFIG.system;
            const Icon = config.icon;
            const targetLink = notif.link || config.defaultLink;

            return (
              <div
                key={notif.id}
                className={`p-4 sm:p-5 flex items-start justify-between gap-4 transition-colors ${
                  !notif.is_read ? 'bg-indigo-50/30 dark:bg-indigo-950/20' : ''
                }`}
              >
                <div className="flex items-start gap-3.5">
                  <div
                    className={`w-9 h-9 rounded-2xl flex items-center justify-center font-bold flex-shrink-0 border ${config.color}`}
                  >
                    <Icon className="w-4 h-4" />
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-900 dark:text-white">
                        {notif.title}
                      </span>
                      {!notif.is_read && (
                        <span className="w-2 h-2 rounded-full bg-indigo-600 flex-shrink-0" />
                      )}
                    </div>

                    <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                      {notif.message}
                    </p>

                    <div className="flex items-center gap-3 pt-1">
                      <span className="text-[10px] text-slate-400 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(notif.created_at).toLocaleDateString('fr-FR', {
                          day: 'numeric',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>

                      {targetLink && (
                        <Link
                          href={targetLink}
                          className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline inline-flex items-center gap-1"
                        >
                          <span>Voir le détail</span>
                          <ExternalLink className="w-3 h-3" />
                        </Link>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => handleToggleRead(notif.id, notif.is_read)}
                    className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    title={notif.is_read ? 'Marquer non lu' : 'Marquer comme lu'}
                  >
                    <CheckCircle2
                      className={`w-4 h-4 ${notif.is_read ? 'text-slate-300' : 'text-indigo-600'}`}
                    />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
