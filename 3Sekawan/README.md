# 3Sekawan – Showcase source

This folder contains the **source code** for the 3Sekawan project showcase in the main HengkyEdyson app. It is not a standalone project.

- **Run the app:** From the repo root, start the main app (`npm start`), then open **Portfolio → 3Sekawan → "Open 3Sekawan app"**, or navigate to `/three-sekawan-app`.
- **Routes:** The main app re-exports these screens under `app/three-sekawan-app/` from `3Sekawan/app/`.
- **Dependencies:** Use the root `node_modules`; do not run `npm install` inside this folder.
- **Env:** Use the root `.env`. See `.env.example` here for 3Sekawan-specific variable names (Neon, Telegram, etc.).
- **Components:** Shared UI lives in the root app (`@/components`, `@/edysonpos/components`); this folder has no `components` directory.

Billiard session billing, POS, expenses, and Neon backend are implemented here and run inside the main Expo app.
