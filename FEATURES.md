# Features Checklist

This document tracks implemented and planned features for the Invoice Generator application.

## Core Features

### Invoice Editor
- [x] Invoice details (number, status, dates, currency)
- [x] Seller/business information with logo support
- [x] Client/customer information
- [x] Line items with description, quantity, unit price
- [x] Per-item discounts and taxes
- [x] Global adjustments (shipping, discount, tax)
- [x] Real-time totals calculation
- [ ] Live preview pane (side-by-side with editor)
- [ ] Autosave functionality
- [ ] Undo/redo support
- [ ] Form validation with helpful error messages

### Data Persistence
- [x] IndexedDB storage setup
- [x] Save invoice
- [x] Load invoice
- [x] Get all invoices
- [x] Delete invoice
- [x] Duplicate invoice
- [ ] Auto-recovery from crashes

### PDF & Export
- [x] PDF generation (html2pdf.js)
- [x] Custom PDF layout with theme colors
- [x] Print functionality
- [ ] PDF preview before download
- [ ] Multiple PDF templates/styles
- [ ] Export as HTML
- [ ] Email invoice (using mailto:)

### History & Management
- [x] Invoice list view
- [x] Status-based filtering
- [x] Search functionality
- [x] Summary statistics
- [ ] Mark invoice as paid
- [ ] Mark invoice as sent
- [ ] Archive invoice
- [ ] Bulk actions (delete, archive, status change)
- [ ] Sort by date, amount, client
- [ ] Date range filtering

### Import/Export
- [x] Export all data as JSON
- [x] Import data from JSON
- [ ] UI for import/export in history view
- [ ] CSV export for invoices
- [ ] Merge vs replace options on import

### PWA & Offline
- [ ] Web manifest
- [ ] Service worker for offline support
- [ ] Install prompts
- [ ] Offline indicator
- [ ] Background sync for data

### UI/UX Enhancements
- [x] Dark mode toggle
- [x] Theme color picker
- [x] Responsive design
- [x] Accessible form controls
- [ ] Keyboard shortcuts (Ctrl+S, Ctrl+P, etc.)
- [ ] Toast notifications for actions
- [ ] Confirm dialogs for destructive actions
- [ ] Drag-and-drop for reordering line items
- [ ] Quick-add buttons for common items
- [ ] Client/seller templates
- [ ] Recent clients list

### Calculations
- [x] Subtotal calculation
- [x] Item-level discounts
- [x] Item-level taxes
- [x] Global discount
- [x] Global tax
- [x] Shipping costs
- [x] Grand total
- [x] Amount paid tracking
- [x] Balance due
- [ ] Multiple tax rates per invoice
- [ ] Compound tax calculations

### Payments
- [x] Payment history tracking
- [x] Payment dates and amounts
- [x] Payment notes
- [ ] Payment method tracking
- [ ] Partial payment calculations
- [ ] Payment reminders

## Nice-to-Have Features

### Analytics & Reporting
- [ ] Revenue dashboard
- [ ] Monthly/yearly reports
- [ ] Client-based analytics
- [ ] Overdue invoices report
- [ ] Tax summary report
- [ ] Export reports to PDF/CSV

### Advanced Features
- [ ] Multi-currency support with exchange rates
- [ ] Tax ID / VAT number support
- [ ] Recurring invoices
- [ ] Invoice templates library
- [ ] Custom fields
- [ ] Multi-language support (i18n)
- [ ] RTL language support
- [ ] Time tracking integration
- [ ] Expense tracking
- [ ] Quote/Estimate mode

### Collaboration
- [ ] Share invoice link (URL hash with data)
- [ ] QR code for invoice
- [ ] Send invoice via email (mailto: link)

### Customization
- [ ] Custom branding colors
- [ ] Custom fonts
- [ ] Custom logo placement
- [ ] Footer text customization
- [ ] Multiple invoice templates
- [ ] Page size options (A4, Letter, A5)
- [ ] Margin settings

### Data Management
- [ ] Client database/directory
- [ ] Product/service catalog
- [ ] Default payment terms
- [ ] Tax rate presets
- [ ] Invoice numbering schemes
- [ ] Backup & restore

### Integrations
- [ ] Import from other invoice tools
- [ ] Export to accounting software formats
- [ ] Sync with cloud storage (via File System Access API)

## Technical Improvements

### Performance
- [ ] Lazy loading for history
- [ ] Virtual scrolling for large lists
- [ ] Optimize PDF generation speed
- [ ] Debounced autosave

### Security
- [ ] Content Security Policy headers
- [ ] Input sanitization
- [ ] XSS protection
- [ ] Local encryption option

### Testing
- [ ] Unit tests for calculations
- [ ] Integration tests for storage
- [ ] E2E tests for critical flows
- [ ] Accessibility testing

### Documentation
- [ ] User guide
- [ ] API documentation
- [ ] Contributing guidelines
- [ ] Deployment guide

## Completed Features

✅ Project setup with Vite + TypeScript
✅ Data schema and TypeScript interfaces
✅ Storage layer with IndexedDB
✅ Calculation utilities
✅ PDF generation functionality
✅ HTML structure and form layout
✅ CSS styling with light/dark mode support

## In Progress

🚧 Main application logic (app.ts)
🚧 History view implementation
🚧 PWA setup (manifest + service worker)

---

## How to Use This File

1. **Track Progress**: Check off features as they're completed
2. **Plan Development**: Add new features with [ ] checkbox
3. **Prioritize**: Move items up/down based on importance
4. **Reference**: Use when discussing what to build next

Feel free to add new features or modify existing ones!
