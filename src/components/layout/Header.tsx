'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { createClient } from '@/lib/supabase/client';
import { AppNotification, Lead, Customer } from '@/lib/types';
import { 
  Bell, 
  Plus, 
  Menu, 
  Search, 
  Check, 
  ExternalLink, 
  Building, 
  AlertTriangle, 
  Info, 
  CheckCircle2, 
  X,
  UserPlus,
  Users,
  Command,
  Loader2,
  ArrowRight
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface HeaderProps {
  onOpenMobileMenu: () => void;
  onOpenQuickAction: () => void;
}

export default function Header({ onOpenMobileMenu, onOpenQuickAction }: HeaderProps) {
  const { profile, currentCompany } = useAuth();
  const router = useRouter();
  const supabase = createClient();

  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotifMenu, setShowNotifMenu] = useState(false);

  // Global search modal
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [leadResults, setLeadResults] = useState<Lead[]>([]);
  const [customerResults, setCustomerResults] = useState<Customer[]>([]);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Keyboard shortcut Ctrl+K / Cmd+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen((prev) => !prev);
      }
      if (e.key === 'Escape' && searchOpen) {
        setSearchOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [searchOpen]);

  // Focus input when modal opens
  useEffect(() => {
    if (searchOpen) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 100);
    } else {
      setSearchQuery('');
      setLeadResults([]);
      setCustomerResults([]);
    }
  }, [searchOpen]);

  // Live search query
  useEffect(() => {
    if (!currentCompany?.id || !searchQuery.trim()) {
      setLeadResults([]);
      setCustomerResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setSearching(true);
      const query = searchQuery.trim();

      // Search leads
      const { data: leads } = await supabase
        .from('leads')
        .select('*')
        .eq('company_id', currentCompany.id)
        .or(`name.ilike.%${query}%,company_name.ilike.%${query}%,email.ilike.%${query}%,phone.ilike.%${query}%`)
        .limit(5);

      // Search customers
      const { data: customers } = await supabase
        .from('customers')
        .select('*')
        .eq('company_id', currentCompany.id)
        .or(`name.ilike.%${query}%,company_name.ilike.%${query}%,email.ilike.%${query}%,phone.ilike.%${query}%`)
        .limit(5);

      if (leads) setLeadResults(leads as Lead[]);
      if (customers) setCustomerResults(customers as Customer[]);
      setSearching(false);
    }, 200);

    return () => clearTimeout(timer);
  }, [searchQuery, currentCompany?.id, supabase]);

  // Notifications
  useEffect(() => {
    if (!currentCompany?.id) return;

    const fetchNotifications = async () => {
      const { data } = await supabase
        .from('notifications')
        .select('*')
        .eq('company_id', currentCompany.id)
        .order('created_at', { ascending: false })
        .limit(10);

      if (data) {
        setNotifications(data as AppNotification[]);
        setUnreadCount(data.filter((n) => !n.is_read).length);
      }
    };

    fetchNotifications();

    const channel = supabase
      .channel('header_notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `company_id=eq.${currentCompany.id}`,
        },
        (payload) => {
          setNotifications((prev) => [payload.new as AppNotification, ...prev]);
          setUnreadCount((c) => c + 1);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentCompany?.id, supabase]);

  const markAllAsRead = async () => {
    if (!currentCompany?.id) return;
    await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('company_id', currentCompany.id);

    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    setUnreadCount(0);
  };

  const getNotifIcon = (type: string) => {
    switch (type) {
      case 'danger':
        return <AlertTriangle className="w-4 h-4 text-rose-500" />;
      case 'warning':
        return <AlertTriangle className="w-4 h-4 text-amber-500" />;
      case 'success':
        return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
      default:
        return <Info className="w-4 h-4 text-blue-500" />;
    }
  };

  return (
    <>
      <header className="h-16 border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-950/80 backdrop-blur-md sticky top-0 z-30 px-4 sm:px-8 flex items-center justify-between">
        {/* Left: Mobile trigger & Greeting */}
        <div className="flex items-center gap-3">
          <button
            onClick={onOpenMobileMenu}
            className="p-2 -ml-2 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white rounded-lg lg:hidden"
          >
            <Menu className="w-5 h-5" />
          </button>

          <div className="flex flex-col">
            <h1 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <span>Bonjour {profile?.first_name || 'Entrepreneur'} 👋</span>
            </h1>
            <span className="text-xs text-slate-500 hidden sm:inline">
              Espace {currentCompany?.name || 'chargement...'}
            </span>
          </div>
        </div>

        {/* Center: Global Search Trigger Button */}
        <div className="hidden md:flex items-center flex-1 max-w-sm mx-6">
          <button
            onClick={() => setSearchOpen(true)}
            className="w-full py-2 px-3.5 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 flex items-center justify-between transition-colors shadow-sm"
          >
            <div className="flex items-center gap-2">
              <Search className="w-3.5 h-3.5" />
              <span>Rechercher un prospect, client...</span>
            </div>
            <kbd className="hidden sm:inline-flex items-center gap-0.5 text-[10px] font-mono bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-1.5 py-0.5 rounded text-slate-400">
              ⌘K
            </kbd>
          </button>
        </div>

        {/* Right actions */}
        <div className="flex items-center gap-3">
          {/* Mobile search trigger */}
          <button
            onClick={() => setSearchOpen(true)}
            className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-900 transition-colors md:hidden"
            title="Rechercher"
          >
            <Search className="w-4 h-4" />
          </button>

          {/* Quick Action Button */}
          <button
            onClick={onOpenQuickAction}
            className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold px-3.5 py-2 rounded-xl shadow-md shadow-indigo-600/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Créer rapidement</span>
          </button>

          {/* Notifications Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowNotifMenu(!showNotifMenu)}
              className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-900 transition-colors relative"
              title="Notifications"
            >
              <Bell className="w-4 h-4" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-rose-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center animate-pulse">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>

            {showNotifMenu && (
              <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-4 z-50 animate-in fade-in zoom-in-95 duration-150">
                <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-slate-900 dark:text-white">Notifications</span>
                    {unreadCount > 0 && (
                      <span className="bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 text-xs px-2 py-0.5 rounded-full font-semibold">
                        {unreadCount} non lue{unreadCount > 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                  {unreadCount > 0 && (
                    <button
                      onClick={markAllAsRead}
                      className="text-[11px] font-medium text-indigo-500 hover:text-indigo-600 transition-colors"
                    >
                      Tout marquer comme lu
                    </button>
                  )}
                </div>

                <div className="divide-y divide-slate-100 dark:divide-slate-800/80 max-h-80 overflow-y-auto mt-2">
                  {notifications.length === 0 ? (
                    <div className="py-8 text-center text-slate-400 text-xs">
                      Aucune notification pour le moment.
                    </div>
                  ) : (
                    notifications.map((notif) => (
                      <div
                        key={notif.id}
                        className={`py-3 px-2 flex items-start gap-3 rounded-xl transition-colors ${
                          !notif.is_read ? 'bg-indigo-50/50 dark:bg-indigo-950/20' : ''
                        }`}
                      >
                        <div className="mt-0.5 flex-shrink-0">{getNotifIcon(notif.type)}</div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-slate-900 dark:text-white">{notif.title}</p>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">{notif.message}</p>
                          {notif.link && (
                            <Link
                              href={notif.link}
                              onClick={() => setShowNotifMenu(false)}
                              className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-500 hover:underline mt-1.5"
                            >
                              <span>Consulter</span>
                              <ExternalLink className="w-3 h-3" />
                            </Link>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
                <div className="pt-2.5 mt-2 border-t border-slate-100 dark:border-slate-800 text-center">
                  <Link
                    href="/notifications"
                    onClick={() => setShowNotifMenu(false)}
                    className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
                  >
                    Voir toutes les notifications →
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Global CRM Search Modal (Cmd+K) */}
      {searchOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-16 sm:pt-24 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-xl w-full shadow-2xl overflow-hidden relative">
            {/* Search Input Bar */}
            <div className="flex items-center px-4 py-3.5 border-b border-slate-200 dark:border-slate-800">
              <Search className="w-5 h-5 text-indigo-500 mr-3 flex-shrink-0" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Rechercher par nom, entreprise, email, téléphone..."
                className="w-full bg-transparent text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none"
              />
              {searching ? (
                <Loader2 className="w-4 h-4 animate-spin text-slate-400 ml-2" />
              ) : searchQuery ? (
                <button
                  onClick={() => setSearchQuery('')}
                  className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-white ml-2"
                >
                  <X className="w-4 h-4" />
                </button>
              ) : (
                <kbd className="text-[10px] font-mono bg-slate-100 dark:bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded ml-2">
                  ESC
                </kbd>
              )}
            </div>

            {/* Results Body */}
            <div className="max-h-96 overflow-y-auto p-3 divide-y divide-slate-100 dark:divide-slate-800/60">
              {!searchQuery.trim() ? (
                <div className="py-8 text-center text-xs text-slate-400">
                  Tapez au moins une lettre pour chercher parmi vos prospects et clients...
                </div>
              ) : leadResults.length === 0 && customerResults.length === 0 && !searching ? (
                <div className="py-8 text-center text-xs text-slate-400">
                  Aucun résultat trouvé pour &quot;{searchQuery}&quot;.
                </div>
              ) : (
                <>
                  {/* Prospects Results */}
                  {leadResults.length > 0 && (
                    <div className="pb-3">
                      <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider px-2 py-1 block">
                        Prospects ({leadResults.length})
                      </span>
                      <div className="mt-1 space-y-1">
                        {leadResults.map((lead) => (
                          <div
                            key={lead.id}
                            onClick={() => {
                              setSearchOpen(false);
                              router.push(`/leads/${lead.id}`);
                            }}
                            className="p-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-between cursor-pointer group transition-colors"
                          >
                            <div className="flex items-center gap-3 truncate">
                              <span className="px-2 py-0.5 rounded-md text-[9px] font-bold uppercase bg-indigo-500/15 text-indigo-600 dark:text-indigo-400">
                                PROSPECT
                              </span>
                              <div className="truncate">
                                <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                                  {lead.name}
                                </p>
                                <p className="text-[11px] text-slate-400 truncate">
                                  {lead.company_name || 'Particulier'} • {lead.phone || lead.email || lead.source}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">
                                {Number(lead.potential_amount || 0).toLocaleString('fr-FR')}{' '}
                                {currentCompany?.currency || 'FCFA'}
                              </span>
                              <ArrowRight className="w-3.5 h-3.5 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Customers Results */}
                  {customerResults.length > 0 && (
                    <div className="pt-3">
                      <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider px-2 py-1 block">
                        Clients ({customerResults.length})
                      </span>
                      <div className="mt-1 space-y-1">
                        {customerResults.map((cust) => (
                          <div
                            key={cust.id}
                            onClick={() => {
                              setSearchOpen(false);
                              router.push(`/customers/${cust.id}`);
                            }}
                            className="p-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-between cursor-pointer group transition-colors"
                          >
                            <div className="flex items-center gap-3 truncate">
                              <span className="px-2 py-0.5 rounded-md text-[9px] font-bold uppercase bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                                CLIENT
                              </span>
                              <div className="truncate">
                                <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                                  {cust.name}
                                </p>
                                <p className="text-[11px] text-slate-400 truncate">
                                  {cust.company_name || 'Particulier'} • {cust.city || 'Abidjan'} • {cust.phone || cust.email || ''}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                                Facturé : {Number(cust.total_invoiced || 0).toLocaleString('fr-FR')}{' '}
                                {currentCompany?.currency || 'FCFA'}
                              </span>
                              <ArrowRight className="w-3.5 h-3.5 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-3 bg-slate-50 dark:bg-slate-800/60 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-400 px-4">
              <span>Navigation instantanée</span>
              <button
                onClick={() => setSearchOpen(false)}
                className="hover:text-slate-600 dark:hover:text-white"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
