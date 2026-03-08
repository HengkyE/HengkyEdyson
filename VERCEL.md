# Deploying to Vercel

The app is set up so that:

- **Frontend** (Expo web build) is served as static files from the root.
- **Backend** (Neon API) runs as a Vercel serverless function for all `/api/*` routes.
- **Sensitive values** stay out of git: use `.env` locally and **Vercel Project Settings → Environment Variables** in production.

## 1. Keep secrets out of Git

- `.env` and `.env.local` are in `.gitignore` — never commit them.
- Copy `.env.example` to `.env` for local development and fill in real values only on your machine.

## 2. Environment variables on Vercel

In **Vercel → Your Project → Settings → Environment Variables**, add:

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | Neon PostgreSQL connection string (pooled). From Neon Console → Connection details. |
| `EXPO_PUBLIC_API_URL` | Yes (for API) | Your Vercel deployment URL, e.g. `https://your-project.vercel.app`. Used at **build** time so the frontend calls your API. |
| `EXPO_PUBLIC_NEON_AUTH_URL` | If using Neon Auth | Neon Auth URL from Neon Console → App Backend → Auth. |
| `EXPO_PUBLIC_SUPABASE_URL` | If using Supabase | Only if you use Supabase instead of Neon Auth. |

Apply to **Production** (and Preview if you want the same behavior for preview deployments).

## 3. Deploy

- Push to your Git repo; Vercel will build and deploy.
- Build command: `npm run build:web`
- Output: `dist`
- The serverless API is in `api/[[...path]].mjs` and serves all `/api/*` routes (e.g. `/api/barangs`, `/api/categories`).

## 4. Local development

- Run the backend: `npm run server` (uses `.env` and `DATABASE_URL`).
- In `.env` set `EXPO_PUBLIC_API_URL=http://localhost:3001`.
- Run the app: `npm run web`.

No backend process is needed in production on Vercel; the API runs as serverless functions.

## 5. Direct Neon Data API (no backend)

To connect **directly** from the app to Neon (no Express server, no Vercel serverless API):

1. In **Neon Console** → your branch → **Data API**: enable the Data API and set authentication to **Use Neon Auth**.
2. Copy the **API URL** (e.g. `https://ep-xxx.apirest.region.aws.neon.tech/neondb`).
3. In `.env` set:
   - `EXPO_PUBLIC_NEON_DATA_API_URL=<that URL>`
   - `EXPO_PUBLIC_NEON_AUTH_URL=<your Neon Auth URL>` (required for login and JWT)
4. Leave `EXPO_PUBLIC_API_URL` unset (or the Data API takes precedence if both are set).
5. Run the app and sign in with Neon Auth; the app will use the JWT for Data API requests.

No `npm run server` or Vercel API needed when using the Data API.
