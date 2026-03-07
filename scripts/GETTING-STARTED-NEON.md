# Get started with Neon (this project)

You already have Neon projects set up. Use this guide to run your schema and connect.

---

## 1. Your Neon project

**Project ID for this repo (EdysonPOS + 3Sekawan):** `misty-tree-20956434`

Use this project in the Neon Console and CLI for schema, connection string, and `neon set-context`.

---

## 2. Run the schema (first-time setup)

1. Open **[Neon Console](https://console.neon.tech)** and select the project **misty-tree-20956434**.
2. Go to **SQL Editor**.
3. Open **`scripts/neon-edysonpos-schema.sql`** in your repo, copy its full contents, paste into the SQL Editor, and click **Run**.

This creates:

- **3Sekawan:** `sampleBilliard_sessions`, `sampleBilliard_shop_expenses`
- **EdysonPOS:** `EdysonPOSSample_categories`, `EdysonPOSSample_systemData`, `EdysonPOSSample_barangs`, `EdysonPOSSample_userProfiles`, and the rest of the EdysonPOS tables (all with `EdysonPOSSample_` prefix), plus the `EdysonPOSSample` add-on table.

---

## 3. Add your connection string and test

1. **Add to `.env`** (in the project root; `.env` is gitignored so the URL is never committed):
   ```bash
   DATABASE_URL=postgresql://neondb_owner:YOUR_PASSWORD@ep-xxx-pooler.region.aws.neon.tech/neondb?sslmode=require&channel_binding=require
   ```
   Paste your real Neon connection string from the Console (Connection details). Use the **pooled** one (host usually has `-pooler`).

2. **Install deps and test the connection:**
   ```bash
   npm install
   npm run neon:test
   ```
   You should see `Neon connection OK` and the list of tables (or a message to run the schema if no tables exist yet).

**Do not** put this string in the Expo app; use it only in scripts or a backend. See [NEON-MIGRATION.md](./NEON-MIGRATION.md) for app migration.

---

## 4. Connect from code

- **Backend (Node/Edge):** Use `@neondatabase/serverless` or `pg` with the connection string. Set it as `DATABASE_URL` in your backend env (never in the client app).
- **Expo app:** Keep using Supabase for now, or switch to calling your backend API; see [NEON-MIGRATION.md](./NEON-MIGRATION.md) for full migration steps.

---

## 4b. Neon Auth (login with Neon instead of Supabase)

To use **Neon Auth** for login (Better Auth–compatible):

1. In **Neon Console** → your project → **App Backend** → **Auth** → **Configuration**, copy the **Auth URL** (e.g. `https://ep-xxx.neonauth.region.aws.neon.tech/neondb/auth`).
2. Add to **`.env`** (project root):
   ```bash
   EXPO_PUBLIC_NEON_AUTH_URL=https://ep-xxx.neonauth.region.aws.neon.tech/neondb/auth
   ```
3. Restart the Expo app. The app will use Neon Auth for sign-in/sign-out and session; when `EXPO_PUBLIC_API_URL` is also set, data (products, sales, profiles) comes from your Neon API server.

Ensure **Allow Localhost** (or your app’s domain) is enabled under Auth → Domains so redirects work.

---

## 5. Optional: Neon CLI

```bash
# Install
npm install -g neonctl

# Log in (opens browser)
neon auth

# List projects
neon projects list

# Use this project as default (misty-tree-20956434)
neon set-context --project-id misty-tree-20956434

# List branches
neon branches list

# Get connection string for default branch
neon connection-string
```

---

## 6. Next steps

- **Schema / tables:** [NEON-MIGRATION.md](./NEON-MIGRATION.md) — table naming, migration checklist, env vars, and code changes.
- **Neon docs:** [Learn the basics](https://neon.com/docs/get-started/signing-up), [Connect to Neon](https://neon.com/docs/connect/connect-intro), [Connect from any app](https://neon.com/docs/connect/connect-from-any-app).
