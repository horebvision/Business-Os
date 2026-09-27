// ==============================================================================
// BUSINESSOS — API ROUTE : /api/pdf/generate (PHASE 6 & PHASE 6.2 HARDENING)
// ==============================================================================
// Génère un véritable fichier PDF binaire ou du HTML pour les devis et factures.
// Supporte :
//   - GET  : /api/pdf/generate?type=invoice&id=...&download=true
//   - POST : { type: 'quote' | 'invoice', documentId: string, mode?: 'pdf' | 'html', download?: boolean }
// Sécurité :
//   - Authentification de session obligatoire (getAuthenticatedContext)
//   - Isolation multi-tenant stricte (company_id = ctx.companyId)
//   - Content-Type: application/pdf avec signature %PDF-

import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedContext } from '@/lib/auth/permissions';
import { createClient } from '@/lib/supabase/server';
import {
  getDocumentHtml,
  getPdfFilename,
  generateDocumentPdf,
  PdfDocumentData,
} from '@/lib/pdf/pdfService';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const authResult = await getAuthenticatedContext(request);
    if (authResult.errorResponse) return authResult.errorResponse;
    const ctx = authResult.context!;

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');
    const documentId = searchParams.get('id') || searchParams.get('documentId');
    const mode = searchParams.get('mode') || 'pdf';
    const isDownload = searchParams.get('download') === 'true' || searchParams.get('disposition') === 'attachment';

    if (!type || !documentId) {
      return NextResponse.json(
        { error: 'Paramètres type et id requis' },
        { status: 400 }
      );
    }

    return await handleGenerate({
      type: type as 'quote' | 'invoice',
      documentId,
      mode: mode as 'pdf' | 'html',
      isDownload,
      companyId: ctx.companyId,
    });
  } catch (err: any) {
    console.error('[PDF Generate GET Error]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await getAuthenticatedContext(request);
    if (authResult.errorResponse) return authResult.errorResponse;
    const ctx = authResult.context!;

    const body = await request.json();
    const { type, documentId, mode = 'pdf', download = false } = body;

    if (!type || !documentId) {
      return NextResponse.json({ error: 'type et documentId requis' }, { status: 400 });
    }

    return await handleGenerate({
      type,
      documentId,
      mode,
      isDownload: Boolean(download),
      companyId: ctx.companyId,
    });
  } catch (err: any) {
    console.error('[PDF Generate POST Error]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// ─── Dispatcher de génération ────────────────────────────────────────────────

interface GenerateParams {
  type: 'quote' | 'invoice';
  documentId: string;
  mode: 'pdf' | 'html';
  isDownload: boolean;
  companyId: string;
}

async function handleGenerate({
  type,
  documentId,
  mode,
  isDownload,
  companyId,
}: GenerateParams): Promise<NextResponse> {
  const supabase = await createClient();
  let documentData: PdfDocumentData;

  if (type === 'quote') {
    documentData = await buildQuoteData(supabase, documentId, companyId);
  } else if (type === 'invoice') {
    documentData = await buildInvoiceData(supabase, documentId, companyId);
  } else {
    return NextResponse.json({ error: 'type invalide (quote|invoice)' }, { status: 400 });
  }

  const filename = getPdfFilename(documentData);

  // 1. Mode HTML : pour rendu/preview direct dans le navigateur
  if (mode === 'html') {
    const html = getDocumentHtml(documentData);
    return new NextResponse(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Disposition': `inline; filename="${filename.replace('.pdf', '.html')}"`,
      },
    });
  }

  // 2. Mode PDF : génération d'un vrai fichier PDF binaire (%PDF-)
  const pdfBuffer = await generateDocumentPdf(documentData);
  const dispositionType = isDownload ? 'attachment' : 'inline';

  return new NextResponse(pdfBuffer as any, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `${dispositionType}; filename="${filename}"`,
      'Content-Length': String(pdfBuffer.length),
      'Cache-Control': 'no-store, max-age=0',
      'X-Pdf-Engine': 'BusinessOS-PDFKit',
    },
  });
}

// ─── Constructeurs de données ──────────────────────────────────────────────────

async function buildQuoteData(
  supabase: any,
  quoteId: string,
  companyId: string
): Promise<PdfDocumentData> {
  const { data: quote, error } = await supabase
    .from('quotes')
    .select(`
      *,
      customers (name, email, phone, city, address),
      quote_items (description, quantity, unit_price, tax_rate, total_ht, total_ttc),
      companies (name, address, phone, email, siret, tva_number, logo_url)
    `)
    .eq('id', quoteId)
    .eq('company_id', companyId)
    .single();

  if (error || !quote) throw new Error('Devis introuvable ou accès refusé');

  const company = quote.companies ?? {};
  const client = quote.customers ?? {};
  const items = (quote.quote_items ?? []).map((i: any) => ({
    description: i.description || 'Prestation',
    quantity: Number(i.quantity) || 1,
    unit_price: Number(i.unit_price) || 0,
    tax_rate: Number(i.tax_rate) || 0,
    total_ht: Number(i.total_ht) || 0,
    total_ttc: Number(i.total_ttc) || 0,
  }));

  return {
    type: 'quote',
    number: quote.quote_number || 'DEV-0000',
    date: quote.created_at || new Date().toISOString(),
    due_date: quote.valid_until,
    status: quote.status,
    currency: quote.currency ?? 'XOF',
    company: {
      name: company.name ?? 'Votre entreprise',
      address: company.address,
      phone: company.phone,
      email: company.email,
      siret: company.siret,
      tva_number: company.tva_number,
      logo_url: company.logo_url,
    },
    client: {
      name: client.name ?? 'Client',
      email: client.email,
      phone: client.phone,
      address: client.address,
      city: client.city,
    },
    items,
    subtotal_ht: Number(quote.subtotal ?? 0),
    total_tax: Number(quote.tax_amount ?? 0),
    total_ttc: Number(quote.total ?? 0),
    discount_amount: quote.discount_amount ? Number(quote.discount_amount) : undefined,
    notes: quote.notes,
    payment_terms: quote.payment_terms,
  };
}

async function buildInvoiceData(
  supabase: any,
  invoiceId: string,
  companyId: string
): Promise<PdfDocumentData> {
  const { data: invoice, error } = await supabase
    .from('invoices')
    .select(`
      *,
      customers (name, email, phone, city, address),
      invoice_items (description, quantity, unit_price, tax_rate, total_ht, total_ttc),
      companies (name, address, phone, email, siret, tva_number, logo_url)
    `)
    .eq('id', invoiceId)
    .eq('company_id', companyId)
    .single();

  if (error || !invoice) throw new Error('Facture introuvable ou accès refusé');

  const company = invoice.companies ?? {};
  const client = invoice.customers ?? {};
  const items = (invoice.invoice_items ?? []).map((i: any) => ({
    description: i.description || 'Prestation',
    quantity: Number(i.quantity) || 1,
    unit_price: Number(i.unit_price) || 0,
    tax_rate: Number(i.tax_rate) || 0,
    total_ht: Number(i.total_ht) || 0,
    total_ttc: Number(i.total_ttc) || 0,
  }));

  return {
    type: 'invoice',
    number: invoice.invoice_number || 'FAC-0000',
    date: invoice.created_at || new Date().toISOString(),
    due_date: invoice.due_date,
    status: invoice.status,
    currency: invoice.currency ?? 'XOF',
    company: {
      name: company.name ?? 'Votre entreprise',
      address: company.address,
      phone: company.phone,
      email: company.email,
      siret: company.siret,
      tva_number: company.tva_number,
      logo_url: company.logo_url,
    },
    client: {
      name: client.name ?? 'Client',
      email: client.email,
      phone: client.phone,
      address: client.address,
      city: client.city,
    },
    items,
    subtotal_ht: Number(invoice.subtotal ?? 0),
    total_tax: Number(invoice.tax_amount ?? 0),
    total_ttc: Number(invoice.total ?? 0),
    discount_amount: invoice.discount_amount ? Number(invoice.discount_amount) : undefined,
    notes: invoice.notes,
    payment_terms: invoice.payment_terms,
  };
}
