import { z } from "zod"
import { getUser } from "@/lib/auth"
import { first, pool } from "@/lib/db"

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getUser()
  if (!user) return new Response(null,{ status: 401 })
  const id = z.uuid().safeParse((await params).id)
  if (!id.success) return new Response(null,{ status: 404 })
  const image = await first<{ content_type: string; data: Buffer }>(pool,"SELECT content_type,data FROM images WHERE id=$1",[id.data])
  if (!image) return new Response(null,{ status: 404 })
  return new Response(Uint8Array.from(image.data),{ headers: {
    "content-type": image.content_type, "x-content-type-options": "nosniff", "cache-control": "private, max-age=3600"
  } })
}
