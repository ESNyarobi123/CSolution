import { randomBytes, scryptSync } from "node:crypto"
import pg from "pg"

// Creates or updates the initial shop team.
//
//   CSOLUTION_TEAM="cash@shop.com:Cashier,store@shop.com:Storekeeper" \
//   CSOLUTION_TEAM_PASSWORD="..." \
//   node scripts/create-staff.mjs
//
// The password is never stored in the repository. It must be at least 12
// characters, matching the rule enforced by the staff form in the app.
// Running this again resets those accounts to the supplied password.

const roles = ["Admin", "Manager", "Cashier", "Storekeeper", "Technician"]
const password = process.env.CSOLUTION_TEAM_PASSWORD
const team = (process.env.CSOLUTION_TEAM ?? "").split(",").map(entry => entry.trim()).filter(Boolean)

if (!team.length) {
  console.log("CSOLUTION_TEAM is empty, no staff accounts were changed.")
  process.exit(0)
}
if (!password || password.length < 12) {
  throw new Error("Set CSOLUTION_TEAM_PASSWORD (at least 12 characters).")
}

const entries = team.map(entry => {
  const [address, role, display] = entry.split(":")
  const email = (address ?? "").trim().toLowerCase()
  const title = (role ?? "").trim()
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    throw new Error(`Invalid team entry "${entry}". Use email:Role.`)
  }
  if (!roles.includes(title)) {
    throw new Error(`Unknown role "${title}". Use one of ${roles.join(", ")}.`)
  }
  const fallback = email.split("@")[0].replace(/[._-]+/g, " ").trim().replace(/\b\w/g, c => c.toUpperCase())
  return { email, role: title, name: display?.trim() || fallback || title }
})

const hash = value => {
  const salt = randomBytes(16).toString("hex")
  return salt + ":" + scryptSync(value, salt, 64).toString("hex")
}

const pool = new pg.Pool(process.env.DATABASE_URL ? { connectionString: process.env.DATABASE_URL } : {})
const client = await pool.connect()
try {
  await client.query("BEGIN")
  for (const { email, role, name } of entries) {
    const existing = await client.query("SELECT id FROM staff WHERE email=$1", [email])
    await client.query(
      `INSERT INTO staff (name,email,password_hash,role,active) VALUES ($1,$2,$3,$4,true)
       ON CONFLICT (email) DO UPDATE SET name=excluded.name, password_hash=excluded.password_hash, role=excluded.role, active=true`,
      [name, email, hash(password), role]
    )
    console.log(`${existing.rowCount ? "Updated" : "Created"} ${role} · ${name} · ${email}`)
  }
  await client.query("DELETE FROM sessions WHERE staff_id IN (SELECT id FROM staff WHERE email = ANY($1::text[]))", [entries.map(e => e.email)])
  await client.query("COMMIT")
} catch (error) {
  await client.query("ROLLBACK")
  throw error
} finally {
  client.release()
  await pool.end()
}
