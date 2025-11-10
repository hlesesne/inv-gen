# INITIAL_PROMPT.md

## Project Overview

You are an expert full-stack front-end engineer. Build a **100% client-side** web app that replicates the core UX of https://invoice-generator.com with modern, accessible UI. The app must run entirely in the browser (no servers, no external services), support offline use, and be easy to host on GitHub Pages.

---

## Feasibility (browser-only + GitHub Pages)

- Client-side PDF generation is well-supported with libraries like **jsPDF**, **html2pdf.js** (html2canvas + jsPDF), and **pdf-lib**—no server needed.
- **IndexedDB** is the right place to store invoices/history and totals (structured data, larger than Web Storage).
- Optional: the **File System Access API** lets users export/import local JSON (with graceful fallback to Blob download/upload). Works over HTTPS (GitHub Pages qualifies).
- **GitHub Pages** is a static host—perfect for a single-page app with zero backend.

Conclusion: You can replicate the core features of invoice-generator.com, persist invoice data locally, and generate PDFs entirely client-side, then host on GitHub Pages.

---

## Prompt for Claude Code

Paste this into Claude Code to generate the project.

```markdown
You are an expert full-stack front-end engineer. Build a **100% client-side** web app that replicates the core UX of https://invoice-generator.com with modern, accessible UI. The app must run entirely in the browser (no servers, no external services), support offline use, and be easy to host on GitHub Pages.

### High-level requirements
- **Stack:** Vanilla TypeScript + lightweight tooling (Vite) or plain ES modules. No Node server at runtime. Keep dependencies minimal.
- **Output structure:**
  - index.html
  - styles.css
  - app.ts
  - storage.ts
  - pdf.ts
  - schema.ts
  - utils.ts
  - manifest.webmanifest
  - sw.js
  - README.md
  - assets/
- **Zero backend:** All features—including PDF creation—must work fully offline.
- **Data privacy:** Never send data off device.

### Core Features
1. **Invoice Editor**
   - Seller/client blocks, invoice meta, line items, totals, notes.
   - Real-time preview, currency formatting, validation, autosave.
   - Accessibility, theme toggles, and print styles.

2. **Persistence & History**
   - Use IndexedDB for storage.
   - History page with filters, totals summary, duplicate/mark paid/archive actions.
   - Import/export JSON data (File System Access API + fallback).

3. **PDF & Print**
   - Client-side only using html2pdf.js or jsPDF + html2canvas.
   - Export clean PDF with consistent layout, fonts, and pagination.

4. **PWA / Offline**
   - Installable via manifest + service worker.
   - Works fully offline including PDF creation.

5. **UX Details**
   - Keyboard shortcuts, autosave debounce, undo/redo.
   - Theme, color picker, and RTL support.

6. **Security & Compatibility**
   - HTTPS-only, CSP-friendly, works on all major browsers.

7. **Data Model (TypeScript)**

```typescript
interface Invoice {
  id: string;
  number: string;
  status: 'draft' | 'sent' | 'paid' | 'overdue' | 'archived';
  createdAt: string;
  updatedAt: string;
  issueDate: string;
  dueDate: string;
  currency: string;
  language: string;
  theme: {
    primary: string;
    mode: 'light' | 'dark';
    density: 'cozy' | 'compact';
    pageSize: 'Letter' | 'A4';
  };
  seller: { name: string; address: string; email?: string; phone?: string; website?: string; logoDataUrl?: string };
  client: { name: string; address?: string; email?: string };
  meta?: { po?: string; reference?: string };
  items: Array<{
    id: string;
    description: string;
    quantity: number;
    unitPrice: number;
    taxRatePct?: number;
    discountPct?: number;
  }>;
  adjustments: { shipping?: number; globalDiscountPct?: number; globalTaxPct?: number };
  payments: Array<{ id: string; date: string; amount: number; note?: string }>;
  notes?: string;
  terms?: string;
  totals: {
    subtotal: number;
    tax: number;
    discount: number;
    grandTotal: number;
    amountPaid: number;
    balanceDue: number;
  };
}
```

### Calculations
- Subtotal, discounts, taxes, shipping, and balance due as per invoice-generator.com.
- Round only at display, not in computation.

### Commands & Dev Experience
- Provide npm scripts: `dev`, `build`, `preview`.
- Document deployment to GitHub Pages.
- MIT License.

### Acceptance Criteria
- Create/edit invoices with live totals.
- Reload shows saved invoices.
- Export/import works offline.
- Download PDF offline.
- Works on all major browsers.

### Nice-to-haves
- Local analytics dashboard.
- RTL demo.
- URL-hash prefill.
- Theme gallery.

Build all files and features in order: schema → storage → UI → calculations → PDF → history → PWA → import/export → polish.
```

---

## Notes
This project should produce a self-contained app deployable on GitHub Pages with no backend or API keys. The design goal is **zero hosting cost** and **100% user-side data control**.
