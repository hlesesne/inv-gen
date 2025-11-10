/**
 * IndexedDB wrapper for storing invoices and application data.
 * Provides a clean API for CRUD operations and querying.
 */

import { openDB, DBSchema, IDBPDatabase } from 'idb';
import type { Invoice, InvoiceFilter, InvoiceSummary } from './schema';

/**
 * Database schema definition
 */
interface InvoiceDB extends DBSchema {
  invoices: {
    key: string;
    value: Invoice;
    indexes: {
      'by-status': string;
      'by-date': string;
      'by-number': string;
    };
  };
  settings: {
    key: string;
    value: any;
  };
}

const DB_NAME = 'invoice-generator-db';
const DB_VERSION = 1;

let dbInstance: IDBPDatabase<InvoiceDB> | null = null;

/**
 * Initialize and open the database
 * @returns Promise resolving to the database instance
 */
export async function initDB(): Promise<IDBPDatabase<InvoiceDB>> {
  if (dbInstance) {
    return dbInstance;
  }

  dbInstance = await openDB<InvoiceDB>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      // Create invoices store
      if (!db.objectStoreNames.contains('invoices')) {
        const invoiceStore = db.createObjectStore('invoices', { keyPath: 'id' });
        invoiceStore.createIndex('by-status', 'status');
        invoiceStore.createIndex('by-date', 'createdAt');
        invoiceStore.createIndex('by-number', 'number');
      }

      // Create settings store
      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings');
      }
    },
  });

  return dbInstance;
}

/**
 * Save an invoice to the database
 * @param invoice - Invoice to save
 * @returns Promise resolving when save is complete
 */
export async function saveInvoice(invoice: Invoice): Promise<void> {
  const db = await initDB();
  invoice.updatedAt = new Date().toISOString();
  await db.put('invoices', invoice);
}

/**
 * Get an invoice by ID
 * @param id - Invoice ID
 * @returns Promise resolving to the invoice or undefined
 */
export async function getInvoice(id: string): Promise<Invoice | undefined> {
  const db = await initDB();
  return await db.get('invoices', id);
}

/**
 * Get all invoices
 * @returns Promise resolving to array of all invoices
 */
export async function getAllInvoices(): Promise<Invoice[]> {
  const db = await initDB();
  return await db.getAll('invoices');
}

/**
 * Get invoices with filters applied
 * @param filter - Filter criteria
 * @returns Promise resolving to filtered invoices
 */
export async function getFilteredInvoices(filter: InvoiceFilter): Promise<Invoice[]> {
  const db = await initDB();
  let invoices = await db.getAll('invoices');

  // Filter by status
  if (filter.status && filter.status.length > 0) {
    invoices = invoices.filter((inv) => filter.status!.includes(inv.status));
  }

  // Filter by date range
  if (filter.dateFrom) {
    invoices = invoices.filter((inv) => inv.createdAt >= filter.dateFrom!);
  }

  if (filter.dateTo) {
    invoices = invoices.filter((inv) => inv.createdAt <= filter.dateTo!);
  }

  // Filter by search query
  if (filter.searchQuery) {
    const query = filter.searchQuery.toLowerCase();
    invoices = invoices.filter(
      (inv) =>
        inv.number.toLowerCase().includes(query) ||
        inv.client.name.toLowerCase().includes(query) ||
        inv.seller.name.toLowerCase().includes(query) ||
        (inv.notes && inv.notes.toLowerCase().includes(query))
    );
  }

  // Sort by created date (newest first)
  invoices.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return invoices;
}

/**
 * Delete an invoice by ID
 * @param id - Invoice ID
 * @returns Promise resolving when delete is complete
 */
export async function deleteInvoice(id: string): Promise<void> {
  const db = await initDB();
  await db.delete('invoices', id);
}

/**
 * Duplicate an invoice
 * @param id - ID of invoice to duplicate
 * @returns Promise resolving to the new invoice
 */
export async function duplicateInvoice(id: string): Promise<Invoice | undefined> {
  const db = await initDB();
  const original = await db.get('invoices', id);

  if (!original) {
    return undefined;
  }

  const now = new Date().toISOString();
  const allInvoices = await db.getAll('invoices');
  const nextSequence = allInvoices.length + 1;

  // Import generateId and generateInvoiceNumber
  const { generateId, generateInvoiceNumber } = await import('./schema');

  const duplicate: Invoice = {
    ...original,
    id: generateId(),
    number: generateInvoiceNumber(nextSequence),
    status: 'draft',
    createdAt: now,
    updatedAt: now,
    payments: [],
    totals: {
      ...original.totals,
      amountPaid: 0,
      balanceDue: original.totals.grandTotal,
    },
  };

  await db.put('invoices', duplicate);
  return duplicate;
}

/**
 * Get invoice summary statistics
 * @returns Promise resolving to summary data
 */
export async function getInvoiceSummary(): Promise<InvoiceSummary> {
  const db = await initDB();
  const invoices = await db.getAll('invoices');

  const summary: InvoiceSummary = {
    totalInvoices: invoices.length,
    totalRevenue: 0,
    totalPaid: 0,
    totalOutstanding: 0,
    byStatus: {
      draft: 0,
      sent: 0,
      paid: 0,
      overdue: 0,
      archived: 0,
    },
  };

  invoices.forEach((invoice) => {
    summary.totalRevenue += invoice.totals.grandTotal;
    summary.totalPaid += invoice.totals.amountPaid;
    summary.totalOutstanding += invoice.totals.balanceDue;
    summary.byStatus[invoice.status]++;
  });

  return summary;
}

/**
 * Get the next invoice sequence number
 * @returns Promise resolving to the next sequence number
 */
export async function getNextInvoiceSequence(): Promise<number> {
  const db = await initDB();
  const invoices = await db.getAll('invoices');
  return invoices.length + 1;
}

/**
 * Save a setting to the database
 * @param key - Setting key
 * @param value - Setting value
 * @returns Promise resolving when save is complete
 */
export async function saveSetting(key: string, value: any): Promise<void> {
  const db = await initDB();
  await db.put('settings', value, key);
}

/**
 * Get a setting from the database
 * @param key - Setting key
 * @returns Promise resolving to the setting value
 */
export async function getSetting<T>(key: string): Promise<T | undefined> {
  const db = await initDB();
  return await db.get('settings', key);
}

/**
 * Export all data as JSON
 * @returns Promise resolving to JSON string
 */
export async function exportData(): Promise<string> {
  const db = await initDB();
  const invoices = await db.getAll('invoices');
  const settings = await db.getAll('settings');

  const data = {
    version: DB_VERSION,
    exportedAt: new Date().toISOString(),
    invoices,
    settings,
  };

  return JSON.stringify(data, null, 2);
}

/**
 * Import data from JSON
 * @param jsonData - JSON string containing data
 * @param merge - If true, merge with existing data; if false, replace
 * @returns Promise resolving to number of invoices imported
 */
export async function importData(jsonData: string, merge: boolean = false): Promise<number> {
  const db = await initDB();
  const data = JSON.parse(jsonData);

  if (!merge) {
    // Clear existing data
    const tx = db.transaction(['invoices', 'settings'], 'readwrite');
    await tx.objectStore('invoices').clear();
    await tx.objectStore('settings').clear();
    await tx.done;
  }

  // Import invoices
  const invoices = data.invoices || [];
  for (const invoice of invoices) {
    await db.put('invoices', invoice);
  }

  // Import settings
  if (data.settings) {
    for (const setting of data.settings) {
      await db.put('settings', setting.value, setting.key);
    }
  }

  return invoices.length;
}

/**
 * Clear all data from the database
 * @returns Promise resolving when clear is complete
 */
export async function clearAllData(): Promise<void> {
  const db = await initDB();
  const tx = db.transaction(['invoices', 'settings'], 'readwrite');
  await tx.objectStore('invoices').clear();
  await tx.objectStore('settings').clear();
  await tx.done;
}

/**
 * Check if database is empty
 * @returns Promise resolving to true if database is empty
 */
export async function isDatabaseEmpty(): Promise<boolean> {
  const db = await initDB();
  const count = await db.count('invoices');
  return count === 0;
}
