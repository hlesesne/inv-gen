/**
 * Utility functions for calculations, formatting, and common operations.
 */

import type { Invoice, InvoiceItem, Totals } from './schema';

/**
 * Format a number as currency
 * @param amount - The amount to format
 * @param currency - Currency code (e.g., 'USD', 'EUR')
 * @param locale - Locale for formatting (defaults to 'en-US')
 * @returns Formatted currency string
 */
export function formatCurrency(
  amount: number,
  currency: string = 'USD',
  locale: string = 'en-US'
): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: currency,
  }).format(amount);
}

/**
 * Format a date string
 * @param dateString - ISO date string
 * @param locale - Locale for formatting (defaults to 'en-US')
 * @returns Formatted date string
 */
export function formatDate(dateString: string, locale: string = 'en-US'): string {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(date);
}

/**
 * Calculate line item total
 * @param item - Invoice line item
 * @returns Line total amount
 */
export function calculateLineTotal(item: InvoiceItem): number {
  let total = item.quantity * item.unitPrice;

  // Apply item-level discount
  if (item.discountPct && item.discountPct > 0) {
    total = total * (1 - item.discountPct / 100);
  }

  // Apply item-level tax
  if (item.taxRatePct && item.taxRatePct > 0) {
    total = total * (1 + item.taxRatePct / 100);
  }

  return total;
}

/**
 * Calculate all totals for an invoice
 * @param invoice - The invoice to calculate totals for
 * @returns Calculated totals object
 */
export function calculateInvoiceTotals(invoice: Invoice): Totals {
  // Calculate subtotal from all line items (before item-level discounts/taxes)
  const subtotal = invoice.items.reduce((sum, item) => {
    return sum + item.quantity * item.unitPrice;
  }, 0);

  // Calculate item-level discounts
  const itemDiscounts = invoice.items.reduce((sum, item) => {
    if (item.discountPct && item.discountPct > 0) {
      return sum + (item.quantity * item.unitPrice * item.discountPct) / 100;
    }
    return sum;
  }, 0);

  // Subtotal after item discounts
  const subtotalAfterItemDiscounts = subtotal - itemDiscounts;

  // Apply global discount
  const globalDiscount = invoice.adjustments.globalDiscountPct
    ? (subtotalAfterItemDiscounts * invoice.adjustments.globalDiscountPct) / 100
    : 0;

  const totalDiscount = itemDiscounts + globalDiscount;

  // Amount after all discounts
  const amountAfterDiscounts = subtotalAfterItemDiscounts - globalDiscount;

  // Add shipping
  const shipping = invoice.adjustments.shipping || 0;
  const amountWithShipping = amountAfterDiscounts + shipping;

  // Calculate item-level taxes
  const itemTaxes = invoice.items.reduce((sum, item) => {
    if (item.taxRatePct && item.taxRatePct > 0) {
      const itemSubtotal = item.quantity * item.unitPrice;
      const itemAfterDiscount = item.discountPct
        ? itemSubtotal * (1 - item.discountPct / 100)
        : itemSubtotal;
      return sum + (itemAfterDiscount * item.taxRatePct) / 100;
    }
    return sum;
  }, 0);

  // Apply global tax
  const globalTax = invoice.adjustments.globalTaxPct
    ? (amountWithShipping * invoice.adjustments.globalTaxPct) / 100
    : 0;

  const totalTax = itemTaxes + globalTax;

  // Grand total
  const grandTotal = amountWithShipping + totalTax;

  // Calculate amount paid
  const amountPaid = invoice.payments.reduce((sum, payment) => {
    return sum + payment.amount;
  }, 0);

  // Balance due
  const balanceDue = grandTotal - amountPaid;

  return {
    subtotal,
    tax: totalTax,
    discount: totalDiscount,
    grandTotal,
    amountPaid,
    balanceDue,
  };
}

/**
 * Debounce function to limit how often a function is called
 * @param func - Function to debounce
 * @param wait - Wait time in milliseconds
 * @returns Debounced function
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout> | null = null;

  return function (this: any, ...args: Parameters<T>) {
    const context = this;

    if (timeout) {
      clearTimeout(timeout);
    }

    timeout = setTimeout(() => {
      func.apply(context, args);
    }, wait);
  };
}

/**
 * Deep clone an object
 * @param obj - Object to clone
 * @returns Cloned object
 */
export function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

/**
 * Check if invoice is overdue
 * @param invoice - Invoice to check
 * @returns True if invoice is overdue
 */
export function isInvoiceOverdue(invoice: Invoice): boolean {
  if (invoice.status === 'paid' || invoice.status === 'archived') {
    return false;
  }

  const dueDate = new Date(invoice.dueDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return dueDate < today && invoice.totals.balanceDue > 0;
}

/**
 * Download a file to the user's device
 * @param content - File content
 * @param filename - Name of the file
 * @param type - MIME type
 */
export function downloadFile(content: string | Blob, filename: string, type: string): void {
  const blob = content instanceof Blob ? content : new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Read a file from user's device
 * @param accept - Accepted file types
 * @returns Promise resolving to file content
 */
export function readFile(accept: string = '*/*'): Promise<string> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;

    input.onchange = async (e: Event) => {
      const target = e.target as HTMLInputElement;
      const file = target.files?.[0];

      if (!file) {
        reject(new Error('No file selected'));
        return;
      }

      try {
        const text = await file.text();
        resolve(text);
      } catch (error) {
        reject(error);
      }
    };

    input.click();
  });
}

/**
 * Validate email format
 * @param email - Email to validate
 * @returns True if email is valid
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Sanitize HTML to prevent XSS
 * @param html - HTML string to sanitize
 * @returns Sanitized HTML string
 */
export function sanitizeHtml(html: string): string {
  const div = document.createElement('div');
  div.textContent = html;
  return div.innerHTML;
}

/**
 * Get currency symbol from currency code
 * @param currencyCode - Currency code (e.g., 'USD')
 * @returns Currency symbol
 */
export function getCurrencySymbol(currencyCode: string): string {
  const currency = (0).toLocaleString('en-US', {
    style: 'currency',
    currency: currencyCode,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).replace(/\d/g, '').trim();

  return currency || currencyCode;
}

/**
 * Calculate days between two dates
 * @param date1 - First date
 * @param date2 - Second date
 * @returns Number of days
 */
export function daysBetween(date1: string, date2: string): number {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  const diffTime = Math.abs(d2.getTime() - d1.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Add days to a date
 * @param date - Date string
 * @param days - Number of days to add
 * @returns New date string
 */
export function addDays(date: string, days: number): string {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

/**
 * Generate a random color in hex format
 * @returns Hex color string
 */
export function randomColor(): string {
  return `#${Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0')}`;
}

/**
 * Check if a color is light or dark
 * @param hexColor - Hex color string
 * @returns True if color is light
 */
export function isLightColor(hexColor: string): boolean {
  const rgb = parseInt(hexColor.slice(1), 16);
  const r = (rgb >> 16) & 0xff;
  const g = (rgb >> 8) & 0xff;
  const b = (rgb >> 0) & 0xff;
  const luma = 0.299 * r + 0.587 * g + 0.114 * b;
  return luma > 128;
}
