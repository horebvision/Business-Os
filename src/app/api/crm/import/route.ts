import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedContext, requirePermission } from '@/lib/auth/permissions';
import { checkLimit } from '@/lib/billing/featureGating';
import { logAuditEvent } from '@/lib/audit/auditLogger';
import { supabaseAdmin } from '@/lib/supabase/admin';

export async function POST(req: NextRequest) {
  try {
    const { errorResponse, context } = await getAuthenticatedContext(req);
    if (errorResponse || !context) {
      return errorResponse || NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    const body = await req.json();
    const { type = 'customers', records = [] } = body;

    if (!Array.isArray(records) || records.length === 0) {
      return NextResponse.json({ error: 'Aucun enregistrement à importer.' }, { status: 400 });
    }

    // 1. Permission check
    const requiredPerm = type === 'customers' ? 'customers.create' : 'leads.create';
    const permCheck = await requirePermission(context.companyId, requiredPerm, req);
    if (permCheck.errorResponse) {
      return permCheck.errorResponse;
    }

    // 2. Limit check
    const resourceName = type === 'customers' ? 'customers' : 'leads';
    const limitCheck = await checkLimit(context.companyId, resourceName);

    if (limitCheck.max !== -1) {
      const remainingQuota = Math.max(0, limitCheck.max - limitCheck.current);
      if (records.length > remainingQuota) {
        return NextResponse.json(
          {
            error: `Votre forfait permet d'ajouter encore ${remainingQuota} ${resourceName}, mais le fichier contient ${records.length} entrées. Passez au plan supérieur pour continuer.`,
            limit_reached: true,
            current: limitCheck.current,
            max: limitCheck.max,
            remaining: remainingQuota,
          },
          { status: 403 }
        );
      }
    }

    // 3. Fetch existing emails to detect and skip duplicates
    const tableName = type === 'customers' ? 'customers' : 'leads';
    const { data: existingRows } = await supabaseAdmin
      .from(tableName)
      .select('email')
      .eq('company_id', context.companyId);

    const existingEmails = new Set(
      (existingRows || []).map((r: any) => r.email?.trim().toLowerCase()).filter(Boolean)
    );

    const toInsert: any[] = [];
    let duplicatesCount = 0;

    for (const rec of records) {
      const email = rec.email?.trim().toLowerCase();
      if (email && existingEmails.has(email)) {
        duplicatesCount++;
        continue;
      }

      if (!rec.name && !rec.company_name && !rec.email) {
        continue;
      }

      toInsert.push({
        company_id: context.companyId,
        name: rec.name || rec.company_name || 'Contact importé',
        company_name: rec.company_name || null,
        email: rec.email || null,
        phone: rec.phone || null,
        address: rec.address || null,
        city: rec.city || null,
        status: type === 'leads' ? 'Nouveau' : 'Actif',
        ...(type === 'leads' ? { source: 'Import CSV' } : {}),
      });

      if (email) existingEmails.add(email);
    }

    if (toInsert.length === 0) {
      return NextResponse.json({
        success: false,
        message: 'Toutes les lignes du fichier sont soit des doublons existants, soit invalides.',
        importedCount: 0,
        duplicatesCount,
      });
    }

    const { error: insertErr } = await supabaseAdmin.from(tableName).insert(toInsert);
    if (insertErr) {
      return NextResponse.json({ error: insertErr.message }, { status: 500 });
    }

    // 4. Audit log
    await logAuditEvent({
      companyId: context.companyId,
      userId: context.user.id,
      action: type === 'customers' ? 'customers.imported' : 'leads.imported',
      entityType: tableName,
      newValues: {
        importedCount: toInsert.length,
        duplicatesCount,
        fileName: body.fileName || 'import.csv',
      },
      ipAddress: req.headers.get('x-forwarded-for') || undefined,
    });

    return NextResponse.json({
      success: true,
      importedCount: toInsert.length,
      duplicatesCount,
      message: `${toInsert.length} ${type === 'customers' ? 'clients' : 'prospects'} importé(s) avec succès. (${duplicatesCount} doublon(s) ignoré(s))`,
    });
  } catch (error: any) {
    console.error('CSV import error:', error);
    const status = error.message?.includes('Accès non autorisé') ? 403 : 500;
    return NextResponse.json({ error: error.message || 'Erreur serveur' }, { status });
  }
}
