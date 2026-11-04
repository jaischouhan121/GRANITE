# Granite Factory ERP

A browser-based app for managing day-to-day records at a granite factory: from raw blocks coming in, through cutting and polishing, to stock and sales.

> **Status:** early-stage project. Feedback, bug reports, and contributions are welcome.

## Features

- **Dashboard** for an overview of factory data
- **Block Inward** register for incoming granite blocks
- **Cutter, Single Cutter, and Bridge Cutter** registers
- **Polisher** register
- **Stock** register
- **Sales** register with party-wise invoices
- **Reports** with print support
- **Backup & Restore**, including spreadsheet import and export
- **Multiple companies**, each with separate data

## How your data is stored

All data is saved in your browser's localStorage. There is no server or database, so:

- Your data stays on your device and is not uploaded by the app.
- Clearing browser data will erase it, so take regular backups.
- Data does not sync between browsers or devices.

## Run locally

**Prerequisite:** Node.js. An internet connection is also needed, because some libraries load from a CDN.

```bash
npm install
npm run dev
```

The app runs at http://localhost:3000.

To create a production build:

```bash
npm run build
```

## Tech stack

React, TypeScript, Vite, and Tailwind CSS.

## Contributing

Please open an issue to report a bug or suggest a feature. Pull requests are welcome.

## License

Released under the [MIT License](LICENSE).
