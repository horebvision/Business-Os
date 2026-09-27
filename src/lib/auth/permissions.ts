// ==============================================================================
// BUSINESSOS — ROLES, PERMISSIONS & AUTHORIZATION LAYER (PHASE 5: SECTION 15, 16, 17)
// ==============================================================================

import { AppPermission, UserRole } from '@/lib/types';
import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

/**
 * Matrice des permissions complètes par rôle.
 */
export const ROLE_PERMISSIONS: Record<UserRole, AppPermission[]> = {
  owner: [
    'company.view', 'company.update',
    'team.view', 'team.invite', 'team.manage',
    'leads.view', 'leads.create', 'leads.update', 'leads.delete',
    'customers.view', 'customers.create', 'customers.update', 'customers.delete',
    'quotes.view', 'quotes.create', 'quotes.update', 'quotes.send', 'quotes.accept',
    'invoices.view', 'invoices.create', 'invoices.update', 'invoices.send',
    'payments.view', 'payments.create',
    'reports.view',
    'automations.view', 'automations.manage',
    'ai.use',
    'billing.view', 'billing.manage',
    'analytics.view',
    'audit.view',
  ],
  admin: [
    'company.view', 'company.update',
    'team.view', 'team.invite', 'team.manage',
    'leads.view', 'leads.create', 'leads.update', 'leads.delete',
    'customers.view', 'customers.create', 'customers.update', 'customers.delete',
    'quotes.view', 'quotes.create', 'quotes.update', 'quotes.send', 'quotes.accept',
    'invoices.view', 'invoices.create', 'invoices.update', 'invoices.send',
    'payments.view', 'payments.create',
    'reports.view',
    'automations.view', 'automations.manage',
    'ai.use',
    'billing.view', 'billing.manage',
    'analytics.view',
    'audit.view',
  ],
  manager: [
    'company.view',
    'team.view',
    'leads.view', 'leads.create', 'leads.update',
    'customers.view', 'customers.create', 'customers.update',
    'quotes.view', 'quotes.create', 'quotes.update', 'quotes.send', 'quotes.accept',
    'invoices.view', 'invoices.create', 'invoices.update', 'invoices.send',
    'payments.view', 'payments.create',
    'reports.view',
    'automations.view',
    'ai.use',
    'analytics.view',
  ],
  commercial: [
    'company.view',
    'leads.view', 'leads.create', 'leads.update',
    'customers.view', 'customers.create', 'customers.update',
    'quotes.view', 'quotes.create', 'quotes.update', 'quotes.send',
    'invoices.view',
    'reports.view',
    'ai.use',
  ],
  accountant: [
    'company.view',
    'customers.view',
    'quotes.view',
    'invoices.view', 'invoices.create', 'invoices.update', 'invoices.send',
    'payments.view', 'payments.create',
    'reports.view',
    'billing.view',
    'ai.use',
    'analytics.view',
  ],
  comptable: [
    'company.view',
    'customers.view',
    'quotes.view',
    'invoices.view', 'invoices.create', 'invoices.update', 'invoices.send',
    'payments.view', 'payments.create',
    'reports.view',
    'billing.view',
    'ai.use',
    'analytics.view',
  ],
  employee: [
    'company.view',
    'customers.view',
    'quotes.view',
    'invoices.view',
    'ai.use',
  ],
};

/**
 * Vérifie si un rôle possède une permission donnée.
 */
export function hasPermission(role: UserRole | string | undefined | null, permission: AppPermission): boolean {
  if (!role) return false;
  const normalized = (role.toLowerCase()) as UserRole;
  const permissions = ROLE_PERMISSIONS[normalized] || ROLE_PERMISSIONS.employee;
  return permissions.includes(permission);
}

export interface AuthenticatedContext {
  user: any;
  companyId: string;
  role: UserRole;
  membership: any;
}

/**
 * Couche d'autorisation serveur vérifiant l'utilisateur, son appartenance à l'entreprise et son rôle.
 * NE FAIT JAMAIS CONFIANCE AU CLIENT : valide la session et l'appartenance réelle dans la base.
 */
export async function getAuthenticatedContext(
  req?: NextRequest,
  requestedCompanyId?: string
): Promise<{ errorResponse?: NextResponse; context?: AuthenticatedContext }> {
  const supabase = await createClient();

  // Extraction du Bearer Token si présent
  const authHeader = req?.headers.get('authorization');
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;

  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser(token);

  if (userErr || !user) {
    return {
      errorResponse: NextResponse.json(
        { error: 'Session non authentifiée. Veuillez vous connecter.' },
        { status: 401 }
      ),
    };
  }

  // Résolution de l'entreprise cible
  let companyId = requestedCompanyId;

  if (!companyId) {
    // Si non fourni, chercher l'entreprise principale de l'utilisateur
    const { data: memberRows } = await supabase
      .from('memberships')
      .select('company_id, role, is_active')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .limit(1);

    if (memberRows && memberRows.length > 0) {
      companyId = memberRows[0].company_id;
    }
  }

  if (!companyId) {
    return {
      errorResponse: NextResponse.json(
        { error: 'Aucune entreprise active associée à ce compte.' },
        { status: 400 }
      ),
    };
  }

  // Vérifier l'appartenance stricte à l'entreprise
  const { data: membership, error: memErr } = await supabase
    .from('memberships')
    .select('*, company:companies(*)')
    .eq('company_id', companyId)
    .eq('user_id', user.id)
    .eq('is_active', true)
    .maybeSingle();

  if (memErr || !membership) {
    return {
      errorResponse: NextResponse.json(
        { error: 'Accès refusé : vous n’appartenez pas à cette entreprise.' },
        { status: 403 }
      ),
    };
  }

  const role = (membership.role?.toLowerCase() || 'employee') as UserRole;

  return {
    context: {
      user,
      companyId,
      role,
      membership,
    },
  };
}

/**
 * Vérification stricte d'une permission côté serveur.
 */
export async function requirePermission(
  companyId: string,
  permission: AppPermission,
  req?: NextRequest
): Promise<{ errorResponse?: NextResponse; context?: AuthenticatedContext }> {
  const { errorResponse, context } = await getAuthenticatedContext(req, companyId);
  if (errorResponse) return { errorResponse };

  if (!context || !hasPermission(context.role, permission)) {
    return {
      errorResponse: NextResponse.json(
        {
          error: `Permission insuffisante : l'action requiert le droit '${permission}'. Votre rôle actuel est '${context?.role}'.`,
        },
        { status: 403 }
      ),
    };
  }

  return { context };
}

/**
 * Vérification stricte d'un rôle côté serveur.
 */
export async function requireRole(
  companyId: string,
  allowedRoles: UserRole[],
  req?: NextRequest
): Promise<{ errorResponse?: NextResponse; context?: AuthenticatedContext }> {
  const { errorResponse, context } = await getAuthenticatedContext(req, companyId);
  if (errorResponse) return { errorResponse };

  if (!context || !allowedRoles.includes(context.role)) {
    return {
      errorResponse: NextResponse.json(
        {
          error: `Accès réservé aux rôles : ${allowedRoles.join(', ')}. Votre rôle est '${context?.role}'.`,
        },
        { status: 403 }
      ),
    };
  }

  return { context };
}
