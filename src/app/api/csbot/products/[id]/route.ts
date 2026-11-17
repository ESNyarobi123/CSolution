import { catalogGuard, getCsbotProduct, noStore, uuidPattern } from "@/lib/csbot-catalog"

export const dynamic = "force-dynamic"

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = catalogGuard(request)
  if (denied) return denied
  const id = (await params).id
  if (!uuidPattern.test(id)) {
    return Response.json({ error: "Invalid product id." }, { status: 400, headers: noStore })
  }
  const product = await getCsbotProduct(id)
  if (!product) {
    return Response.json({ error: "Product not found or no longer active." }, { status: 404, headers: noStore })
  }
  return Response.json(product, { headers: noStore })
}
