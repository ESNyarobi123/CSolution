import { createHash, timingSafeEqual } from "node:crypto"
import { first, pool, rows } from "./db"

/**
 * Read-only catalog contract for CSbot. The dashboard and the reply worker both
 * read from here, so a price change in CSolution reaches WhatsApp without a deploy.
 */
export type CsbotProduct = {
  id: string
  name: string
  sku: string
  brand: string | null
  category: string | null
  type: "Stocked" | "Non-stock" | "Service"
  unit: string
  description: string
  price: { amount: number; currency: string }
  agent_price: number | null
  warranty: number
  available_to_sell: number
  available: boolean
  in_stock: boolean
  created_at: string
  images: { url: string; primary?: boolean }[]
}

const digest = (value: string) => createHash("sha256").update(value).digest()

export function catalogTokenConfigured() {
  return (process.env.CSBOT_CATALOG_TOKEN ?? "").trim().length >= 24
}

/** Constant-time bearer check so the catalog can never be read with a guessed token. */
export function catalogAuthorized(request: Request) {
  const expected = (process.env.CSBOT_CATALOG_TOKEN ?? "").trim()
  if (expected.length < 24) return false
  const header = request.headers.get("authorization") ?? ""
  const provided = header.startsWith("Bearer ") ? header.slice(7).trim() : ""
  if (!provided) return false
  return timingSafeEqual(digest(provided), digest(expected))
}

export const unauthorized = () => Response.json(
  { error: "Send the CSbot catalog token in the Authorization header." }, { status: 401 }
)

export const notConfigured = () => Response.json(
  { error: "CSBOT_CATALOG_TOKEN is not configured on CSolution." }, { status: 503 }
)

export const noStore = { "cache-control": "no-store", "x-content-type-options": "nosniff" }

export function catalogGuard(request: Request) {
  if (!catalogTokenConfigured()) return notConfigured()
  if (!catalogAuthorized(request)) return unauthorized()
  return undefined
}

/** Stored uploads are proxied through this API; external photos must already be HTTPS. */
function imageUrl(value: string | null) {
  if (!value) return undefined
  const stored = /^\/api\/images\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i.exec(value)
  if (stored) return "/api/csbot/image/" + stored[1].toLowerCase()
  return /^https:\/\//i.test(value) ? value : undefined
}

const productColumns = `p.id,p.name,p.sku,p.type,p.unit,p.description,p.price,p.agent_price,
  p.warranty,p.on_hand,p.created_at,b.name AS brand,c.name AS category,
  (SELECT i.url FROM product_images i WHERE i.product_id=p.id ORDER BY i.position,i.created_at LIMIT 1) AS cover_url`

type ProductRow = {
  id: string; name: string; sku: string; type: CsbotProduct["type"]; unit: string
  description: string; price: number; agent_price: number | null; warranty: number
  on_hand: number; created_at: Date; brand: string | null; category: string | null
  cover_url: string | null
}

const shape = (row: ProductRow, currency: string, images?: string[]): CsbotProduct => {
  const list = (images ?? (row.cover_url ? [row.cover_url] : []))
    .map(imageUrl).filter((value): value is string => Boolean(value))
  return {
    id: row.id,
    name: row.name,
    sku: row.sku,
    brand: row.brand,
    category: row.category,
    type: row.type,
    unit: row.unit,
    description: row.description,
    price: { amount: Number(row.price), currency },
    agent_price: row.agent_price === null ? null : Number(row.agent_price),
    warranty: row.warranty,
    available_to_sell: row.type === "Service" ? 0 : row.on_hand,
    // Services are made to order; stocked items need units on the shelf.
    available: row.type === "Service" || row.on_hand > 0,
    in_stock: row.type === "Service" || row.on_hand > 0,
    created_at: new Date(row.created_at).toISOString(),
    images: list.map((url, index) => ({ url, primary: index === 0 })),
  }
}

async function shopCurrency() {
  return (await first<{ currency: string }>(pool,"SELECT currency FROM business WHERE id=1"))?.currency ?? "TZS"
}

export async function listCsbotProducts(search: string, limit: number) {
  const tokens = search.toLowerCase().match(/[\p{L}\p{N}]+/gu)?.slice(0, 12) ?? []
  const [currency, result] = await Promise.all([
    shopCurrency(),
    rows<ProductRow>(pool,`SELECT ${productColumns}
      FROM products p
      LEFT JOIN brands b ON b.id=p.brand_id
      LEFT JOIN categories c ON c.id=p.category_id
      WHERE p.active AND ($2::text[] = '{}'::text[] OR NOT EXISTS (
        SELECT 1 FROM unnest($2::text[]) AS term
        WHERE strpos(lower(concat_ws(' ',p.name,p.sku,coalesce(b.name,''),coalesce(c.name,''),p.description)),term)=0
      ))
      ORDER BY (lower(p.sku)=lower($1)) DESC,(lower(p.name)=lower($1)) DESC,
        (p.type='Service'),(p.on_hand=0),p.name,p.id
      LIMIT $3`, [search, tokens, limit])
  ])
  return { items: result.map(row => shape(row, currency)), currency }
}

export async function getCsbotProduct(id: string) {
  const [currency, product] = await Promise.all([
    shopCurrency(),
    first<ProductRow>(pool,`SELECT ${productColumns}
      FROM products p
      LEFT JOIN brands b ON b.id=p.brand_id
      LEFT JOIN categories c ON c.id=p.category_id
      WHERE p.id=$1 AND p.active`, [id])
  ])
  if (!product) return undefined
  const photos = await rows<{ url: string }>(pool,
    "SELECT url FROM product_images WHERE product_id=$1 ORDER BY position,created_at", [id])
  const images = photos.map(photo => photo.url).filter(Boolean)
  if (!images.length) images.push(...(product.cover_url ? [product.cover_url] : []))
  return shape(product, currency, images)
}

export async function countCsbotProducts() {
  const item = await first<{ total: number; images: number }>(pool,
    // Only photos linked to a live product matter; orphan uploads are ignored.
    `SELECT (SELECT count(*) FROM products WHERE active)::int AS total,
      (SELECT count(DISTINCT pi.url) FROM product_images pi
        JOIN products p ON p.id=pi.product_id WHERE p.active)::int AS images`)
  return item ?? { total: 0, images: 0 }
}

export async function catalogImage(id: string) {
  return first<{ content_type: string; data: Buffer }>(pool,
    `SELECT i.content_type,i.data FROM images i
      WHERE i.id=$1 AND octet_length(i.data) <= 5242880
        AND i.content_type IN ('image/png','image/jpeg','image/webp')
        AND EXISTS (
          SELECT 1 FROM product_images pi JOIN products p ON p.id=pi.product_id
          WHERE p.active AND pi.url='/api/images/'||i.id::text)`,
    [id])
}

export const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
