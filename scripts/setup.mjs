import { readFile, readdir } from "node:fs/promises"
import { randomBytes, scryptSync } from "node:crypto"
import pg from "pg"

const email = process.env.CSOLUTION_ADMIN_EMAIL?.trim().toLowerCase()
const password = process.env.CSOLUTION_ADMIN_PASSWORD
if (!email || !password || password.length < 12) {
  throw new Error("Set CSOLUTION_ADMIN_EMAIL and CSOLUTION_ADMIN_PASSWORD (at least 12 characters).")
}

const pool = new pg.Pool(process.env.DATABASE_URL ? { connectionString: process.env.DATABASE_URL } : {})
const client = await pool.connect()
try {
  await client.query("BEGIN")
  await client.query("SELECT pg_advisory_xact_lock(804513)")
  await client.query("CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY)")
  const directory = new URL("../db/", import.meta.url)
  const migrations = (await readdir(directory)).filter(name => /^\d+_.*\.sql$/.test(name)).sort()
  for (const migration of migrations) {
    if (!(await client.query("SELECT 1 FROM schema_migrations WHERE name = $1", [migration])).rowCount) {
      await client.query(await readFile(new URL(migration, directory), "utf8"))
      await client.query("INSERT INTO schema_migrations (name) VALUES ($1)", [migration])
    }
  }
  const salt = randomBytes(16).toString("hex")
  const hash = salt + ":" + scryptSync(password, salt, 64).toString("hex")
  await client.query(
    "INSERT INTO staff (name, email, password_hash, role) SELECT 'Store Admin', $1, $2, 'Admin' WHERE NOT EXISTS (SELECT 1 FROM staff WHERE role = 'Admin' AND active)",
    [email, hash]
  )
  if (process.env.CSOLUTION_DEMO === "1" && !(await client.query("SELECT 1 FROM schema_migrations WHERE name = 'demo'")).rowCount) {
    await client.query(await readFile(new URL("../db/demo.sql", import.meta.url), "utf8"))
    await client.query("INSERT INTO schema_migrations (name) VALUES ('demo')")
  }
  await client.query("COMMIT")
  console.log("CSolution database ready.")
} catch (error) {
  await client.query("ROLLBACK")
  throw error
} finally {
  client.release()
  await pool.end()
}
