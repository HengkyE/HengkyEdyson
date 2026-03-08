# Direct Neon connection (no backend, no Vercel)

Use this so the app talks to your Neon database directly. No `npm run server`, no Vercel API.

## 1. Enable Data API in Neon

1. Open [Neon Console](https://console.neon.tech) → your project → select the branch you use.
2. Go to **Data API** (or **API** in the branch menu).
3. Turn the Data API **ON**.
4. Set authentication to **Use Neon Auth** (so the app sends your login JWT).
5. Copy the **API URL** (e.g. `https://ep-xxx.apirest.region.aws.neon.tech/neondb`).

## 2. Get Neon Auth URL

1. In Neon Console → **App Backend** (or **Auth**) → **Auth**.
2. Copy the **Auth URL** (e.g. `https://ep-xxx.neonauth.region.aws.neon.tech/neondb/auth`).

## 3. Configure `.env`

Create or edit `.env` in the project root:

```env
# Direct Neon – no backend
EXPO_PUBLIC_NEON_DATA_API_URL=https://ep-xxx.apirest.region.aws.neon.tech/neondb
EXPO_PUBLIC_NEON_AUTH_URL=https://ep-xxx.neonauth.region.aws.neon.tech/neondb/auth

# Leave empty so the app does not use a backend
EXPO_PUBLIC_API_URL=
```

Use your real URLs from steps 1 and 2. Do **not** set `EXPO_PUBLIC_API_URL` to a Vercel or backend URL if you want direct connection.

## 4. Run the app

```bash
npm run web
# or
npx expo start --web
```

Open the app, **sign in** with Neon Auth (email/password). After login, the app will use your JWT to call the Data API and load/save data in Neon. You can test the database anytime without running a backend.
