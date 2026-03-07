/**
 * Test Neon database connection using DATABASE_URL from .env
 * Run: node scripts/test-neon-connection.js
 * Ensure .env contains: DATABASE_URL=postgresql://...
 */

require('dotenv').config();
const { neon } = require('@neondatabase/serverless');

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('Missing DATABASE_URL in .env. Add your Neon connection string.');
    process.exit(1);
  }

  const sql = neon(url);

  try {
    const version = await sql`SELECT version()`;
    console.log('Neon connection OK');
    console.log('Postgres:', version[0]?.version ?? 'unknown');

    const tables = await sql`
      SELECT table_schema, table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_schema, table_name
    `;
    if (tables.length === 0) {
      console.log('No tables in public schema yet. Run scripts/neon-edysonpos-schema.sql in Neon SQL Editor.');
    } else {
      console.log('Tables:', tables.map((t) => t.table_name).join(', '));
    }
  } catch (err) {
    console.error('Connection failed:', err.message);
    process.exit(1);
  }
}

main();
