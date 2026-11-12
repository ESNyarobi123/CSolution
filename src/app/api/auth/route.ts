import { z } from "zod"
import { createSession, endSession, sameOrigin, verifyPassword } from "@/lib/auth"
import { first, pool } from "@/lib/db"

const credentials = z.object({ email: z.string().trim().email().max(254), password: z.string().min(1).max(200) })

export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "Invalid request origin." }, { status: 403 })
  const body = await request.json().catch(() => null)
  if (body?.action === "logout") {
    await endSession()
    return Response.json({ ok: true })
  }
  if (body?.action === "demo" && process.env.CSOLUTION_DEMO === "1") {
    const host = new URL(request.url).hostname
    if (!["localhost","127.0.0.1","[::1]"].includes(host)) {
      return Response.json({ error: "Open the demo from the local machine." }, { status: 403 })
    }
    const user = await first(pool, `SELECT id FROM staff WHERE email=$1 AND role='Admin' AND active
      AND EXISTS (SELECT 1 FROM schema_migrations WHERE name='demo')`, [process.env.CSOLUTION_ADMIN_EMAIL?.toLowerCase()])
    if (user) {
      await createSession(user.id, request, true)
      return Response.json({ ok: true })
    }
  }
  const parsed = credentials.safeParse(body)
  if (!parsed.success) return Response.json({ error: "Enter a valid email and password." }, { status: 400 })
  const email = parsed.data.email.toLowerCase()
  const limit = await first(pool, `INSERT INTO login_attempts (email,count,reset_at) VALUES ($1,1,now()+interval '15 minutes')
    ON CONFLICT (email) DO UPDATE SET count=CASE WHEN login_attempts.reset_at<now() THEN 1 ELSE login_attempts.count+1 END,
    reset_at=CASE WHEN login_attempts.reset_at<now() THEN excluded.reset_at ELSE login_attempts.reset_at END
    RETURNING count`, [email])
  if (Number(limit?.count) > 8) return Response.json({ error: "Too many attempts. Try again in 15 minutes." }, { status: 429 })
  const user = await first(pool, "SELECT id,password_hash FROM staff WHERE email=$1 AND active", [email])
  if (!await verifyPassword(parsed.data.password, user?.password_hash) || !user) {
    return Response.json({ error: "Email or password is incorrect." }, { status: 401 })
  }
  await pool.query("DELETE FROM login_attempts WHERE email=$1", [email])
  await createSession(user.id, request)
  return Response.json({ ok: true })
}
