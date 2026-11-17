import { catalogGuard, listCsbotProducts, noStore } from "@/lib/csbot-catalog"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const denied = catalogGuard(request)
  if (denied) return denied
  const search = new URL(request.url).searchParams
  const query = (search.get("search") ?? "").trim().slice(0, 120)
  const raw = Number(search.get("limit") ?? 60)
  const limit = Number.isFinite(raw) ? Math.min(100, Math.max(1, Math.trunc(raw))) : 60
  const { items, currency } = await listCsbotProducts(query, limit)
  return Response.json({
    items, currency, search: query,
    generated_at: new Date().toISOString()
  }, { headers: noStore })
}
