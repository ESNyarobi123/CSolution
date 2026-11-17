// Attach product photos in bulk.
//
//   node --env-file-if-exists=.env scripts/attach-photos.mjs ./photos            # show what would change
//   node --env-file-if-exists=.env scripts/attach-photos.mjs ./photos --apply    # write to the database
//
// Name each file after the product SKU or its exact name, for example
// OMD-EAP225.jpg, TPL-C340.png or "Omada EAP225.webp". Photos are stored in the
// images table and linked through product_images, so CSbot and the dashboard
// pick them up immediately without a deploy.
import { randomUUID } from "node:crypto"
import { mkdir, readdir, readFile, stat } from "node:fs/promises"
import { basename, extname, join } from "node:path"
import pg from "pg"

const args = process.argv.slice(2)
const apply = args.includes("--apply")
const directory = args.find(arg => !arg.startsWith("--")) ?? "./photos"
const maxBytes = 3_000_000

const pool = new pg.Pool(process.env.DATABASE_URL ? { connectionString: process.env.DATABASE_URL } : {})

function contentType(data) {
  const head = data.subarray(0, 8).toString("hex")
  if (head.startsWith("ffd8ff")) return "image/jpeg"
  if (head === "89504e470d0a1a0a") return "image/png"
  if (data.toString("ascii", 0, 4) === "RIFF" && data.toString("ascii", 8, 12) === "WEBP") return "image/webp"
  return null
}

// SKUs differ only by separators, so CAT6CAB and CAB-CAT6 should still match.
const normalize = value => value.toLowerCase().replace(/[^a-z0-9]/g, "")

/** Shows the exact file names this folder should contain, so filling it is copy-paste work. */
function expected(products) {
  console.log(`\nName each file after the product SKU (JPEG, PNG or WebP, under 3 MB):`)
  for (const item of products) console.log(`  ${item.sku}.jpg   -> ${item.name}`)
  console.log(`\nThen run: npm run photos ${directory} -- --apply`)
}

async function main() {
  let files = []
  try {
    files = (await readdir(directory, { withFileTypes: true }))
      .filter(entry => entry.isFile() && [".jpg", ".jpeg", ".png", ".webp"].includes(extname(entry.name).toLowerCase()))
  } catch (error) {
    if (error.code !== "ENOENT") throw error
    // A missing folder is the normal first run, not an error worth a stack trace.
    await mkdir(directory, { recursive: true })
    console.log(`Created ${directory}. Put product photos in it, then run this command again.`)
  }

  const { rows: products } = await pool.query(
    "SELECT id,sku,name FROM products WHERE active ORDER BY name")
  if (!files.length) {
    console.log(`\nNo JPEG, PNG or WebP files found in ${directory} yet.`)
    expected(products)
    return
  }

  const bySku = new Map(products.map(item => [normalize(item.sku), item]))
  const byName = new Map(products.map(item => [normalize(item.name), item]))

  let linked = 0
  let skipped = 0
  for (const file of files) {
    const path = join(directory, file.name)
    const key = normalize(basename(file.name, extname(file.name)))
    const product = bySku.get(key) ?? byName.get(key)
    if (!product) {
      console.log(`skip  ${file.name}: no active product matches this name or SKU`)
      skipped += 1
      continue
    }
    const info = await stat(path)
    if (info.size > maxBytes) {
      console.log(`skip  ${file.name}: ${Math.round(info.size / 1024)} KB is larger than 3 MB`)
      skipped += 1
      continue
    }
    const data = await readFile(path)
    const mime = contentType(data)
    if (!mime) {
      console.log(`skip  ${file.name}: not a JPEG, PNG or WebP image`)
      skipped += 1
      continue
    }

    if (!apply) {
      console.log(`would attach ${file.name} (${mime}, ${Math.round(info.size / 1024)} KB) to ${product.name} [${product.sku}]`)
      linked += 1
      continue
    }

    const id = randomUUID()
    const client = await pool.connect()
    try {
      await client.query("BEGIN")
      await client.query("INSERT INTO images (id,content_type,data) VALUES ($1,$2,$3)", [id, mime, data])
      const url = "/api/images/" + id
      // The first photo is the cover. Extra photos join the gallery after it.
      const { rows: existing } = await client.query(
        "SELECT count(*)::int AS total, coalesce(max(position),-1)::int AS last FROM product_images WHERE product_id=$1",
        [product.id])
      const next = existing[0].total ? existing[0].last + 1 : 0
      await client.query(
        "INSERT INTO product_images (product_id,url,position) VALUES ($1,$2,$3)", [product.id, url, next])
      if (!existing[0].total) {
        await client.query(
          "UPDATE products SET image_url=$2 WHERE id=$1 AND (image_url IS NULL OR image_url='')", [product.id, url])
      }
      await client.query("COMMIT")
      console.log(`ok    ${file.name} -> ${product.name} [${product.sku}]`)
      linked += 1
    } catch (error) {
      await client.query("ROLLBACK")
      console.log(`fail  ${file.name}: ${error.message}`)
      skipped += 1
    } finally {
      client.release()
    }
  }

  console.log(`\n${apply ? "Attached" : "Would attach"} ${linked} photo(s), ${skipped} skipped.`)
  if (!apply && linked) console.log("Re-run with --apply to save these changes.")
}

try {
  await main()
} finally {
  await pool.end()
}
