/**
 * EdysonPOS Neon API – backend for Expo app.
 * Uses Neon (EdysonPOSSample_* tables). Set DATABASE_URL in .env (or copy from project root).
 */
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../.env") });
import express from "express";
import cors from "cors";
import { neon } from "@neondatabase/serverless";

const app = express();
const PORT = process.env.PORT || 3001;

if (!process.env.DATABASE_URL) {
  console.error("Missing DATABASE_URL. Set it in .env (local) or Vercel Project Settings → Environment Variables.");
  if (!process.env.VERCEL) process.exit(1);
}

const sql = process.env.DATABASE_URL ? neon(process.env.DATABASE_URL) : null;

// Allow localhost (dev) and Vercel deployments; credentials for cookies/auth
const corsOptions = {
  origin: (origin, cb) => {
    if (!origin) return cb(null, true);
    const local = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
    const vercel = /^https:\/\/([a-z0-9-]+\.)?vercel\.app$/.test(origin) || /\.vercel\.app$/.test(origin);
    cb(null, local || vercel);
  },
  credentials: true,
  methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Accept", "Authorization"],
};
app.use(cors(corsOptions));
app.use(express.json({ limit: "2mb" }));

// Fail fast when DATABASE_URL is missing (e.g. Vercel env not set)
app.use("/api", (req, res, next) => {
  if (!sql) {
    return res.status(503).json({ error: "DATABASE_URL is not configured. Set it in Vercel Project Settings → Environment Variables." });
  }
  next();
});

// ---------- Categories ----------
app.get("/api/categories", async (req, res) => {
  try {
    const rows = await sql`SELECT * FROM "EdysonPOSSample_categories" ORDER BY title ASC`;
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post("/api/categories", async (req, res) => {
  try {
    const { title } = req.body;
    const rows = await sql`INSERT INTO "EdysonPOSSample_categories" (title) VALUES (${title}) RETURNING *`;
    res.status(201).json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ---------- System data ----------
app.get("/api/system-data", async (req, res) => {
  try {
    const rows = await sql`SELECT * FROM "EdysonPOSSample_systemData" LIMIT 1`;
    res.json(rows[0] || null);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post("/api/next-grosir-invoice", async (req, res) => {
  try {
    const rows = await sql`SELECT * FROM "EdysonPOSSample_systemData" WHERE id = 'notaGrosir'`;
    let nextNo = 1;
    if (rows.length > 0) {
      nextNo = Number(rows[0].grosirInvoiceNo || 0) + 1;
      await sql`UPDATE "EdysonPOSSample_systemData" SET "grosirInvoiceNo" = ${nextNo} WHERE id = 'notaGrosir'`;
    } else {
      await sql`INSERT INTO "EdysonPOSSample_systemData" (id, "grosirInvoiceNo") VALUES ('notaGrosir', 1)`;
    }
    res.json({ nextNo });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ---------- Barangs ----------
app.get("/api/barangs", async (req, res) => {
  try {
    const rows = await sql`SELECT * FROM "EdysonPOSSample_barangs" ORDER BY "barangNama" ASC`;
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get("/api/barangs/:id", async (req, res) => {
  try {
    const id = req.params.id.trim();
    const rows = await sql`SELECT * FROM "EdysonPOSSample_barangs" WHERE id = ${id}`;
    if (rows.length === 0) return res.status(404).json({ error: "Not found" });
    res.json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post("/api/barangs", async (req, res) => {
  try {
    const b = req.body;
    const id = (b.id || "").toString().toUpperCase();
    await sql`INSERT INTO "EdysonPOSSample_barangs" (id, "createdBy", "barangNama", "barangType", "barangUnit", "barangHarga", "barangModal", "barangGrosir", "barangBon", "barangNote", "stockBarang", "stockTokoMini")
      VALUES (${id}, ${b.createdBy ?? "system"}, ${b.barangNama}, ${b.barangType ?? "umum"}, ${b.barangUnit ?? "Pcs"}, ${b.barangHarga}, ${b.barangModal ?? 0}, ${b.barangGrosir}, ${b.barangBon ?? 0}, ${b.barangNote ?? null}, ${b.stockBarang ?? 0}, ${b.stockTokoMini ?? 0})`;
    const rows = await sql`SELECT * FROM "EdysonPOSSample_barangs" WHERE id = ${id}`;
    res.status(201).json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.patch("/api/barangs/:id", async (req, res) => {
  try {
    const id = req.params.id.trim();
    const u = req.body;
    if (u.barangNama !== undefined) await sql`UPDATE "EdysonPOSSample_barangs" SET "barangNama" = ${u.barangNama} WHERE id = ${id}`;
    if (u.barangUnit !== undefined) await sql`UPDATE "EdysonPOSSample_barangs" SET "barangUnit" = ${u.barangUnit} WHERE id = ${id}`;
    if (u.barangHarga !== undefined) await sql`UPDATE "EdysonPOSSample_barangs" SET "barangHarga" = ${u.barangHarga} WHERE id = ${id}`;
    if (u.barangGrosir !== undefined) await sql`UPDATE "EdysonPOSSample_barangs" SET "barangGrosir" = ${u.barangGrosir} WHERE id = ${id}`;
    if (u.barangBon !== undefined) await sql`UPDATE "EdysonPOSSample_barangs" SET "barangBon" = ${u.barangBon} WHERE id = ${id}`;
    if (u.barangModal !== undefined) await sql`UPDATE "EdysonPOSSample_barangs" SET "barangModal" = ${u.barangModal} WHERE id = ${id}`;
    if (u.barangType !== undefined) await sql`UPDATE "EdysonPOSSample_barangs" SET "barangType" = ${u.barangType} WHERE id = ${id}`;
    if (u.barangNote !== undefined) await sql`UPDATE "EdysonPOSSample_barangs" SET "barangNote" = ${u.barangNote} WHERE id = ${id}`;
    if (u.stockBarang !== undefined) await sql`UPDATE "EdysonPOSSample_barangs" SET "stockBarang" = ${u.stockBarang} WHERE id = ${id}`;
    if (u.stockTokoMini !== undefined) await sql`UPDATE "EdysonPOSSample_barangs" SET "stockTokoMini" = ${u.stockTokoMini} WHERE id = ${id}`;
    const rows = await sql`SELECT * FROM "EdysonPOSSample_barangs" WHERE id = ${id}`;
    res.json(rows[0] || null);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.patch("/api/barangs/:id/stock", async (req, res) => {
  try {
    const id = req.params.id.trim();
    const { stockBarang, stockTokoMini } = req.body;
    if (stockTokoMini !== undefined) {
      await sql`UPDATE "EdysonPOSSample_barangs" SET "stockBarang" = ${stockBarang}, "stockTokoMini" = ${stockTokoMini} WHERE id = ${id}`;
    } else {
      await sql`UPDATE "EdysonPOSSample_barangs" SET "stockBarang" = ${stockBarang} WHERE id = ${id}`;
    }
    res.status(204).end();
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete("/api/barangs/:id", async (req, res) => {
  try {
    await sql`DELETE FROM "EdysonPOSSample_barangs" WHERE id = ${req.params.id.trim()}`;
    res.status(204).end();
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ---------- User profiles ----------
app.get("/api/user-profiles", async (req, res) => {
  try {
    const rows = await sql`SELECT * FROM "EdysonPOSSample_userProfiles" ORDER BY created_at DESC`;
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get("/api/user-profiles/:id", async (req, res) => {
  try {
    const rows = await sql`SELECT * FROM "EdysonPOSSample_userProfiles" WHERE id = ${req.params.id}::uuid`;
    res.json(rows[0] || null);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post("/api/user-profiles", async (req, res) => {
  try {
    const p = req.body;
    await sql`INSERT INTO "EdysonPOSSample_userProfiles" (id, "fullName", email, phone, role, "isActive")
      VALUES (${p.id}, ${p.fullName}, ${p.email}, ${p.phone ?? null}, ${p.role}, true)`;
    const rows = await sql`SELECT * FROM "EdysonPOSSample_userProfiles" WHERE id = ${p.id}`;
    res.status(201).json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.patch("/api/user-profiles/:id", async (req, res) => {
  try {
    const id = req.params.id;
    const u = req.body;
    if (u.lastLoginAt !== undefined) {
      await sql`UPDATE "EdysonPOSSample_userProfiles" SET "lastLoginAt" = ${u.lastLoginAt}, updated_at = now() WHERE id = ${id}`;
    }
    if (u.fullName !== undefined) {
      await sql`UPDATE "EdysonPOSSample_userProfiles" SET "fullName" = ${u.fullName}, updated_at = now() WHERE id = ${id}`;
    }
    if (u.phone !== undefined) {
      await sql`UPDATE "EdysonPOSSample_userProfiles" SET phone = ${u.phone}, updated_at = now() WHERE id = ${id}`;
    }
    if (u.role !== undefined) {
      await sql`UPDATE "EdysonPOSSample_userProfiles" SET role = ${u.role}, updated_at = now() WHERE id = ${id}`;
    }
    if (u.isActive !== undefined) {
      await sql`UPDATE "EdysonPOSSample_userProfiles" SET "isActive" = ${u.isActive}, updated_at = now() WHERE id = ${id}`;
    }
    const rows = await sql`SELECT * FROM "EdysonPOSSample_userProfiles" WHERE id = ${id}`;
    res.json(rows[0] || null);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get("/api/users-without-profiles", async (req, res) => {
  res.json([]);
});

// ---------- Jualan Kontan ----------
app.get("/api/jualan-kontan", async (req, res) => {
  try {
    if (req.query.today === "true") {
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      const rows = await sql`SELECT * FROM "EdysonPOSSample_jualanKontan" WHERE created_at >= ${start.toISOString()} ORDER BY created_at DESC`;
      return res.json(rows);
    }
    const rows = await sql`SELECT * FROM "EdysonPOSSample_jualanKontan" ORDER BY created_at DESC`;
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get("/api/jualan-kontan/date-range", async (req, res) => {
  try {
    const { start, end, userId } = req.query;
    let rows = await sql`SELECT * FROM "EdysonPOSSample_jualanKontan" WHERE created_at >= ${start} AND created_at <= ${end} ORDER BY created_at DESC`;
    if (userId) rows = rows.filter((r) => r.userId === userId);
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post("/api/jualan-kontan", async (req, res) => {
  try {
    const b = req.body;
    const id = b.id || Date.now().toString();
    await sql`INSERT INTO "EdysonPOSSample_jualanKontan" (id, "totalBelanja", "namaKasir", "caraPembayaran", "created_atIndo", "userId")
      VALUES (${id}, ${b.totalBelanja}, ${b.namaKasir}, ${b.caraPembayaran}, ${b.created_atIndo ?? null}, ${b.userId ?? null})`;
    const rows = await sql`SELECT * FROM "EdysonPOSSample_jualanKontan" WHERE id = ${id}`;
    res.status(201).json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ---------- Jualan Items ----------
app.get("/api/jualan-items/kontan/:id", async (req, res) => {
  try {
    const rows = await sql`SELECT * FROM "EdysonPOSSample_jualanItems" WHERE "jualanKontanId" = ${req.params.id} ORDER BY created_at ASC`;
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get("/api/jualan-items/grosir/:id", async (req, res) => {
  try {
    const rows = await sql`SELECT * FROM "EdysonPOSSample_jualanItems" WHERE "jualanGrosirId" = ${req.params.id} ORDER BY created_at ASC`;
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post("/api/jualan-items", async (req, res) => {
  try {
    const items = Array.isArray(req.body) ? req.body : [req.body];
    const inserted = [];
    for (const it of items) {
      const r = await sql`INSERT INTO "EdysonPOSSample_jualanItems" ("jualanKontanId", "jualanGrosirId", "barangId", "barangNama", quantity, "unitPrice", "totalPrice", "barangUnit")
        VALUES (${it.jualanKontanId ?? null}, ${it.jualanGrosirId ?? null}, ${it.barangId}, ${it.barangNama}, ${it.quantity}, ${it.unitPrice}, ${it.totalPrice}, ${it.barangUnit ?? "Pcs"})
        RETURNING *`;
      inserted.push(r[0]);
    }
    res.status(201).json(inserted);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ---------- Jualan Grosir ----------
app.get("/api/jualan-grosir", async (req, res) => {
  try {
    if (req.query.today === "true") {
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      const rows = await sql`SELECT * FROM "EdysonPOSSample_jualanGrosir" WHERE created_at >= ${start.toISOString()} ORDER BY created_at DESC`;
      return res.json(rows);
    }
    const rows = await sql`SELECT * FROM "EdysonPOSSample_jualanGrosir" ORDER BY created_at DESC`;
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get("/api/jualan-grosir/date-range", async (req, res) => {
  try {
    const { start, end, userId } = req.query;
    let rows = await sql`SELECT * FROM "EdysonPOSSample_jualanGrosir" WHERE created_at >= ${start} AND created_at <= ${end} ORDER BY created_at DESC`;
    if (userId) rows = rows.filter((r) => r.userId === userId);
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get("/api/jualan-grosir/:id", async (req, res) => {
  try {
    const rows = await sql`SELECT * FROM "EdysonPOSSample_jualanGrosir" WHERE id = ${req.params.id}`;
    if (rows.length === 0) return res.status(404).json({ error: "Not found" });
    res.json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.patch("/api/jualan-grosir/:id", async (req, res) => {
  try {
    const u = req.body;
    await sql`UPDATE "EdysonPOSSample_jualanGrosir" SET "paymentHistory" = ${JSON.stringify(u.paymentHistory)}, "setorGrosir" = ${u.setorGrosir}, "sisaBonGrosir" = ${u.sisaBonGrosir}, "payment_status" = ${u.payment_status}, "percent_paid" = ${u.percent_paid} WHERE id = ${req.params.id}`;
    const rows = await sql`SELECT * FROM "EdysonPOSSample_jualanGrosir" WHERE id = ${req.params.id}`;
    res.json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete("/api/jualan-grosir/:id", async (req, res) => {
  try {
    const id = req.params.id;
    await sql`DELETE FROM "EdysonPOSSample_jualanItems" WHERE "jualanGrosirId" = ${id}`;
    await sql`DELETE FROM "EdysonPOSSample_grosirPayments" WHERE "jualanGrosirId" = ${id}`;
    await sql`DELETE FROM "EdysonPOSSample_jualanGrosir" WHERE id = ${id}`;
    res.status(204).end();
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post("/api/jualan-grosir", async (req, res) => {
  try {
    const b = req.body;
    const r = await sql`INSERT INTO "EdysonPOSSample_jualanGrosir" ("invoiceNo", "namaPelanggan", "totalBelanja", "setorGrosir", "sisaBonGrosir", "namaKasir", "caraPembayaran", "created_atIndo", "paymentHistory", "payment_status", "percent_paid", "userId")
      VALUES (${b.invoiceNo}, ${b.namaPelanggan ?? ""}, ${b.totalBelanja}, ${b.setorGrosir}, ${b.sisaBonGrosir}, ${b.namaKasir}, ${b.caraPembayaran ?? ""}, ${b.created_atIndo ?? null}, ${b.paymentHistory ? JSON.stringify(b.paymentHistory) : null}, ${b.payment_status ?? "unpaid"}, ${b.percent_paid ?? null}, ${b.userId ?? null})
      RETURNING *`;
    res.status(201).json(r[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ---------- Grosir payments ----------
app.get("/api/grosir-payments/:jualanGrosirId", async (req, res) => {
  try {
    const rows = await sql`SELECT * FROM "EdysonPOSSample_grosirPayments" WHERE "jualanGrosirId" = ${req.params.jualanGrosirId} ORDER BY created_at ASC`;
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get("/api/grosir-payments/date-range", async (req, res) => {
  try {
    const { start, end } = req.query;
    const rows = await sql`SELECT * FROM "EdysonPOSSample_grosirPayments" WHERE created_at >= ${start} AND created_at <= ${end} ORDER BY created_at DESC`;
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post("/api/grosir-payments", async (req, res) => {
  try {
    const b = req.body;
    const r = await sql`INSERT INTO "EdysonPOSSample_grosirPayments" ("jualanGrosirId", amount, "paymentMethod", "createdBy", "userId")
      VALUES (${b.jualanGrosirId}, ${b.amount}, ${b.paymentMethod}, ${b.createdBy}, ${b.userId ?? null})
      RETURNING *`;
    res.status(201).json(r[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ---------- Grosir drafts ----------
app.get("/api/grosir-drafts", async (req, res) => {
  try {
    let rows = await sql`SELECT * FROM "EdysonPOSSample_grosirDrafts" WHERE status = 'draft' ORDER BY updated_at DESC`;
    const userId = req.query.userId;
    if (userId) rows = rows.filter((r) => r.createdBy === userId);
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get("/api/grosir-drafts/:id", async (req, res) => {
  try {
    const rows = await sql`SELECT * FROM "EdysonPOSSample_grosirDrafts" WHERE id = ${req.params.id}`;
    res.json(rows[0] || null);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get("/api/grosir-drafts/:id/items", async (req, res) => {
  try {
    const rows = await sql`SELECT * FROM "EdysonPOSSample_grosirDraftItems" WHERE "grosirDraftId" = ${req.params.id} ORDER BY "barangNama"`;
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post("/api/grosir-drafts", async (req, res) => {
  try {
    const b = req.body;
    const r = await sql`INSERT INTO "EdysonPOSSample_grosirDrafts" ("createdBy", "namaPelanggan", "totalBelanja", "setorAwal", status)
      VALUES (${b.createdBy ?? null}, ${b.namaPelanggan ?? ""}, ${b.totalBelanja}, ${b.setorAwal ?? 0}, 'draft')
      RETURNING *`;
    const draftId = r[0].id;
    if (b.items && b.items.length > 0) {
      for (const it of b.items) {
        await sql`INSERT INTO "EdysonPOSSample_grosirDraftItems" ("grosirDraftId", "barangId", "barangNama", "barangUnit", quantity, "unitPrice", "totalPrice")
          VALUES (${draftId}, ${it.barangId}, ${it.barangNama}, ${it.barangUnit ?? "Pcs"}, ${it.quantity}, ${it.unitPrice}, ${it.totalPrice})`;
      }
    }
    const rows = await sql`SELECT * FROM "EdysonPOSSample_grosirDrafts" WHERE id = ${draftId}`;
    res.status(201).json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.patch("/api/grosir-drafts/:id", async (req, res) => {
  try {
    const id = req.params.id;
    const b = req.body;
    await sql`UPDATE "EdysonPOSSample_grosirDrafts" SET "namaPelanggan" = ${b.namaPelanggan ?? ""}, "totalBelanja" = ${b.totalBelanja}, "setorAwal" = ${b.setorAwal ?? 0}, updated_at = now() WHERE id = ${id}`;
    await sql`DELETE FROM "EdysonPOSSample_grosirDraftItems" WHERE "grosirDraftId" = ${id}`;
    if (b.items && b.items.length > 0) {
      for (const it of b.items) {
        await sql`INSERT INTO "EdysonPOSSample_grosirDraftItems" ("grosirDraftId", "barangId", "barangNama", "barangUnit", quantity, "unitPrice", "totalPrice")
          VALUES (${id}, ${it.barangId}, ${it.barangNama}, ${it.barangUnit ?? "Pcs"}, ${it.quantity}, ${it.unitPrice}, ${it.totalPrice})`;
      }
    }
    const rows = await sql`SELECT * FROM "EdysonPOSSample_grosirDrafts" WHERE id = ${id}`;
    res.json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete("/api/grosir-drafts/:id", async (req, res) => {
  try {
    const id = req.params.id;
    await sql`DELETE FROM "EdysonPOSSample_grosirDraftItems" WHERE "grosirDraftId" = ${id}`;
    await sql`DELETE FROM "EdysonPOSSample_grosirDrafts" WHERE id = ${id}`;
    res.status(204).end();
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get("/api/health", (req, res) => res.json({ ok: true }));

// ---------- 3Sekawan: sampleBilliard_sessions ----------
app.get("/api/billiard/sessions", async (req, res) => {
  try {
    const { status } = req.query;
    let rows = await sql`SELECT * FROM sampleBilliard_sessions ORDER BY started_at DESC`;
    if (status) rows = rows.filter((r) => r.status === status);
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post("/api/billiard/sessions", async (req, res) => {
  try {
    const b = req.body;
    const r = await sql`INSERT INTO sampleBilliard_sessions (table_number, started_at, duration_hours, rate_per_hour, status, cashier_id)
      VALUES (${b.table_number}, ${b.started_at ?? new Date().toISOString()}, ${b.duration_hours}, ${b.rate_per_hour}, ${b.status ?? "active"}, ${b.cashier_id})
      RETURNING *`;
    res.status(201).json(r[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.patch("/api/billiard/sessions/:id", async (req, res) => {
  try {
    const id = req.params.id;
    const u = req.body;
    const rows = await sql`SELECT * FROM sampleBilliard_sessions WHERE id = ${id}::uuid`;
    if (rows.length === 0) return res.status(404).json({ error: "Not found" });
    const cur = rows[0];
    const duration_hours = u.duration_hours !== undefined ? u.duration_hours : cur.duration_hours;
    const rate_per_hour = u.rate_per_hour !== undefined ? u.rate_per_hour : cur.rate_per_hour;
    const status = u.status !== undefined ? u.status : cur.status;
    const paid_at = u.paid_at !== undefined ? u.paid_at : cur.paid_at;
    const payment_method = u.payment_method !== undefined ? u.payment_method : cur.payment_method;
    await sql`UPDATE sampleBilliard_sessions SET duration_hours = ${duration_hours}, rate_per_hour = ${rate_per_hour}, status = ${status}, paid_at = ${paid_at}, payment_method = ${payment_method} WHERE id = ${id}::uuid`;
    const out = await sql`SELECT * FROM sampleBilliard_sessions WHERE id = ${id}::uuid`;
    res.json(out[0] || null);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ---------- 3Sekawan: sampleBilliard_shop_expenses ----------
app.get("/api/billiard/shop-expenses", async (req, res) => {
  try {
    const { expense_date, category } = req.query;
    let rows = await sql`SELECT * FROM sampleBilliard_shop_expenses ORDER BY expense_date DESC, created_at DESC`;
    if (expense_date) rows = rows.filter((r) => r.expense_date && r.expense_date.toString().startsWith(expense_date));
    if (category) rows = rows.filter((r) => r.category === category);
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post("/api/billiard/shop-expenses", async (req, res) => {
  try {
    const b = req.body;
    const r = await sql`INSERT INTO sampleBilliard_shop_expenses (expense_date, category, description, amount, created_by, notes)
      VALUES (${b.expense_date}, ${b.category}, ${b.description ?? null}, ${b.amount}, ${b.created_by ?? null}, ${b.notes ?? null})
      RETURNING *`;
    res.status(201).json(r[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete("/api/billiard/shop-expenses/:id", async (req, res) => {
  try {
    await sql`DELETE FROM sampleBilliard_shop_expenses WHERE id = ${req.params.id}::uuid`;
    res.status(204).end();
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Only start listening when running locally (not on Vercel serverless)
if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`Neon API at http://localhost:${PORT}`);
  });
}

export default app;
