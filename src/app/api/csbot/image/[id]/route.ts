import { catalogGuard, catalogImage, uuidPattern } from "@/lib/csbot-catalog"

export const dynamic = "force-dynamic"

const allowed = new Set(["image/png", "image/jpeg", "image/webp"])

/** Product photos are served only to CSbot, so the shop's login stays private. */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = catalogGuard(request)
  if (denied) return denied
  const id = (await params).id
  if (!uuidPattern.test(id)) return new Response(null, { status: 404 })
  const image = await catalogImage(id)
  if (!image || !allowed.has(image.content_type)) return new Response(null, { status: 404 })
  return new Response(Uint8Array.from(image.data), {
    headers: {
      "content-type": image.content_type,
      "content-length": String(image.data.length),
      "cache-control": "private, max-age=3600",
      "x-content-type-options": "nosniff"
    }
  })
}
