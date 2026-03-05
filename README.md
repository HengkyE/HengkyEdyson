# EdysonPOS

A modern Point of Sale (POS) system for supermarket operations in Indonesia, built with Expo and React Native. Supports cash sales (jualan kontan), wholesale sales (jualan grosir), barcode scanning, receipt printing, and Telegram integration.

**Full documentation:** [DOCUMENTATION.md](./DOCUMENTATION.md) (builds, Supabase, EAS, Vercel, printer, barcode, migrations, and implementation summary).

## Getting started

```bash
npm install
npm start
# or: npx expo start
```

- **iOS:** `npm run ios`
- **Android:** `npm run android`
- **Web:** `npm run web`
- **Web build:** `npm run build:web` → output in `dist/`
- **Android APK (EAS):** `npx eas-cli@latest build --platform android --profile preview`

Set `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` in `.env` (local) or in EAS/Vercel for builds. See [DOCUMENTATION.md](./DOCUMENTATION.md) for details.

## Scripts

- `npm start` – Start Expo dev server
- `npm run ios` / `npm run android` – Run on simulator/device
- `npm run web` – Start web dev server
- `npm run build:web` – Export static web to `dist/`
- `npm run build:android` – EAS build Android APK (preview)
- `npm run lint` – ESLint
- `npm run printer-server` – Start USB printer server (web only)

## License

Private project – All rights reserved
