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
