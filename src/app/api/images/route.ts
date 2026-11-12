import { randomUUID } from "node:crypto"
import { can } from "@/lib/access"
import { getUser, sameOrigin } from "@/lib/auth"
import { pool } from "@/lib/db"

export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "Invalid request origin." }, { status: 403 })
  const user = await getUser()
  if (!user || !can(user.role,"catalog")) return Response.json({ error: "Access denied." }, { status: 403 })
  const length = Number(request.headers.get("content-length"))
  if (length > 3_200_000) return Response.json({ error: "Choose an image under 3 MB." }, { status: 413 })
  const form = await request.formData().catch(() => null)
  const file = form?.get("image")
  if (!(file instanceof File) || !file.size || file.size > 3_000_000) {
    return Response.json({ error: "Choose an image under 3 MB." }, { status: 400 })
  }
  const data = Buffer.from(await file.arrayBuffer())
  const prefix = data.subarray(0, 8).toString("hex")
  const contentType = prefix.startsWith("ffd8ff") ? "image/jpeg" :
    prefix === "89504e470d0a1a0a" ? "image/png" :
      data.toString("ascii",0,4) === "RIFF" && data.toString("ascii",8,12) === "WEBP" ? "image/webp" : null
  if (!contentType) return Response.json({ error: "Use a JPEG, PNG or WebP image." }, { status: 400 })
  const id = randomUUID()
  await pool.query("INSERT INTO images (id,content_type,data) VALUES ($1,$2,$3)", [id,contentType,data])
  return Response.json({ url: "/api/images/" + id })
}
