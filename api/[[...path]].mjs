/**
 * Vercel serverless handler for all /api/* routes.
 * Exports the Express app so /api/barangs, /api/categories, etc. are handled.
 * Set DATABASE_URL (and optional EXPO_PUBLIC_* for build) in Vercel Project Settings → Environment Variables.
 */
import app from "../server/index.js";
export default app;
