# Neon database migration (EdysonPOS + 3Sekawan / sampleBilliard)

Use this guide when you run the Neon SQL and switch from Supabase to Neon. **Migration has not been started yet** — run the SQL first, then follow the steps below.

---

## 1. Run the SQL in Neon

1. In [Neon Console](https://console.neon.tech), open project **misty-tree-20956434** and go to **SQL Editor**.
2. Paste the contents of **`scripts/neon-edysonpos-schema.sql`** and run it.
3. Tables are created in this order:
   - **Part 1 – sampleBilliard (3Sekawan):** `sampleBilliard_sessions`, `sampleBilliard_shop_expenses` (billiard and shop expense tables; naming uses **sampleBilliard** prefix on top).
   - **Part 2 – EdysonPOS (all with EdysonPOSSample_ prefix):** `EdysonPOSSample_categories`, `EdysonPOSSample_systemData`, `EdysonPOSSample_barangs`, `EdysonPOSSample_userProfiles`, `EdysonPOSSample_jualanKontan`, `EdysonPOSSample_jualanGrosir`, `EdysonPOSSample_jualanItems`, `EdysonPOSSample_grosirPayments`, `EdysonPOSSample_grosirDrafts`, `EdysonPOSSample_grosirDraftItems`, and **`EdysonPOSSample`** (add-on table with constraint **`edyson_pos_sample_name_unique`** on `name`).

---

## 2. Table naming summary

| Scope        | Table naming / constraint |
|-------------|----------------------------|
| **3Sekawan**| `sampleBilliard_sessions`, `sampleBilliard_shop_expenses` |
| **EdysonPOS** | All tables use **EdysonPOSSample_** prefix: `EdysonPOSSample_categories`, `EdysonPOSSample_systemData`, `EdysonPOSSample_barangs`, `EdysonPOSSample_userProfiles`, `EdysonPOSSample_jualanKontan`, `EdysonPOSSample_jualanGrosir`, `EdysonPOSSample_jualanItems`, `EdysonPOSSample_grosirPayments`, `EdysonPOSSample_grosirDrafts`, `EdysonPOSSample_grosirDraftItems`, plus add-on table **`EdysonPOSSample`** (constraint **`edyson_pos_sample_name_unique`** on `name`). |
| **EdysonPOSSample** (add-on) | Unique constraint on `name`: **`edyson_pos_sample_name_unique`** |

If you use the **same Neon database** for both apps:

- **EdysonPOS** app (or backend) must use the prefixed table names: `EdysonPOSSample_categories`, `EdysonPOSSample_systemData`, `EdysonPOSSample_barangs`, `EdysonPOSSample_userProfiles`, etc., instead of `categories`, `systemData`, `barangs`, `userProfiles`.
- **3Sekawan** app must use: `sampleBilliard_sessions` and `sampleBilliard_shop_expenses` instead of `sessions` and `shop_expenses` (update Supabase client calls or your backend to point to these tables).

---

## 3. What you need to change for the migration

### A. **Database client: Supabase → Neon**

The apps use the **Supabase JS client** (`lib/supabase.ts`) against Supabase Postgres + REST. **Neon is plain Postgres** and does not provide that REST/Realtime API.

Options:

| Option | Description |
|--------|-------------|
| **1) Backend API** | Add a backend (Node/Edge) that connects to Neon with `@neondatabase/serverless` or `pg`, and exposes REST or tRPC. The Expo app calls this API instead of `supabase.from(...)`. |
| **2) Keep Supabase, use Neon as DB** | Use Supabase “external database” / connection pooling only if your plan supports it. |

**Recommended:** Option 1 — backend that uses Neon; app calls that backend for all DB access.

---

### B. **Environment variables**

- **Remove or stop using** (for DB access):
  - `EXPO_PUBLIC_SUPABASE_URL`
  - `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- **Add** (for your backend that uses Neon):
  - Backend only: **`DATABASE_URL`** = Neon connection string (Neon Console → Connection details).
  - App: e.g. **`EXPO_PUBLIC_API_URL`** = your backend base URL.

Do not put the Neon connection string in the Expo app.

---

### C. **Auth (Supabase Auth → your solution)**

- Current setup: **Supabase Auth**; `userProfiles.id` matches `auth.users.id`.
- Neon has **no built-in auth**. Either:
  - Keep **Supabase Auth** for login/signup and pass session/user id to your backend; backend uses Neon for data and checks user id, or
  - Replace with another auth (e.g. Clerk, Auth0) and keep storing user id in `userProfiles` as before.

---

### D. **Code changes**

1. **`lib/supabase.ts`**  
   - If moving fully off Supabase: replace with a client that calls your backend (e.g. `fetch(EXPO_PUBLIC_API_URL + '/barangs')`).  
   - If keeping Supabase Auth: use Supabase client only for `supabase.auth`; use your API client for all `supabase.from(...)`-style access.

2. **EdysonPOS – `edysonpos/services/database.ts`**  
   - Replace every `supabase.from('...')` with calls to your backend API. Use the **EdysonPOSSample_** table names in Neon: e.g. `EdysonPOSSample_categories`, `EdysonPOSSample_systemData`, `EdysonPOSSample_barangs`, `EdysonPOSSample_userProfiles`, `EdysonPOSSample_jualanKontan`, `EdysonPOSSample_jualanGrosir`, `EdysonPOSSample_jualanItems`, `EdysonPOSSample_grosirPayments`, `EdysonPOSSample_grosirDrafts`, `EdysonPOSSample_grosirDraftItems`, `EdysonPOSSample`. Keep the same function names and return types so the rest of the app does not need to change.

3. **3Sekawan – table names**  
   - If 3Sekawan uses the same Neon DB, change:
     - `from('sessions')` → `from('sampleBilliard_sessions')` (or equivalent in your backend).
     - `from('shop_expenses')` → `from('sampleBilliard_shop_expenses')`.

4. **RPC `get_users_without_profiles`**  
   - The SQL defines a stub that returns no rows. When you have an auth table, implement the function to select from that table and exclude ids that exist in `EdysonPOSSample_userProfiles`. Your backend can call it via raw SQL or a dedicated endpoint.

5. **Row Level Security (RLS)**  
   - Supabase RLS does not apply on Neon. Enforce permissions in your backend and return 403 when not allowed.

6. **EdysonPOS table names in backend**  
   - When querying Neon from your backend, use the prefixed names: `"EdysonPOSSample_categories"`, `"EdysonPOSSample_systemData"`, `"EdysonPOSSample_barangs"`, `"EdysonPOSSample_userProfiles"`, `"EdysonPOSSample_jualanKontan"`, `"EdysonPOSSample_jualanGrosir"`, `"EdysonPOSSample_jualanItems"`, `"EdysonPOSSample_grosirPayments"`, `"EdysonPOSSample_grosirDrafts"`, `"EdysonPOSSample_grosirDraftItems"`, `"EdysonPOSSample"`.

---

### E. **Data migration (existing Supabase data → Neon)**

1. **Export from Supabase**  
   - Use Supabase Dashboard → Database → backup, or `pg_dump` with the Supabase DB URL.

2. **Transform if needed**  
   - EdysonPOS tables in Neon use the **EdysonPOSSample_** prefix. Map from Supabase names to Neon names, e.g.:
     - `categories` → `EdysonPOSSample_categories`, `systemData` → `EdysonPOSSample_systemData`, `barangs` → `EdysonPOSSample_barangs`, `userProfiles` → `EdysonPOSSample_userProfiles`, `jualanKontan` → `EdysonPOSSample_jualanKontan`, `jualanGrosir` → `EdysonPOSSample_jualanGrosir`, `jualanItems` → `EdysonPOSSample_jualanItems`, `grosirPayments` → `EdysonPOSSample_grosirPayments`, `grosirDrafts` → `EdysonPOSSample_grosirDrafts`, `grosirDraftItems` → `EdysonPOSSample_grosirDraftItems`; the add-on table stays `EdysonPOSSample`.
   - For 3Sekawan, map: `sessions` → `sampleBilliard_sessions`, `shop_expenses` → `sampleBilliard_shop_expenses`.  
   - If your dump uses different names, rename or map in the dump/scripts.

3. **Import into Neon**  
   - Use `psql` with the Neon connection string, or Neon’s import/restore, e.g.  
     `psql "postgresql://user:pass@host/db?sslmode=require" < dump.sql`

4. **Sequence for `grosirInvoiceNo`**  
   - After importing EdysonPOS data, set the next invoice number:  
     `UPDATE "EdysonPOSSample_systemData" SET "grosirInvoiceNo" = (SELECT COALESCE(MAX("invoiceNo"),0)+1 FROM "EdysonPOSSample_jualanGrosir") WHERE id = 'notaGrosir';`

---

### F. **EdysonPOSSample table**

- **Table name:** `EdysonPOSSample`.
- **Columns:** `id`, `created_at`, `name`, `description`, `metadata` (JSONB).
- **Unique constraint on `name`:** **`edyson_pos_sample_name_unique`**.
- Use for sample/demo rows or app metadata. Add API endpoints and service functions when you need it.

---

## 4. Checklist

- [ ] Run `neon-edysonpos-schema.sql` in Neon SQL Editor (sampleBilliard tables first, then EdysonPOS; EdysonPOSSample with `edyson_pos_sample_name_unique`).
- [ ] Create a backend that connects to Neon with `DATABASE_URL`.
- [ ] Replace Supabase DB usage in the app with calls to your backend API; keep or replace Supabase Auth.
- [ ] Set `EXPO_PUBLIC_API_URL` (and backend `DATABASE_URL`) in env.
- [ ] If 3Sekawan uses the same Neon DB: update table names to `sampleBilliard_sessions` and `sampleBilliard_shop_expenses`.
- [ ] Implement auth and authorization in the backend (no RLS on Neon).
- [ ] Migrate existing data from Supabase to Neon and fix sequences if needed.
- [ ] Implement `get_users_without_profiles` in Neon when you have an auth table.
- [ ] Add service/API for `EdysonPOSSample` if needed.
