import { createHash, randomBytes, scrypt, timingSafeEqual } from "node:crypto"
import { promisify } from "node:util"
import { cookies } from "next/headers"
import { first, pool } from "./db"
import type { User } from "./access"

const derive = promisify(scrypt)
const cookieName = "csolution_session"
const sessionAge = 60 * 60 * 12
const digest = (value: string) => createHash("sha256").update(value).digest("hex")

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex")
  const key = await derive(password, salt, 64) as Buffer
  return salt + ":" + key.toString("hex")
}

export async function verifyPassword(password: string, saved = "") {
  const [salt, key] = saved.split(":")
  const candidate = await derive(password, salt || "csolution-unknown-user", 64) as Buffer
  const expected = /^[a-f0-9]{128}$/.test(key ?? "") ? Buffer.from(key, "hex") : Buffer.alloc(64)
  return timingSafeEqual(candidate, expected) && Boolean(salt && key)
}

export async function getUser() {
  const jar = await cookies()
  const token = jar.get(cookieName)?.value
  if (!token) return undefined
  return first<User>(pool, `SELECT u.id,u.name,u.email,u.role, s.demo
    FROM sessions s JOIN staff u ON u.id=s.staff_id
    WHERE s.token_hash=$1 AND s.expires_at > now() AND u.active`, [digest(token)])
}

export async function createSession(id: string, request: Request, demo = false) {
  const jar = await cookies()
  const oldToken = jar.get(cookieName)?.value
  if (oldToken) await pool.query("DELETE FROM sessions WHERE token_hash=$1", [digest(oldToken)])
  const token = randomBytes(32).toString("hex")
  await pool.query("INSERT INTO sessions (token_hash,staff_id,expires_at,demo) VALUES ($1,$2,$3,$4)",
    [digest(token), id, new Date(Date.now() + sessionAge * 1000), demo])
  jar.set(cookieName, token, { httpOnly: true, sameSite: "lax", path: "/", maxAge: sessionAge,
    secure: new URL(request.url).protocol === "https:" || request.headers.get("x-forwarded-proto") === "https" })
}

export async function endSession() {
  const jar = await cookies()
  const token = jar.get(cookieName)?.value
  if (token) await pool.query("DELETE FROM sessions WHERE token_hash=$1", [digest(token)])
  jar.delete(cookieName)
}

export function sameOrigin(request: Request) {
  try {
    const origin = request.headers.get("origin")
    if (!origin) return false
    const sent = new URL(origin)
    const url = new URL(request.url)
    const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",")[0].trim()
    const proto = forwardedProto === "https" ? "https:" : url.protocol
    return sent.host === (request.headers.get("host") ?? url.host) && sent.protocol === proto
  } catch {
    return false
  }
}
