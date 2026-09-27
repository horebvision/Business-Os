import { SupabaseClient } from '@supabase/supabase-js';
import { DuplicateCheckMatch } from '../types';

interface DuplicateCheckParams {
  email?: string | null;
  phone?: string | null;
  name?: string | null;
  companyName?: string | null;
  currentId?: string; // ID to exclude when editing
}

export async function checkDuplicates(
  supabase: SupabaseClient,
  companyId: string,
  params: DuplicateCheckParams
): Promise<DuplicateCheckMatch[]> {
  const matches: DuplicateCheckMatch[] = [];
  const cleanEmail = params.email?.trim().toLowerCase();
  const cleanPhone = params.phone?.replace(/[\s\-\+\(\)]/g, '');
  const cleanName = params.name?.trim().toLowerCase();
  const cleanCompanyName = params.companyName?.trim().toLowerCase();

  if (!companyId) return matches;

  // 1. Check in LEADS
  let leadQuery = supabase
    .from('leads')
    .select('id, name, company_name, email, phone')
    .eq('company_id', companyId);

  if (params.currentId) {
    leadQuery = leadQuery.neq('id', params.currentId);
  }

  const { data: leads } = await leadQuery;

  if (leads) {
    for (const lead of leads) {
      const lEmail = lead.email?.trim().toLowerCase();
      const lPhone = lead.phone?.replace(/[\s\-\+\(\)]/g, '');
      const lName = lead.name?.trim().toLowerCase();
      const lCompany = lead.company_name?.trim().toLowerCase();

      // Check email match
      if (cleanEmail && lEmail && cleanEmail === lEmail) {
        matches.push({
          id: lead.id,
          name: `${lead.name} ${lead.company_name ? `(${lead.company_name})` : ''}`,
          type: 'lead',
          matchedField: 'email',
          link: `/leads/${lead.id}`,
        });
        continue;
      }

      // Check phone match (if length >= 8)
      if (cleanPhone && lPhone && cleanPhone.length >= 8 && (cleanPhone.endsWith(lPhone) || lPhone.endsWith(cleanPhone))) {
        matches.push({
          id: lead.id,
          name: `${lead.name} ${lead.company_name ? `(${lead.company_name})` : ''}`,
          type: 'lead',
          matchedField: 'phone',
          link: `/leads/${lead.id}`,
        });
        continue;
      }

      // Check name + company match
      if (cleanName && lName && cleanName === lName) {
        if (!cleanCompanyName || !lCompany || cleanCompanyName === lCompany) {
          matches.push({
            id: lead.id,
            name: `${lead.name} ${lead.company_name ? `(${lead.company_name})` : ''}`,
            type: 'lead',
            matchedField: 'name_company',
            link: `/leads/${lead.id}`,
          });
        }
      }
    }
  }

  // 2. Check in CUSTOMERS
  let customerQuery = supabase
    .from('customers')
    .select('id, name, company_name, email, phone')
    .eq('company_id', companyId);

  if (params.currentId) {
    customerQuery = customerQuery.neq('id', params.currentId);
  }

  const { data: customers } = await customerQuery;

  if (customers) {
    for (const customer of customers) {
      const cEmail = customer.email?.trim().toLowerCase();
      const cPhone = customer.phone?.replace(/[\s\-\+\(\)]/g, '');
      const cName = customer.name?.trim().toLowerCase();
      const cCompany = customer.company_name?.trim().toLowerCase();

      // Check email match
      if (cleanEmail && cEmail && cleanEmail === cEmail) {
        matches.push({
          id: customer.id,
          name: `${customer.name} ${customer.company_name ? `(${customer.company_name})` : ''}`,
          type: 'customer',
          matchedField: 'email',
          link: `/customers/${customer.id}`,
        });
        continue;
      }

      // Check phone match
      if (cleanPhone && cPhone && cleanPhone.length >= 8 && (cleanPhone.endsWith(cPhone) || cPhone.endsWith(cleanPhone))) {
        matches.push({
          id: customer.id,
          name: `${customer.name} ${customer.company_name ? `(${customer.company_name})` : ''}`,
          type: 'customer',
          matchedField: 'phone',
          link: `/customers/${customer.id}`,
        });
        continue;
      }

      // Check name + company match
      if (cleanName && cName && cleanName === cName) {
        if (!cleanCompanyName || !cCompany || cleanCompanyName === cCompany) {
          matches.push({
            id: customer.id,
            name: `${customer.name} ${customer.company_name ? `(${customer.company_name})` : ''}`,
            type: 'customer',
            matchedField: 'name_company',
            link: `/customers/${customer.id}`,
          });
        }
      }
    }
  }

  return matches;
}
