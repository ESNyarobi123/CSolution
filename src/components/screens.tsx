"use client"

import { useState, type ReactNode } from "react"
import { Archive, ArchiveRestore, ArrowDownLeft, ArrowUpRight, BadgeCheck, Box, ChartNoAxesCombined, ChevronRight, CircleDollarSign, Download, Edit3, Eye, FileText, ListFilter, Layers3, PackageOpen, Plus, RadioTower, ReceiptText, RotateCcw, ScrollText, Settings2, Store, Trash2, Truck, UserCheck, Users, UserX, Wallet } from "lucide-react"
import { can, capabilityGroups, ownSalesOnly, roles } from "@/lib/access"
import { type DeletableRecord, deletableRecords } from "@/lib/management"
import { date, initials, money, num, shopDay } from "@/lib/format"
import { buyerTypes, expenseCategories, jobStatuses } from "@/lib/model"
import type { Customer, Expense, Group, Job, Person, Product, Purchase, Quote, Sale, SerialRecord, Snapshot, Staff, StockMovement } from "@/lib/model"
import { ActionMenu, Badge, type Column, Empty, ErrorLine, Field, type MenuAction, ProductPhoto, SearchBox, Select, Table } from "./ui"
import { growth, Metric, reportStart, RevenueChart } from "./dashboard"

export type Panel =
  { kind:"categories"|"brands"; record?:Group } |
  { kind:"product"|"stock"; record?:Product } | { kind:"openingStock" } | { kind:"productDetail"; id:string } |
  { kind:"customer"; record?:Customer } | { kind:"customerDetail"; record:Customer } |
  { kind:"supplier"; record?:Person } | { kind:"staff"; record?:Staff } |
  { kind:"job"; record?:Job } | { kind:"expense"; job?:Job; record?:Expense } | { kind:"expenseDetail"; record:Expense } |
  { kind:"installationRequest" } | { kind:"approvalDetail"; id:string } |
  { kind:"purchaseReference"; record:Purchase } |
  { kind:"deleteRecord"; id:string; record:DeletableRecord; title:string } |
  { kind:"productStatus"; id:string; title:string; active:boolean } |
  { kind:"staffStatus"; id:string; title:string; active:boolean } |
  { kind:"sale"|"quote"; record?:Quote } | { kind:"purchase"|"settings"|"search" } |
  { kind:"saleDetail"|"invoice"|"receipt"|"payment"|"return"|"jobDetail"|"material"|"jobStatus"; id:string } |
  { kind:"quoteDetail"; record:Quote }

type Props = { data: Snapshot; open: (panel: Panel) => void }

function Add({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return <button className="button primary" onClick={onClick}><Plus size={17} />{children}</button>
}
function editAction(label: string, run: () => void): MenuAction {
  return { label,icon:Edit3,run }
}

function deleteActions(data: Snapshot, open: Props["open"], record: DeletableRecord, id: string, title: string): MenuAction[] {
  if (!can(data.user.role,"admin")) return []
  return [{
    label:"Delete "+deletableRecords[record],icon:Trash2,destructive:true,
    run:()=>open({kind:"deleteRecord",id,record,title})
  }]
}

function rowActions<T extends { id: string }>(label: (row:T)=>string, actions: (row:T)=>MenuAction[]): Column<T> {
  return {
    label:"Actions",actions:true,
    cell:row=><ActionMenu label={"Actions for "+label(row)} actions={actions(row)} />
  }
}

function Filters({ children }: { children: ReactNode }) { return <div className="filters">{children}</div> }
function Filtered<T extends { id: string }>({ items, columns, search, filter, children, empty }: {
  items: T[]; columns: Column<T>[]; search: (item:T) => string; filter?: (item:T)=>boolean; children?: ReactNode; empty: string
}) {
  const [query,setQuery] = useState("")
  const result = items.filter(item=>(!filter || filter(item))&&search(item).toLowerCase().includes(query.trim().toLowerCase()))
  return <article className="panel records-panel">
    <Filters><SearchBox value={query} change={setQuery} />{children}</Filters>
    <Table key={query} rows={result} columns={columns} empty={empty} />
  </article>
}
function Tabs({ tabs,value,change }: { tabs: string[]; value: string; change: (value: string)=>void }) {
  return <div className="tabs" aria-label="Filter view">{tabs.map(tab=><button key={tab} type="button" aria-pressed={tab===value} onClick={()=>change(tab)}>{tab}</button>)}</div>
}
function Actions({ children }: { children: ReactNode }) { return <div className="page-actions">{children}</div> }
const fields = (...values: (string|null|undefined)[])=>values.filter(Boolean).join(" ")
export const productStock = (p: Product) => p.on_hand===0 ? "Out of stock" : p.on_hand<=p.reorder ? "Low stock" : "In stock"
const availability = (p: Product) => !p.active ? "Archived" : p.type==="Stocked" ? productStock(p) : p.type

function ProductLabel({ product, open }: { product: Product; open: Props["open"] }) {
  return <button type="button" className="product-label product-link" onClick={()=>open({kind:"productDetail",id:product.id})}>
    <ProductPhoto product={product} /><span><strong>{product.name}</strong><small className="table-sub">{product.sku}</small></span>
  </button>
}
function TextLink({ children, run }: { children: ReactNode; run:()=>void }) {
  return <button className="text-button" onClick={run}>{children}<ChevronRight size={14} /></button>
}

export function Groups({ data,open,kind }: Props & { kind:"categories"|"brands" }) {
  const isCategory = kind==="categories"
  const singular = isCategory ? "category" : "brand"
  const edit = can(data.user.role,"catalog")
  return <>
    {edit && <Actions><Add onClick={()=>open({kind})}>Add {singular}</Add></Actions>}
    <Filtered items={data[kind]} search={g=>fields(g.name,g.description)} empty={`No ${kind} found`} columns={[
      {label:"Name",cell:g=><span className="customer-cell"><span className="avatar mini">{isCategory ? <Layers3 size={15} /> : <BadgeCheck size={15} />}</span><strong>{g.name}</strong></span>},
      {label:"Description",cell:g=>g.description || "—"},
      {label:"Products",cell:g=>num(g.product_count),numeric:true},
      ...(edit ? [rowActions<Group>(g=>g.name,g=>[
        editAction("Edit "+singular,()=>open({kind,record:g})), ...deleteActions(data,open,kind,g.id,g.name)
      ])] : [])
    ]} />
  </>
}
export function Products({ data,open }: Props) {
  const [category,setCategory] = useState("")
  const [type,setType] = useState("")
  const [stockStatus,setStockStatus] = useState("")
  const edit = can(data.user.role,"catalog")
  return <>
    {edit && <Actions>
      <button className="button secondary" onClick={()=>open({kind:"product"})}><Plus size={17} /> Add product</button>
      <button className="button primary" onClick={()=>open({kind:"openingStock"})}><PackageOpen size={17} /> Register existing stock</button>
    </Actions>}
    <Filtered items={data.products} search={p=>fields(p.name,p.sku,p.brand,p.category,p.unit)}
      filter={p=>(!category||p.category_id===category)&&(!type||p.type===type)&&(!stockStatus||availability(p)===stockStatus)}
      empty="No products match these filters" columns={[
      {label:"Product",cell:p=><ProductLabel product={p} open={open} />},
      {label:"Category",cell:p=>p.category ?? "—"}, {label:"Brand",cell:p=>p.brand ?? "—"},
      {label:"Type",cell:p=><Badge value={p.type} />},
      {label:"Price / unit",cell:p=><><strong>{money(p.price)}</strong>{p.cost !== undefined && <small className="table-sub">Cost {money(p.cost)}</small>}</>,numeric:true},
      {label:"Available",cell:p=>p.type==="Stocked" ? <strong>{num(p.on_hand)} {p.unit}</strong> : <span>Per {p.unit}</span>,numeric:true},
      {label:"Status",cell:p=><Badge value={availability(p)} />},
      ...(edit ? [rowActions<Product>(p=>p.name,p=>[
        {label:"View product",icon:Eye,run:()=>open({kind:"productDetail",id:p.id})},
        editAction("Edit product",()=>open({kind:"product",record:p})),
        ...(p.type==="Stocked" && can(data.user.role,"inventory") ? [
          {label:"Adjust stock",icon:Settings2,run:()=>open({kind:"stock",record:p})}
        ] : []),
        ...(can(data.user.role,"admin") ? [{
          label:p.active?"Archive product":"Restore product",icon:p.active?Archive:ArchiveRestore,
          run:()=>open({kind:"productStatus",id:p.id,title:p.name,active:!p.active})
        }] : []),
        ...deleteActions(data,open,"products",p.id,p.name)
      ])] : [])
    ]}>
      <Select aria-label="Category" value={category} onChange={e=>setCategory(e.target.value)}><option value="">All categories</option>{data.categories.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</Select>
      <Select aria-label="Product type" value={type} onChange={e=>setType(e.target.value)}><option value="">All types</option><option>Stocked</option><option>Non-stock</option><option>Service</option></Select>
      <Select aria-label="Availability" value={stockStatus} onChange={e=>setStockStatus(e.target.value)}><option value="">All availability</option><option>In stock</option><option>Low stock</option><option>Out of stock</option><option>Archived</option></Select>
    </Filtered>
  </>
}
export function Inventory({ data,open,initialLow = false }: Props & { initialLow?: boolean }) {
  const [tab,setTab] = useState("Stock levels")
  const [low,setLow] = useState(initialLow)
  return <>
    <Actions><button className="button secondary" onClick={()=>open({kind:"stock"})}><Settings2 size={17} /> Adjust stock</button>
      {can(data.user.role,"catalog") && <button className="button secondary" onClick={()=>open({kind:"openingStock"})}><PackageOpen size={17} /> Register existing stock</button>}
      <Add onClick={()=>open({kind:"purchase"})}>Receive purchase</Add></Actions>
    <Tabs tabs={["Stock levels","Movement history","Serials & warranties"]} value={tab} change={setTab} />
    {tab==="Stock levels" ? <Filtered key="stock" items={data.products.filter(p=>p.type==="Stocked")}
      search={p=>fields(p.name,p.sku,p.category,p.brand)} filter={p=>!low || (p.active&&p.on_hand<=p.reorder)} empty="No matching stock records" columns={[
      {label:"Product",cell:p=><ProductLabel product={p} open={open} />}, {label:"On hand",cell:p=><strong>{num(p.on_hand)} {p.unit}</strong>,numeric:true},
      {label:"Reorder at",cell:p=>num(p.reorder),numeric:true},{label:"Stock cost",cell:p=>money((p.cost??0)*p.on_hand),numeric:true},
      {label:"Status",cell:p=><Badge value={p.active?productStock(p):"Archived"} />},
      rowActions<Product>(p=>p.name,p=>[
        {label:"Adjust stock",icon:Settings2,run:()=>open({kind:"stock",record:p})},
        ...(can(data.user.role,"catalog") ? [editAction("Edit product",()=>open({kind:"product",record:p}))] : [])
      ])
    ]}><label className="checkbox"><input type="checkbox" checked={low} onChange={e=>setLow(e.target.checked)} /> Low stock only</label></Filtered>
      : tab==="Movement history" ? <Filtered<StockMovement> key="movements" items={data.movements} search={m=>fields(m.product,m.sku,m.kind,m.reference,m.staff)} empty="No stock movements" columns={[
        {label:"Product",cell:m=><><strong>{m.product}</strong><small className="table-sub">{m.sku}</small></>},
        {label:"Movement",cell:m=>m.kind},
        {label:"Quantity",cell:m=><span className={`movement ${m.delta>0?"positive":"negative"}`}>{m.delta>0?<ArrowDownLeft size={15}/>:<ArrowUpRight size={15}/>} {m.delta>0?"+":""}{num(m.delta)}</span>},
        {label:"Reference",cell:m=>m.reference}, {label:"Staff",cell:m=>m.staff},{label:"Date",cell:m=>date(m.created_at)}
      ]} /> : <Filtered<SerialRecord> key="serials" items={data.serials}
        search={r=>fields(r.serial,r.product,r.sku,r.reference,r.customer)} empty="No serial numbers recorded" columns={[
        {label:"Serial number",cell:r=><strong>{r.serial}</strong>},
        {label:"Product",cell:r=><>{r.product}<small className="table-sub">{r.sku}</small></>},
        {label:"Record",cell:r=><>{r.reference}<small className="table-sub">{r.source}</small></>},
        {label:"Customer",cell:r=>r.customer??"—"},
        {label:"Warranty ends",cell:r=>date(r.warranty_until)},
        {label:"Status",cell:r=><Badge value={r.status} />}
      ]} />}
  </>
}
function salesColumns(open: Props["open"], invoice: boolean): Column<Sale>[] {
  return [
    {label:invoice?"Invoice":"Sale ID",cell:s=><TextLink run={()=>open({kind:invoice?"invoice":"saleDetail",id:s.id})}>{invoice?s.invoice:s.number}</TextLink>},
    {label:"Customer",cell:s=><span className="customer-cell"><span className="avatar mini">{initials(s.customer_name)}</span><span>{s.customer_name}<small className="table-sub">{s.buyer_type}</small></span></span>},
    {label:invoice?"Due date":"Sale type",cell:s=>invoice?date(s.due_date):s.kind},
    {label:"Issued",cell:s=>date(s.created_at)},
    {label:"Total",cell:s=><><strong>{money(invoice ? s.total : s.total-s.credits)}</strong>{!invoice && s.credits>0 && <small className="table-sub">After returns</small>}</>,numeric:true},
    {label:"Balance",cell:s=>money(s.balance),numeric:true},{label:"Status",cell:s=><Badge value={s.status} />},
    rowActions<Sale>(s=>invoice?s.invoice:s.number,s=>[
      {label:"View sale",icon:Eye,run:()=>open({kind:"saleDetail",id:s.id})},
      {label:"View invoice",icon:FileText,run:()=>open({kind:"invoice",id:s.id})},
      ...(s.paid>0 ? [{label:"View receipt",icon:ReceiptText,run:()=>open({kind:"receipt",id:s.id})}] : []),
      ...(s.balance>0 ? [{label:"Record payment",icon:Wallet,run:()=>open({kind:"payment",id:s.id})}] : [])
    ])
  ]
}
const saleStatuses = ["All sales","Paid","Partial","Unpaid","Returned"] as const
const defaultSalesFilters = { query:"",period:"all",from:"",to:"",type:"",status:"All sales",sort:"recent" }

export function Sales({ data,open,balancesOnly = false }: Props & { balancesOnly?: boolean }) {
  const [filters,setFilters] = useState(defaultSalesFilters)
  const change = (field: keyof typeof filters, value: string)=>setFilters(current=>({...current,[field]:value}))
  const {query,period,from,to,type,status,sort} = filters
  const filtered = Boolean(query.trim() || period!=="all" || type || status!=="All sales" || sort!=="recent")
  const invalidDates = period==="custom" && Boolean(from && to && from>to)
  const text = query.trim().toLowerCase().split(/\s+/).filter(Boolean)
  const daysAgo = (days: number)=>new Date(Date.parse(data.today)-days*86_400_000).toISOString().slice(0,10)
  const start = ({ today:data.today,week:daysAgo(6),month:daysAgo(29),currentMonth:data.today.slice(0,7)+"-01",custom:from })[period]
  const end = period==="all" ? "" : period==="custom" ? to : data.today
  const available = balancesOnly ? data.sales.filter(sale=>sale.balance>0) : data.sales
  const matches = invalidDates ? [] : available.filter(sale=>{
    if (type && sale.kind!==type) return false
    if (start || end) {
      const day = shopDay(sale.created_at)
      if ((start && day<start) || (end && day>end)) return false
    }
    const searchable = fields(sale.number,sale.invoice,sale.customer_name,sale.customer_phone,sale.cashier,sale.buyer_type).toLowerCase()
    return text.every(term=>searchable.includes(term))
  })
  const counts: Record<string,number> = { "All sales":matches.length, Paid:0, Partial:0, Unpaid:0, Returned:0 }
  for (const sale of matches) counts[sale.status]++
  const results = matches.filter(sale=>status==="All sales" || sale.status===status)
  const latest = (a: Sale,b: Sale)=>new Date(b.created_at).getTime()-new Date(a.created_at).getTime()
  results.sort((a,b)=>{
    switch (sort) {
      case "oldest": return latest(b,a)
      case "total": return (b.total-b.credits)-(a.total-a.credits) || latest(a,b)
      case "balance": return b.balance-a.balance || latest(a,b)
      default: return latest(a,b)
    }
  })
  const totals = results.reduce((sum,sale)=>({
    invoiced:sum.invoiced + sale.total - sale.credits, collected:sum.collected + sale.paid, balance:sum.balance + sale.balance
  }),{invoiced:0,collected:0,balance:0})

  return <div className="sales-page">
    <section className="sales-metrics" aria-label="Totals for matching sales">
      <div className="panel sales-metric"><span className="metric-icon blue"><ReceiptText size={19} /></span><div><small>Invoiced after returns</small><strong>{money(totals.invoiced)}</strong></div></div>
      <div className="panel sales-metric"><span className="metric-icon green"><CircleDollarSign size={19} /></span><div><small>Collected</small><strong>{money(totals.collected)}</strong></div></div>
      <div className="panel sales-metric"><span className="metric-icon cyan"><Wallet size={19} /></span><div><small>Outstanding</small><strong>{money(totals.balance)}</strong></div></div>
    </section>
    <article className="panel sales-list">
      <div className="sales-list-head">
        <div><h2>{balancesOnly ? "Open invoice balances" : "Transactions"}</h2><p aria-live="polite">{num(results.length)} of {num(available.length)} {balancesOnly ? "invoices" : "sales"}</p></div>
        {filtered && <button type="button" className="button secondary small" onClick={()=>setFilters(defaultSalesFilters)}><RotateCcw size={15} /> Clear filters</button>}
      </div>
      <div className="sales-filters">
        <SearchBox value={query} change={value=>change("query",value)} placeholder="Search sale ID, invoice, customer or cashier…" />
        <Select aria-label="Sale date range" value={period} onChange={event=>change("period",event.target.value)}>
          <option value="all">All dates</option><option value="today">Today</option><option value="week">Last 7 days</option><option value="month">Last 30 days</option>
          <option value="currentMonth">This month</option><option value="custom">Custom dates</option>
        </Select>
        <Select aria-label="Sale type" value={type} onChange={event=>change("type",event.target.value)}>
          <option value="">All sale types</option><option>Equipment</option><option>Equipment + installation</option><option>Service only</option>
        </Select>
        <Select aria-label="Sort sales" value={sort} onChange={event=>change("sort",event.target.value)}>
          <option value="recent">Newest first</option><option value="oldest">Oldest first</option><option value="total">Highest total</option><option value="balance">Largest balance</option>
        </Select>
      </div>
      {period==="custom" && <div className="sales-custom-dates">
        <Field label="From"><input type="date" value={from} onChange={event=>change("from",event.target.value)} /></Field>
        <Field label="To"><input type="date" value={to} onChange={event=>change("to",event.target.value)} /></Field>
      </div>}
      {invalidDates && <div className="sales-date-error"><ErrorLine message="The end date must be on or after the start date." /></div>}
      {!balancesOnly && <div className="sales-statuses" aria-label="Payment status filters"><ListFilter size={17} />
        {saleStatuses.map(item=><button key={item} type="button" aria-pressed={status===item} onClick={()=>change("status",item)}>
          {item} <span>{num(counts[item])}</span>
        </button>)}
      </div>}
      <Table key={[query,period,from,to,type,status,sort].join("|")} rows={results} columns={salesColumns(open,false)}
        empty={available.length ? "No sales match these filters" : balancesOnly ? "No invoices with an open balance" : "No sales recorded yet"} />
    </article>
  </div>
}
const documentTabs = [
  { id:"invoices",title:"Invoices",icon:FileText,tone:"blue" },
  { id:"quotations",title:"Quotations",icon:ScrollText,tone:"teal" },
  { id:"receipts",title:"Receipts",icon:ReceiptText,tone:"cyan" }
] as const
const documentDefaults = { query:"",status:"",buyer:"",from:"",to:"" }
const quoteStatus = (quote: Quote,today: string) => quote.sale_id ? "Converted" : quote.valid_until && quote.valid_until<today ? "Expired" : "Open"

export function Documents({ data,open,page,go }: Props & { page:string; go:(page:string)=>void }) {
  const tab = documentTabs.find(item=>item.id===page.split("/")[1])?.id ?? "invoices"
  const [filters,setFilters] = useState(documentDefaults)
  const {query,status,buyer,from,to} = filters
  const change = (field:keyof typeof filters,value:string)=>setFilters(current=>({...current,[field]:value}))
  const text = query.trim().toLowerCase().split(/\s+/).filter(Boolean)
  const receipts = data.sales.filter(sale=>sale.paid>0).sort((a,b)=>
    new Date(b.last_payment_at ?? b.created_at).getTime()-new Date(a.last_payment_at ?? a.created_at).getTime())
  const invalidDates = Boolean(from && to && from>to)
  const match = (labels:string, documentDate:string, documentStatus:string, buyerType:string)=>{
    if (invalidDates || (status && status!==documentStatus) || (buyer && buyer!==buyerType)) return false
    const day = shopDay(documentDate)
    return (!from || day>=from) && (!to || day<=to) && text.every(term=>labels.toLowerCase().includes(term))
  }
  const quotes = data.quotes.filter(q=>match(fields(q.number,q.customer_name),q.created_at,quoteStatus(q,data.today),q.buyer_type))
  const source = tab==="receipts" ? receipts : data.sales
  const sales = source.filter(sale=>match(fields(sale.number,sale.invoice,sale.customer_name),tab==="receipts" ? sale.last_payment_at ?? sale.created_at : sale.created_at,sale.status,sale.buyer_type))
  const total = tab==="quotations" ? quotes.reduce((sum,quote)=>sum+quote.total,0) :
    sales.reduce((sum,sale)=>sum+(tab==="receipts" ? sale.paid : sale.total),0)
  const count = tab==="quotations" ? quotes.length : sales.length
  const size = tab==="quotations" ? data.quotes.length : source.length
  const buyerLabel = (name:string,type:string)=><span>{name}<small className="table-sub">{type}</small></span>
  return <div className="sales-page">
    <nav className="document-tabs" aria-label="Document types">
      {documentTabs.map(({id,title,icon:Icon,tone})=><button type="button" key={id} aria-pressed={tab===id} onClick={()=>go(id==="invoices" ? "documents" : "documents/"+id)}>
        <span className={`metric-icon ${tone}`}><Icon size={19} /></span><strong>{title}</strong>
        <small>{num(id==="quotations" ? data.quotes.length : id==="receipts" ? receipts.length : data.sales.length)}</small>
      </button>)}
    </nav>
    <article className="panel sales-list">
      <div className="sales-list-head">
        <div><h2>{documentTabs.find(item=>item.id===tab)?.title}</h2><p aria-live="polite">{num(count)} of {num(size)} records</p></div>
        <div className="list-total"><small>{tab==="receipts" ? "Amount paid" : "Matching total"}</small><strong>{money(total)}</strong></div>
      </div>
      <div className="document-filters">
        <SearchBox value={query} change={value=>change("query",value)} placeholder="Search document, sale or buyer…" />
        <Select aria-label="Document status" value={status} onChange={event=>change("status",event.target.value)}>
          <option value="">All statuses</option>{(tab==="quotations" ? ["Open","Expired","Converted"] : ["Paid","Partial","Unpaid","Returned"]).map(option=><option key={option}>{option}</option>)}
        </Select>
        <Select aria-label="Filter by buyer type" value={buyer} onChange={event=>change("buyer",event.target.value)}>
          <option value="">All buyers</option>{buyerTypes.map(option=><option key={option}>{option}</option>)}
        </Select>
        <Field label="From"><input type="date" value={from} onChange={event=>change("from",event.target.value)} /></Field>
        <Field label="To"><input type="date" value={to} onChange={event=>change("to",event.target.value)} /></Field>
        {Boolean(query || status || buyer || from || to) && <button className="button secondary small" onClick={()=>setFilters(documentDefaults)}><RotateCcw size={15} /> Clear</button>}
      </div>
      {invalidDates && <div className="sales-date-error"><ErrorLine message="The end date must be on or after the start date." /></div>}
      {tab==="quotations" ? <Table rows={quotes} key={JSON.stringify(filters)} empty={size ? "No quotations match these filters" : "No quotations yet"} columns={[
        {label:"Quotation",cell:q=><TextLink run={()=>open({kind:"quoteDetail",record:q})}>{q.number}</TextLink>},
        {label:"Buyer",cell:q=>buyerLabel(q.customer_name,q.buyer_type)},{label:"Issued",cell:q=>date(q.created_at)},
        {label:"Valid until",cell:q=>date(q.valid_until)},{label:"Total",cell:q=><strong>{money(q.total)}</strong>,numeric:true},
        {label:"Status",cell:q=><Badge value={quoteStatus(q,data.today)} />},
        rowActions<Quote>(q=>q.number,q=>[
          {label:"View quotation",icon:Eye,run:()=>open({kind:"quoteDetail",record:q})},
          ...(quoteStatus(q,data.today)==="Open" ? [{label:"Convert to sale",icon:ReceiptText,run:()=>open({kind:"sale",record:q})}] : []),
          ...(!q.sale_id && can(data.user.role,"admin") ? [
            editAction("Edit quotation",()=>open({kind:"quote",record:q})), ...deleteActions(data,open,"quotations",q.id,q.number)
          ] : [])
        ])
      ]} /> : <Table rows={sales} key={JSON.stringify(filters)} empty={size ? "No documents match these filters" : "No documents yet"}
        columns={tab==="invoices" ? salesColumns(open,true) : [
          {label:"Receipt",cell:s=><TextLink run={()=>open({kind:"receipt",id:s.id})}>RC-{s.number}</TextLink>},
          {label:"Buyer",cell:s=>buyerLabel(s.customer_name,s.buyer_type)},{label:"Invoice",cell:s=>s.invoice},
          {label:"Last payment",cell:s=>date(s.last_payment_at)},
          {label:"Amount paid",cell:s=><strong>{money(s.paid)}</strong>,numeric:true},{label:"Status",cell:s=><Badge value={s.status} />},
          rowActions<Sale>(s=>"RC-"+s.number,s=>[
            {label:"View receipt",icon:Eye,run:()=>open({kind:"receipt",id:s.id})},
            {label:"View invoice",icon:FileText,run:()=>open({kind:"invoice",id:s.id})}
          ])
        ]} />}
    </article>
  </div>
}

export function Expenses({ data,open,embedded = false }: Props & { embedded?:boolean }) {
  const [query,setQuery] = useState("")
  const [category,setCategory] = useState("")
  const [scope,setScope] = useState("")
  const [period,setPeriod] = useState(embedded ? "report" : "all")
  const days = period==="report" ? data.days : Number(period)
  const start = days ? new Date(Date.parse(data.today)-(days-1)*86_400_000).toISOString().slice(0,10) : ""
  const text = query.trim().toLowerCase().split(/\s+/).filter(Boolean)
  const items = data.expenses.filter(expense=>{
    const labels = fields(expense.description,expense.category,expense.reference,expense.notes,expense.job,expense.method).toLowerCase()
    return (!start || (expense.incurred>=start && expense.incurred<=data.today)) &&
      (!scope || Boolean(expense.job_id)===(scope==="job")) && (!category || category===expense.category) &&
      text.every(term=>labels.includes(term))
  })
  const amounts = items.reduce((sum,expense)=>{
    if (expense.job_id) sum.jobs+=expense.amount
    else sum.operating+=expense.amount
    return sum
  },{operating:0,jobs:0})
  return <div className="sales-page">
    <section className="sales-metrics" aria-label="Totals for matching expenses">
      <div className="panel sales-metric"><span className="metric-icon blue"><Wallet size={19} /></span><div><small>Total expenses</small><strong>{money(amounts.operating+amounts.jobs)}</strong></div></div>
      <div className="panel sales-metric"><span className="metric-icon teal"><Store size={19} /></span><div><small>Operating expenses</small><strong>{money(amounts.operating)}</strong></div></div>
      <div className="panel sales-metric"><span className="metric-icon cyan"><RadioTower size={19} /></span><div><small>Installation expenses</small><strong>{money(amounts.jobs)}</strong></div></div>
    </section>
    <article className="panel sales-list">
      <div className="sales-list-head"><div><h2>Expense records</h2><p aria-live="polite">{num(items.length)} of {num(data.expenses.length)} expenses</p></div></div>
      <div className="sales-filters expense-filters">
        <SearchBox value={query} change={setQuery} placeholder="Search expense, notes or reference…" />
        <Select aria-label="Expense category" value={category} onChange={event=>setCategory(event.target.value)}><option value="">All categories</option>{expenseCategories.map(option=><option key={option}>{option}</option>)}</Select>
        <Select aria-label="Expense scope" value={scope} onChange={event=>setScope(event.target.value)}><option value="">All expenses</option><option value="operating">Operating</option><option value="job">Installation</option></Select>
        <Select aria-label="Expense period" value={period} onChange={event=>setPeriod(event.target.value)}>
          {embedded && <option value="report">Report period</option>}
          <option value="all">All dates</option><option value="7">Last 7 days</option><option value="30">Last 30 days</option><option value="90">Last 90 days</option>
        </Select>
      </div>
      <Table key={JSON.stringify([query,category,scope,period])} rows={items} empty={data.expenses.length ? "No expenses match these filters" : "No expenses recorded yet"} columns={[
        {label:"Expense",cell:e=><TextLink run={()=>open({kind:"expenseDetail",record:e})}>{e.description}</TextLink>},
        {label:"Category",cell:e=>e.category},
        {label:"Scope",cell:e=>e.job ? e.job : "Operating"},
        {label:"Date",cell:e=>date(e.incurred)},
        {label:"Payment",cell:e=><>{e.method ?? "—"}{e.reference&&<small className="table-sub">{e.reference}</small>}</>},
        {label:"Amount",cell:e=><strong>{money(e.amount)}</strong>,numeric:true},
        rowActions<Expense>(e=>e.description,e=>[
          {label:"View expense",icon:Eye,run:()=>open({kind:"expenseDetail",record:e})},
          ...(can(data.user.role,"admin") ? [editAction("Edit expense",()=>open({kind:"expense",record:e})),...deleteActions(data,open,"expenses",e.id,e.description)] : [])
        ])
      ]} />
    </article>
  </div>
}

export function Customers({ data,open }: Props) {
  const [tab,setTab] = useState("All customers")
  const manage = can(data.user.role,"manageCustomers")
  return <>
    <Actions><Add onClick={()=>open({kind:"customer"})}>Add customer</Add></Actions>
    <Tabs tabs={["All customers","Agents","Businesses","Retail"]} value={tab} change={setTab} />
    <Filtered items={data.customers} search={c=>fields(c.name,c.code,c.phone,c.email)}
      filter={c=>tab==="All customers"||c.kind===(tab==="Agents"?"Agent":tab==="Businesses"?"Business":"Retail")} empty="No customers found" columns={[
      {label:"Name",cell:c=><TextLink run={()=>open({kind:"customerDetail",record:c})}>{c.name}</TextLink>},
      {label:"Type",cell:c=><Badge value={c.kind} />}, {label:"Agent code",cell:c=>c.code ?? "—"},
      {label:"Phone",cell:c=>c.phone||"—"},{label:ownSalesOnly(data.user.role) ? "My sales" : "Sales",cell:c=>num(c.sales_count),numeric:true},
      {label:"Outstanding",cell:c=>money(c.outstanding),numeric:true},
      rowActions<Customer>(c=>c.name,c=>[
        {label:"View history",icon:Eye,run:()=>open({kind:"customerDetail",record:c})},
        ...(manage ? [editAction("Edit customer",()=>open({kind:"customer",record:c}))] : []), ...deleteActions(data,open,"customers",c.id,c.name)
      ])
    ]} />
  </>
}
export function Installations({ data,open }: Props) {
  const [status,setStatus] = useState("")
  const intake = can(data.user.role,"requestJobs")
  const schedules = can(data.user.role,"scheduleJobs")
  return <>
    {(intake || schedules) && <Actions><Add onClick={()=>open({kind:intake ? "installationRequest" : "job"})}>{intake ? "New installation request" : "New installation"}</Add></Actions>}
    <Filtered items={data.jobs} search={j=>fields(j.number,j.title,j.customer,j.technician,j.location,j.sale)}
      filter={j=>!status || j.status===status} empty="No installation jobs found" columns={[
      {label:"Job",cell:j=><><TextLink run={()=>open({kind:"jobDetail",id:j.id})}>{j.title}</TextLink><small className="table-sub">{j.number}</small></>},
      {label:"Customer",cell:j=>j.customer ?? "Walk-in customer"},{label:"Technician",cell:j=>j.technician ?? "Unassigned"},
      {label:"Location",cell:j=>j.location||"—"},{label:"Service date",cell:j=><>{date(j.scheduled)}{j.scheduled && j.status==="Requested" && <small className="table-sub">Preferred</small>}</>},{label:"Status",cell:j=><Badge value={j.status} />},
      rowActions<Job>(j=>j.number,j=>[
        {label:"View installation",icon:Eye,run:()=>open({kind:"jobDetail",id:j.id})},
        ...(schedules ? [editAction(j.status==="Requested" ? "Schedule installation" : "Edit installation",()=>open({kind:"job",record:j}))] :
          !intake ? [editAction("Update status",()=>open({kind:"jobStatus",id:j.id}))] : []),
        ...(!j.sale_id && (j.status==="Scheduled" || j.status==="Cancelled") ? deleteActions(data,open,"installations",j.id,j.title) : [])
      ])
    ]}><Select aria-label="Job status" value={status} onChange={e=>setStatus(e.target.value)}><option value="">All statuses</option>{jobStatuses.map(item=><option key={item}>{item}</option>)}</Select></Filtered>
  </>
}
export function Suppliers({ data,open }: Props) {
  const [tab,setTab] = useState("Suppliers")
  return <>
    <Actions><button className="button secondary" onClick={()=>open({kind:"supplier"})}><Plus size={17} /> Add supplier</button>
      <Add onClick={()=>open({kind:"purchase"})}>Receive purchase</Add></Actions>
    <Tabs tabs={["Suppliers","Purchases"]} value={tab} change={setTab} />
    {tab==="Suppliers" ? <Filtered<Person> key={tab} items={data.suppliers} search={s=>fields(s.name,s.phone,s.email,s.address)} empty="No suppliers found" columns={[
      {label:"Supplier",cell:s=><span className="customer-cell"><span className="avatar mini"><Truck size={16} /></span><strong>{s.name}</strong></span>},
      {label:"Phone",cell:s=>s.phone||"—"},{label:"Email",cell:s=>s.email||"—"},{label:"Address",cell:s=>s.address||"—"},
      rowActions<Person>(s=>s.name,s=>[
        editAction("Edit supplier",()=>open({kind:"supplier",record:s})), ...deleteActions(data,open,"suppliers",s.id,s.name)
      ])
    ]} /> : <Filtered<Purchase> key={tab} items={data.purchases} search={p=>fields(p.number,p.supplier,p.reference)} empty="No purchases found" columns={[
      {label:"Purchase",cell:p=><strong>{p.number}</strong>},{label:"Supplier",cell:p=>p.supplier},{label:"Reference",cell:p=>p.reference||"—"},
      {label:"Received",cell:p=>date(p.created_at)},{label:"Total cost",cell:p=><strong>{money(p.total)}</strong>,numeric:true},
      ...(can(data.user.role,"admin") ? [rowActions<Purchase>(p=>p.number,p=>[
        editAction("Edit reference",()=>open({kind:"purchaseReference",record:p}))
      ])] : [])
    ]} />}
  </>
}

export function ProductDetail({ data, product, open }: Props & { product: Product }) {
  const performance = data.breakdown.products.find(item=>item.product_id===product.id)
  const perUnit = product.cost === undefined ? null : product.price - product.cost
  const profit = performance?.profit ?? 0
  const stocked = product.type === "Stocked"
  return <div className="stack">
    <div className="product-overview">
      <ProductPhoto product={product} large />
      <div><Badge value={availability(product)} />
        <p>{[product.sku,product.category,product.brand].filter(Boolean).join(" · ")}</p>
        {product.description && <p>{product.description}</p>}
      </div>
    </div>
    <div className="detail-summary">
      {stocked && <div><small>Available stock</small><strong>{num(product.on_hand)} {product.unit}</strong></div>}
      <div><small>Selling price / {product.unit}</small><strong>{money(product.price)}</strong></div>
      {product.cost !== undefined && <div><small>Cost / {product.unit}</small><strong>{money(product.cost)}</strong></div>}
      {perUnit !== null && <div><small>{perUnit < 0 ? "Gross loss" : "Gross profit"} / {product.unit}</small><strong className={perUnit < 0 ? "amount-loss" : ""}>{money(perUnit)}</strong></div>}
      {stocked && product.cost !== undefined && <div><small>Stock value</small><strong>{money(product.cost*product.on_hand)}</strong></div>}
    </div>
    {can(data.user.role,"reports") && <div className="product-results">
      <h3>Recorded sales · Last {data.days} days</h3>
      <div className="detail-summary">
        <div><small>Sold less returns</small><strong>{num(performance?.units ?? 0)}</strong></div>
        <div><small>Net sales before tax</small><strong>{money(performance?.sales ?? 0)}</strong></div>
        <div><small>{profit < 0 ? "Gross loss" : "Gross profit"}</small><strong className={profit < 0 ? "amount-loss" : ""}>{money(profit)}</strong></div>
      </div>
    </div>}
    <div className="detail-actions">
      {can(data.user.role,"catalog") && <button className="button secondary" onClick={()=>open({kind:"product",record:product})}><Edit3 size={16} /> Edit product</button>}
      {stocked && can(data.user.role,"inventory") && <button className="button secondary" onClick={()=>open({kind:"stock",record:product})}><Settings2 size={16} /> Adjust stock</button>}
    </div>
  </div>
}

function downloadReport(filename: string, headers: string[], rows: (string | number)[][]) {
  const cell = (value: string | number) => {
    if (typeof value==="number") return value
    const safe = /^[\s]*[=+\-@]|^[\t\r\n]/.test(value) ? "'"+value : value
    return '"'+safe.replaceAll('"','""')+'"'
  }
  const body = [headers,...rows].map(row=>row.map(cell).join(",")).join("\r\n")
  const url = URL.createObjectURL(new Blob([body],{type:"text/csv;charset=utf-8"}))
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = filename+".csv"
  anchor.click()
  setTimeout(()=>URL.revokeObjectURL(url),1000)
}

const breakdownGroups = ["Products","Brands","Categories","Agents"] as const
const breakdownSort = {
  sales: "Highest revenue",
  profit: "Highest gross profit",
  units: "Most units",
  name: "Name A–Z"
} as const

export function Analytics({ data,open }: Props) {
  const [tab,setTab] = useState<string>("Products")
  const [mode,setMode] = useState("Performance")
  const [search,setSearch] = useState("")
  const [sort,setSort] = useState<keyof typeof breakdownSort>("sales")
  const key = tab.toLowerCase() as keyof Snapshot["breakdown"]
  const amounts = data.breakdown[key].filter(item=>fields(item.name,item.sku).toLowerCase().includes(search.trim().toLowerCase()))
    .sort((a,b)=>sort==="name" ? a.name.localeCompare(b.name) : b[sort]-a[sort] || a.name.localeCompare(b.name))
  const { kpi,previous } = data
  const start = reportStart(data.today,data.days)
  const reportDates = date(start)+" – "+date(data.today)
  const profit = kpi.profit ?? 0
  const overhead = kpi.overhead ?? 0
  const net = kpi.net ?? 0
  const margin = kpi.revenue>0 ? (net/kpi.revenue*100).toFixed(1)+"%" : "—"
  const filePrefix = "CSolution-"+start+"-to-"+data.today
  const hasSku = key==="products"

  function exportBreakdown() {
    downloadReport(filePrefix+"-"+key,
      ["Name",...(hasSku ? ["SKU"] : []),"Units","Revenue (TZS)","Gross profit (TZS)"],
      amounts.map(item=>[item.name,...(hasSku ? [item.sku ?? ""] : []),item.units,item.sales,item.profit]))
  }

  function exportDaily() {
    downloadReport(filePrefix+"-daily",
      ["Date","Revenue (TZS)","Payments collected (TZS)","Gross profit (TZS)","Operating expenses (TZS)","Net profit (TZS)"],
      data.series.map(point=>[point.day,point.sales,point.collected,point.profit ?? 0,point.overhead ?? 0,point.net ?? 0]))
  }

  return <div className="analytics-page">
    <section className="metric-grid overview-metrics" aria-label="Financial metrics">
      <Metric label="Sales revenue" value={money(kpi.revenue)} icon={CircleDollarSign} tone="blue"
        change={growth(kpi.revenue,previous.revenue)} note={previous.revenue>0 ? "vs. previous period" : "After returns, excluding tax"} />
      <Metric label="Gross profit" value={money(profit)} icon={ChartNoAxesCombined} tone="cyan"
        change={growth(profit,previous.profit ?? 0)} note={(previous.profit ?? 0)>0 ? "vs. previous period" : "After direct costs"} />
      <Metric label="Operating expenses" value={money(overhead)} icon={ReceiptText} tone="blue" note="Shop overhead in this period" />
      <Metric label="Net profit" value={money(net)} icon={Wallet} tone="teal"
        change={growth(net,previous.net ?? 0)} note={(previous.net ?? 0)>0 ? "vs. previous period" : "After operating expenses"} />
    </section>
    <div className="analytics-toolbar">
      <Tabs tabs={["Performance","Installation costs","Expenses"]} value={mode} change={setMode} />
      <button className="button secondary" disabled={!data.series.length} onClick={exportDaily}><Download size={16} /> Export daily report</button>
    </div>
    {mode==="Performance" ? <div className="stack">
      <div className="analytics-grid">
        <RevenueChart points={data.series} days={data.days} />
        <article className="panel report-statement">
          <div className="panel-head"><div><h2>Profit & loss</h2><p>{reportDates}</p></div></div>
          <dl>
            <div><dt>Sales revenue</dt><dd>{money(kpi.revenue)}</dd></div>
            <div><dt>Direct costs</dt><dd>{money(kpi.revenue-profit)}</dd></div>
            <div className="statement-subtotal"><dt>Gross profit</dt><dd>{money(profit)}</dd></div>
            <div><dt>Operating expenses</dt><dd>{money(overhead)}</dd></div>
            <div className="statement-net"><dt>Net profit</dt><dd>{money(net)}</dd></div>
          </dl>
          <div className="statement-footer"><span>Net margin <strong>{margin}</strong></span><button type="button" className="text-button" onClick={()=>setMode("Expenses")}>View expenses <ChevronRight size={14} /></button></div>
        </article>
      </div>
      <article className="panel">
        <div className="panel-head"><div><h2>Sales breakdown</h2><p>{reportDates}</p></div>
          <button className="button secondary small" disabled={!amounts.length} onClick={exportBreakdown}><Download size={16} /> Export results</button></div>
        <div className="breakdown-filters">
          <Tabs tabs={[...breakdownGroups]} value={tab} change={value=>{ setTab(value);setSearch("") }} />
          <div>
            <SearchBox value={search} change={setSearch} placeholder={hasSku ? "Search name or SKU…" : "Search name…"} />
            <Select aria-label="Sort report" value={sort} onChange={event=>setSort(event.target.value as keyof typeof breakdownSort)}>
              {Object.entries(breakdownSort).map(([value,label])=><option key={value} value={value}>{label}</option>)}
            </Select>
          </div>
        </div>
        <Table key={key+":"+search+":"+sort} rows={amounts.map(item=>({...item,id:item.product_id ?? item.name}))}
          empty={search.trim() ? "No results match your search" : "No transactions in this period"} columns={[
            {label:"Name",cell:r=><>{r.product_id ? <TextLink run={()=>open({kind:"productDetail",id:r.product_id!})}>{r.name}</TextLink> : <strong>{r.name}</strong>}{r.sku && <small className="table-sub">{r.sku}</small>}</>},
            {label:"Units",cell:r=>num(r.units),numeric:true},
            {label:"Revenue",cell:r=>money(r.sales),numeric:true},
            {label:"Gross profit",cell:r=>money(r.profit),numeric:true},
            {label:"Gross margin",cell:r=>r.sales>0 ? (r.profit/r.sales*100).toFixed(1)+"%" : "—",numeric:true}
          ]} />
      </article>
    </div> : mode==="Installation costs" ? <InstallationReport data={data} open={open} /> : <Expenses data={data} open={open} embedded />}
  </div>
}

function InstallationReport({ data,open }: Props) {
  const sales = new Map(data.sales.map(sale=>[sale.id,sale]))
  const jobsPerSale = new Map<string,number>()
  for (const job of data.jobs) {
    if (job.sale_id) jobsPerSale.set(job.sale_id,(jobsPerSale.get(job.sale_id) ?? 0)+1)
  }
  const jobs = data.jobs.map(job=>{
    const sale = job.sale_id ? sales.get(job.sale_id) : undefined
    const shared = Boolean(job.sale_id && (jobsPerSale.get(job.sale_id) ?? 0)>1)
    const direct = (job.extra_cost ?? 0)+(job.material_cost ?? 0)
    return {...job,direct,shared,revenue:sale?.net_revenue ?? 0,
      margin:(sale?.net_revenue ?? 0)-(sale?.net_cost ?? 0)-direct}
  })
  return <div className="stack">
    <p className="report-scope">Installation costs show all recorded costs for each job.</p>
    <Filtered items={jobs} search={j=>fields(j.number,j.title,j.customer)} empty="No installation jobs found" columns={[
      {label:"Job",cell:j=><TextLink run={()=>open({kind:"jobDetail",id:j.id})}>{j.number} · {j.title}</TextLink>},
      {label:"Linked sale",cell:j=>j.sale ?? "—"},{label:"Extra materials",cell:j=>money(j.material_cost ?? 0),numeric:true},
      {label:"Job expenses",cell:j=>money(j.extra_cost ?? 0),numeric:true},{label:"Additional cost",cell:j=>money(j.direct),numeric:true},
      {label:"Linked revenue",cell:j=>j.shared ? "Shared sale" : money(j.revenue),numeric:true},
      {label:"Gross profit",cell:j=>j.shared ? "—" : <strong>{money(j.margin)}</strong>,numeric:true},
      {label:"Status",cell:j=><Badge value={j.status} />}
    ]} />
  </div>
}
export function Settings({ data,open,initialStaff = false }: Props & { initialStaff?: boolean }) {
  const [tab,setTab] = useState(initialStaff ? "Staff & roles" : "Business profile")
  return <>
    <Tabs tabs={["Business profile","Staff & roles","Activity log"]} value={tab} change={setTab} />
    {tab==="Business profile" ? <div className="settings-grid">
      <article className="panel">
        <div className="panel-head"><div><h2>Company information</h2><p>Shown on quotes, invoices and receipts.</p></div>
          <button className="button secondary small" onClick={()=>open({kind:"settings"})}><Edit3 size={15} /> Edit</button></div>
        <dl className="details-list">{[["Business",data.business.name],["Address",data.business.address],["Phone",data.business.phone],
          ["Email",data.business.email],["Currency",data.business.currency],["Invoice prefix",data.business.invoice_prefix]].map(([label,value])=>
          <div key={label}><dt>{label}</dt><dd>{value||"—"}</dd></div>)}</dl>
      </article>
      <article className="panel">
        <div className="panel-head"><div><h2>Data backup</h2><p>{data.user.demo ? "Sign in with an administrator password to download a backup." : "Download a PostgreSQL backup of this shop."}</p></div><span className="metric-icon cyan"><Download size={19} /></span></div>
        <div className="panel-body">{data.user.demo ? <button className="button secondary" disabled><Download size={17} /> Download backup</button> : <a className="button secondary" href="/api/backup" download><Download size={17} /> Download backup</a>}</div>
      </article>
    </div> : tab==="Staff & roles" ? <>
      <Actions><Add onClick={()=>open({kind:"staff"})}>Add staff</Add></Actions>
      <div className="staff-role-cards">
        <article className="panel staff-role-card"><span className="metric-icon blue"><Settings2 size={19} /></span><div><h2>Admin</h2><p>All sales, buying costs, stock, profit, expenses, approvals, staff and settings.</p></div></article>
        <article className="panel staff-role-card"><span className="metric-icon teal"><Users size={19} /></span><div><h2>Front Office</h2><p>Own sales and documents, stock lookup, new customers, payments and installation requests.</p></div></article>
      </div>
      <Filtered<Staff> key={tab} items={data.staff} search={u=>fields(u.name,u.email,u.role)} empty="No staff found" columns={[
        {label:"Staff member",cell:u=><strong>{u.name}</strong>},{label:"Email",cell:u=>u.email},{label:"Role",cell:u=>u.role},
        {label:"Status",cell:u=><Badge value={u.active?"Active":"Inactive"} />},
        rowActions<Staff>(u=>u.name,u=>u.id===data.user.id && data.user.demo ? [] : [
          editAction("Edit staff account",()=>open({kind:"staff",record:u})),
          ...(u.id!==data.user.id ? [{
            label:u.active?"Deactivate account":"Reactivate account",icon:u.active?UserX:UserCheck,destructive:u.active,
            run:()=>open({kind:"staffStatus",id:u.id,title:u.name,active:!u.active})
          }] : [])
        ])
      ]} />
      <PermissionMatrix />
    </> : <Filtered key={tab} items={data.audit} search={a=>fields(a.action,a.detail,a.staff)} empty="No activity recorded" columns={[
      {label:"Action",cell:a=><strong>{a.action}</strong>},{label:"Details",cell:a=>a.detail},{label:"Staff",cell:a=>a.staff},{label:"Time",cell:a=>new Intl.DateTimeFormat("en-GB",{dateStyle:"medium",timeStyle:"short",timeZone:"Africa/Dar_es_Salaam"}).format(new Date(a.created_at))}
    ]} />}
  </>
}

function PermissionMatrix() {
  return <article className="panel permission-matrix">
    <div className="panel-head"><div><h2>Permission matrix</h2><p>Exactly what each role can do. Front Office is limited to the shop counter.</p></div></div>
    <div className="table-scroll">
      <table>
        <thead><tr><th scope="col">Capability</th>{roles.map(role=><th key={role} scope="col" className="matrix-role">{role}</th>)}</tr></thead>
        {capabilityGroups.map(group=><tbody key={group.name}>
          <tr className="matrix-group"><th scope="colgroup" colSpan={roles.length+1}>{group.name}</th></tr>
          {group.items.map(item=><tr key={item.key}>
            <th scope="row" className="matrix-cap">{item.label}</th>
            {roles.map(role=><td key={role} className="matrix-cell">
              {can(role,item.key) ? <span className="matrix-yes" aria-label="Allowed">✓</span> : <span className="matrix-no" aria-label="Not allowed">—</span>}
            </td>)}
          </tr>)}
        </tbody>)}
      </table>
    </div>
  </article>
}

export function CustomerDetail({ data,record,open }: Props & { record:Customer }) {
  const sales = data.sales.filter(s=>s.customer_id===record.id)
  const jobs = data.jobs.filter(j=>j.customer_id===record.id)
  return <div className="stack">
    <div className="detail-summary">
      <div><small>Account type</small><Badge value={record.kind} /></div>
      <div><small>Phone</small><strong>{record.phone||"—"}</strong></div>
      <div><small>Outstanding</small><strong>{money(record.outstanding)}</strong></div>
    </div>
    {record.address && <p className="detail-note">{record.address}</p>}
    <div className="detail-block"><h3><ReceiptText size={17} /> Purchase history</h3>
      {sales.length ? <Table rows={sales} pageSize={5} columns={[
        {label:"Sale",cell:s=><TextLink run={()=>open({kind:"saleDetail",id:s.id})}>{s.number}</TextLink>},
        {label:"Date",cell:s=>date(s.created_at)},{label:"Total",cell:s=>money(s.total),numeric:true},
        {label:"Status",cell:s=><Badge value={s.status} />}
      ]} /> : <Empty title="No sales recorded" icon={ReceiptText} />}</div>
    <div className="detail-block"><h3><RadioTower size={17} /> Installation history</h3>
      {jobs.length ? <Table rows={jobs} pageSize={5} columns={[
        {label:"Job",cell:j=><TextLink run={()=>open({kind:"jobDetail",id:j.id})}>{j.title}</TextLink>},
        {label:"Scheduled",cell:j=>date(j.scheduled)},{label:"Status",cell:j=><Badge value={j.status} />}
      ]} /> : <Empty title="No installations recorded" icon={RadioTower} />}</div>
  </div>
}
