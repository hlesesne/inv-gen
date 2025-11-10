/**
 * Main application entry point
 * Handles UI interactions, state management, and coordination between modules
 */

import { Invoice, Client, Seller, createBlankInvoice, generateId } from './schema';
import {
  initDB,
  saveInvoice,
  getInvoice,
  getAllInvoices,
  getFilteredInvoices,
  deleteInvoice as deleteInvoiceFromDB,
  duplicateInvoice as duplicateInvoiceInDB,
  getInvoiceSummary,
  getNextInvoiceSequence,
  exportData,
  importData,
  saveSetting,
  getSetting,
} from './storage';
import {
  formatCurrency,
  formatDate,
  calculateInvoiceTotals,
  debounce,
  downloadFile,
  readFile,
  isInvoiceOverdue,
} from './utils';
import { generatePDF, printInvoice } from './pdf';
import { Chart, registerables } from 'chart.js';

// Register Chart.js components
Chart.register(...registerables);

// ========================================
// State Management
// ========================================

let currentInvoice: Invoice | null = null;
let allInvoices: Invoice[] = [];
let currentTheme: 'light' | 'dark' = 'light';

// ========================================
// Initialization
// ========================================

async function init() {
  try {
    showLoading(true);

    // Initialize database
    await initDB();

    // Load theme
    const savedTheme = await getSetting<string>('theme');
    if (savedTheme === 'dark') {
      currentTheme = 'dark';
      document.documentElement.classList.add('dark');
      updateThemeToggleIcon();
    }

    // Load all invoices
    allInvoices = await getAllInvoices();
    populateInvoiceSelect();
    populateClientDatalist();
    populateSellerDatalist();
    populateItemsDatalist();

    // Create new blank invoice or load last edited
    const lastInvoiceId = await getSetting<string>('lastInvoiceId');
    if (lastInvoiceId) {
      const invoice = await getInvoice(lastInvoiceId);
      if (invoice) {
        currentInvoice = invoice;
      }
    }

    if (!currentInvoice) {
      const sequence = await getNextInvoiceSequence();
      currentInvoice = createBlankInvoice(sequence);
    }

    // Render the invoice form
    renderInvoiceForm();
    updateTotalsDisplay();

    // Setup event listeners
    setupEventListeners();

    showToast('Application loaded successfully', 'success');
  } catch (error) {
    console.error('Initialization error:', error);
    showToast('Failed to initialize application', 'error');
  } finally {
    showLoading(false);
  }
}

// ========================================
// Event Listeners
// ========================================

function setupEventListeners() {
  // Header buttons
  document.getElementById('theme-toggle')?.addEventListener('click', toggleTheme);
  document.getElementById('view-history')?.addEventListener('click', showHistoryView);
  document.getElementById('new-invoice')?.addEventListener('click', createNewInvoice);

  // Toolbar buttons
  document.getElementById('save-invoice')?.addEventListener('click', saveCurrentInvoice);
  document.getElementById('save-invoice-bottom')?.addEventListener('click', saveCurrentInvoice);
  document.getElementById('duplicate-invoice')?.addEventListener('click', duplicateCurrentInvoice);
  document.getElementById('download-pdf')?.addEventListener('click', downloadPDF);
  document.getElementById('print-invoice')?.addEventListener('click', printCurrentInvoice);

  // Invoice selector
  document.getElementById('invoice-select')?.addEventListener('change', onInvoiceSelectChange);

  // Form inputs - debounced auto-update
  const formInputs = document.querySelectorAll('.invoice-form input, .invoice-form select, .invoice-form textarea');
  formInputs.forEach((input) => {
    input.addEventListener('input', debounce(() => {
      updateInvoiceFromForm();
      updateTotalsDisplay();
    }, 300));
  });

  // Logo upload
  document.getElementById('seller-logo')?.addEventListener('change', onLogoUpload);
  document.getElementById('change-logo')?.addEventListener('click', () => {
    document.getElementById('seller-logo')?.click();
  });

  // Add item/payment buttons
  document.getElementById('add-item')?.addEventListener('click', addLineItem);
  document.getElementById('add-payment')?.addEventListener('click', addPayment);

  // Client autocomplete
  document.getElementById('client-name')?.addEventListener('change', onClientNameChange);
  document.getElementById('client-name')?.addEventListener('blur', onClientNameChange);

  // Seller autocomplete
  document.getElementById('seller-name')?.addEventListener('change', onSellerNameChange);
  document.getElementById('seller-name')?.addEventListener('blur', onSellerNameChange);

  // History view buttons
  document.getElementById('close-history')?.addEventListener('click', showEditorView);
  document.getElementById('export-data')?.addEventListener('click', exportAllData);
  document.getElementById('import-data')?.addEventListener('click', importAllData);
  document.getElementById('view-analytics')?.addEventListener('click', showAnalyticsView);

  // Analytics view buttons
  document.getElementById('close-analytics')?.addEventListener('click', showHistoryView);

  // History filters
  document.getElementById('search-invoices')?.addEventListener('input', debounce(renderHistoryView, 300));
  document.getElementById('filter-status')?.addEventListener('change', renderHistoryView);

  // Keyboard shortcuts
  document.addEventListener('keydown', handleKeyboardShortcuts);
}

// ========================================
// Invoice Form Management
// ========================================

function renderInvoiceForm() {
  if (!currentInvoice) return;

  // Invoice details
  setValue('invoice-number', currentInvoice.number);
  setValue('invoice-status', currentInvoice.status);
  setValue('issue-date', currentInvoice.issueDate);
  setValue('due-date', currentInvoice.dueDate);
  setValue('currency', currentInvoice.currency);
  setValue('theme-color', currentInvoice.theme.primary);

  // Seller
  setValue('seller-name', currentInvoice.seller.name);
  setValue('seller-address', currentInvoice.seller.address);
  setValue('seller-email', currentInvoice.seller.email || '');
  setValue('seller-phone', currentInvoice.seller.phone || '');
  setValue('seller-website', currentInvoice.seller.website || '');

  // Client
  setValue('client-name', currentInvoice.client.name);
  setValue('client-address', currentInvoice.client.address || '');
  setValue('client-email', currentInvoice.client.email || '');

  // Adjustments
  setValue('shipping', String(currentInvoice.adjustments.shipping || 0));
  setValue('global-discount', String(currentInvoice.adjustments.globalDiscountPct || 0));
  setValue('global-tax', String(currentInvoice.adjustments.globalTaxPct || 0));

  // Notes
  setValue('notes', currentInvoice.notes || '');
  setValue('terms', currentInvoice.terms || '');

  // Render line items
  renderLineItems();

  // Render payments
  renderPayments();

  // Update logo preview
  updateLogoPreview();
}

function updateInvoiceFromForm() {
  if (!currentInvoice) return;

  // Update invoice details
  currentInvoice.number = getValue('invoice-number');
  currentInvoice.status = getValue('invoice-status') as any;
  currentInvoice.issueDate = getValue('issue-date');
  currentInvoice.dueDate = getValue('due-date');
  currentInvoice.currency = getValue('currency');
  currentInvoice.theme.primary = getValue('theme-color');

  // Update seller
  currentInvoice.seller.name = getValue('seller-name');
  currentInvoice.seller.address = getValue('seller-address');
  currentInvoice.seller.email = getValue('seller-email') || undefined;
  currentInvoice.seller.phone = getValue('seller-phone') || undefined;
  currentInvoice.seller.website = getValue('seller-website') || undefined;

  // Update client
  currentInvoice.client.name = getValue('client-name');
  currentInvoice.client.address = getValue('client-address') || undefined;
  currentInvoice.client.email = getValue('client-email') || undefined;

  // Update adjustments
  currentInvoice.adjustments.shipping = parseFloat(getValue('shipping')) || 0;
  currentInvoice.adjustments.globalDiscountPct = parseFloat(getValue('global-discount')) || 0;
  currentInvoice.adjustments.globalTaxPct = parseFloat(getValue('global-tax')) || 0;

  // Update notes
  currentInvoice.notes = getValue('notes') || undefined;
  currentInvoice.terms = getValue('terms') || undefined;

  // Recalculate totals
  currentInvoice.totals = calculateInvoiceTotals(currentInvoice);
}

// ========================================
// Line Items
// ========================================

function renderLineItems() {
  if (!currentInvoice) return;

  const container = document.getElementById('items-container');
  if (!container) return;

  container.innerHTML = '';

  currentInvoice.items.forEach((item, index) => {
    const row = createLineItemRow(item, index);
    container.appendChild(row);
  });
}

function createLineItemRow(item: any, index: number) {
  const row = document.createElement('div');
  row.className = 'item-row';
  row.innerHTML = `
    <div class="form-group">
      <label>Description</label>
      <input type="text" class="form-input" data-item-index="${index}" data-field="description" value="${item.description || ''}" list="items-list">
    </div>
    <div class="form-group">
      <label>Quantity</label>
      <input type="number" class="form-input" data-item-index="${index}" data-field="quantity" value="${item.quantity}" step="1" min="0">
    </div>
    <div class="form-group">
      <label>Unit Price</label>
      <input type="number" class="form-input" data-item-index="${index}" data-field="unitPrice" value="${item.unitPrice}" step="0.01" min="0">
    </div>
    <div class="form-group">
      <label>Discount %</label>
      <input type="number" class="form-input" data-item-index="${index}" data-field="discountPct" value="${item.discountPct || 0}" step="0.01" min="0" max="100">
    </div>
    <div class="form-group">
      <label>Tax %</label>
      <input type="number" class="form-input" data-item-index="${index}" data-field="taxRatePct" value="${item.taxRatePct || 0}" step="0.01" min="0" max="100">
    </div>
    <button type="button" class="btn btn-sm btn-danger" data-remove-item="${index}">
      <span class="icon">🗑️</span>
    </button>
  `;

  // Add event listeners
  row.querySelectorAll('input').forEach((input) => {
    const field = input.dataset.field!;

    // Special handling for description field to trigger autocomplete
    if (field === 'description') {
      input.addEventListener('change', () => {
        onItemDescriptionChange(index, input as HTMLInputElement);
      });
    }

    // Regular input handling for all fields
    input.addEventListener('input', debounce(() => {
      onLineItemChange(index, field, input.value);
    }, 300));
  });

  row.querySelector(`[data-remove-item="${index}"]`)?.addEventListener('click', () => {
    removeLineItem(index);
  });

  return row;
}

function addLineItem() {
  if (!currentInvoice) return;

  const newItem = {
    id: generateId(),
    description: '',
    quantity: 1,
    unitPrice: 0,
  };

  currentInvoice.items.push(newItem);
  renderLineItems();
  updateTotalsDisplay();
}

function onLineItemChange(index: number, field: string, value: string) {
  if (!currentInvoice || !currentInvoice.items[index]) return;

  const item = currentInvoice.items[index];

  switch (field) {
    case 'description':
      item.description = value;
      break;
    case 'quantity':
      item.quantity = parseFloat(value) || 0;
      break;
    case 'unitPrice':
      item.unitPrice = parseFloat(value) || 0;
      break;
    case 'discountPct':
      item.discountPct = parseFloat(value) || undefined;
      break;
    case 'taxRatePct':
      item.taxRatePct = parseFloat(value) || undefined;
      break;
  }

  currentInvoice.totals = calculateInvoiceTotals(currentInvoice);
  updateTotalsDisplay();
}

function removeLineItem(index: number) {
  if (!currentInvoice) return;

  currentInvoice.items.splice(index, 1);
  renderLineItems();
  currentInvoice.totals = calculateInvoiceTotals(currentInvoice);
  updateTotalsDisplay();
}

// ========================================
// Payments
// ========================================

function renderPayments() {
  if (!currentInvoice) return;

  const container = document.getElementById('payments-container');
  if (!container) return;

  container.innerHTML = '';

  if (currentInvoice.payments.length === 0) {
    container.innerHTML = '<p style="color: var(--color-text-secondary);">No payments recorded yet.</p>';
    return;
  }

  currentInvoice.payments.forEach((payment, index) => {
    const row = createPaymentRow(payment, index);
    container.appendChild(row);
  });
}

function createPaymentRow(payment: any, index: number) {
  const row = document.createElement('div');
  row.className = 'payment-row';
  row.innerHTML = `
    <div class="form-group">
      <label>Date</label>
      <input type="date" class="form-input" data-payment-index="${index}" data-field="date" value="${payment.date}">
    </div>
    <div class="form-group">
      <label>Amount</label>
      <input type="number" class="form-input" data-payment-index="${index}" data-field="amount" value="${payment.amount}" step="0.01" min="0">
    </div>
    <div class="form-group">
      <label>Note</label>
      <input type="text" class="form-input" data-payment-index="${index}" data-field="note" value="${payment.note || ''}">
    </div>
    <button type="button" class="btn btn-sm btn-danger" data-remove-payment="${index}">
      <span class="icon">🗑️</span>
    </button>
  `;

  // Add event listeners
  row.querySelectorAll('input').forEach((input) => {
    input.addEventListener('input', debounce(() => {
      onPaymentChange(index, input.dataset.field!, input.value);
    }, 300));
  });

  row.querySelector(`[data-remove-payment="${index}"]`)?.addEventListener('click', () => {
    removePayment(index);
  });

  return row;
}

function addPayment() {
  if (!currentInvoice) return;

  const newPayment = {
    id: generateId(),
    date: new Date().toISOString().split('T')[0],
    amount: 0,
    note: '',
  };

  currentInvoice.payments.push(newPayment);
  renderPayments();
  currentInvoice.totals = calculateInvoiceTotals(currentInvoice);
  updateTotalsDisplay();

  // Auto-mark as paid if balance is zero
  if (currentInvoice.totals.balanceDue === 0 && currentInvoice.totals.grandTotal > 0) {
    currentInvoice.status = 'paid';
    setValue('invoice-status', 'paid');
  }
}

function onPaymentChange(index: number, field: string, value: string) {
  if (!currentInvoice || !currentInvoice.payments[index]) return;

  const payment = currentInvoice.payments[index];

  switch (field) {
    case 'date':
      payment.date = value;
      break;
    case 'amount':
      payment.amount = parseFloat(value) || 0;
      break;
    case 'note':
      payment.note = value || undefined;
      break;
  }

  currentInvoice.totals = calculateInvoiceTotals(currentInvoice);
  updateTotalsDisplay();

  // Auto-mark as paid if balance is zero
  if (currentInvoice.totals.balanceDue === 0 && currentInvoice.totals.grandTotal > 0) {
    currentInvoice.status = 'paid';
    setValue('invoice-status', 'paid');
  }
}

function removePayment(index: number) {
  if (!currentInvoice) return;

  currentInvoice.payments.splice(index, 1);
  renderPayments();
  currentInvoice.totals = calculateInvoiceTotals(currentInvoice);
  updateTotalsDisplay();

  // Auto-mark as paid if balance is zero, or revert to sent/draft if balance > 0
  if (currentInvoice.totals.balanceDue === 0 && currentInvoice.totals.grandTotal > 0) {
    currentInvoice.status = 'paid';
    setValue('invoice-status', 'paid');
  } else if (currentInvoice.status === 'paid' && currentInvoice.totals.balanceDue > 0) {
    // Revert from paid if balance is now due
    currentInvoice.status = 'sent';
    setValue('invoice-status', 'sent');
  }
}

// ========================================
// Totals Display
// ========================================

function updateTotalsDisplay() {
  if (!currentInvoice) return;

  const currency = currentInvoice.currency;

  setText('total-subtotal', formatCurrency(currentInvoice.totals.subtotal, currency));
  setText('total-discount', formatCurrency(currentInvoice.totals.discount, currency));
  setText('total-tax', formatCurrency(currentInvoice.totals.tax, currency));
  setText('total-grand', formatCurrency(currentInvoice.totals.grandTotal, currency));
  setText('total-paid', formatCurrency(currentInvoice.totals.amountPaid, currency));
  setText('total-balance', formatCurrency(currentInvoice.totals.balanceDue, currency));
}

// ========================================
// Invoice Actions
// ========================================

async function createNewInvoice() {
  const sequence = await getNextInvoiceSequence();
  currentInvoice = createBlankInvoice(sequence);

  // Load last used seller information
  const savedSeller = await getSetting<Seller>('lastSeller');
  if (savedSeller) {
    currentInvoice.seller = savedSeller;
  }

  renderInvoiceForm();
  updateTotalsDisplay();
  populateInvoiceSelect();
  showToast('New invoice created', 'success');
}

async function saveCurrentInvoice() {
  if (!currentInvoice) return;

  try {
    showLoading(true);
    updateInvoiceFromForm();
    await saveInvoice(currentInvoice);
    await saveSetting('lastInvoiceId', currentInvoice.id);

    // Save seller information for future invoices
    await saveSetting('lastSeller', currentInvoice.seller);

    allInvoices = await getAllInvoices();
    populateInvoiceSelect();
    populateClientDatalist();
    populateSellerDatalist();
    populateItemsDatalist();

    showToast('Invoice saved successfully', 'success');
  } catch (error) {
    console.error('Save error:', error);
    showToast('Failed to save invoice', 'error');
  } finally {
    showLoading(false);
  }
}

async function duplicateCurrentInvoice() {
  if (!currentInvoice) return;

  try {
    showLoading(true);
    await saveInvoice(currentInvoice);
    const duplicated = await duplicateInvoiceInDB(currentInvoice.id);

    if (duplicated) {
      currentInvoice = duplicated;
      allInvoices = await getAllInvoices();
      populateInvoiceSelect();
      renderInvoiceForm();
      updateTotalsDisplay();
      showToast('Invoice duplicated', 'success');
    }
  } catch (error) {
    console.error('Duplicate error:', error);
    showToast('Failed to duplicate invoice', 'error');
  } finally {
    showLoading(false);
  }
}

async function downloadPDF() {
  if (!currentInvoice) return;

  try {
    showLoading(true);
    updateInvoiceFromForm();

    // Auto-change draft invoices to sent when downloading PDF
    if (currentInvoice.status === 'draft') {
      currentInvoice.status = 'sent';
      setValue('invoice-status', 'sent');
      await saveInvoice(currentInvoice);
    }

    await generatePDF(currentInvoice);
    showToast('PDF downloaded', 'success');
  } catch (error) {
    console.error('PDF error:', error);
    showToast('Failed to generate PDF', 'error');
  } finally {
    showLoading(false);
  }
}

function printCurrentInvoice() {
  if (!currentInvoice) return;

  try {
    updateInvoiceFromForm();
    printInvoice(currentInvoice);
  } catch (error) {
    console.error('Print error:', error);
    showToast('Failed to print invoice', 'error');
  }
}

// ========================================
// Invoice Selector
// ========================================

function populateInvoiceSelect() {
  const select = document.getElementById('invoice-select') as HTMLSelectElement;
  if (!select) return;

  select.innerHTML = '<option value="">New Invoice</option>';

  allInvoices.forEach((invoice) => {
    const option = document.createElement('option');
    option.value = invoice.id;
    option.textContent = `${invoice.number} - ${invoice.client.name || 'Unnamed'}`;
    if (currentInvoice && invoice.id === currentInvoice.id) {
      option.selected = true;
    }
    select.appendChild(option);
  });
}

async function onInvoiceSelectChange(event: Event) {
  const select = event.target as HTMLSelectElement;
  const invoiceId = select.value;

  if (!invoiceId) {
    await createNewInvoice();
    return;
  }

  try {
    showLoading(true);
    const invoice = await getInvoice(invoiceId);
    if (invoice) {
      currentInvoice = invoice;
      renderInvoiceForm();
      updateTotalsDisplay();
      await saveSetting('lastInvoiceId', invoice.id);
    }
  } catch (error) {
    console.error('Load error:', error);
    showToast('Failed to load invoice', 'error');
  } finally {
    showLoading(false);
  }
}

// ========================================
// Logo Upload
// ========================================

async function onLogoUpload(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];

  if (!file || !currentInvoice) return;

  try {
    const reader = new FileReader();
    reader.onload = (e) => {
      if (currentInvoice && e.target?.result) {
        currentInvoice.seller.logoDataUrl = e.target.result as string;
        updateLogoPreview();
        showToast('Logo uploaded', 'success');
      }
    };
    reader.readAsDataURL(file);
  } catch (error) {
    console.error('Logo upload error:', error);
    showToast('Failed to upload logo', 'error');
  }
}

function updateLogoPreview() {
  const previewContainer = document.getElementById('logo-preview-container');
  const previewImg = document.getElementById('logo-preview') as HTMLImageElement;
  const logoInput = document.getElementById('seller-logo') as HTMLInputElement;

  if (!previewContainer || !previewImg || !logoInput) return;

  if (currentInvoice?.seller.logoDataUrl) {
    previewImg.src = currentInvoice.seller.logoDataUrl;
    previewContainer.classList.remove('hidden');
    logoInput.classList.add('hidden');
  } else {
    previewContainer.classList.add('hidden');
    logoInput.classList.remove('hidden');
  }
}

// ========================================
// History View
// ========================================

function showHistoryView() {
  document.getElementById('editor-view')?.classList.remove('active');
  document.getElementById('history-view')?.classList.add('active');
  renderHistoryView();
}

function showEditorView() {
  document.getElementById('history-view')?.classList.remove('active');
  document.getElementById('editor-view')?.classList.add('active');
}

async function renderHistoryView() {
  try {
    showLoading(true);

    // Get filter values
    const searchQuery = getValue('search-invoices');
    const statusFilter = getValue('filter-status');

    const filter: any = {};
    if (searchQuery) filter.searchQuery = searchQuery;
    if (statusFilter) filter.status = [statusFilter];

    // Get filtered invoices
    const invoices = await getFilteredInvoices(filter);

    // Render summary
    const summary = await getInvoiceSummary();
    renderSummary(summary);

    // Render invoice list
    renderInvoiceList(invoices);
  } catch (error) {
    console.error('History view error:', error);
    showToast('Failed to load history', 'error');
  } finally {
    showLoading(false);
  }
}

function renderSummary(summary: any) {
  const container = document.getElementById('history-summary');
  if (!container) return;

  container.innerHTML = `
    <div class="summary-card">
      <h3>Total Invoices</h3>
      <div class="value">${summary.totalInvoices}</div>
    </div>
    <div class="summary-card">
      <h3>Total Revenue</h3>
      <div class="value">${formatCurrency(summary.totalRevenue, 'USD')}</div>
    </div>
    <div class="summary-card">
      <h3>Total Paid</h3>
      <div class="value text-success">${formatCurrency(summary.totalPaid, 'USD')}</div>
    </div>
    <div class="summary-card">
      <h3>Outstanding</h3>
      <div class="value text-danger">${formatCurrency(summary.totalOutstanding, 'USD')}</div>
    </div>
  `;
}

function renderInvoiceList(invoices: Invoice[]) {
  const container = document.getElementById('history-list');
  if (!container) return;

  if (invoices.length === 0) {
    container.innerHTML = '<p style="text-align: center; color: var(--color-text-secondary);">No invoices found.</p>';
    return;
  }

  container.innerHTML = '';

  invoices.forEach((invoice) => {
    const card = createInvoiceCard(invoice);
    container.appendChild(card);
  });
}

function createInvoiceCard(invoice: Invoice) {
  const card = document.createElement('div');
  card.className = 'invoice-card';

  const isOverdue = isInvoiceOverdue(invoice);

  card.innerHTML = `
    <div class="invoice-card-header">
      <div>
        <div class="invoice-card-title">${invoice.number}</div>
        <div class="invoice-card-meta">Created: ${formatDate(invoice.createdAt)}</div>
      </div>
      <span class="invoice-card-status status-${invoice.status}">${invoice.status}</span>
    </div>
    <div class="invoice-card-body">
      <div class="invoice-card-field">
        <label>Client</label>
        <value>${invoice.client.name}</value>
      </div>
      <div class="invoice-card-field">
        <label>Amount</label>
        <value>${formatCurrency(invoice.totals.grandTotal, invoice.currency)}</value>
      </div>
      <div class="invoice-card-field">
        <label>Balance Due</label>
        <value class="${invoice.totals.balanceDue > 0 ? 'text-danger' : 'text-success'}">${formatCurrency(invoice.totals.balanceDue, invoice.currency)}</value>
      </div>
      <div class="invoice-card-field">
        <label>Due Date</label>
        <value class="${isOverdue ? 'text-danger' : ''}">${formatDate(invoice.dueDate)}</value>
      </div>
    </div>
    <div class="invoice-card-actions">
      ${invoice.totals.balanceDue > 0 ? `
      <button class="btn btn-sm btn-success" data-action="mark-paid" data-id="${invoice.id}">
        <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
        </svg>
        <span>Mark Paid</span>
      </button>
      ` : ''}
      <button class="btn btn-sm btn-primary" data-action="edit" data-id="${invoice.id}">
        <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
        </svg>
        <span>Edit</span>
      </button>
      <button class="btn btn-sm btn-secondary" data-action="duplicate" data-id="${invoice.id}">
        <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/>
        </svg>
        <span>Duplicate</span>
      </button>
      <button class="btn btn-sm btn-secondary" data-action="pdf" data-id="${invoice.id}">
        <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
        </svg>
        <span>PDF</span>
      </button>
      <button class="btn btn-sm btn-danger" data-action="delete" data-id="${invoice.id}">
        <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
        </svg>
        <span>Delete</span>
      </button>
    </div>
  `;

  // Add event listeners
  card.querySelector('[data-action="mark-paid"]')?.addEventListener('click', () => markInvoiceAsPaid(invoice.id));
  card.querySelector('[data-action="edit"]')?.addEventListener('click', () => editInvoice(invoice.id));
  card.querySelector('[data-action="duplicate"]')?.addEventListener('click', () => duplicateInvoice(invoice.id));
  card.querySelector('[data-action="pdf"]')?.addEventListener('click', () => downloadInvoicePDF(invoice.id));
  card.querySelector('[data-action="delete"]')?.addEventListener('click', () => deleteInvoice(invoice.id));

  return card;
}

async function editInvoice(id: string) {
  const invoice = await getInvoice(id);
  if (invoice) {
    currentInvoice = invoice;
    renderInvoiceForm();
    updateTotalsDisplay();
    populateInvoiceSelect();
    showEditorView();
  }
}

async function duplicateInvoice(id: string) {
  try {
    showLoading(true);
    const duplicated = await duplicateInvoiceInDB(id);
    if (duplicated) {
      showToast('Invoice duplicated', 'success');
      renderHistoryView();
    }
  } catch (error) {
    console.error('Duplicate error:', error);
    showToast('Failed to duplicate invoice', 'error');
  } finally {
    showLoading(false);
  }
}

async function downloadInvoicePDF(id: string) {
  try {
    showLoading(true);
    const invoice = await getInvoice(id);
    if (invoice) {
      await generatePDF(invoice);
      showToast('PDF downloaded', 'success');
    }
  } catch (error) {
    console.error('PDF error:', error);
    showToast('Failed to generate PDF', 'error');
  } finally {
    showLoading(false);
  }
}

async function markInvoiceAsPaid(id: string) {
  try {
    showLoading(true);
    const invoice = await getInvoice(id);
    if (!invoice) return;

    // Add payment for the full balance due
    const payment = {
      id: generateId(),
      date: new Date().toISOString().split('T')[0],
      amount: invoice.totals.balanceDue,
      note: 'Marked as paid from history',
    };

    invoice.payments.push(payment);
    invoice.totals = calculateInvoiceTotals(invoice);
    invoice.status = 'paid';

    await saveInvoice(invoice);
    showToast('Invoice marked as paid', 'success');
    renderHistoryView();
  } catch (error) {
    console.error('Mark paid error:', error);
    showToast('Failed to mark invoice as paid', 'error');
  } finally {
    showLoading(false);
  }
}

async function deleteInvoice(id: string) {
  if (!confirm('Are you sure you want to delete this invoice? This action cannot be undone.')) {
    return;
  }

  try {
    showLoading(true);
    await deleteInvoiceFromDB(id);
    showToast('Invoice deleted', 'success');
    renderHistoryView();
  } catch (error) {
    console.error('Delete error:', error);
    showToast('Failed to delete invoice', 'error');
  } finally {
    showLoading(false);
  }
}

// ========================================
// Import/Export
// ========================================

async function exportAllData() {
  try {
    showLoading(true);
    const jsonData = await exportData();
    const filename = `invoice-generator-backup-${new Date().toISOString().split('T')[0]}.json`;
    downloadFile(jsonData, filename, 'application/json');
    showToast('Data exported successfully', 'success');
  } catch (error) {
    console.error('Export error:', error);
    showToast('Failed to export data', 'error');
  } finally {
    showLoading(false);
  }
}

async function importAllData() {
  try {
    const jsonData = await readFile('application/json');
    const count = await importData(jsonData, false);
    allInvoices = await getAllInvoices();
    showToast(`Imported ${count} invoices`, 'success');
    renderHistoryView();
  } catch (error) {
    console.error('Import error:', error);
    showToast('Failed to import data', 'error');
  }
}

// ========================================
// Analytics Dashboard
// ========================================

let revenueChart: Chart | null = null;
let statusChart: Chart | null = null;
let clientsChart: Chart | null = null;

function showAnalyticsView() {
  document.getElementById('history-view')?.classList.remove('active');
  document.getElementById('analytics-view')?.classList.add('active');
  renderAnalytics();
}

async function renderAnalytics() {
  try {
    showLoading(true);
    const invoices = await getAllInvoices();

    // Render metrics
    renderAnalyticsMetrics(invoices);

    // Render charts
    renderRevenueChart(invoices);
    renderStatusChart(invoices);
    renderClientsChart(invoices);

    // Render aging report
    renderAgingReport(invoices);
  } catch (error) {
    console.error('Analytics error:', error);
    showToast('Failed to load analytics', 'error');
  } finally {
    showLoading(false);
  }
}

function renderAnalyticsMetrics(invoices: Invoice[]) {
  const container = document.getElementById('analytics-metrics');
  if (!container) return;

  const totalRevenue = invoices.reduce((sum, inv) => sum + inv.totals.grandTotal, 0);
  const totalPaid = invoices.reduce((sum, inv) => sum + inv.totals.amountPaid, 0);
  const totalOutstanding = invoices.reduce((sum, inv) => sum + inv.totals.balanceDue, 0);
  const avgInvoiceValue = invoices.length > 0 ? totalRevenue / invoices.length : 0;

  container.innerHTML = `
    <div class="summary-card">
      <h3>Total Revenue</h3>
      <div class="value">${formatCurrency(totalRevenue, 'USD')}</div>
    </div>
    <div class="summary-card">
      <h3>Total Paid</h3>
      <div class="value text-success">${formatCurrency(totalPaid, 'USD')}</div>
    </div>
    <div class="summary-card">
      <h3>Outstanding</h3>
      <div class="value text-danger">${formatCurrency(totalOutstanding, 'USD')}</div>
    </div>
    <div class="summary-card">
      <h3>Avg Invoice Value</h3>
      <div class="value">${formatCurrency(avgInvoiceValue, 'USD')}</div>
    </div>
  `;
}

function renderRevenueChart(invoices: Invoice[]) {
  const canvas = document.getElementById('revenue-chart') as HTMLCanvasElement;
  if (!canvas) return;

  // Destroy existing chart
  if (revenueChart) {
    revenueChart.destroy();
  }

  // Group invoices by month
  const monthlyData = new Map<string, number>();

  invoices.forEach((invoice) => {
    const date = new Date(invoice.issueDate);
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const current = monthlyData.get(monthKey) || 0;
    monthlyData.set(monthKey, current + invoice.totals.grandTotal);
  });

  // Sort by month and get last 12 months
  const sortedMonths = Array.from(monthlyData.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-12);

  const labels = sortedMonths.map(([month]) => {
    const [year, monthNum] = month.split('-');
    const date = new Date(parseInt(year), parseInt(monthNum) - 1);
    return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  });

  const data = sortedMonths.map(([, total]) => total);

  const isDark = currentTheme === 'dark';
  const textColor = isDark ? '#e5e7eb' : '#374151';
  const gridColor = isDark ? '#374151' : '#e5e7eb';

  revenueChart = new Chart(canvas, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Revenue',
        data,
        borderColor: '#3b82f6',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        tension: 0.4,
        fill: true,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: {
          labels: {
            color: textColor,
          },
        },
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            color: textColor,
            callback: function(value) {
              return '$' + value.toLocaleString();
            },
          },
          grid: {
            color: gridColor,
          },
        },
        x: {
          ticks: {
            color: textColor,
          },
          grid: {
            color: gridColor,
          },
        },
      },
    },
  });
}

function renderStatusChart(invoices: Invoice[]) {
  const canvas = document.getElementById('status-chart') as HTMLCanvasElement;
  if (!canvas) return;

  // Destroy existing chart
  if (statusChart) {
    statusChart.destroy();
  }

  // Count by status
  const statusCounts = {
    draft: 0,
    sent: 0,
    paid: 0,
    overdue: 0,
    archived: 0,
  };

  invoices.forEach((invoice) => {
    if (invoice.status in statusCounts) {
      statusCounts[invoice.status as keyof typeof statusCounts]++;
    }
  });

  const isDark = currentTheme === 'dark';
  const textColor = isDark ? '#e5e7eb' : '#374151';

  statusChart = new Chart(canvas, {
    type: 'doughnut',
    data: {
      labels: ['Draft', 'Sent', 'Paid', 'Overdue', 'Archived'],
      datasets: [{
        data: [
          statusCounts.draft,
          statusCounts.sent,
          statusCounts.paid,
          statusCounts.overdue,
          statusCounts.archived,
        ],
        backgroundColor: [
          '#6b7280', // gray for draft
          '#3b82f6', // blue for sent
          '#10b981', // green for paid
          '#ef4444', // red for overdue
          '#9ca3af', // gray for archived
        ],
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: {
          labels: {
            color: textColor,
          },
        },
      },
    },
  });
}

function renderClientsChart(invoices: Invoice[]) {
  const canvas = document.getElementById('clients-chart') as HTMLCanvasElement;
  if (!canvas) return;

  // Destroy existing chart
  if (clientsChart) {
    clientsChart.destroy();
  }

  // Group by client
  const clientTotals = new Map<string, number>();

  invoices.forEach((invoice) => {
    const clientName = invoice.client.name || 'Unnamed';
    const current = clientTotals.get(clientName) || 0;
    clientTotals.set(clientName, current + invoice.totals.grandTotal);
  });

  // Get top 10 clients
  const topClients = Array.from(clientTotals.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  const labels = topClients.map(([name]) => name);
  const data = topClients.map(([, total]) => total);

  const isDark = currentTheme === 'dark';
  const textColor = isDark ? '#e5e7eb' : '#374151';
  const gridColor = isDark ? '#374151' : '#e5e7eb';

  clientsChart = new Chart(canvas, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Revenue',
        data,
        backgroundColor: '#3b82f6',
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      indexAxis: 'y',
      plugins: {
        legend: {
          display: false,
        },
      },
      scales: {
        x: {
          beginAtZero: true,
          ticks: {
            color: textColor,
            callback: function(value) {
              return '$' + value.toLocaleString();
            },
          },
          grid: {
            color: gridColor,
          },
        },
        y: {
          ticks: {
            color: textColor,
          },
          grid: {
            color: gridColor,
          },
        },
      },
    },
  });
}

function renderAgingReport(invoices: Invoice[]) {
  const container = document.getElementById('aging-report');
  if (!container) return;

  // Filter unpaid invoices
  const unpaidInvoices = invoices.filter((inv) => inv.totals.balanceDue > 0);

  if (unpaidInvoices.length === 0) {
    container.innerHTML = '<p class="text-center text-gray-500 dark:text-gray-400 py-8">No outstanding invoices</p>';
    return;
  }

  // Calculate days overdue
  const today = new Date();
  const agingData = unpaidInvoices.map((invoice) => {
    const dueDate = new Date(invoice.dueDate);
    const daysOverdue = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));

    let ageBucket = 'Current';
    if (daysOverdue > 90) ageBucket = '90+ days';
    else if (daysOverdue > 60) ageBucket = '61-90 days';
    else if (daysOverdue > 30) ageBucket = '31-60 days';
    else if (daysOverdue > 0) ageBucket = '1-30 days';

    return {
      invoice,
      daysOverdue,
      ageBucket,
    };
  });

  // Sort by days overdue (descending)
  agingData.sort((a, b) => b.daysOverdue - a.daysOverdue);

  const isDark = currentTheme === 'dark';
  const tableClass = isDark ? 'dark' : '';

  container.innerHTML = `
    <table class="w-full text-sm ${tableClass}">
      <thead class="bg-gray-50 dark:bg-gray-900">
        <tr>
          <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Invoice</th>
          <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Client</th>
          <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Due Date</th>
          <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Age</th>
          <th class="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Balance Due</th>
        </tr>
      </thead>
      <tbody class="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
        ${agingData.map((item) => {
          const overdueClass = item.daysOverdue > 0 ? 'text-red-600 dark:text-red-400 font-semibold' : '';
          return `
            <tr class="hover:bg-gray-50 dark:hover:bg-gray-700">
              <td class="px-4 py-3 text-gray-900 dark:text-gray-100">${item.invoice.number}</td>
              <td class="px-4 py-3 text-gray-900 dark:text-gray-100">${item.invoice.client.name}</td>
              <td class="px-4 py-3 text-gray-900 dark:text-gray-100">${formatDate(item.invoice.dueDate)}</td>
              <td class="px-4 py-3 ${overdueClass}">${item.ageBucket}</td>
              <td class="px-4 py-3 text-right ${overdueClass}">${formatCurrency(item.invoice.totals.balanceDue, item.invoice.currency)}</td>
            </tr>
          `;
        }).join('')}
      </tbody>
      <tfoot class="bg-gray-50 dark:bg-gray-900">
        <tr>
          <td colspan="4" class="px-4 py-3 text-right font-bold text-gray-900 dark:text-white">Total Outstanding:</td>
          <td class="px-4 py-3 text-right font-bold text-red-600 dark:text-red-400">${formatCurrency(
            agingData.reduce((sum, item) => sum + item.invoice.totals.balanceDue, 0),
            'USD'
          )}</td>
        </tr>
      </tfoot>
    </table>
  `;
}

// ========================================
// Theme Toggle
// ========================================

async function toggleTheme() {
  currentTheme = currentTheme === 'light' ? 'dark' : 'light';
  if (currentTheme === 'dark') {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
  await saveSetting('theme', currentTheme);
  updateThemeToggleIcon();

  // Re-render analytics charts if analytics view is active
  const analyticsView = document.getElementById('analytics-view');
  if (analyticsView?.classList.contains('active')) {
    renderAnalytics();
  }
}

function updateThemeToggleIcon() {
  const icon = document.querySelector('#theme-toggle .icon');
  if (icon) {
    icon.textContent = currentTheme === 'dark' ? '☀️' : '🌙';
  }
}

// ========================================
// Keyboard Shortcuts
// ========================================

function handleKeyboardShortcuts(event: KeyboardEvent) {
  // Ctrl/Cmd + S: Save
  if ((event.ctrlKey || event.metaKey) && event.key === 's') {
    event.preventDefault();
    saveCurrentInvoice();
  }

  // Ctrl/Cmd + P: Print
  if ((event.ctrlKey || event.metaKey) && event.key === 'p') {
    event.preventDefault();
    printCurrentInvoice();
  }

  // Ctrl/Cmd + N: New invoice
  if ((event.ctrlKey || event.metaKey) && event.key === 'n') {
    event.preventDefault();
    createNewInvoice();
  }
}

// ========================================
// Client/Seller Autocomplete
// ========================================

function getUniqueClients(): Client[] {
  const clientsMap = new Map<string, Client>();

  allInvoices.forEach((invoice) => {
    if (invoice.client.name) {
      const key = invoice.client.name.toLowerCase();
      if (!clientsMap.has(key)) {
        clientsMap.set(key, { ...invoice.client });
      }
    }
  });

  return Array.from(clientsMap.values()).sort((a, b) =>
    a.name.localeCompare(b.name)
  );
}

function populateClientDatalist() {
  const datalist = document.getElementById('client-list');
  if (!datalist) return;

  datalist.innerHTML = '';
  const clients = getUniqueClients();

  clients.forEach((client) => {
    const option = document.createElement('option');
    option.value = client.name;
    option.setAttribute('data-address', client.address || '');
    option.setAttribute('data-email', client.email || '');
    datalist.appendChild(option);
  });
}

function onClientNameChange() {
  const clientNameInput = document.getElementById('client-name') as HTMLInputElement;
  if (!clientNameInput) return;

  const clientName = clientNameInput.value;
  const clients = getUniqueClients();
  const matchingClient = clients.find((c) => c.name === clientName);

  if (matchingClient) {
    setValue('client-address', matchingClient.address || '');
    setValue('client-email', matchingClient.email || '');
    updateInvoiceFromForm();
  }
}

function getUniqueSellers(): Seller[] {
  const sellersMap = new Map<string, Seller>();

  allInvoices.forEach((invoice) => {
    if (invoice.seller.name) {
      const key = invoice.seller.name.toLowerCase();
      if (!sellersMap.has(key)) {
        sellersMap.set(key, { ...invoice.seller });
      }
    }
  });

  return Array.from(sellersMap.values()).sort((a, b) =>
    a.name.localeCompare(b.name)
  );
}

function populateSellerDatalist() {
  const datalist = document.getElementById('seller-list');
  if (!datalist) return;

  datalist.innerHTML = '';
  const sellers = getUniqueSellers();

  sellers.forEach((seller) => {
    const option = document.createElement('option');
    option.value = seller.name;
    datalist.appendChild(option);
  });
}

function onSellerNameChange() {
  const sellerNameInput = document.getElementById('seller-name') as HTMLInputElement;
  if (!sellerNameInput) return;

  const sellerName = sellerNameInput.value;
  const sellers = getUniqueSellers();
  const matchingSeller = sellers.find((s) => s.name === sellerName);

  if (matchingSeller) {
    setValue('seller-address', matchingSeller.address || '');
    setValue('seller-email', matchingSeller.email || '');
    setValue('seller-phone', matchingSeller.phone || '');
    setValue('seller-website', matchingSeller.website || '');
    if (currentInvoice) {
      currentInvoice.seller = { ...matchingSeller };
      updateLogoPreview();
    }
    updateInvoiceFromForm();
  }
}

// ========================================
// Line Items Autocomplete
// ========================================

interface SavedLineItem {
  description: string;
  unitPrice: number;
  discountPct?: number;
  taxRatePct?: number;
}

function getUniqueLineItems(): SavedLineItem[] {
  const itemsMap = new Map<string, SavedLineItem>();

  allInvoices.forEach((invoice) => {
    invoice.items.forEach((item) => {
      if (item.description && item.description.trim()) {
        const key = item.description.toLowerCase().trim();
        // Store the most recent pricing for this item
        if (!itemsMap.has(key) || itemsMap.get(key)!.unitPrice < item.unitPrice) {
          itemsMap.set(key, {
            description: item.description.trim(),
            unitPrice: item.unitPrice,
            discountPct: item.discountPct,
            taxRatePct: item.taxRatePct,
          });
        }
      }
    });
  });

  return Array.from(itemsMap.values()).sort((a, b) =>
    a.description.localeCompare(b.description)
  );
}

function populateItemsDatalist() {
  const items = getUniqueLineItems();
  const datalistId = 'items-list';

  // Remove existing datalist if it exists
  const existingDatalist = document.getElementById(datalistId);
  if (existingDatalist) {
    existingDatalist.remove();
  }

  // Create new datalist
  const datalist = document.createElement('datalist');
  datalist.id = datalistId;

  items.forEach((item) => {
    const option = document.createElement('option');
    option.value = item.description;
    option.textContent = `${item.description} - $${item.unitPrice.toFixed(2)}`;
    datalist.appendChild(option);
  });

  document.body.appendChild(datalist);
}

function onItemDescriptionChange(index: number, descriptionInput: HTMLInputElement) {
  if (!currentInvoice) return;

  const description = descriptionInput.value;
  const items = getUniqueLineItems();
  const matchingItem = items.find((item) => item.description === description);

  if (matchingItem && currentInvoice.items[index]) {
    // Auto-fill the price and other fields
    currentInvoice.items[index].unitPrice = matchingItem.unitPrice;
    if (matchingItem.discountPct !== undefined) {
      currentInvoice.items[index].discountPct = matchingItem.discountPct;
    }
    if (matchingItem.taxRatePct !== undefined) {
      currentInvoice.items[index].taxRatePct = matchingItem.taxRatePct;
    }

    // Re-render to show the updated values
    renderLineItems();
    currentInvoice.totals = calculateInvoiceTotals(currentInvoice);
    updateTotalsDisplay();
  }
}

// ========================================
// UI Helpers
// ========================================

function showLoading(show: boolean) {
  const loading = document.getElementById('loading');
  if (loading) {
    loading.classList.toggle('hidden', !show);
  }
}

function showToast(message: string, type: 'success' | 'error' | 'info' = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;

  container.appendChild(toast);

  setTimeout(() => {
    toast.remove();
  }, 3000);
}

function getValue(id: string): string {
  const element = document.getElementById(id) as HTMLInputElement;
  return element?.value || '';
}

function setValue(id: string, value: string) {
  const element = document.getElementById(id) as HTMLInputElement;
  if (element) {
    element.value = value;
  }
}

function setText(id: string, text: string) {
  const element = document.getElementById(id);
  if (element) {
    element.textContent = text;
  }
}

// ========================================
// Start Application
// ========================================

init();
