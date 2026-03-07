# Folder structure

This repo is organized into **portfolio** (resume/showcase) and **EdysonPOS** (Point of Sale app) areas, plus shared app shell.

## Portfolio (`/portfolio`)

Everything for the portfolio and resume site:

- **`portfolio/constants/`** – Profile, projects, theme colors, skills data
  - `portfolio.ts` – Profile and project list
  - `portfolio-theme.ts` – Dark/light theme colors
  - `skills.ts` – Skills categories and items
- **`portfolio/context/`** – Theme state
  - `PortfolioThemeContext.tsx` – Theme mode (dark/light) and persistence
- **`portfolio/components/`** – Portfolio UI
  - `portfolio-theme-toggle.tsx` – Theme switch

**Routes:** `/` (index), `/skills`, `/projects/edyson-pos`, `/projects/three-sekawan`, `/portfolios` (redirects to `/`).

---

## EdysonPOS (`/edysonpos`)

Everything for the POS app (sales, products, thermal printer, Telegram, etc.):

- **`edysonpos/types/`** – Database and domain types
  - `database.ts` – Barang, JualanKontan, JualanGrosir, UserProfile, etc.
- **`edysonpos/utils/`** – POS-specific helpers
  - `receipt-formatter.ts` – Receipt HTML and formatting
- **`edysonpos/services/`** – Backend and device logic
  - `database.ts` – Supabase CRUD
  - `thermal-printer.ts` – ESC/POS thermal printing
  - `receipt-generator.ts` – PDF / print
  - `telegram.ts` – Telegram PDF and notifications
  - `printer-settings.ts` – Printer type (USB/Bluetooth) persistence
  - `scanned-barcode-store.ts` – Barcode scan event bus
- **`edysonpos/components/`** – POS-specific UI
  - `product-form.tsx` – Add/edit product
  - `cash-payment-calculator.tsx` – Cash payment input
  - `calculator-modal.tsx` – Numeric modal (quantity, discount, price)

**Routes:** `/login`, `/(tabs)`, `/products`, `/sales`, `/transactions`, `/users`, etc.

---

## Shared (root)

Used by both portfolio and EdysonPOS:

- **`app/`** – Expo Router screens and layouts
- **`components/`** – Shared UI (themed-text, ui/button, auth-guard, printer-connect-modal, etc.)
- **`contexts/`** – Auth, language (portfolio theme lives under `portfolio/context/`)
- **`hooks/`** – useColorScheme, usePermissions, etc.
- **`lib/`** – Supabase client and DB types
- **`constants/`** – theme, translations, product-units, product-types (POS-related but shared with UI)
- **`utils/`** – date, currency, permissions, supabase-test (no receipt-formatter; that’s in `edysonpos/utils`)

---

## Import paths

- Portfolio: `@/portfolio/constants/...`, `@/portfolio/context/...`, `@/portfolio/components/...`
- EdysonPOS: `@/edysonpos/types/...`, `@/edysonpos/utils/...`, `@/edysonpos/services/...`, `@/edysonpos/components/...`
- Shared: `@/components/...`, `@/contexts/...`, `@/lib/...`, `@/hooks/...`, `@/constants/...`, `@/utils/...`
