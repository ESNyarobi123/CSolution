import { catalogGuard, countCsbotProducts, noStore } from "@/lib/csbot-catalog"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const denied = catalogGuard(request)
  if (denied) return denied
  const counts = await countCsbotProducts()
  return Response.json({
    service: "csolution-catalog",
    status: "ok",
    products: counts.total,
    images: counts.images,
    generated_at: new Date().toISOString()
  }, { headers: noStore })
}
