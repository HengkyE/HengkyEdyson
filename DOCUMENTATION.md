# EdysonPOS – Documentation Summary

This file consolidates all project documentation. For quick start and scripts, see **README.md**.

---

## 1. Project overview

- **EdysonPOS**: Point of Sale (POS) for supermarket operations in Indonesia (Expo + React Native).
- **Features**: Cash sales (jualan kontan), wholesale sales (jualan grosir), barcode scanning, receipt printing (thermal + PDF), Telegram integration, inventory (barangs), sales overview, grosir invoices and payments.
- **Stack**: Expo ~54, React Native 0.81, TypeScript, Supabase, Expo Router.
- **Platforms**: iOS, Android, Web (Expo export).

---

## 2. Old system analysis (tokoEdyson-antd)

- **Source**: Next.js + Ant Design; reference for migrating logic into the Expo app.
- **Cash sales**: Barcode/cart, payment methods (Cash, QRIS, BNI, Mandiri), denomination buttons, Uang Pas, change calculation, receipt PDF, Telegram, stock deduction, `jualanKontan` table.
- **Wholesale**: Customer name, invoice from `systemData`, `barangGrosir` price, partial payment (`setorGrosir` / `sisaBonGrosir`), receipts (A4/A6), SURAT JALAN, `jualanGrosir` table.
- **Products**: CRUD, barcode, prices (kontan, grosir, bon, modal), stock (toko + toko mini), categories/units.
- **Receipts**: pdfmake (web); mobile uses expo-print / thermal ESC/POS.
- **Barcode**: Old = html5-qrcode; new = expo-camera (CameraView).
- **Payments**: Cash, QRIS, BNI, BRI, Mandiri.

---

## 3. Implementation plan and summary

- **Phase 1 (Core)**: Cash sales (payment methods, cash calculator, change), wholesale screen (customer, invoice no, setor/sisa), invoice numbering. **Done.**
- **Phase 2 (Products)**: Product CRUD, units/types, form, add/edit screens. **Done.**
- **Phase 2.5**: Auth (AuthContext, login, auth guard). **Done.**
- **Phase 3 (Receipts)**: Receipt formatter, receipt generator (expo-print), thermal printing. **Done.**
- **Phase 4**: Quantity modal, custom items, barcode scanner improvements. **Partial.**
- **Phase 5**: Telegram, sales reports, transaction history. **Done.**
- **Phase 6**: UI/UX (skeletons, error/empty states, animations, responsive, accessibility). **Done.**

Estimated totals: Core ~19–27 h; full plan ~29–40 h. Database tables already exist; no schema changes required for the above.

---

## 4. Phase progress (current)

- **Completed**: Phases 1, 2, 2.5, 3, 5, 6 (payment methods, grosir, invoice numbering, product CRUD, auth, receipts, Telegram, reports, transaction filters, UI/UX).
- **In progress**: Phase 4 (quantity modal, custom items, scanner enhancements).
- Overall: 6 of 7 phases complete (~86%).

---

## 5. Building Android APK

- **EAS (recommended)**  
  - Login: `npx eas-cli@latest login`  
  - Build: `npx eas-cli@latest build --platform android --profile preview` (testing) or `--profile production`  
  - APK: download from link in terminal or https://expo.dev/accounts/[account]/projects/EdysonPOS/builds  
  - List: `npx eas-cli@latest build:list`  
  - Download by ID: `npx eas-cli@latest build:download [BUILD_ID]`

- **Local (Android Studio)**  
  - Prebuild: `npx expo prebuild --clean`  
  - Build: `cd android && ./gradlew assembleRelease`  
  - APK: `android/app/build/outputs/apk/release/app-release.apk`

- **Profiles** (eas.json): `preview` (APK, testing), `production` (APK, release), `development` (dev client).  
- **Note**: `.env` is not included in EAS builds; set `EXPO_PUBLIC_*` in EAS env (see §6).  
- **Prebuild**: Use `npx expo prebuild --clean` when adding/changing native modules (e.g. thermal printer). Expo Go does not support custom native modules; use dev/build APK.

---

## 6. EAS environment variables

- **Issue**: `.env` is not used in EAS builds; app needs Supabase (and other) vars in EAS.
- **Required**: `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY` (and any other `EXPO_PUBLIC_*` used by the app).
- **Set**: Expo Dashboard → Project → Variables, or CLI:  
  `npx eas-cli@latest env:create --name EXPO_PUBLIC_SUPABASE_URL --value "https://....supabase.co" --type string --scope project --environment preview` (repeat for anon key and for `production` if needed).
- **Check**: `npx eas-cli@latest env:list`. Then rebuild APK.

---

## 7. Supabase setup

- **RLS**: 406 / “Not Acceptable” often means RLS is blocking. For testing you can disable RLS on the table; for production add policies (SELECT/INSERT/UPDATE/DELETE) for `anon`/`authenticated` as needed.
- **Policies**: Create policies per table (`barangs`, `jualanKontan`, `jualanGrosir`, `systemData`, `categories`, etc.). Example for read: `CREATE POLICY "Allow public read" ON barangs FOR SELECT USING (true);` (and similar for INSERT/UPDATE/DELETE where desired).
- **Local**: `.env` with `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY`; restart Expo after changes.

---

## 8. Vercel deployment (web)

- **Build**: `npm run build:web` (runs `expo export -p web`); output in `dist/`.
- **Vercel**: Connect repo; root = `.`; build command = `npm run build:web`; output = `dist`. Set env vars: `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY` (use `EXPO_PUBLIC_` prefix).
- **Fix for build failures**: Metro and Supabase client were adjusted so build can complete even when env vars are missing at build time; runtime will show errors if vars are missing. Ensure env vars are set in Vercel for Production/Preview/Development and redeploy.

---

## 9. Bluetooth / thermal printer

- **Init error**: Thermal printer lib `init()` may expect different args; code tries callback, then config object, then skips init if not required.
- **Connection status**: `thermalPrinter.getConnectionStatus()`, `getConnectedDevice()`, `isConnected()`; UI shows connected device name and updates on connect/disconnect/scan.
- **Android raw print**: Use `ReactNativePosPrinter.sendRawCommand` for ESC/POS raw bytes (thermal-printer service updated accordingly).
- **Platforms**: Bluetooth on device; web can use Web Bluetooth or USB via printer server (see §12).

---

## 10. Barcode scanner

- **Migration**: Replaced deprecated `expo-barcode-scanner` with `expo-camera` (CameraView) for SDK 54.
- **Changes**: `app/sales/scan.tsx` and `components/product-form.tsx` use `CameraView` + `useCameraPermissions()`; barcode types as string array (e.g. `['ean13','ean8','upc','code128']`).
- **Out of stock**: Scanning allows adding items even when stock is 0 or null; stock can go negative until proper stock management is in place.

---

## 11. Database migrations (summary)

- **Tables**: `barangs`, `jualanKontan`, `jualanGrosir`, `jualanItems`, `userProfiles`, `grosirPayments`, `grosirDrafts`, `grosirDraftItems`, `systemData`.
- **Done**: Sale line items (`jualanItems`), user profiles and RLS, `userId` on sales, grosir payments table and invoice `payment_status`/`percent_paid`, grosir drafts and draft items.
- **New env**: Recreate schema from this summary and app types; use Supabase SQL Editor. User profiles: create rows for `auth.users` (e.g. insert into `userProfiles` from `auth.users` with default role); first user can be set to admin via SQL or app.

---

## 12. Printer server and thermal setup

- **Printer server**: For **USB** thermal printing from the **web** app. Bluetooth printing on device does **not** need the server.
- **Start**: `npm run printer-server` or `node services/printer-server.js`. Server runs on port 3001; connect app from same machine (e.g. `npm run web` → http://localhost:8081). Do not use deployed URL for USB printing (localhost blocked from HTTPS).
- **Endpoints**: GET `/health`, GET `/printers`, POST `/print`. Optional: `PRINTER_NAME="..."` to force printer name.
- **Thermal setup**: 80mm ESC/POS; Android uses Bluetooth (thermal-printer service); iOS may need native USB module or network printer; web uses Bluetooth or this USB server.

---

## 13. Quick reference

| Topic              | Command / location |
|--------------------|--------------------|
| Start dev          | `npm start` / `npx expo start` |
| Web build          | `npm run build:web` → `dist/` |
| Android APK (EAS)   | `npx eas-cli@latest build --platform android --profile preview` |
| EAS env list       | `npx eas-cli@latest env:list` |
| Prebuild           | `npx expo prebuild --clean` |
| Printer server     | `npm run printer-server` |

---

*Last consolidated from: ANALYSIS_OLD_SYSTEM, IMPLEMENTATION_PLAN, IMPLEMENTATION_SUMMARY, PHASE_PROGRESS, APK_BUILD_INSTRUCTIONS, BUILD_APK_NOW, BUILD_ANDROID_APK, PREBUILD_INSTRUCTIONS, EAS_ENV_VARIABLES, SUPABASE_SETUP, VERCEL_DEPLOYMENT, VERCEL_BUILD_FIX, BLUETOOTH_PRINTER_FIX, BARCODE_SCANNER_FIX, migrations/README, migrations/SETUP_INSTRUCTIONS, services/START_PRINTER_SERVER, services/PRINTER_SETUP.*
