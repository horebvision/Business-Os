'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import {
  LayoutDashboard,
  CheckSquare,
  History,
  UserPlus,
  Users,
  Kanban,
  FileSpreadsheet,
  Receipt,
  Wallet,
  Building2,
  FolderOpen,
  BarChart3,
  Zap,
  Bot,
  Settings,
  LogOut,
  ChevronDown,
  Layers,
  Sparkles,
  BellRing,
  TrendingUp,
  CreditCard,
  ShieldCheck
} from 'lucide-react';

interface SidebarProps {
  mobileOpen: boolean;
  setMobileOpen: (open: boolean) => void;
}

export default function Sidebar({ mobileOpen, setMobileOpen }: SidebarProps) {
  const pathname = usePathname();
  const { currentCompany, companies, switchCompany, profile, currentRole, signOut } = useAuth();

  const navigationGroups = [
    {
      title: 'PRINCIPAL',
      items: [
        { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
        { name: 'Analytics', href: '/analytics', icon: TrendingUp },
        { name: 'Tâches', href: '/tasks', icon: CheckSquare },
        { name: 'Activité', href: '/activity', icon: History },
      ],
    },
    {
      title: 'COMMERCIAL',
      items: [
        { name: 'Prospects', href: '/leads', icon: UserPlus },
        { name: 'Clients', href: '/customers', icon: Users },
        { name: 'Pipeline', href: '/pipeline', icon: Kanban },
      ],
    },
    {
      title: 'FINANCES',
      items: [
        { name: 'Devis', href: '/quotes', icon: FileSpreadsheet },
        { name: 'Factures', href: '/invoices', icon: Receipt },
        { name: 'Paiements', href: '/payments', icon: Wallet },
        { name: 'Relances', href: '/reminders', icon: BellRing, badge: 'IA' },
      ],
    },
    {
      title: 'ENTREPRISE',
      items: [
        { name: 'Équipe', href: '/team', icon: Building2 },
        { name: 'Abonnement', href: '/billing', icon: CreditCard },
        { name: 'Documents', href: '/documents', icon: FolderOpen },
        { name: 'Rapports', href: '/reports', icon: BarChart3 },
        { name: 'Audit & Logs', href: '/settings/audit', icon: History },
      ],
    },
    {
      title: 'AUTOMATISATION',
      items: [
        { name: 'Automatisations', href: '/automations', icon: Zap },
        { name: 'Journal des logs', href: '/automations/logs', icon: History },
        { name: 'Assistant IA', href: '/assistant', icon: Bot, badge: 'IA' },
      ],
    },
    {
      title: 'PARAMÈTRES',
      items: [
        { name: 'Paramètres', href: '/settings', icon: Settings },
        { name: 'Intégrations', href: '/settings/integrations', icon: Sparkles },
        ...(currentRole === 'owner' ? [{ name: 'Plateforme SaaS', href: '/admin', icon: ShieldCheck, badge: 'Admin' }] : []),
      ],
    },
  ];

  const getRoleBadge = (role: string | null) => {
    switch (role) {
      case 'owner':
        return <span className="text-[10px] font-bold bg-amber-500/15 text-amber-600 dark:text-amber-400 px-2 py-0.5 rounded-full border border-amber-500/30">Propriétaire</span>;
      case 'admin':
        return <span className="text-[10px] font-bold bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 px-2 py-0.5 rounded-full border border-indigo-500/30">Admin</span>;
      case 'accountant':
        return <span className="text-[10px] font-bold bg-teal-500/15 text-teal-600 dark:text-teal-400 px-2 py-0.5 rounded-full border border-teal-500/30">Comptable</span>;
      default:
        return <span className="text-[10px] font-bold bg-slate-500/15 text-slate-600 dark:text-slate-400 px-2 py-0.5 rounded-full border border-slate-500/30">Employé</span>;
    }
  };

  return (
    <>
      {/* Mobile backdrop */}
      {mobileOpen && (
        <div 
          onClick={() => setMobileOpen(false)} 
          className="fixed inset-0 z-40 bg-slate-900/60 backdrop-blur-sm lg:hidden"
        />
      )}

      {/* Sidebar container */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 w-72 bg-white dark:bg-slate-950 border-r border-slate-200 dark:border-slate-800/80 flex flex-col transition-transform duration-300 ease-in-out lg:translate-x-0 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand header */}
        <div className="h-16 px-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <Link href="/dashboard" className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-blue-500 flex items-center justify-center shadow-md shadow-indigo-500/20">
              <Layers className="w-5 h-5 text-white" />
            </div>
            <div className="flex flex-col">
              <span className="text-lg font-bold tracking-tight text-slate-900 dark:text-white leading-tight">
                Business<span className="text-indigo-500">OS</span>
              </span>
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                Assistant Pro
              </span>
            </div>
          </Link>
        </div>

        {/* Company Switcher */}
        <div className="p-3.5 border-b border-slate-200 dark:border-slate-800/60 bg-slate-50/50 dark:bg-slate-900/40">
          <div className="relative">
            <select
              value={currentCompany?.id || ''}
              onChange={(e) => switchCompany(e.target.value)}
              className="w-full text-xs font-semibold appearance-none bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 text-slate-900 dark:text-white py-2.5 pl-3 pr-8 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all cursor-pointer shadow-sm"
            >
              {companies.map((comp) => (
                <option key={comp.id} value={comp.id}>
                  🏢 {comp.name}
                </option>
              ))}
            </select>
            <ChevronDown className="w-4 h-4 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
          <div className="mt-2 flex items-center justify-between px-1">
            <span className="text-[11px] font-medium text-slate-600 dark:text-slate-400">
              {currentCompany?.currency || 'FCFA'} • Plan {currentCompany?.plan?.toUpperCase() || 'FREE'}
            </span>
            {getRoleBadge(currentRole)}
          </div>
        </div>

        {/* Navigation list */}
        <div className="flex-1 overflow-y-auto px-3.5 py-4 space-y-6">
          {navigationGroups.map((group) => (
            <div key={group.title}>
              <div className="px-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                {group.title}
              </div>
              <div className="space-y-1">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = pathname === item.href;
                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      onClick={() => setMobileOpen(false)}
                      className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                        isActive
                          ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/25'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-900'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400 dark:text-slate-500'}`} />
                        <span>{item.name}</span>
                      </div>
                      {item.badge && (
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-bold ${
                          isActive ? 'bg-indigo-500 text-white' : 'bg-indigo-500/10 text-indigo-500 dark:text-indigo-400'
                        }`}>
                          {item.badge}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* User profile & sign out footer */}
        <div className="p-3.5 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 flex items-center justify-between">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-500 to-blue-500 text-white flex items-center justify-center font-bold text-xs flex-shrink-0">
              {profile?.first_name ? profile.first_name[0].toUpperCase() : 'U'}
            </div>
            <div className="min-w-0">
              <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
                {profile?.full_name || 'Utilisateur'}
              </div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                {profile?.job_title || 'Membre'}
              </div>
            </div>
          </div>

          <button
            onClick={() => signOut()}
            title="Se déconnecter"
            className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 rounded-lg transition-colors"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </aside>
    </>
  );
}
