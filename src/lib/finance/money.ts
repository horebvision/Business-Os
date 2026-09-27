/**
 * Financial calculation & currency formatting utilities
 * Ensures decimal precision and avoids floating point issues.
 */

export function formatMoney(amount: number | null | undefined, currency: string = 'FCFA'): string {
  const safeAmount = Math.round(Number(amount) || 0);
  return `${safeAmount.toLocaleString('fr-FR')} ${currency}`;
}

export function roundMoney(amount: number): number {
  return Math.round((Number(amount) || 0) * 100) / 100;
}

export interface CalculationLine {
  quantity: number;
  unit_price: number;
  discount_rate?: number;
  tax_rate?: number;
}

export interface DocumentTotals {
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  total: number;
}

export function calculateTotals(
  items: CalculationLine[],
  globalDiscountRate: number = 0,
  defaultTaxRate: number = 18
): DocumentTotals {
  let subtotal = 0;
  let lineTaxTotal = 0;

  for (const item of items) {
    const qty = Number(item.quantity) || 0;
    const price = Number(item.unit_price) || 0;
    const lineDiscount = Number(item.discount_rate) || 0;
    const lineTax = item.tax_rate !== undefined ? Number(item.tax_rate) : defaultTaxRate;

    const baseLineTotal = qty * price;
    const lineDiscountAmount = baseLineTotal * (lineDiscount / 100);
    const lineAfterDiscount = baseLineTotal - lineDiscountAmount;

    subtotal += lineAfterDiscount;
    lineTaxTotal += lineAfterDiscount * (lineTax / 100);
  }

  // Global discount
  const globalDiscountAmount = subtotal * ((Number(globalDiscountRate) || 0) / 100);
  const taxableBase = Math.max(0, subtotal - globalDiscountAmount);

  // Recalculate tax proportionally if global discount applied
  const finalTaxAmount = subtotal > 0 ? (lineTaxTotal * (taxableBase / subtotal)) : 0;
  const total = taxableBase + finalTaxAmount;

  return {
    subtotal: roundMoney(subtotal),
    discountAmount: roundMoney(globalDiscountAmount),
    taxAmount: roundMoney(finalTaxAmount),
    total: Math.round(total), // XOF / FCFA rounded to integer
  };
}

export function calculateDueDate(issueDateStr: string, terms: string): string {
  const issue = issueDateStr ? new Date(issueDateStr) : new Date();
  const date = new Date(issue);

  switch (terms) {
    case 'comptant':
    case 'À réception':
      break;
    case '7 jours':
      date.setDate(date.getDate() + 7);
      break;
    case '15 jours':
      date.setDate(date.getDate() + 15);
      break;
    case '30 jours':
      date.setDate(date.getDate() + 30);
      break;
    case '45 jours':
      date.setDate(date.getDate() + 45);
      break;
    case '60 jours':
      date.setDate(date.getDate() + 60);
      break;
    default:
      date.setDate(date.getDate() + 15);
      break;
  }

  return date.toISOString().split('T')[0];
}

export function getDaysOverdue(dueDateStr: string): number {
  if (!dueDateStr) return 0;
  const due = new Date(dueDateStr);
  const now = new Date();
  // Strip time
  due.setHours(0, 0, 0, 0);
  now.setHours(0, 0, 0, 0);

  const diffMs = now.getTime() - due.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  return Math.max(0, diffDays);
}

export function generateSequenceNumber(prefix: string, count: number): string {
  const year = new Date().getFullYear();
  const nextNum = (count + 1).toString().padStart(4, '0');
  return `${prefix}-${year}-${nextNum}`;
}
