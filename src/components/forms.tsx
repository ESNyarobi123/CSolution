"use client"

import { useEffect, useRef, useState } from "react"
import { Box, CircleDollarSign, CopyPlus, CreditCard, FileText, ImagePlus, Minus, PackageOpen, Plus, ShoppingCart, Trash2, UploadCloud, Wallet } from "lucide-react"
import { can, roles } from "@/lib/access"
import { money, num, requestJSON } from "@/lib/format"
import { customerTypes, expenseCategories, jobStatuses, methods, productTypes, type BuyerType, type Customer, type Expense, type Group, type Job, type JobDetail, type Line, type Person, type Product, type Purchase, type Quote, type Sale, type SaleDetail, type Snapshot, type Staff } from "@/lib/model"
import { ErrorLine, Field, Form, numberVal as n, opt, ProductPhoto, Select, val as v } from "./ui"
import { CheckoutBuyer, buyerNameKey, isBuyerAccount } from "./checkout-buyer"
import { SaleCatalog } from "./sale-catalog"

export type Save = (data: object, message?: string) => Promise<{ id?: string; number?: string; refund?: number }>
type FormProps = { data: Snapshot; close: () => void; save: Save }
type SimpleProps = Pick<FormProps,"close"|"save">
const blank = <option value="">Select…</option>

function PeopleOptions({ people }: { people: { id: string; name: string }[] }) {
  return <>{people.map(person => <option key={person.id} value={person.id}>{person.name}</option>)}</>
}
function ContactFields({ record, company = false }: { record?: Partial<Person>; company?: boolean }) {
  return <>
    <Field label={company ? "Business name" : "Name"}><input name="name" defaultValue={record?.name} maxLength={160} required /></Field>
    <Field label="Phone"><input name="phone" type="tel" defaultValue={record?.phone} maxLength={40} /></Field>
    <Field label="Email"><input name="email" type="email" defaultValue={record?.email} /></Field>
    <Field label="Address"><input name="address" defaultValue={record?.address} maxLength={2000} /></Field>
  </>
}

export function GroupForm({ kind, record, close, save }: SimpleProps & { kind: "categories"|"brands"; record?: Group }) {
  return <Form close={close} onSave={f=>save({action:"group",kind,id:record?.id,name:v(f,"name"),description:v(f,"description")})}>
    <Field label="Name"><input name="name" defaultValue={record?.name} maxLength={160} required autoFocus /></Field>
    <Field label="Description"><textarea name="description" defaultValue={record?.description} rows={3} /></Field>
  </Form>
}

export function ProductForm({ data, record, opening = false, close, save }: FormProps & { record?: Product; opening?: boolean }) {
  const [type,setType] = useState(record?.type ?? "Stocked")
  const [unit,setUnit] = useState(record?.unit ?? "pcs")
  const [cost,setCost] = useState<number | null>(record?.cost ?? null)
  const [price,setPrice] = useState<number | null>(record?.price ?? null)
  const [stock,setStock] = useState<number | null>(opening ? null : 0)
  const [image,setImage] = useState(record?.image_url ?? "")
  const [file,setFile] = useState<File | null>(null)
  const [preview,setPreview] = useState("")
  const [badPreview,setBadPreview] = useState("")
  const uploaded = useRef<{ file: File; url: string }>(null)
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview) }, [preview])
  function updateFile(next: File | null) {
    setFile(next)
    setPreview(next ? URL.createObjectURL(next) : "")
  }
  async function submit(form: FormData) {
    let imageUrl = image.trim() || null
    if (file) {
      if (uploaded.current?.file === file) imageUrl = uploaded.current.url
      else {
        const upload = new FormData()
        upload.append("image",file)
        const result = await requestJSON<{ url: string }>("/api/images",{ method:"POST",body:upload })
        uploaded.current = { file,url:result.url }
        imageUrl = result.url
      }
    }
    await save({ action:"product",id:record?.id,name:v(form,"name"),sku:v(form,"sku"),type,unit:v(form,"unit"),
      categoryId:opt(form,"categoryId"),brandId:opt(form,"brandId"),description:v(form,"description"),
      price:n(form,"price"),cost:n(form,"cost"),agentPrice:opt(form,"agentPrice") === null ? null : n(form,"agentPrice"),
      initialStock:n(form,"stock"),reorder:n(form,"reorder"),warranty:n(form,"warranty"),imageUrl,active:v(form,"active") !== "false" })
  }
  const visual = preview || image
  const grossPerUnit = cost !== null && price !== null ? price - cost : null
  const stocked = type === "Stocked"
  const quantity = record ? record.on_hand : stock
  const stockValue = stocked && quantity !== null && cost !== null ? quantity * cost : null
  return <Form onSave={submit} close={close} label={record ? "Save product" : opening ? "Register stock" : "Add product"}>
    <div className="image-fields">
      <div className="image-preview">{visual && badPreview !== visual ? <img src={visual} alt="Product preview" referrerPolicy="no-referrer" onError={()=>setBadPreview(visual)} /> : <ImagePlus size={28} />}</div>
      <div>
        <Field label="Product photo URL"><input value={image} placeholder="https://…" onChange={e=>{ setImage(e.target.value); if(file) updateFile(null) }} /></Field>
        <div className="file-row"><label className="button secondary small file-label"><UploadCloud size={16} />{file ? file.name : "Upload photo"}<input type="file" accept="image/jpeg,image/png,image/webp" onChange={e=>updateFile(e.target.files?.[0] ?? null)} /></label>
          {(file || image) && <button type="button" className="text-button" onClick={()=>{ setImage("");updateFile(null) }}>Remove</button>}</div>
      </div>
    </div>
    <div className="form-grid">
      <Field label="Product name"><input name="name" defaultValue={record?.name} required maxLength={160} /></Field>
      <Field label="SKU" hint="Unique code for this product."><input name="sku" defaultValue={record?.sku} required maxLength={60} /></Field>
      <Field label="Category"><Select name="categoryId" defaultValue={record?.category_id ?? ""}><option value="">Uncategorized</option><PeopleOptions people={data.categories} /></Select></Field>
      <Field label="Brand"><Select name="brandId" defaultValue={record?.brand_id ?? ""}><option value="">No brand</option><PeopleOptions people={data.brands} /></Select></Field>
      {!opening && <Field label="Item type"><Select value={type} onChange={e=>setType(e.target.value as Product["type"])}>{productTypes.map(t=><option key={t}>{t}</option>)}</Select></Field>}
      <Field label="Unit of measure" hint="For example, pcs, m, roll or box."><input name="unit" value={unit} onChange={e=>setUnit(e.target.value)} required maxLength={15} /></Field>
      {stocked && !record && <Field label="Opening quantity" hint="Count the units physically in your shop."><input name="stock" type="number" min={opening ? "1" : "0"} max="100000" value={stock ?? ""} onChange={e=>setStock(e.target.value === "" ? null : e.target.valueAsNumber)} required={opening} /></Field>}
      <Field label="Cost per unit (TZS)" hint={record?.type === "Stocked" && record.on_hand > 0 ? "Updated when stock is received." : "What the shop paid per unit."}><input name="cost" type="number" min="0" max="9999999999" value={cost ?? ""} onChange={e=>setCost(e.target.value === "" ? null : e.target.valueAsNumber)} required readOnly={record?.type === "Stocked" && record.on_hand > 0} /></Field>
      <Field label="Selling price per unit (TZS)"><input name="price" type="number" min="0" max="9999999999" value={price ?? ""} onChange={e=>setPrice(e.target.value === "" ? null : e.target.valueAsNumber)} required /></Field>
    </div>
    <div className="detail-summary product-calculation">
      {stocked && <div><small><PackageOpen size={14} /> {record ? "Stock value" : "Opening stock value"}</small><strong>{stockValue === null ? "—" : money(stockValue)}</strong></div>}
      <div><small><CircleDollarSign size={14} /> {grossPerUnit !== null && grossPerUnit < 0 ? "Gross loss per unit" : "Gross profit per unit"}</small><strong className={grossPerUnit !== null && grossPerUnit < 0 ? "amount-loss" : ""}>{grossPerUnit === null ? "—" : money(grossPerUnit)}</strong></div>
    </div>
    <div className="form-grid">
      <Field label="Agent price per unit (TZS)"><input name="agentPrice" type="number" min="0" max="9999999999" defaultValue={record?.agent_price ?? ""} placeholder="Optional" /></Field>
      <Field label="Warranty (months)"><input name="warranty" type="number" min="0" max="120" defaultValue={record?.warranty ?? 0} /></Field>
      {stocked && <Field label="Low-stock threshold"><input name="reorder" type="number" min="0" max="100000" defaultValue={record?.reorder ?? 0} /></Field>}
      {record && <Field label="Status"><Select name="active" defaultValue={String(record.active)}><option value="true">Active</option><option value="false">Archived</option></Select></Field>}
    </div>
    <Field label="Description"><textarea name="description" defaultValue={record?.description} rows={2} /></Field>
  </Form>
}

export function ContactForm({ kind, record, close, save, allowAgentCode = true }: SimpleProps & { kind: "customer"|"supplier"; record?: Person|Customer; allowAgentCode?: boolean }) {
  const customer = record && "kind" in record ? record : undefined
  const [type,setType] = useState(customer?.kind ?? "Retail")
  return <Form close={close} onSave={f=>save({ action:kind,id:record?.id,name:v(f,"name"),phone:v(f,"phone"),email:v(f,"email"),address:v(f,"address"),kind:type,code:v(f,"code") })}>
    <div className="form-grid"><ContactFields record={record} />
      {kind==="customer" && <Field label="Customer type"><Select value={type} onChange={e=>setType(e.target.value as Customer["kind"])}>{customerTypes.map(t=><option key={t}>{t}</option>)}</Select></Field>}
      {kind==="customer" && type==="Agent" && allowAgentCode && <Field label="Agent code"><input name="code" defaultValue={customer?.code ?? ""} maxLength={60} /></Field>}
    </div>
  </Form>
}

function ProductPicker({ products, add }: { products: Product[]; add: (product: Product) => void }) {
  const [selected,setSelected] = useState("")
  const current = products.find(p=>p.id===selected)
  return <div className="product-picker">
    <Select aria-label="Choose product" value={selected} onChange={e=>setSelected(e.target.value)}>
      <option value="">Choose a product or service</option>
      {products.map(p=><option key={p.id} value={p.id}>{p.name} · {p.sku}{p.type==="Stocked" ? " · "+p.on_hand+" "+p.unit : ""}</option>)}
    </Select>
    <button type="button" className="button secondary" disabled={!current} onClick={()=>{ if(current) add(current); setSelected("") }}><Plus size={17} /> Add item</button>
  </div>
}

export function CartForm({ data, mode, quote, close, save }: FormProps & { mode: "sale"|"quote"; quote?: Quote }) {
  const productMap = new Map(data.products.map(p=>[p.id,p]))
  const [customerId,setCustomer] = useState(quote?.customer_id ?? "")
  const [buyerType,setBuyerType] = useState<BuyerType>(quote?.buyer_type ?? "Walk-in")
  const [buyerName,setBuyerName] = useState(quote?.customer_id ? quote.customer_name : "")
  const [lines,setLines] = useState<(Line & { key: string; name: string })[]>(()=>quote?.lines.map((line,i)=>({...line,key:String(i)})) ?? [])
  const [discount,setDiscount] = useState(quote?.discount ?? 0)
  const [tax,setTax] = useState(quote?.tax ?? 0)
  const [payment,setPayment] = useState("full")
  const [received,setReceived] = useState<number | null>(null)
  const [installation,setInstallation] = useState(false)
  const requestId = useRef("")
  const sequence = useRef(lines.length)
  const cartHeading = useRef<HTMLHeadingElement>(null)
  const isSale = mode === "sale"
  const converting = isSale && Boolean(quote)
  const editPrice = can(data.user.role,"pricing") && !converting
  const requestApprovals = can(data.user.role,"requestApprovals")
  const requestJobs = can(data.user.role,"requestJobs")
  const scheduleJobs = can(data.user.role,"scheduleJobs")
  const canAddInstallation = requestJobs || scheduleJobs
  const buyer = data.customers.find(c=>c.id===customerId)
  const lookupPrice = (product?: Product) => product ? (buyerType==="Agent" ? product.agent_price ?? product.price : product.price) : 0
  const priceForLine = (line: Line) => line.price ?? lookupPrice(productMap.get(line.productId))
  const subtotal = lines.reduce((sum,line)=>sum+line.quantity*priceForLine(line),0)
  const total = subtotal - discount + tax
  const paid = payment==="full" ? total : payment==="partial" ? received ?? 0 : 0
  const needsApproval = isSale && requestApprovals && (discount>0 || paid<total)
  const update = (key: string, patch: Partial<Line>)=>setLines(current=>current.map(line=>line.key===key ? {...line,...patch} : line))
  const products = data.products.filter(product=>product.active)
  const quantities = new Map<string,number>()
  for (const line of lines) quantities.set(line.productId,(quantities.get(line.productId) ?? 0) + line.quantity)
  let stockError = ""
  if (isSale) {
    for (const [productId, quantity] of quantities) {
      const product = productMap.get(productId)
      if (!product?.active) {
        stockError = "A selected product is no longer available."
        break
      }
      if (product.type === "Stocked" && quantity > product.on_hand) {
        stockError = `${product.name} has only ${num(product.on_hand)} ${product.unit} available.`
        break
      }
    }
  }
  const discountError = discount > subtotal ? "Discount cannot exceed the subtotal." : ""
  const namedBuyer = buyerType!=="Walk-in"
  const enteredName = buyerName.trim()
  const nameKey = buyerNameKey(enteredName)
  const matchingAccounts = namedBuyer && !customerId && nameKey ? data.customers.filter(customer=>
    isBuyerAccount(buyerType,customer) && buyerNameKey(customer.name)===nameKey) : []
  const ambiguousName = matchingAccounts.length>1
  const matchedBuyer = ambiguousName ? undefined : matchingAccounts[0]
  const resolvedCustomerId = customerId || matchedBuyer?.id || null
  const newBuyer = namedBuyer && !resolvedCustomerId && enteredName && !ambiguousName ? { name:enteredName } : undefined
  const customerError = ambiguousName ? "More than one account has this name. Choose an existing account to continue." :
    namedBuyer && !resolvedCustomerId && !newBuyer ? "Enter the buyer’s name." :
    isSale && lines.length>0 && payment!=="full" && !namedBuyer ? "Choose a customer or agent for an unpaid balance." : ""
  function addProduct(product: Product, separate = false) {
    const key = String(++sequence.current)
    setLines(current=>{
      const inCart = current.reduce((sum,line)=>line.productId===product.id ? sum+line.quantity : sum,0)
      if (isSale && product.type==="Stocked" && inCart>=product.on_hand) return current
      const matching = !separate ? current.find(line=>line.productId===product.id && line.price===undefined && !line.serial && line.quantity<100000) : undefined
      if (matching) return current.map(line=>line===matching ? {...line,quantity:line.quantity+1} : line)
      if (current.length>=100) return current
      return [...current,{key,name:product.name,productId:product.id,quantity:1}]
    })
  }

  async function submit(form: FormData) {
    if (!lines.length) throw new Error("Add at least one item.")
    if (stockError || discountError || customerError) throw new Error(stockError || discountError || customerError)
    const payload = {
      customerId:resolvedCustomerId, buyerType, newBuyer, discount, tax, expectedTotal:total,
      lines:lines.map(({key:_key,name:_name,...line})=>!converting ? {...line,expectedUnitPrice:priceForLine(line)} : line)
    }
    requestId.current ||= crypto.randomUUID()
    if (!isSale) {
      await save({ action:"quote",...payload,id:quote?.id,requestId:quote ? undefined : requestId.current,quoteVersion:quote?.version,validUntil:opt(form,"validUntil") },quote ? "Quotation updated" : "Quotation created")
      return
    }
    if (payment==="partial" && (paid<=0 || paid>=total)) throw new Error("Enter a partial payment below the sale total.")
    const sale = {
      action:"sale",...payload,requestId:requestId.current,quoteId:quote?.id,quoteVersion:quote?.version,paid,
      method:v(form,"method") || "Cash",reference:v(form,"reference"),dueDate:opt(form,"dueDate"),
      installation:canAddInstallation && installation ? { title:v(form,"title"),location:v(form,"location"),technicianId:opt(form,"technicianId"),scheduled:opt(form,"scheduled") } : undefined
    }
    if (needsApproval) {
      await save({action:"requestSaleApproval",sale,reason:v(form,"approvalReason")},"Approval requested")
    } else {
      await save(sale,"Sale completed")
    }
  }
  const customerField = converting ? <p className="checkout-hint">{buyerType} · {quote?.customer_name}</p> :
    <CheckoutBuyer type={buyerType} name={buyerName} account={buyer ?? matchedBuyer} ambiguousName={ambiguousName} customers={data.customers}
      onType={type=>{setBuyerType(type);setCustomer("");setBuyerName("")}}
      onName={name=>{setBuyerName(name);setCustomer("")}}
      onSelect={customer=>{setBuyerName(customer.name);setCustomer(customer.id)}} />
  const adjustments = <div className="form-grid">
    {(editPrice || (isSale && requestApprovals && !converting)) && <Field label="Discount (TZS)"><input type="number" min="0" max="9999999999" value={discount}
      onChange={event=>setDiscount(event.target.valueAsNumber || 0)} /></Field>}
    {!requestApprovals && <Field label="Tax (TZS)"><input type="number" min="0" max="9999999999" value={tax} readOnly={converting}
      onChange={event=>setTax(event.target.valueAsNumber || 0)} /></Field>}
  </div>
  const cartItems = <div className="sale-cart-items">
    {!lines.length && <div className="cart-empty"><ShoppingCart size={19} /> Add products or services to this {isSale ? "sale" : "quotation"}.</div>}
    {lines.map(line=>{
      const product = productMap.get(line.productId)
      const price = priceForLine(line)
      const stocked = product?.type==="Stocked"
      const canAddUnit = !isSale || !stocked || (quantities.get(line.productId) ?? 0)<product.on_hand
      const quantityLabel = "Quantity for "+line.name
      const canEditQuantity = !converting && !line.serial
      return <div className="sale-cart-line" key={line.key}>
        <div className="cart-name">
          <div className="sale-line-identity">
            {product && <ProductPhoto product={product} />}
            <div><strong>{line.name}</strong><small>{[product?.sku,stocked && isSale ? num(product.on_hand)+" "+product.unit+" in stock" : ""].filter(Boolean).join(" · ")}</small></div>
          </div>
          {isSale && !converting && stocked && line.quantity===1 && <input aria-label={"Serial number for "+line.name} placeholder="Serial (optional)"
            value={line.serial ?? ""} maxLength={100} onChange={event=>update(line.key,{serial:event.target.value})} />}
        </div>
        <div className="sale-line-quantity">
          <span className="sale-line-label">{"Qty ("+(product?.unit ?? "unit")+")"}</span>
          <div className="quantity-stepper">
            {!converting && <button type="button" disabled={!canEditQuantity || line.quantity<=1}
              aria-label={"Decrease "+line.name+" quantity"} onClick={()=>update(line.key,{quantity:line.quantity-1})}><Minus size={14} /></button>}
            <input aria-label={quantityLabel} type="number" min="1" max="100000" required value={line.quantity || ""} readOnly={!canEditQuantity}
              onChange={event=>update(line.key,{quantity:event.target.valueAsNumber || 0})} />
            {!converting && <button type="button" disabled={!canEditQuantity || !canAddUnit || line.quantity>=100000}
              aria-label={"Increase "+line.name+" quantity"} onClick={()=>update(line.key,{quantity:line.quantity+1})}><Plus size={14} /></button>}
          </div>
        </div>
        <Field label="Unit price (TZS)"><input aria-label={"Unit price for "+line.name} type="number" min="0" max="9999999999" required value={price}
          readOnly={!editPrice} onChange={event=>update(line.key,{price:event.target.valueAsNumber || 0})} /></Field>
        <strong className="line-total">{money(line.quantity*price)}</strong>
        {!converting && <div className="sale-line-actions">
          {product && <button className="icon-btn" type="button" disabled={!canAddUnit || lines.length>=100}
            aria-label={"Add a separate line for "+line.name} title="Add a separate line for another price or serial number"
            onClick={()=>addProduct(product,true)}><CopyPlus size={15} /></button>}
          <button className="icon-btn" aria-label={"Remove "+line.name} type="button"
            onClick={()=>setLines(current=>current.filter(item=>item.key!==line.key))}><Trash2 size={16} /></button>
        </div>}
      </div>
    })}
  </div>

  const submitLabel = needsApproval ? "Request approval" : isSale ? "Complete sale" : quote ? "Save quotation" : "Create quotation"
  return <Form close={close} onSave={submit} label={submitLabel} busyLabel={isSale ? "Recording sale…" : "Saving quotation…"}
    submitDisabled={!lines.length || Boolean(stockError || discountError || customerError)}
    footerSummary={<><small>{isSale ? "Sale total" : "Quotation total"}</small><strong>{money(total)}</strong>
      {isSale && payment!=="full"&&<span>Balance {money(Math.max(0,total-paid))}</span>}</>}>
    <div className="checkout-layout">
      {converting ? <section className="sale-quote-source">
        <span className="metric-icon blue"><FileText size={19} /></span>
        <h3>Quotation {quote?.number}</h3><p>{quote?.customer_name}</p>
        {cartItems}<ErrorLine message={stockError} />
      </section> : <SaleCatalog products={products} quantities={quantities} price={lookupPrice} add={addProduct} lineCount={lines.length} trackStock={isSale}
        viewCart={()=>{ cartHeading.current?.scrollIntoView({block:"start"});cartHeading.current?.focus({preventScroll:true}) }} />}

      <section className="checkout-side" aria-label="Checkout">
        {!converting && <div className="checkout-card">
          <div className="checkout-section-title">
            <span className="metric-icon blue"><ShoppingCart size={19} /></span>
            <div><h3 ref={cartHeading} tabIndex={-1}>{isSale ? "Cart" : "Quotation items"}</h3><small aria-live="polite">{num(lines.length)} {lines.length===1 ? "line" : "lines"}</small></div>
          </div>
          {cartItems}
          <ErrorLine message={stockError} />
          {lines.length>=100 && <p className="checkout-hint">This cart has reached 100 lines.</p>}
        </div>}

        <div className="checkout-card">
          <div className="checkout-section-title"><span className="metric-icon teal"><CreditCard size={19} /></span><h3>{isSale ? "Buyer & payment" : "Quote recipient"}</h3></div>
          {customerField}
          {buyerType==="Agent" && !converting && <p className="checkout-hint">Agent prices apply where available.</p>}
          <ErrorLine message={customerError} />
          {isSale ? <>
          <fieldset className="payment-options">
            <legend>Payment timing</legend>
            {[["full","Pay in full"],["partial","Partial"],["credit","On credit"]].map(([value,label])=><label key={value}>
              <input type="radio" name="paymentTiming" value={value} checked={payment===value} onChange={()=>setPayment(value)} />
              <span>{label}</span>
            </label>)}
          </fieldset>
          <div className="form-grid">
            {payment!=="credit" && <Field label="Payment method"><Select name="method">{methods.map(method=><option key={method}>{method}</option>)}</Select></Field>}
            {payment==="partial" && <Field label={requestApprovals ? "Proposed payment (TZS)" : "Amount received (TZS)"}><input name="paid" type="number" min="1" max={Math.max(0,total-1)}
              value={received ?? ""} onChange={event=>setReceived(event.target.value==="" ? null : event.target.valueAsNumber)} required /></Field>}
            {payment!=="full" && <Field label="Balance due date"><input name="dueDate" type="date" min={data.today} /></Field>}
            {payment!=="credit" && <Field label="Payment reference"><input name="reference" placeholder="Optional" /></Field>}
          </div></> : <Field label="Valid until"><input name="validUntil" type="date" defaultValue={quote?.valid_until ?? ""}
            min={quote?.valid_until && quote.valid_until < data.today ? quote.valid_until : data.today} /></Field>}
        </div>

        <div className="checkout-card">
          <div className="checkout-section-title"><span className="metric-icon cyan"><Wallet size={19} /></span><h3>{isSale ? "Order summary" : "Quotation summary"}</h3></div>
          {(!requestApprovals || (isSale && !converting)) && adjustments}
          <ErrorLine message={discountError} />
          <dl className="sale-totals">
            <div><dt>Subtotal</dt><dd>{money(subtotal)}</dd></div>
            {discount>0 && <div><dt>Discount</dt><dd>−{money(discount)}</dd></div>}
            {tax>0 && <div><dt>Tax</dt><dd>{money(tax)}</dd></div>}
            {isSale && payment!=="full" && <div><dt>Balance due</dt><dd>{money(Math.max(0,total-paid))}</dd></div>}
          </dl>
          {needsApproval && <Field label="Reason for approval" hint="The sale will be ready to complete after an administrator approves these terms.">
            <input name="approvalReason" maxLength={160} required placeholder="Why is the discount or balance needed?" />
          </Field>}
          {isSale && canAddInstallation && <>
            <label className="checkbox checkout-installation"><input type="checkbox" checked={installation}
              onChange={event=>setInstallation(event.target.checked)} /> {requestJobs ? "Request an installation" : "Create a linked installation job"}</label>
            {installation && <div className="form-grid">
              <Field label="Job title"><input name="title" required placeholder="Office network installation" /></Field>
              <Field label="Installation location"><input name="location" required={requestJobs} /></Field>
              <Field label={requestJobs ? "Preferred date" : "Scheduled date"}><input name="scheduled" type="date" min={requestJobs ? data.today : undefined} /></Field>
              {scheduleJobs && <Field label="Technician"><Select name="technicianId"><option value="">Assign later</option><PeopleOptions people={data.staff.filter(staff=>staff.role==="Technician"&&staff.active)} /></Select></Field>}
            </div>}
          </>}
        </div>
      </section>
    </div>
  </Form>
}

export function StockForm({ data, product, close, save }: FormProps & { product?: Product }) {
  return <Form close={close} label="Record adjustment" onSave={f=>save({action:"stock",productId:v(f,"productId"),delta:n(f,"delta"),reason:v(f,"reason")},"Stock updated")}>
    <Field label="Product"><Select name="productId" defaultValue={product?.id ?? ""} required>{blank}<PeopleOptions people={data.products.filter(p=>p.type==="Stocked")} /></Select></Field>
    <Field label="Quantity change" hint="Use a positive number to add units or a negative number to remove them."><input name="delta" type="number" min="-100000" max="100000" required /></Field>
    <Field label="Reason"><input name="reason" required placeholder="Stock count, damaged item, or correction" /></Field>
  </Form>
}

export function PurchaseForm({ data, close, save }: FormProps) {
  const [items,setItems] = useState<{ key: number; product: Product; quantity: number; cost: number }[]>([])
  const sequence = useRef(0)
  return <Form close={close} label="Receive purchase" onSave={f=>{
    if (!items.length) return Promise.reject(new Error("Add at least one stocked product."))
    return save({action:"purchase",supplierId:v(f,"supplierId"),reference:v(f,"reference"),lines:items.map(i=>({ productId:i.product.id,quantity:i.quantity,cost:i.cost }))},"Purchase received")
  }}>
    <div className="form-grid">
      <Field label="Supplier"><Select name="supplierId" required defaultValue="">{blank}<PeopleOptions people={data.suppliers} /></Select></Field>
      <Field label="Supplier reference"><input name="reference" placeholder="Optional" /></Field>
    </div>
    <ProductPicker products={data.products.filter(p=>p.type==="Stocked" && p.active)}
      add={p=>setItems(current=>[...current,{ key:++sequence.current,product:p,quantity:1,cost:p.cost ?? 0 }])} />
    {items.map(item=><div className="cart-line" key={item.key}>
      <div className="cart-name"><strong>{item.product.name}</strong><small>{item.product.sku}</small></div>
      <Field label="Quantity"><input type="number" min="1" max="100000" required value={item.quantity} onChange={e=>setItems(current=>current.map(i=>i.key===item.key ? {...i,quantity:e.target.valueAsNumber || 0}:i))} /></Field>
      <Field label="Unit cost"><input type="number" min="0" max="9999999999" required value={item.cost} onChange={e=>setItems(current=>current.map(i=>i.key===item.key ? {...i,cost:e.target.valueAsNumber || 0}:i))} /></Field>
      <strong className="line-total">{money(item.quantity*item.cost)}</strong>
      <button type="button" className="icon-btn" aria-label={"Remove "+item.product.name} onClick={()=>setItems(current=>current.filter(i=>i.key!==item.key))}><Trash2 size={17} /></button>
    </div>)}
    <div className="cart-total"><span>Total cost</span><strong>{money(items.reduce((sum,i)=>sum+i.quantity*i.cost,0))}</strong></div>
  </Form>
}

export function PaymentForm({ sale, close, save }: SimpleProps & { sale: Sale }) {
  const requestId = useRef("")
  return <Form close={close} label="Record payment" onSave={f=>{ requestId.current ||= crypto.randomUUID()
    return save({ action:"payment",requestId:requestId.current,saleId:sale.id,amount:n(f,"amount"),method:v(f,"method"),reference:v(f,"reference") },"Payment recorded")
  }}>
    <div className="cart-total"><span>Outstanding balance</span><strong>{money(sale.balance)}</strong></div>
    <Field label="Amount (TZS)"><input name="amount" type="number" min="1" max={sale.balance} defaultValue={sale.balance} required /></Field>
    <Field label="Payment method"><Select name="method">{methods.map(m=><option key={m}>{m}</option>)}</Select></Field>
    <Field label="Reference"><input name="reference" placeholder="Optional" /></Field>
  </Form>
}

export function ReturnForm({ detail, close, save, approval = false }: SimpleProps & { detail: SaleDetail; approval?: boolean }) {
  const available = detail.lines.filter(l=>l.returned<l.quantity)
  const [id,setId] = useState(available[0]?.id ?? "")
  const line = available.find(l=>l.id===id)
  const requestId = useRef("")
  return <Form close={close} label={approval ? "Request approval" : "Record return"} onSave={f=>{ requestId.current ||= crypto.randomUUID()
    const item = {action:"return",requestId:requestId.current,saleId:detail.sale.id,lineId:id,quantity:n(f,"quantity"),reason:v(f,"reason"),restock:line?.type==="Stocked"&&f.has("restock")}
    return approval ? save({action:"requestReturnApproval",item},"Return approval requested") : save(item,"Return recorded")
  }}>
    {approval && <p className="detail-note">An administrator will review the return and any refund before they are recorded.</p>}
    <Field label="Sale item"><Select value={id} required onChange={e=>setId(e.target.value)}>{available.map(l=><option key={l.id} value={l.id}>{l.name} · {num(l.quantity-l.returned)} available</option>)}</Select></Field>
    <Field label="Quantity"><input name="quantity" type="number" min="1" max={line ? line.quantity-line.returned : 0} defaultValue={1} required /></Field>
    <Field label="Reason"><input name="reason" maxLength={160} required /></Field>
    {line?.type==="Stocked" && <label className="checkbox"><input name="restock" type="checkbox" defaultChecked /> Return units to sellable stock</label>}
  </Form>
}

export function JobForm({ data, record, close, save }: FormProps & { record?: Job }) {
  const [saleId,setSale] = useState(record?.sale_id ?? "")
  return <Form close={close} label={record ? "Save job" : "Create job"} onSave={f=>save({
    action:"job",id:record?.id,title:v(f,"title"),customerId:opt(f,"customerId"),saleId:saleId||null,
    technicianId:opt(f,"technicianId"),location:v(f,"location"),notes:v(f,"notes"),scheduled:opt(f,"scheduled"),status:v(f,"status")
  },"Installation saved")}>
    <div className="form-grid">
      <Field label="Job title"><input name="title" defaultValue={record?.title} required /></Field>
      <Field label="Linked sale"><Select value={saleId} disabled={Boolean(record)} onChange={e=>setSale(e.target.value)}>
        <option value="">Standalone service job</option>{data.sales.map(s=><option value={s.id} key={s.id}>{s.number} · {s.customer_name}</option>)}
      </Select></Field>
      {!saleId && <Field label="Customer"><Select name="customerId" defaultValue={record?.customer_id ?? ""}><option value="">Walk-in customer</option><PeopleOptions people={data.customers} /></Select></Field>}
      <Field label="Technician"><Select name="technicianId" defaultValue={record?.technician_id ?? ""}><option value="">Assign later</option><PeopleOptions people={data.staff.filter(u=>u.role==="Technician" && (u.active || u.id===record?.technician_id))} /></Select></Field>
      <Field label="Location"><input name="location" defaultValue={record?.location} /></Field>
      <Field label="Scheduled date"><input name="scheduled" type="date" defaultValue={record?.scheduled ?? ""} /></Field>
      <Field label="Status"><Select name="status" defaultValue={record?.status==="Requested" ? "Scheduled" : record?.status ?? "Scheduled"}>{jobStatuses.map(s=><option key={s}>{s}</option>)}</Select></Field>
    </div>
    <Field label="Work notes"><textarea name="notes" rows={3} defaultValue={record?.notes} /></Field>
  </Form>
}

export function InstallationRequestForm({ data, close, save }: FormProps) {
  const [saleId,setSale] = useState("")
  return <Form close={close} label="Send installation request" onSave={form=>save({
    action:"installationRequest",title:v(form,"title"),customerId:opt(form,"customerId"),saleId:saleId || null,
    location:v(form,"location"),notes:v(form,"notes"),scheduled:opt(form,"scheduled")
  },"Installation requested")}>
    <div className="form-grid">
      <Field label="Work title"><input name="title" required maxLength={160} placeholder="Office Wi-Fi setup" /></Field>
      <Field label="Linked sale"><Select value={saleId} onChange={event=>setSale(event.target.value)}>
        <option value="">Standalone request</option>{data.sales.map(sale=><option key={sale.id} value={sale.id}>{sale.number} · {sale.customer_name}</option>)}
      </Select></Field>
      {!saleId && <Field label="Customer or agent"><Select name="customerId" required defaultValue="">{blank}<PeopleOptions people={data.customers} /></Select></Field>}
      <Field label="Location"><input name="location" required maxLength={2000} /></Field>
      <Field label="Preferred date"><input name="scheduled" type="date" min={data.today} /></Field>
    </div>
    <Field label="Work notes" hint={saleId ? "Add any equipment or instructions beyond the linked sale." : "List the equipment needed and any instructions for the technician."}>
      <textarea name="notes" rows={4} maxLength={2000} />
    </Field>
  </Form>
}

export function JobStatusForm({ job, close, save }: SimpleProps & { job: Job }) {
  return <Form close={close} onSave={f=>save({action:"jobStatus",id:job.id,status:v(f,"status"),notes:v(f,"notes")},"Job updated")}>
    <Field label="Status"><Select name="status" defaultValue={job.status}>{jobStatuses.filter(status=>status!=="Requested").map(s=><option key={s}>{s}</option>)}</Select></Field>
    <Field label="Work notes"><textarea name="notes" rows={4} defaultValue={job.notes} /></Field>
  </Form>
}

export function MaterialForm({ data, detail, close, save }: FormProps & { detail: JobDetail }) {
  return <Form close={close} label="Use material" onSave={f=>save({
    action:"material",jobId:detail.job.id,productId:v(f,"productId"),quantity:n(f,"quantity"),serial:v(f,"serial")
  },"Material recorded")}>
    <Field label="Extra material" hint="This draws additional units from stock. Items already on the linked sale appear in the job history.">
      <Select name="productId" defaultValue="" required>{blank}{data.products.filter(p=>p.active&&p.type==="Stocked"&&p.on_hand>0).map(p=><option key={p.id} value={p.id}>{p.name} · {p.on_hand} {p.unit} available</option>)}</Select>
    </Field>
    <Field label="Quantity"><input name="quantity" type="number" min="1" defaultValue={1} required /></Field>
    <Field label="Serial number"><input name="serial" placeholder="Optional for one unit" /></Field>
  </Form>
}

export function ExpenseForm({ data, job, record, close, save }: FormProps & { job?: Job; record?: Expense }) {
  return <Form close={close} label={record ? "Save expense" : "Record expense"} onSave={f=>save({action:"expense",id:record?.id,description:v(f,"description"),
    amount:n(f,"amount"),incurred:v(f,"incurred"),jobId:opt(f,"jobId"),category:v(f,"category"),method:opt(f,"method"),reference:v(f,"reference"),notes:v(f,"notes")},record ? "Expense updated" : "Expense recorded")}>
    <Field label="Description"><input name="description" defaultValue={record?.description} required maxLength={160} /></Field>
    <div className="form-grid">
      <Field label="Amount (TZS)"><input name="amount" type="number" min="1" max="9999999999" defaultValue={record?.amount} required /></Field>
      <Field label="Date incurred"><input name="incurred" type="date" defaultValue={record?.incurred ?? data.today} required /></Field>
    </div>
    <div className="form-grid">
      <Field label="Category"><Select name="category" defaultValue={record?.category ?? "Other"}>{expenseCategories.map(category=><option key={category}>{category}</option>)}</Select></Field>
      <Field label="Payment method"><Select name="method" defaultValue={record?.method ?? ""}><option value="">Unspecified</option>{methods.map(method=><option key={method}>{method}</option>)}</Select></Field>
      <Field label="Related installation"><Select name="jobId" defaultValue={record?.job_id ?? job?.id ?? ""}><option value="">General operating expense</option>{data.jobs.map(j=><option key={j.id} value={j.id}>{j.number} · {j.title}</option>)}</Select></Field>
      <Field label="Receipt or payment reference"><input name="reference" defaultValue={record?.reference} maxLength={160} placeholder="Optional" /></Field>
    </div>
    <Field label="Notes"><textarea name="notes" rows={3} maxLength={2000} defaultValue={record?.notes} placeholder="Optional" /></Field>
  </Form>
}

export function PurchaseReferenceForm({ record,close,save }: SimpleProps & { record: Purchase }) {
  return <Form close={close} label="Save reference" onSave={form=>save({
    action:"purchaseReference",id:record.id,reference:v(form,"reference")
  },"Purchase reference updated")}>
    <Field label="Supplier reference"><input name="reference" defaultValue={record.reference} maxLength={2000} /></Field>
  </Form>
}

export function SettingsForm({ data, close, save }: FormProps) {
  const business = data.business
  return <Form close={close} onSave={f=>save({action:"settings",name:v(f,"name"),phone:v(f,"phone"),email:v(f,"email"),
    address:v(f,"address"),invoicePrefix:v(f,"invoicePrefix")},"Business profile updated")}>
    <div className="form-grid"><ContactFields record={business} company />
      <Field label="Invoice prefix"><input name="invoicePrefix" defaultValue={business.invoice_prefix} pattern="[A-Za-z0-9]{1,12}" required /></Field>
      <Field label="Currency"><input value="TZS — Tanzanian shilling" readOnly /></Field>
    </div>
  </Form>
}

export function StaffForm({ record, close, save }: SimpleProps & { record?: Staff }) {
  return <Form close={close} onSave={f=>save({action:"staff",id:record?.id,name:v(f,"name"),email:v(f,"email"),role:v(f,"role"),
    active:f.has("active"),password:String(f.get("password") ?? "")},"Staff account saved")}>
    <div className="form-grid">
      <Field label="Name"><input name="name" defaultValue={record?.name} required /></Field>
      <Field label="Email"><input name="email" type="email" defaultValue={record?.email} required /></Field>
      <Field label="Role"><Select name="role" defaultValue={record?.role ?? "Front Office"}>{roles.map(r=><option key={r}>{r}</option>)}</Select></Field>
      <Field label={record ? "New password" : "Temporary password"} hint={record ? "Leave blank to keep the current password." : "At least 12 characters."}>
        <input name="password" type="password" autoComplete="new-password" minLength={12} required={!record} />
      </Field>
    </div>
    <label className="checkbox"><input type="checkbox" name="active" defaultChecked={record?.active ?? true} /> Active staff account</label>
  </Form>
}

