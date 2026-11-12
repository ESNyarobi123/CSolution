"use client"

import { useState } from "react"
import { Box, Layers3, Plus, Search, ShoppingCart, X } from "lucide-react"
import { money, num } from "@/lib/format"
import type { Product } from "@/lib/model"
import { Empty, ProductPhoto, Select } from "./ui"

export function SaleCatalog({ products, quantities, price, add, lineCount, viewCart }: {
  products: Product[]
  quantities: Map<string,number>
  price: (product: Product) => number
  add: (product: Product) => void
  lineCount: number
  viewCart: () => void
}) {
  const [query,setQuery] = useState("")
  const [category,setCategory] = useState("")
  const [brand,setBrand] = useState("")
  const [groupBy,setGroupBy] = useState<"category"|"brand">("category")
  const [limit,setLimit] = useState(36)
  const search = query.trim().toLowerCase().split(/\s+/).filter(Boolean)
  const categories = [...new Set(products.flatMap(product=>product.category ? [product.category] : []))].sort()
  const brands = [...new Set(products.flatMap(product=>product.brand ? [product.brand] : []))].sort()
  const matches = products.filter(product=>{
    if ((category && product.category!==category) || (brand && product.brand!==brand)) return false
    const words = [product.name,product.sku,product.category,product.brand].join(" ").toLowerCase()
    return search.every(term=>words.includes(term))
  })
  const available = (product: Product) => Math.max(0,product.on_hand-(quantities.get(product.id) ?? 0))
  const canAdd = (product: Product) => product.type!=="Stocked" || available(product)>0
  const sorted = [...matches].sort((a,b)=>(a[groupBy] ?? "").localeCompare(b[groupBy] ?? "") || a.name.localeCompare(b.name))
  const groups = new Map<string,Product[]>()
  for (const product of sorted.slice(0,limit)) {
    const name = product[groupBy] ?? (groupBy==="category" ? "Uncategorized" : "No brand")
    const group = groups.get(name)
    if (group) group.push(product)
    else groups.set(name,[product])
  }
  function clear() { setQuery("");setCategory("");setBrand("");setLimit(36) }
  return <section className="sale-catalog" aria-label="Product catalog">
    <div className="checkout-section-title">
      <span className="metric-icon blue"><Layers3 size={19} /></span>
      <div><h3>Product catalog</h3><small>{num(matches.length)} {matches.length===1 ? "match" : "matches"}</small></div>
      <button type="button" className="button secondary small sale-cart-jump" onClick={viewCart}><ShoppingCart size={16} /> Cart ({lineCount})</button>
    </div>
    <label className="search-box sale-product-search"><Search size={17} />
      <input type="search" data-checkout-focus aria-label="Search products" placeholder="Search name, SKU, category or brand" value={query}
        onChange={event=>{setQuery(event.target.value);setLimit(36)}} onKeyDown={event=>{
          if (event.key!=="Enter") return
          event.preventDefault()
          if (search.length && matches.length===1 && canAdd(matches[0])) add(matches[0])
        }} />
    </label>
    <div className="sale-catalog-filters">
      <Select aria-label="Product category" value={category} onChange={event=>{setCategory(event.target.value);setLimit(36)}}>
        <option value="">All categories</option>{categories.map(item=><option key={item}>{item}</option>)}
      </Select>
      <Select aria-label="Product brand" value={brand} onChange={event=>{setBrand(event.target.value);setLimit(36)}}>
        <option value="">All brands</option>{brands.map(item=><option key={item}>{item}</option>)}
      </Select>
      <Select aria-label="Group products by" value={groupBy} onChange={event=>{setGroupBy(event.target.value==="brand"?"brand":"category");setLimit(36)}}>
        <option value="category">Group by category</option><option value="brand">Group by brand</option>
      </Select>
    </div>
    <div className="sale-catalog-list" aria-label="Matching products">
      {!matches.length && <div className="sale-no-products"><Empty title="No products match" icon={Search} description="Try another search or clear the catalog filters." />
        <button type="button" className="button secondary small" onClick={clear}><X size={14} /> Clear filters</button></div>}
      {[...groups].map(([name,items])=><section className="sale-catalog-group" key={name}>
        <h4>{name}</h4>
        <div className="sale-product-grid">{items.map(product=>{
          const remaining = available(product)
          const stocked = product.type==="Stocked"
          return <div className="sale-product-card" key={product.id}>
            <div className="sale-product-main"><ProductPhoto product={product} />
              <div><strong>{product.name}</strong><small>{product.sku}</small></div>
            </div>
            <div className="sale-product-foot">
              <div><strong>{money(price(product))}</strong><small className={stocked && remaining===0 ? "sale-out-of-stock" : ""}>
                {stocked ? remaining>0 ? num(remaining)+" "+product.unit+" available" : product.on_hand===0 ? "Out of stock" : "All stock in cart" : product.type}
              </small></div>
              <button type="button" className="sale-product-add" disabled={!canAdd(product)} aria-label={"Add "+product.name+" ("+product.sku+")"} onClick={()=>add(product)}><Plus size={18} /></button>
            </div>
          </div>
        })}</div>
      </section>)}
      {sorted.length>limit && <button type="button" className="button secondary" onClick={()=>setLimit(limit+36)}><Box size={16} /> Show more products</button>}
    </div>
  </section>
}
