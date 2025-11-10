/**
 * Client-side PDF generation functionality using html2pdf.js
 */

import html2pdf from 'html2pdf.js';
import type { Invoice } from './schema';
import { formatCurrency, formatDate, calculateLineTotal } from './utils';

/**
 * Generate PDF options based on page size
 * @param pageSize - Page size ('Letter' or 'A4')
 * @returns html2pdf options object
 */
function getPdfOptions(pageSize: 'Letter' | 'A4') {
  const format = pageSize === 'Letter' ? 'letter' : 'a4';

  return {
    margin: [10, 10],
    filename: 'invoice.pdf',
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: {
      scale: 2,
      useCORS: true,
      letterRendering: true,
    },
    jsPDF: {
      unit: 'mm',
      format: format,
      orientation: 'portrait',
    },
  };
}

/**
 * Generate HTML content for the PDF
 * @param invoice - Invoice data
 * @returns HTML string
 */
function generateInvoiceHTML(invoice: Invoice): string {
  const lineItemsHTML = invoice.items
    .map((item) => {
      const lineTotal = calculateLineTotal(item);
      return `
        <tr>
          <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${escapeHtml(item.description)}</td>
          <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: center;">${item.quantity}</td>
          <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: right;">${formatCurrency(item.unitPrice, invoice.currency)}</td>
          ${item.discountPct ? `<td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: center;">${item.discountPct}%</td>` : '<td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: center;">-</td>'}
          ${item.taxRatePct ? `<td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: center;">${item.taxRatePct}%</td>` : '<td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: center;">-</td>'}
          <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: right; font-weight: 600;">${formatCurrency(lineTotal, invoice.currency)}</td>
        </tr>
      `;
    })
    .join('');

  const paymentsHTML = invoice.payments.length > 0
    ? `
      <div style="margin-top: 30px;">
        <h3 style="font-size: 14px; font-weight: 600; margin-bottom: 10px; color: #374151;">Payment History</h3>
        <table style="width: 100%; border-collapse: collapse;">
          <thead>
            <tr style="background-color: #f9fafb;">
              <th style="padding: 8px; text-align: left; font-weight: 600; border-bottom: 2px solid #e5e7eb;">Date</th>
              <th style="padding: 8px; text-align: right; font-weight: 600; border-bottom: 2px solid #e5e7eb;">Amount</th>
              <th style="padding: 8px; text-align: left; font-weight: 600; border-bottom: 2px solid #e5e7eb;">Note</th>
            </tr>
          </thead>
          <tbody>
            ${invoice.payments.map(payment => `
              <tr>
                <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${formatDate(payment.date)}</td>
                <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: right;">${formatCurrency(payment.amount, invoice.currency)}</td>
                <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${payment.note || '-'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `
    : '';

  return `
    <!DOCTYPE html>
    <html lang="${invoice.language}">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Invoice ${invoice.number}</title>
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Helvetica', 'Arial', sans-serif;
          font-size: 12px;
          line-height: 1.5;
          color: #111827;
          padding: 20px;
        }
        .invoice-container {
          max-width: 800px;
          margin: 0 auto;
        }
      </style>
    </head>
    <body>
      <div class="invoice-container">
        <!-- Header -->
        <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 30px; padding-bottom: 20px; border-bottom: 3px solid ${invoice.theme.primary};">
          <div>
            ${invoice.seller.logoDataUrl ? `<img src="${invoice.seller.logoDataUrl}" alt="Logo" style="max-width: 150px; max-height: 80px; margin-bottom: 10px;">` : ''}
            <h1 style="font-size: 32px; font-weight: 700; color: ${invoice.theme.primary}; margin-bottom: 5px;">INVOICE</h1>
            <p style="font-size: 14px; color: #6b7280;">#${invoice.number}</p>
          </div>
          <div style="text-align: right;">
            <p style="margin-bottom: 5px;"><strong>Status:</strong> <span style="text-transform: uppercase; color: ${getStatusColor(invoice.status)}; font-weight: 600;">${invoice.status}</span></p>
            <p style="margin-bottom: 5px;"><strong>Issue Date:</strong> ${formatDate(invoice.issueDate)}</p>
            <p style="margin-bottom: 5px;"><strong>Due Date:</strong> ${formatDate(invoice.dueDate)}</p>
            ${invoice.meta?.po ? `<p style="margin-bottom: 5px;"><strong>PO:</strong> ${escapeHtml(invoice.meta.po)}</p>` : ''}
            ${invoice.meta?.reference ? `<p style="margin-bottom: 5px;"><strong>Reference:</strong> ${escapeHtml(invoice.meta.reference)}</p>` : ''}
          </div>
        </div>

        <!-- From/To Section -->
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-bottom: 30px;">
          <div>
            <h2 style="font-size: 12px; font-weight: 600; text-transform: uppercase; color: #6b7280; margin-bottom: 10px;">From</h2>
            <p style="font-weight: 600; font-size: 14px; margin-bottom: 5px;">${escapeHtml(invoice.seller.name)}</p>
            <p style="color: #6b7280; white-space: pre-line;">${escapeHtml(invoice.seller.address)}</p>
            ${invoice.seller.email ? `<p style="color: #6b7280; margin-top: 5px;">${escapeHtml(invoice.seller.email)}</p>` : ''}
            ${invoice.seller.phone ? `<p style="color: #6b7280;">${escapeHtml(invoice.seller.phone)}</p>` : ''}
            ${invoice.seller.website ? `<p style="color: #6b7280;">${escapeHtml(invoice.seller.website)}</p>` : ''}
          </div>
          <div>
            <h2 style="font-size: 12px; font-weight: 600; text-transform: uppercase; color: #6b7280; margin-bottom: 10px;">Bill To</h2>
            <p style="font-weight: 600; font-size: 14px; margin-bottom: 5px;">${escapeHtml(invoice.client.name)}</p>
            ${invoice.client.address ? `<p style="color: #6b7280; white-space: pre-line;">${escapeHtml(invoice.client.address)}</p>` : ''}
            ${invoice.client.email ? `<p style="color: #6b7280; margin-top: 5px;">${escapeHtml(invoice.client.email)}</p>` : ''}
          </div>
        </div>

        <!-- Line Items -->
        <div style="margin-bottom: 30px;">
          <table style="width: 100%; border-collapse: collapse;">
            <thead>
              <tr style="background-color: ${invoice.theme.primary}; color: white;">
                <th style="padding: 10px 8px; text-align: left; font-weight: 600;">Description</th>
                <th style="padding: 10px 8px; text-align: center; font-weight: 600; width: 80px;">Qty</th>
                <th style="padding: 10px 8px; text-align: right; font-weight: 600; width: 100px;">Unit Price</th>
                <th style="padding: 10px 8px; text-align: center; font-weight: 600; width: 80px;">Disc.</th>
                <th style="padding: 10px 8px; text-align: center; font-weight: 600; width: 80px;">Tax</th>
                <th style="padding: 10px 8px; text-align: right; font-weight: 600; width: 120px;">Total</th>
              </tr>
            </thead>
            <tbody>
              ${lineItemsHTML}
            </tbody>
          </table>
        </div>

        <!-- Totals -->
        <div style="display: flex; justify-content: flex-end; margin-bottom: 30px;">
          <div style="width: 300px;">
            <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e5e7eb;">
              <span style="color: #6b7280;">Subtotal:</span>
              <span style="font-weight: 600;">${formatCurrency(invoice.totals.subtotal, invoice.currency)}</span>
            </div>
            ${invoice.totals.discount > 0 ? `
              <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e5e7eb;">
                <span style="color: #6b7280;">Discount:</span>
                <span style="font-weight: 600; color: #10b981;">-${formatCurrency(invoice.totals.discount, invoice.currency)}</span>
              </div>
            ` : ''}
            ${invoice.adjustments.shipping && invoice.adjustments.shipping > 0 ? `
              <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e5e7eb;">
                <span style="color: #6b7280;">Shipping:</span>
                <span style="font-weight: 600;">${formatCurrency(invoice.adjustments.shipping, invoice.currency)}</span>
              </div>
            ` : ''}
            ${invoice.totals.tax > 0 ? `
              <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e5e7eb;">
                <span style="color: #6b7280;">Tax:</span>
                <span style="font-weight: 600;">${formatCurrency(invoice.totals.tax, invoice.currency)}</span>
              </div>
            ` : ''}
            <div style="display: flex; justify-content: space-between; padding: 12px 0; border-top: 2px solid #374151; margin-top: 8px;">
              <span style="font-weight: 700; font-size: 14px;">Grand Total:</span>
              <span style="font-weight: 700; font-size: 16px; color: ${invoice.theme.primary};">${formatCurrency(invoice.totals.grandTotal, invoice.currency)}</span>
            </div>
            ${invoice.totals.amountPaid > 0 ? `
              <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e5e7eb;">
                <span style="color: #6b7280;">Amount Paid:</span>
                <span style="font-weight: 600; color: #10b981;">${formatCurrency(invoice.totals.amountPaid, invoice.currency)}</span>
              </div>
              <div style="display: flex; justify-content: space-between; padding: 12px 0; background-color: #fef3c7; padding: 12px; margin-top: 8px; border-radius: 4px;">
                <span style="font-weight: 700;">Balance Due:</span>
                <span style="font-weight: 700; font-size: 16px; color: #d97706;">${formatCurrency(invoice.totals.balanceDue, invoice.currency)}</span>
              </div>
            ` : ''}
          </div>
        </div>

        ${paymentsHTML}

        <!-- Notes and Terms -->
        ${invoice.notes || invoice.terms ? `
          <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
            ${invoice.notes ? `
              <div style="margin-bottom: 20px;">
                <h3 style="font-size: 12px; font-weight: 600; text-transform: uppercase; color: #6b7280; margin-bottom: 8px;">Notes</h3>
                <p style="color: #374151; white-space: pre-line;">${escapeHtml(invoice.notes)}</p>
              </div>
            ` : ''}
            ${invoice.terms ? `
              <div>
                <h3 style="font-size: 12px; font-weight: 600; text-transform: uppercase; color: #6b7280; margin-bottom: 8px;">Terms & Conditions</h3>
                <p style="color: #374151; white-space: pre-line;">${escapeHtml(invoice.terms)}</p>
              </div>
            ` : ''}
          </div>
        ` : ''}

        <!-- Footer -->
        <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center; color: #9ca3af; font-size: 10px;">
          <p>Generated on ${formatDate(new Date().toISOString())}</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

/**
 * Escape HTML to prevent XSS
 * @param text - Text to escape
 * @returns Escaped text
 */
function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Get color for invoice status
 * @param status - Invoice status
 * @returns Hex color code
 */
function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    draft: '#6b7280',
    sent: '#3b82f6',
    paid: '#10b981',
    overdue: '#ef4444',
    archived: '#9ca3af',
  };
  return colors[status] || '#6b7280';
}

/**
 * Generate and download PDF for an invoice
 * @param invoice - Invoice to generate PDF for
 * @returns Promise resolving when PDF generation is complete
 */
export async function generatePDF(invoice: Invoice): Promise<void> {
  const html = generateInvoiceHTML(invoice);

  // Create a temporary iframe to properly render the full HTML document
  const iframe = document.createElement('iframe');
  iframe.style.position = 'absolute';
  iframe.style.left = '-9999px';
  iframe.style.width = '800px';
  iframe.style.height = '1200px';
  document.body.appendChild(iframe);

  const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
  if (!iframeDoc) {
    document.body.removeChild(iframe);
    throw new Error('Could not access iframe document');
  }

  iframeDoc.open();
  iframeDoc.write(html);
  iframeDoc.close();

  // Wait for content to render
  await new Promise(resolve => setTimeout(resolve, 100));

  const container = iframeDoc.querySelector('.invoice-container');
  if (!container) {
    document.body.removeChild(iframe);
    throw new Error('Invoice container not found');
  }

  const options = getPdfOptions(invoice.theme.pageSize);
  options.filename = `invoice-${invoice.number}.pdf`;

  try {
    await html2pdf().set(options).from(container).save();
  } finally {
    document.body.removeChild(iframe);
  }
}

/**
 * Generate PDF blob (for preview or further processing)
 * @param invoice - Invoice to generate PDF for
 * @returns Promise resolving to PDF blob
 */
export async function generatePDFBlob(invoice: Invoice): Promise<Blob> {
  const html = generateInvoiceHTML(invoice);

  // Create a temporary iframe to properly render the full HTML document
  const iframe = document.createElement('iframe');
  iframe.style.position = 'absolute';
  iframe.style.left = '-9999px';
  iframe.style.width = '800px';
  iframe.style.height = '1200px';
  document.body.appendChild(iframe);

  const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
  if (!iframeDoc) {
    document.body.removeChild(iframe);
    throw new Error('Could not access iframe document');
  }

  iframeDoc.open();
  iframeDoc.write(html);
  iframeDoc.close();

  // Wait for content to render
  await new Promise(resolve => setTimeout(resolve, 100));

  const container = iframeDoc.querySelector('.invoice-container');
  if (!container) {
    document.body.removeChild(iframe);
    throw new Error('Invoice container not found');
  }

  const options = getPdfOptions(invoice.theme.pageSize);

  try {
    const pdf = await html2pdf().set(options).from(container).outputPdf('blob');
    return pdf;
  } finally {
    document.body.removeChild(iframe);
  }
}

/**
 * Print an invoice
 * @param invoice - Invoice to print
 */
export function printInvoice(invoice: Invoice): void {
  const html = generateInvoiceHTML(invoice);

  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.onload = () => {
      printWindow.print();
    };
  }
}
