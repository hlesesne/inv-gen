# Invoice Generator

A **100% client-side** invoice generator with offline support. Create professional invoices entirely in your browser with zero servers, zero API keys, and complete privacy.

## Features

- ✨ **Fully Offline**: Works completely offline, including PDF generation
- 🔒 **Private**: Your data never leaves your device
- 💾 **Persistent**: Uses IndexedDB for local storage
- 📱 **PWA**: Install as a Progressive Web App
- 🎨 **Customizable**: Theme colors, dark mode, and flexible layouts
- 📊 **Complete**: Line items, taxes, discounts, payments, and more
- 📄 **PDF Export**: Generate clean, professional PDF invoices
- 🔄 **Import/Export**: Backup and restore your data
- ⌨️ **Keyboard Shortcuts**: Save (Ctrl+S), Print (Ctrl+P), New (Ctrl+N)
- ♿ **Accessible**: WCAG compliant with screen reader support

## Quick Start

### Prerequisites

- Node.js 18+ and npm
- A modern web browser

### Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/invoice-generator.git
cd invoice-generator
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm run dev
```

4. Open your browser to `http://localhost:3000`

### Building for Production

```bash
npm run build
```

The built files will be in the `dist/` directory.

### Preview the Production Build

```bash
npm run preview
```

## Deployment

### GitHub Pages

1. Update `vite.config.ts` to set the correct `base` path:
```typescript
export default defineConfig({
  base: '/invoice-generator/', // Replace with your repo name
  // ...
});
```

2. Install the gh-pages package (already in devDependencies):
```bash
npm install --save-dev gh-pages
```

3. Build and deploy:
```bash
npm run build
npm run deploy
```

4. Enable GitHub Pages in your repository settings:
   - Go to Settings > Pages
   - Source: Deploy from a branch
   - Branch: `gh-pages` / `root`

Your app will be available at `https://yourusername.github.io/invoice-generator/`

### Other Static Hosts

The built `dist/` folder can be deployed to any static hosting service:

- **Netlify**: Drag and drop the `dist/` folder
- **Vercel**: `vercel --prod`
- **Cloudflare Pages**: Connect your repo or upload `dist/`
- **AWS S3**: Upload `dist/` contents to an S3 bucket with static hosting

## Usage

### Creating an Invoice

1. Click "New Invoice" in the header
2. Fill in your business information (seller details)
3. Add client information
4. Add line items with descriptions, quantities, and prices
5. Adjust discounts, taxes, and shipping as needed
6. Add payment records if applicable
7. Click "Save" to store the invoice locally

### Generating PDFs

- Click "Download PDF" to generate and download a PDF
- Or use Ctrl+P to print the invoice

### Managing Invoices

- Click "History" to view all invoices
- Use the search bar to find specific invoices
- Filter by status (draft, sent, paid, overdue, archived)
- Edit, duplicate, or delete invoices from the history view

### Import/Export

- **Export**: Click "Export" in the history view to download a JSON backup
- **Import**: Click "Import" and select a previously exported JSON file

## Data Model

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
  theme: {
    primary: string;
    mode: 'light' | 'dark';
  };
  seller: { name, address, email?, phone?, website?, logoDataUrl? };
  client: { name, address?, email? };
  items: Array<{ description, quantity, unitPrice, taxRatePct?, discountPct? }>;
  adjustments: { shipping?, globalDiscountPct?, globalTaxPct? };
  payments: Array<{ date, amount, note? }>;
  notes?: string;
  terms?: string;
  totals: {
    subtotal, tax, discount, grandTotal, amountPaid, balanceDue
  };
}
```

## Technology Stack

- **Framework**: Vanilla TypeScript
- **Build Tool**: Vite
- **Storage**: IndexedDB (via idb library)
- **PDF Generation**: html2pdf.js
- **Styling**: CSS Custom Properties (CSS Variables)
- **PWA**: Service Workers + Web App Manifest

## Project Structure

```
invoice-generator/
├── index.html              # Main HTML file
├── public/
│   ├── manifest.webmanifest # PWA manifest
│   ├── sw.js               # Service worker
│   └── favicon.svg         # Favicon
├── src/
│   ├── app.ts              # Main application logic
│   ├── schema.ts           # TypeScript interfaces
│   ├── storage.ts          # IndexedDB wrapper
│   ├── utils.ts            # Utility functions
│   ├── pdf.ts              # PDF generation
│   └── styles.css          # Styles
├── package.json
├── tsconfig.json
├── vite.config.ts
└── README.md
```

## Keyboard Shortcuts

- `Ctrl+S` (Cmd+S on Mac): Save current invoice
- `Ctrl+P` (Cmd+P on Mac): Print invoice
- `Ctrl+N` (Cmd+N on Mac): Create new invoice

## Browser Compatibility

This app works on all modern browsers that support:
- ES2020
- IndexedDB
- Service Workers (for PWA features)
- File System Access API (optional, for enhanced import/export)

Tested on:
- Chrome/Edge 90+
- Firefox 88+
- Safari 14+

## Privacy & Security

- **No Tracking**: Zero analytics, no cookies, no tracking
- **No Server**: Everything runs in your browser
- **No Cloud**: Data stored locally in IndexedDB
- **No Login**: No accounts, no passwords
- **Open Source**: Full transparency, audit the code yourself

## Development

### Running Tests

```bash
# Run unit tests (if configured)
npm test
```

### Code Style

This project uses TypeScript's strict mode for type safety:
- `strict: true`
- `noUnusedLocals: true`
- `noUnusedParameters: true`

### Adding Features

See [FEATURES.md](FEATURES.md) for the complete feature checklist and roadmap.

## Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Troubleshooting

### PDFs not generating

- Ensure you're using a modern browser with canvas support
- Check browser console for errors
- Try a different browser

### Data not persisting

- Check that cookies/storage are enabled
- Ensure you're not in private/incognito mode
- Check browser console for IndexedDB errors

### PWA not installing

- Must be served over HTTPS (or localhost)
- Check service worker registration in DevTools
- Ensure manifest.webmanifest is accessible

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Acknowledgments

- Built with [Vite](https://vitejs.dev/)
- PDF generation by [html2pdf.js](https://github.com/eKoopmans/html2pdf.js)
- IndexedDB wrapper: [idb](https://github.com/jakearchibald/idb)

## Support

- 🐛 [Report a bug](https://github.com/yourusername/invoice-generator/issues)
- 💡 [Request a feature](https://github.com/yourusername/invoice-generator/issues)
- 📖 [View documentation](https://github.com/yourusername/invoice-generator)

---

**Note**: This is a client-side only application. Your invoice data is stored locally in your browser's IndexedDB. Be sure to export your data regularly as backups.

Made with ❤️ for invoice freedom
