'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';
import { Company, Membership, UserProfile, UserRole } from '@/lib/types';
import { useRouter, usePathname } from 'next/navigation';

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  session: Session | null;
  companies: Company[];
  currentCompany: Company | null;
  currentRole: UserRole | null;
  memberships: Membership[];
  loading: boolean;
  switchCompany: (companyId: string) => void;
  refreshUserData: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  session: null,
  companies: [],
  currentCompany: null,
  currentRole: null,
  memberships: [],
  loading: true,
  switchCompany: () => {},
  refreshUserData: async () => {},
  signOut: async () => {},
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [currentCompany, setCurrentCompany] = useState<Company | null>(null);
  const [currentRole, setCurrentRole] = useState<UserRole | null>(null);
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [loading, setLoading] = useState(true);

  const supabase = createClient();
  const router = useRouter();
  const pathname = usePathname();

  const fetchUserData = useCallback(async (activeUser: User) => {
    try {
      // 1. Fetch user profile
      const { data: userProfile, error: profileErr } = await supabase
        .from('users')
        .select('*')
        .eq('id', activeUser.id)
        .single();

      if (userProfile) {
        setProfile(userProfile);
      } else if (profileErr) {
        // If row doesn't exist yet, insert basic profile
        const newProfile = {
          id: activeUser.id,
          email: activeUser.email || '',
          first_name: activeUser.user_metadata?.first_name || '',
          last_name: activeUser.user_metadata?.last_name || '',
          phone: activeUser.user_metadata?.phone || '',
        };
        await supabase.from('users').upsert(newProfile);
        setProfile(newProfile as UserProfile);
      }

      // 2. Fetch memberships with companies
      const { data: userMemberships, error: memErr } = await supabase
        .from('memberships')
        .select(`
          id,
          company_id,
          user_id,
          role,
          is_active,
          created_at,
          updated_at,
          company:companies(*)
        `)
        .eq('user_id', activeUser.id)
        .eq('is_active', true);

      if (userMemberships && userMemberships.length > 0) {
        setMemberships(userMemberships as unknown as Membership[]);
        const comps = userMemberships
          .map((m: any) => m.company)
          .filter(Boolean) as Company[];
        
        setCompanies(comps);

        // Retrieve preferred company from localStorage or default to first
        const savedCompanyId = typeof window !== 'undefined' ? localStorage.getItem('businessos_active_company_id') : null;
        const matchedMem = userMemberships.find((m: any) => m.company_id === savedCompanyId) || userMemberships[0];

        if (matchedMem && matchedMem.company) {
          setCurrentCompany(matchedMem.company as unknown as Company);
          setCurrentRole(matchedMem.role as UserRole);
          if (typeof window !== 'undefined') {
            localStorage.setItem('businessos_active_company_id', matchedMem.company_id);
          }
        }
      } else {
        setCompanies([]);
        setCurrentCompany(null);
        setCurrentRole(null);
        setMemberships([]);
      }
    } catch (err) {
      console.error('Error loading user profile & companies:', err);
    }
  }, [supabase]);

  useEffect(() => {
    // Initial session load
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchUserData(session.user).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    // Auth state change listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchUserData(session.user).finally(() => setLoading(false));
      } else {
        setProfile(null);
        setCompanies([]);
        setCurrentCompany(null);
        setCurrentRole(null);
        setMemberships([]);
        setLoading(false);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [supabase, fetchUserData]);

  const switchCompany = (companyId: string) => {
    const mem = memberships.find((m) => m.company_id === companyId);
    if (mem && mem.company) {
      setCurrentCompany(mem.company);
      setCurrentRole(mem.role);
      if (typeof window !== 'undefined') {
        localStorage.setItem('businessos_active_company_id', companyId);
      }
    }
  };

  const refreshUserData = async () => {
    if (user) {
      await fetchUserData(user);
    }
  };

  const signOut = async () => {
    setLoading(true);
    await supabase.auth.signOut();
    if (typeof window !== 'undefined') {
      localStorage.removeItem('businessos_active_company_id');
    }
    setUser(null);
    setProfile(null);
    setCompanies([]);
    setCurrentCompany(null);
    setCurrentRole(null);
    setMemberships([]);
    setLoading(false);
    router.push('/login');
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        session,
        companies,
        currentCompany,
        currentRole,
        memberships,
        loading,
        switchCompany,
        refreshUserData,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
