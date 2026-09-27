// ==============================================================================
// BUSINESSOS — SERVICE PDF (PHASE 6 & PHASE 6.2 HARDENING)
// ==============================================================================
// Génère de véritables PDF binaires côté serveur avec PDFKit.
// Supporte :
//   - Factures & Devis avec design professionnel
//   - Logos (base64 data URL ou chemin de fichier) et avatar vectoriel de repli
//   - Multi-devises (XOF, XAF, EUR, USD, MAD)
//   - Multi-lignes avec calcul automatique de hauteur et sauts de page
//   - Totaux, remises, TVA, total TTC
//   - Notes, conditions de paiement, mentions légales, pagination automatique
//   - Sortie : Buffer binaire pur avec signature %PDF-
//   - Mode HTML conservé pour prévisualisation web

import PDFDocument from 'pdfkit';

export interface PdfCompany {
  name: string;
  address?: string;
  phone?: string;
  email?: string;
  siret?: string;
  tva_number?: string;
  logo_url?: string;
}

export interface PdfLineItem {
  description: string;
  quantity: number;
  unit_price: number;
  tax_rate: number;
  total_ht: number;
  total_ttc: number;
}

export interface PdfDocumentData {
  type: 'quote' | 'invoice';
  number: string;              // ex: DEV-2024-001 ou FAC-2024-001
  date: string;                // ISO
  due_date?: string;           // ISO
  status?: string;
  company: PdfCompany;
  client: {
    name: string;
    email?: string;
    phone?: string;
    address?: string;
    city?: string;
  };
  items: PdfLineItem[];
  subtotal_ht: number;
  total_tax: number;
  total_ttc: number;
  discount_amount?: number;
  notes?: string;
  payment_terms?: string;
  currency: string;
}

// ─── Formatters ───────────────────────────────────────────────────────────────

export function formatCurrency(amount: number, currency: string): string {
  const symbols: Record<string, string> = {
    XOF: 'FCFA',
    XAF: 'FCFA',
    EUR: '€',
    USD: '$',
    MAD: 'MAD',
  };
  const sym = symbols[currency] ?? currency;
  return `${amount.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} ${sym}`;
}

export function formatDate(iso?: string): string {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

// ─── Génération binaire PDF (Server-side via PDFKit) ──────────────────────────

/**
 * Génère un véritable fichier PDF sous forme de Buffer binaire.
 * Garanti : commence par la signature %PDF-, non vide, conforme standard PDF.
 */
export function generateDocumentPdf(data: PdfDocumentData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const isInvoice = data.type === 'invoice';
      const title = isInvoice ? 'FACTURE' : 'DEVIS';
      const primaryColor = isInvoice ? '#1e40af' : '#6d28d9';
      const lightBg = '#f8fafc';
      const borderColor = '#e2e8f0';
      const textColor = '#0f172a';
      const mutedColor = '#64748b';
      const currency = data.currency || 'XOF';

      const doc = new PDFDocument({
        size: 'A4',
        margin: 40,
        bufferPages: true,
        info: {
          Title: `${title} ${data.number}`,
          Author: data.company.name,
          Subject: `${title} commerciale BusinessOS`,
          Creator: 'BusinessOS',
        },
      });

      const buffers: Buffer[] = [];
      doc.on('data', (chunk) => buffers.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', (err) => reject(err));

      const pageWidth = 595.28;
      const pageHeight = 841.89;
      const leftMargin = 40;
      const rightMargin = pageWidth - 40;
      const contentWidth = rightMargin - leftMargin;

      // ─── En-tête ──────────────────────────────────────────────
      let y = 40;

      // Logo ou badge initiales
      let hasLogo = false;
      if (data.company.logo_url) {
        try {
          if (data.company.logo_url.startsWith('data:image')) {
            const base64Data = data.company.logo_url.split(',')[1];
            const imgBuffer = Buffer.from(base64Data, 'base64');
            doc.image(imgBuffer, leftMargin, y, { fit: [140, 50] });
            hasLogo = true;
          }
        } catch {
          hasLogo = false;
        }
      }

      if (!hasLogo) {
        doc.roundedRect(leftMargin, y, 48, 48, 8).fill(primaryColor);
        doc.fillColor('#ffffff').fontSize(22).font('Helvetica-Bold')
           .text((data.company.name || 'B').charAt(0).toUpperCase(), leftMargin + 16, y + 13);
      }

      // Titre & Métadonnées du document (alignés à droite)
      doc.fillColor(primaryColor).fontSize(26).font('Helvetica-Bold')
         .text(title, rightMargin - 220, y, { width: 220, align: 'right' });

      doc.fillColor(textColor).fontSize(12).font('Helvetica-Bold')
         .text(`N° ${data.number}`, rightMargin - 220, y + 32, { width: 220, align: 'right' });

      doc.fillColor(mutedColor).fontSize(10).font('Helvetica')
         .text(`Date : ${formatDate(data.date)}`, rightMargin - 220, y + 48, { width: 220, align: 'right' });

      if (data.due_date) {
        doc.text(`Échéance : ${formatDate(data.due_date)}`, rightMargin - 220, y + 62, { width: 220, align: 'right' });
      }

      if (data.status) {
        const badgeY = data.due_date ? y + 78 : y + 64;
        const statusText = data.status.toUpperCase();
        doc.roundedRect(rightMargin - 100, badgeY, 100, 18, 4).fillAndStroke('#eff6ff', primaryColor);
        doc.fillColor(primaryColor).fontSize(9).font('Helvetica-Bold')
           .text(statusText, rightMargin - 100, badgeY + 4, { width: 100, align: 'center' });
      }

      y += 105;

      // Ligne séparatrice
      doc.strokeColor(primaryColor).lineWidth(2)
         .moveTo(leftMargin, y).lineTo(rightMargin, y).stroke();

      y += 15;

      // ─── Émetteur & Destinataire ──────────────────────────────
      const boxWidth = (contentWidth - 20) / 2;
      const boxHeight = 90;

      // Cadre Émetteur
      doc.roundedRect(leftMargin, y, boxWidth, boxHeight, 6).fillAndStroke(lightBg, borderColor);
      doc.fillColor(primaryColor).fontSize(9).font('Helvetica-Bold')
         .text('ÉMETTEUR', leftMargin + 12, y + 10);
      doc.fillColor(textColor).fontSize(11).font('Helvetica-Bold')
         .text(data.company.name || '', leftMargin + 12, y + 24, { width: boxWidth - 24, lineBreak: false, ellipsis: true });
      doc.fillColor(mutedColor).fontSize(9).font('Helvetica');
      const compInfo: string[] = [];
      if (data.company.address) compInfo.push(data.company.address);
      if (data.company.phone) compInfo.push(`Tél: ${data.company.phone}`);
      if (data.company.email) compInfo.push(data.company.email);
      if (data.company.siret) compInfo.push(`SIRET: ${data.company.siret}`);
      if (data.company.tva_number) compInfo.push(`TVA: ${data.company.tva_number}`);
      doc.text(compInfo.join('\n'), leftMargin + 12, y + 38, { width: boxWidth - 24, lineGap: 2 });

      // Cadre Destinataire
      const rightBoxX = leftMargin + boxWidth + 20;
      doc.roundedRect(rightBoxX, y, boxWidth, boxHeight, 6).fillAndStroke(lightBg, borderColor);
      doc.fillColor(primaryColor).fontSize(9).font('Helvetica-Bold')
         .text('DESTINATAIRE', rightBoxX + 12, y + 10);
      doc.fillColor(textColor).fontSize(11).font('Helvetica-Bold')
         .text(data.client.name || '', rightBoxX + 12, y + 24, { width: boxWidth - 24, lineBreak: false, ellipsis: true });
      doc.fillColor(mutedColor).fontSize(9).font('Helvetica');
      const clientInfo: string[] = [];
      if (data.client.email) clientInfo.push(data.client.email);
      if (data.client.phone) clientInfo.push(`Tél: ${data.client.phone}`);
      if (data.client.address) clientInfo.push(data.client.address);
      if (data.client.city) clientInfo.push(data.client.city);
      doc.text(clientInfo.join('\n'), rightBoxX + 12, y + 38, { width: boxWidth - 24, lineGap: 2 });

      y += boxHeight + 25;

      // ─── Tableau des articles ─────────────────────────────────
      const colX = {
        desc: leftMargin + 8,
        qty: leftMargin + 250,
        price: leftMargin + 310,
        tax: leftMargin + 400,
        total: rightMargin - 8,
      };

      const drawTableHeader = (curY: number): number => {
        doc.rect(leftMargin, curY, contentWidth, 24).fill(primaryColor);
        doc.fillColor('#ffffff').fontSize(9).font('Helvetica-Bold');
        doc.text('DESCRIPTION', colX.desc, curY + 7, { width: 235 });
        doc.text('QTÉ', colX.qty, curY + 7, { width: 50, align: 'center' });
        doc.text('P.U. HT', colX.price, curY + 7, { width: 80, align: 'right' });
        doc.text('TVA', colX.tax, curY + 7, { width: 45, align: 'center' });
        doc.text('TOTAL TTC', colX.total - 80, curY + 7, { width: 80, align: 'right' });
        return curY + 24;
      };

      y = drawTableHeader(y);

      // Lignes de tableau
      doc.font('Helvetica').fontSize(9);
      for (let i = 0; i < data.items.length; i++) {
        const item = data.items[i];
        const descHeight = doc.heightOfString(item.description, { width: 235 });
        const rowHeight = Math.max(24, descHeight + 12);

        // Saut de page automatique si la ligne dépasse
        if (y + rowHeight > pageHeight - 120) {
          doc.addPage();
          y = 40;
          y = drawTableHeader(y);
        }

        // Fond alterné
        if (i % 2 === 1) {
          doc.rect(leftMargin, y, contentWidth, rowHeight).fill('#f8fafc');
        }

        // Séparateur inférieur
        doc.strokeColor(borderColor).lineWidth(0.5)
           .moveTo(leftMargin, y + rowHeight).lineTo(rightMargin, y + rowHeight).stroke();

        doc.fillColor(textColor).font('Helvetica')
           .text(item.description, colX.desc, y + 6, { width: 235 });
        doc.text(String(item.quantity), colX.qty, y + 6, { width: 50, align: 'center' });
        doc.text(formatCurrency(item.unit_price, currency), colX.price, y + 6, { width: 80, align: 'right' });
        doc.text(`${item.tax_rate}%`, colX.tax, y + 6, { width: 45, align: 'center' });
        doc.font('Helvetica-Bold')
           .text(formatCurrency(item.total_ttc, currency), colX.total - 80, y + 6, { width: 80, align: 'right' });

        y += rowHeight;
      }

      y += 15;

      // ─── Totaux ───────────────────────────────────────────────
      if (y + 110 > pageHeight - 80) {
        doc.addPage();
        y = 40;
      }

      const totalsWidth = 240;
      const totalsX = rightMargin - totalsWidth;

      // Sous-total HT
      doc.fillColor(mutedColor).font('Helvetica').fontSize(9)
         .text('Sous-total HT', totalsX, y, { width: 120 });
      doc.fillColor(textColor).font('Helvetica-Bold').fontSize(9)
         .text(formatCurrency(data.subtotal_ht, currency), rightMargin - 110, y, { width: 110, align: 'right' });
      y += 18;

      // Remise éventuelle
      if (data.discount_amount) {
        doc.fillColor('#dc2626').font('Helvetica').fontSize(9)
           .text('Remise', totalsX, y, { width: 120 });
        doc.font('Helvetica-Bold')
           .text(`- ${formatCurrency(data.discount_amount, currency)}`, rightMargin - 110, y, { width: 110, align: 'right' });
        y += 18;
      }

      // TVA
      doc.fillColor(mutedColor).font('Helvetica').fontSize(9)
         .text('TVA', totalsX, y, { width: 120 });
      doc.fillColor(textColor).font('Helvetica-Bold').fontSize(9)
         .text(formatCurrency(data.total_tax, currency), rightMargin - 110, y, { width: 110, align: 'right' });
      y += 20;

      // TOTAL TTC
      doc.roundedRect(totalsX - 10, y, totalsWidth + 10, 32, 6).fill(primaryColor);
      doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(11)
         .text('TOTAL TTC', totalsX, y + 10, { width: 110 });
      doc.fontSize(13)
         .text(formatCurrency(data.total_ttc, currency), rightMargin - 120, y + 8, { width: 120, align: 'right' });

      y += 50;

      // ─── Notes & Conditions ───────────────────────────────────
      if (data.notes || data.payment_terms) {
        if (y + 60 > pageHeight - 80) {
          doc.addPage();
          y = 40;
        }

        doc.strokeColor(borderColor).lineWidth(1)
           .moveTo(leftMargin, y).lineTo(rightMargin, y).stroke();
        y += 10;

        if (data.notes) {
          doc.fillColor(primaryColor).font('Helvetica-Bold').fontSize(8)
             .text('NOTES', leftMargin, y);
          y += 10;
          doc.fillColor(mutedColor).font('Helvetica').fontSize(8)
             .text(data.notes, leftMargin, y, { width: contentWidth });
          y += doc.heightOfString(data.notes, { width: contentWidth }) + 8;
        }

        if (data.payment_terms) {
          doc.fillColor(primaryColor).font('Helvetica-Bold').fontSize(8)
             .text('CONDITIONS DE PAIEMENT', leftMargin, y);
          y += 10;
          doc.fillColor(mutedColor).font('Helvetica').fontSize(8)
             .text(data.payment_terms, leftMargin, y, { width: contentWidth });
          y += doc.heightOfString(data.payment_terms, { width: contentWidth }) + 8;
        }
      }

      // ─── Pieds de page sur l'ensemble des pages ───────────────
      const range = doc.bufferedPageRange();
      for (let i = range.start; i < range.start + range.count; i++) {
        doc.switchToPage(i);
        const footerY = pageHeight - 35;
        doc.strokeColor(borderColor).lineWidth(0.5)
           .moveTo(leftMargin, footerY - 5).lineTo(rightMargin, footerY - 5).stroke();

        const legalNotice = isInvoice
          ? 'Tout retard de paiement entraîne des pénalités de 1,5%/mois (art. L.441-10 C.com).'
          : `Devis valable 30 jours à compter du ${formatDate(data.date)}.`;

        doc.fillColor('#94a3b8').font('Helvetica').fontSize(7.5)
           .text(legalNotice, leftMargin, footerY, { width: 340 });

        doc.text(`Page ${i + 1} / ${range.count} • Généré par BusinessOS`, rightMargin - 200, footerY, { width: 200, align: 'right' });
      }

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

export const generateDocumentPdfBuffer = generateDocumentPdf;

// ─── Génération HTML (pour preview navigateur) ────────────────────────────────

export function generateDocumentHtml(data: PdfDocumentData): string {
  const isInvoice = data.type === 'invoice';
  const title = isInvoice ? 'FACTURE' : 'DEVIS';
  const accentColor = isInvoice ? '#2563eb' : '#7c3aed';
  const currency = data.currency || 'XOF';

  const itemRows = data.items.map((item) => `
    <tr>
      <td class="td-desc">${item.description}</td>
      <td class="td-center">${item.quantity}</td>
      <td class="td-right">${formatCurrency(item.unit_price, currency)}</td>
      <td class="td-center">${item.tax_rate}%</td>
      <td class="td-right bold">${formatCurrency(item.total_ttc, currency)}</td>
    </tr>
  `).join('');

  const statusBadge = data.status ? `
    <span class="status-badge">${data.status.toUpperCase()}</span>
  ` : '';

  const logoHtml = data.company.logo_url ? `
    <img src="${data.company.logo_url}" alt="Logo" class="logo" />
  ` : `<div class="logo-placeholder">${data.company.name.charAt(0)}</div>`;

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title} ${data.number}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, sans-serif;
      font-size: 13px;
      color: #1e293b;
      background: #fff;
      padding: 40px;
      line-height: 1.5;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 40px;
      padding-bottom: 24px;
      border-bottom: 3px solid ${accentColor};
    }
    .logo { height: 60px; max-width: 180px; object-fit: contain; }
    .logo-placeholder {
      width: 60px; height: 60px;
      border-radius: 12px;
      background: ${accentColor};
      color: #fff;
      font-size: 24px;
      font-weight: 700;
      display: flex; align-items: center; justify-content: center;
    }
    .company-info { font-size: 12px; color: #64748b; margin-top: 8px; }
    .company-name { font-size: 16px; font-weight: 700; color: #0f172a; }
    .doc-header { text-align: right; }
    .doc-title {
      font-size: 32px;
      font-weight: 800;
      color: ${accentColor};
      letter-spacing: 2px;
    }
    .doc-number { font-size: 14px; font-weight: 600; color: #334155; margin-top: 4px; }
    .doc-date { font-size: 12px; color: #64748b; margin-top: 2px; }
    .status-badge {
      display: inline-block;
      padding: 3px 10px;
      border-radius: 20px;
      background: ${accentColor}20;
      color: ${accentColor};
      font-size: 11px;
      font-weight: 700;
      margin-top: 6px;
      border: 1px solid ${accentColor}40;
    }
    .parties { display: flex; gap: 40px; margin-bottom: 32px; }
    .party { flex: 1; }
    .party-label {
      font-size: 10px;
      font-weight: 700;
      color: ${accentColor};
      text-transform: uppercase;
      letter-spacing: 1px;
      margin-bottom: 8px;
      padding-bottom: 4px;
      border-bottom: 2px solid ${accentColor}30;
    }
    .party-name { font-size: 15px; font-weight: 700; color: #0f172a; margin-bottom: 4px; }
    .party-detail { font-size: 12px; color: #475569; line-height: 1.6; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
    thead tr { background: ${accentColor}; color: #fff; }
    thead th {
      padding: 10px 12px;
      text-align: left;
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    tbody tr:nth-child(even) { background: #f8fafc; }
    .td-desc { padding: 10px 12px; }
    .td-center { padding: 10px 12px; text-align: center; }
    .td-right { padding: 10px 12px; text-align: right; }
    .bold { font-weight: 600; }
    .totals { display: flex; justify-content: flex-end; margin-bottom: 32px; }
    .totals-table { width: 320px; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; }
    .total-row { display: flex; justify-content: space-between; padding: 10px 16px; border-bottom: 1px solid #f1f5f9; font-size: 13px; }
    .total-row:last-child { border-bottom: none; }
    .total-label { color: #64748b; }
    .total-value { font-weight: 600; color: #1e293b; }
    .total-final { background: ${accentColor}; color: #fff; }
    .total-final .total-label { color: #fff; font-weight: 700; font-size: 14px; }
    .total-final .total-value { color: #fff; font-size: 16px; font-weight: 800; }
    .notes-section { border-top: 1px solid #e2e8f0; padding-top: 20px; margin-bottom: 20px; }
    .notes-title { font-size: 11px; font-weight: 700; color: ${accentColor}; text-transform: uppercase; margin-bottom: 6px; }
    .notes-text { font-size: 12px; color: #64748b; }
    .footer {
      margin-top: 40px;
      padding-top: 16px;
      border-top: 1px solid #e2e8f0;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .footer-left { font-size: 11px; color: #94a3b8; }
    .footer-brand { font-size: 11px; color: #cbd5e1; }
  </style>
</head>
<body>
  <div class="header">
    <div>
      ${logoHtml}
      <div class="company-name" style="margin-top:10px">${data.company.name}</div>
      <div class="company-info">
        ${data.company.address ? `${data.company.address}<br/>` : ''}
        ${data.company.phone ? `Tél : ${data.company.phone}<br/>` : ''}
        ${data.company.email ? `${data.company.email}<br/>` : ''}
        ${data.company.siret ? `SIRET : ${data.company.siret}<br/>` : ''}
        ${data.company.tva_number ? `N° TVA : ${data.company.tva_number}` : ''}
      </div>
    </div>
    <div class="doc-header">
      <div class="doc-title">${title}</div>
      <div class="doc-number">N° ${data.number}</div>
      <div class="doc-date">Date : ${formatDate(data.date)}</div>
      ${data.due_date ? `<div class="doc-date">Échéance : ${formatDate(data.due_date)}</div>` : ''}
      ${statusBadge}
    </div>
  </div>

  <div class="parties">
    <div class="party">
      <div class="party-label">Émetteur</div>
      <div class="party-name">${data.company.name}</div>
      <div class="party-detail">
        ${data.company.address ?? ''}<br/>
        ${data.company.phone ? `Tél : ${data.company.phone}` : ''}
      </div>
    </div>
    <div class="party">
      <div class="party-label">Destinataire</div>
      <div class="party-name">${data.client.name}</div>
      <div class="party-detail">
        ${data.client.email ? `${data.client.email}<br/>` : ''}
        ${data.client.phone ? `Tél : ${data.client.phone}<br/>` : ''}
        ${data.client.address ? `${data.client.address}` : ''}
        ${data.client.city ? `, ${data.client.city}` : ''}
      </div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th style="width:40%">Description</th>
        <th style="width:10%" class="td-center">Qté</th>
        <th style="width:18%" class="td-right">Prix unitaire HT</th>
        <th style="width:12%" class="td-center">TVA</th>
        <th style="width:20%" class="td-right">Total TTC</th>
      </tr>
    </thead>
    <tbody>
      ${itemRows}
    </tbody>
  </table>

  <div class="totals">
    <div class="totals-table">
      <div class="total-row">
        <span class="total-label">Sous-total HT</span>
        <span class="total-value">${formatCurrency(data.subtotal_ht, currency)}</span>
      </div>
      ${data.discount_amount ? `
      <div class="total-row">
        <span class="total-label">Remise</span>
        <span class="total-value" style="color:#ef4444">- ${formatCurrency(data.discount_amount, currency)}</span>
      </div>` : ''}
      <div class="total-row">
        <span class="total-label">TVA</span>
        <span class="total-value">${formatCurrency(data.total_tax, currency)}</span>
      </div>
      <div class="total-row total-final">
        <span class="total-label">TOTAL TTC</span>
        <span class="total-value">${formatCurrency(data.total_ttc, currency)}</span>
      </div>
    </div>
  </div>

  ${data.notes || data.payment_terms ? `
  <div class="notes-section">
    ${data.notes ? `
    <div class="notes-title">Notes</div>
    <div class="notes-text">${data.notes}</div>
    ` : ''}
    ${data.payment_terms ? `
    <div class="notes-title" style="margin-top:12px">Conditions de paiement</div>
    <div class="notes-text">${data.payment_terms}</div>
    ` : ''}
  </div>
  ` : ''}

  <div class="footer">
    <div class="footer-left">
      ${isInvoice
        ? 'Tout retard de paiement entraîne des pénalités de 1,5%/mois (art. L.441-10 C.com).'
        : `Devis valable 30 jours à compter du ${formatDate(data.date)}.`
      }
    </div>
    <div class="footer-brand">Généré par BusinessOS</div>
  </div>
</body>
</html>`;
}

export function getDocumentHtml(data: PdfDocumentData): string {
  return generateDocumentHtml(data);
}

export function getPdfFilename(data: PdfDocumentData): string {
  const prefix = data.type === 'invoice' ? 'Facture' : 'Devis';
  const safeName = (data.client.name || 'Client').replace(/[^a-zA-Z0-9]/g, '_').substring(0, 20);
  return `${prefix}_${data.number}_${safeName}.pdf`;
}
