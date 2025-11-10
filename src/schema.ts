/**
 * Core data model for the invoice generator application.
 * Defines all interfaces and types used throughout the app.
 */

/**
 * Status of an invoice in its lifecycle
 */
export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'overdue' | 'archived';

/**
 * Theme mode for the application
 */
export type ThemeMode = 'light' | 'dark';

/**
 * Display density for UI elements
 */
export type Density = 'cozy' | 'compact';

/**
 * Page size for PDF generation
 */
export type PageSize = 'Letter' | 'A4';

/**
 * Theme configuration for an invoice
 */
export interface Theme {
  primary: string;
  mode: ThemeMode;
  density: Density;
  pageSize: PageSize;
}

/**
 * Seller/company information
 */
export interface Seller {
  name: string;
  address: string;
  email?: string;
  phone?: string;
  website?: string;
  logoDataUrl?: string;
}

/**
 * Client/customer information
 */
export interface Client {
  name: string;
  address?: string;
  email?: string;
}

/**
 * Additional invoice metadata
 */
export interface InvoiceMeta {
  po?: string;
  reference?: string;
}

/**
 * Line item in an invoice
 */
export interface InvoiceItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  taxRatePct?: number;
  discountPct?: number;
}

/**
 * Global adjustments applied to the invoice
 */
export interface Adjustments {
  shipping?: number;
  globalDiscountPct?: number;
  globalTaxPct?: number;
}

/**
 * Payment record for an invoice
 */
export interface Payment {
  id: string;
  date: string;
  amount: number;
  note?: string;
}

/**
 * Calculated totals for an invoice
 */
export interface Totals {
  subtotal: number;
  tax: number;
  discount: number;
  grandTotal: number;
  amountPaid: number;
  balanceDue: number;
}

/**
 * Complete invoice data structure
 */
export interface Invoice {
  id: string;
  number: string;
  status: InvoiceStatus;
  createdAt: string;
  updatedAt: string;
  issueDate: string;
  dueDate: string;
  currency: string;
  language: string;
  theme: Theme;
  seller: Seller;
  client: Client;
  meta?: InvoiceMeta;
  items: InvoiceItem[];
  adjustments: Adjustments;
  payments: Payment[];
  notes?: string;
  terms?: string;
  totals: Totals;
}

/**
 * Filter options for invoice history
 */
export interface InvoiceFilter {
  status?: InvoiceStatus[];
  dateFrom?: string;
  dateTo?: string;
  searchQuery?: string;
}

/**
 * Summary statistics for invoice history
 */
export interface InvoiceSummary {
  totalInvoices: number;
  totalRevenue: number;
  totalPaid: number;
  totalOutstanding: number;
  byStatus: Record<InvoiceStatus, number>;
}

/**
 * Default theme configuration
 */
export const DEFAULT_THEME: Theme = {
  primary: '#3B82F6',
  mode: 'light',
  density: 'cozy',
  pageSize: 'Letter',
};

/**
 * Default seller information (empty template)
 */
export const DEFAULT_SELLER: Seller = {
  name: '',
  address: '',
};

/**
 * Default client information (empty template)
 */
export const DEFAULT_CLIENT: Client = {
  name: '',
};

/**
 * Default adjustments (no adjustments)
 */
export const DEFAULT_ADJUSTMENTS: Adjustments = {
  shipping: 0,
  globalDiscountPct: 0,
  globalTaxPct: 0,
};

/**
 * Default totals (all zeros)
 */
export const DEFAULT_TOTALS: Totals = {
  subtotal: 0,
  tax: 0,
  discount: 0,
  grandTotal: 0,
  amountPaid: 0,
  balanceDue: 0,
};

/**
 * Currency options for invoices
 */
export const CURRENCIES = [
  { code: 'USD', symbol: '$', name: 'US Dollar' },
  { code: 'EUR', symbol: '€', name: 'Euro' },
  { code: 'GBP', symbol: '£', name: 'British Pound' },
  { code: 'JPY', symbol: '¥', name: 'Japanese Yen' },
  { code: 'CAD', symbol: 'CA$', name: 'Canadian Dollar' },
  { code: 'AUD', symbol: 'A$', name: 'Australian Dollar' },
  { code: 'CHF', symbol: 'CHF', name: 'Swiss Franc' },
  { code: 'CNY', symbol: '¥', name: 'Chinese Yuan' },
  { code: 'INR', symbol: '₹', name: 'Indian Rupee' },
];

/**
 * Generate a unique ID
 */
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Generate an invoice number based on current date and sequence
 */
export function generateInvoiceNumber(sequence: number): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `INV-${year}${month}-${String(sequence).padStart(4, '0')}`;
}

/**
 * Create a new blank invoice with default values
 */
export function createBlankInvoice(sequence: number = 1): Invoice {
  const now = new Date().toISOString();
  const today = new Date().toISOString().split('T')[0];

  return {
    id: generateId(),
    number: generateInvoiceNumber(sequence),
    status: 'draft',
    createdAt: now,
    updatedAt: now,
    issueDate: today,
    dueDate: today,
    currency: 'USD',
    language: 'en',
    theme: { ...DEFAULT_THEME },
    seller: { ...DEFAULT_SELLER },
    client: { ...DEFAULT_CLIENT },
    items: [],
    adjustments: { ...DEFAULT_ADJUSTMENTS },
    payments: [],
    totals: { ...DEFAULT_TOTALS },
  };
}
