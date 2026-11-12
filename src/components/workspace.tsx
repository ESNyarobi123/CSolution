"use client"

import { useEffect, useEffectEvent, useRef, useState } from "react"
import { Archive, ArchiveRestore, ArrowRight, BadgeCheck, Bell, Box, CalendarDays, ChartNoAxesCombined, Check, ChevronDown, ChevronRight, CircleDollarSign, ClipboardCheck, CreditCard, FileText, LayoutDashboard, Layers3, LogOut, Menu, PackageOpen, Plus, RadioTower, ReceiptText, RefreshCw, Search, Settings2, Store, Trash2, Truck, UserCheck, UserPlus, Users, UserX, Wallet, X, type LucideIcon } from "lucide-react"
import { can, ownSalesOnly, type Capability, type Role } from "@/lib/access"
import { deletableRecords } from "@/lib/management"
import { date, initials, money, num, RequestError, requestJSON } from "@/lib/format"
import type { JobDetail, SaleDetail, Snapshot } from "@/lib/model"
import { Dashboard, reportStart } from "./dashboard"
import { QuoteDocument, SaleDocument } from "./documents"
import { CartForm, ContactForm, ExpenseForm, GroupForm, InstallationRequestForm, JobForm, JobStatusForm, MaterialForm, PaymentForm, ProductForm, PurchaseForm, PurchaseReferenceForm, ReturnForm, SettingsForm, StaffForm, StockForm, type Save } from "./forms"
import { ApprovalDetail, Approvals, FrontOfficeDashboard } from "./front-office"
import { Analytics, CustomerDetail, Customers, Documents, Expenses, Groups, Installations, Inventory, ProductDetail, Products, Sales, Settings, Suppliers, type Panel } from "./screens"
import { ActionMenu, Badge, Brand, Empty, ErrorLine, Form, Modal, SearchBox, Select, Table } from "./ui"

type NavigationGroup = { name: string; links: { id:string; title:string; heading:string; sub:string; icon:LucideIcon; permission?:Capability }[] }
const sections: NavigationGroup[] = [
  { name:"WORKSPACE", links:[
    { id:"overview",title:"Overview",heading:"Business overview",sub:"Track sales, stock and service jobs across your shop.", icon:LayoutDashboard },
    { id:"sales",title:"Sales & POS",heading:"Sales & point of sale",sub:"Sell products and services, and track every payment.", icon:CreditCard, permission:"sales" },
    { id:"documents",title:"Quotations & invoices",heading:"Quotations & invoices",sub:"Create quotes and download invoices and receipts.", icon:ReceiptText, permission:"sales" },
    { id:"customers",title:"Customers & agents",heading:"Customers & agents",sub:"Manage customer profiles, agent pricing and outstanding balances.",icon:Users, permission:"customers" }
  ]},
  { name:"CATALOG & STOCK", links:[
    { id:"products",title:"Products",heading:"Products",sub:"Register products and check available stock, prices and sales.",icon:Box },
    { id:"categories",title:"Categories",heading:"Categories",sub:"Organize your catalog by product category.",icon:Layers3 },
    { id:"brands",title:"Brands",heading:"Brands",sub:"Manage the brands in your catalog.",icon:BadgeCheck },
    { id:"inventory",title:"Inventory",heading:"Inventory",sub:"Check stock levels, reorder thresholds and movement history.",icon:PackageOpen,permission:"inventory" },
    { id:"suppliers",title:"Suppliers & purchases",heading:"Suppliers & purchases",sub:"Manage suppliers and receive stock into the shop.",icon:Truck,permission:"inventory" }
  ]},
  { name:"OPERATIONS", links:[
    { id:"installations",title:"Installations",heading:"Installations",sub:"Assign technicians and track materials and service work.",icon:RadioTower,permission:"viewJobs" },
    { id:"approvals",title:"Approvals",heading:"Approvals",sub:"Review requests for discounts, credit and returns.",icon:ClipboardCheck,permission:"viewApprovals" },
    { id:"expenses",title:"Expenses",heading:"Expenses",sub:"Record operating costs and expenses linked to installation jobs.",icon:CircleDollarSign,permission:"reports" },
    { id:"analytics",title:"Analytics & reports",heading:"Analytics & reports",sub:"Measure revenue, costs and profitability across the shop.",icon:ChartNoAxesCombined,permission:"reports" },
    { id:"settings",title:"Settings",heading:"Settings",sub:"Manage the business profile, staff accounts and backups.",icon:Settings2,permission:"admin" }
  ]}
]

const frontOfficeSections: NavigationGroup[] = [
  { name:"FRONT OFFICE",links:[
    { id:"overview",title:"Overview",heading:"Front Office",sub:"Manage your sales, customers and service requests.",icon:LayoutDashboard },
    { id:"sales",title:"My sales & POS",heading:"My sales & POS",sub:"Create a sale and view your transaction history.",icon:CreditCard },
    { id:"products",title:"Products & stock",heading:"Products & stock",sub:"Check selling prices, product details and available stock.",icon:Box },
    { id:"customers",title:"Customers & agents",heading:"Customers & agents",sub:"Add customers and agents and view your sales with them.",icon:Users },
    { id:"documents",title:"Quotations & invoices",heading:"My quotations & invoices",sub:"Create quotations and access invoices and receipts from your sales.",icon:ReceiptText },
    { id:"payments",title:"Payments",heading:"Payments",sub:"Follow up on open balances and record payments on your invoices.",icon:Wallet }
  ]},
  { name:"REQUESTS",links:[
    { id:"installations",title:"Installation requests",heading:"Installation requests",sub:"Send service requests and check their status.",icon:RadioTower },
    { id:"approvals",title:"Approvals",heading:"My approvals",sub:"Follow up on requests for discounts, credit and returns.",icon:ClipboardCheck }
  ]}
]

function navigationFor(role: Role) {
  return ownSalesOnly(role) ? frontOfficeSections : sections.map(group=>({
    ...group,links:group.links.filter(link=>!link.permission || can(role,link.permission))
  }))
}

const createEntries: { label:string; kind:"sale"|"quote"|"product"|"openingStock"|"categories"|"brands"|"customer"|"supplier"|"job"|"installationRequest"|"expense"|"staff"; icon:LucideIcon; permission:Capability }[] = [
  { label:"New sale",kind:"sale",icon:CreditCard,permission:"sales" },
  { label:"New quotation",kind:"quote",icon:FileText,permission:"sales" },
  { label:"Add product",kind:"product",icon:Box,permission:"catalog" },
  { label:"Register existing stock",kind:"openingStock",icon:PackageOpen,permission:"catalog" },
  { label:"Add category",kind:"categories",icon:Layers3,permission:"catalog" },
  { label:"Add brand",kind:"brands",icon:BadgeCheck,permission:"catalog" },
  { label:"Add customer",kind:"customer",icon:Users,permission:"customers" },
  { label:"Add supplier",kind:"supplier",icon:Truck,permission:"inventory" },
  { label:"New installation",kind:"job",icon:RadioTower,permission:"scheduleJobs" },
  { label:"Installation request",kind:"installationRequest",icon:RadioTower,permission:"requestJobs" },
  { label:"Record expense",kind:"expense",icon:CircleDollarSign,permission:"reports" },
  { label:"Add staff",kind:"staff",icon:UserPlus,permission:"admin" }
]

export function Workspace({ initial }: { initial: Snapshot }) {
  const [data,setData] = useState(initial)
  const [page,setPage] = useState("overview")
  const [panel,setPanel] = useState<Panel | null>(null)
  const [mobile,setMobile] = useState(false)
  const [profile,setProfile] = useState(false)
  const [notice,setNotice] = useState("")
  const [error,setError] = useState("")
  const [updating,setUpdating] = useState(false)
  const generation = useRef(0)
  const autoPending = useRef(false)
  const windowNotice = useRef<ReturnType<typeof setTimeout> | null>(null)
  const available = navigationFor(data.user.role)
  const active = available.flatMap(group=>group.links).find(link=>link.id===page.split("/")[0]) ?? available[0].links[0]
  const activePage = active.id
  const reportPage = activePage==="overview" || activePage==="analytics" || activePage==="approvals"
  const frontOffice = ownSalesOnly(data.user.role)
  const sells = can(data.user.role,"sales")
  const canSeeInventory = can(data.user.role,"inventory")
  const createActions = createEntries
    .filter(entry=>can(data.user.role,entry.permission))
    .map(({label,kind,icon})=>({label,icon,run:()=>open({kind})}))
  const stockAlerts = data.products.filter(p=>p.active&&p.type==="Stocked"&&p.on_hand<=p.reorder).length
  const approvalAlerts = data.approvals.filter(item=>item.status===(frontOffice ? "Approved" : "Pending")).length
  const autoRefresh = useEffectEvent(()=>{
    if (document.visibilityState!=="visible" || panel || updating || autoPending.current) return
    autoPending.current = true
    void refresh().catch(()=>undefined).finally(()=>{ autoPending.current = false })
  })

  useEffect(()=>{
    if (!reportPage || panel) return
    const interval = window.setInterval(autoRefresh,60_000)
    document.addEventListener("visibilitychange",autoRefresh)
    return ()=>{
      window.clearInterval(interval)
      document.removeEventListener("visibilitychange",autoRefresh)
    }
  },[reportPage,panel,data.updatedAt])

  useEffect(()=>{
    const read = ()=>{ setPage(location.hash.slice(1) || "overview"); setMobile(false) }
    read()
    window.addEventListener("hashchange",read)
    const shortcut = (e:KeyboardEvent)=>{
      if ((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==="k") {
        e.preventDefault(); setPanel(p=>p?.kind==="search" ? null : {kind:"search"})
      }
    }
    window.addEventListener("keydown",shortcut)
    return ()=>{ window.removeEventListener("hashchange",read);window.removeEventListener("keydown",shortcut) }
  },[])

  function go(section:string) {
    setPage(section);setMobile(false);setPanel(null);setProfile(false)
    if (section==="overview") history.replaceState(null,"",location.pathname)
    else if (location.hash!=="#"+section) location.hash=section
    window.scrollTo({top:0})
  }
  function open(next:Panel) { setProfile(false);setPanel(next) }
  function notify(message:string) {
    setNotice(message)
    if(windowNotice.current) clearTimeout(windowNotice.current)
    windowNotice.current = setTimeout(()=>setNotice(""),4000)
  }
  async function refresh(days = data.days) {
    const run = ++generation.current
    const next = await requestJSON<Snapshot>("/api/shop?days="+days,{cache:"no-store"})
    if (generation.current===run) setData(next)
    return next
  }
  async function changePeriod(days:number) {
    setError("");setUpdating(true)
    try { await refresh(days) }
    catch (e) { setError(e instanceof Error ? e.message : "Could not update date range.") }
    finally { setUpdating(false) }
  }
  async function signOut() {
    setError("")
    try {
      await requestJSON("/api/auth",{method:"POST",headers:{"content-type":"application/json"},body:'{"action":"logout"}'})
      location.replace("/")
    } catch (e) { setError(e instanceof Error ? e.message : "Could not sign out.") }
  }
  const save: Save = async (body,message="Changes saved")=>{
    const {action} = body as { action?: string }
    let result: { id?:string; number?:string; refund?:number }
    try {
      result = await requestJSON("/api/shop",{
        method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(body)
      })
    } catch (error) {
      if ((panel?.kind==="sale" || panel?.kind==="quote") && error instanceof RequestError && error.status===409) await refresh().catch(()=>undefined)
      throw error
    }
    const refreshResult = await refresh().catch(e=>{ setError(e instanceof Error ? e.message : "Refresh the page to see the saved change.");return undefined })
    if (action==="requestSaleApproval" || action==="requestReturnApproval") go("approvals")
    if (panel?.kind==="quote" && page.split("/")[0]==="documents" && refreshResult?.quotes.some(quote=>quote.id===result.id)) {
      setPage("documents/quotations")
      history.replaceState(null,"","#documents/quotations")
    }
    setPanel(current=>{
      if (!current || current!==panel) return current
      if (action==="completeApprovedSale" && result.id) return {kind:"saleDetail",id:result.id}
      if (current.kind==="sale" && result.id) return {kind:"saleDetail",id:result.id}
      if (current.kind==="quote") {
        const quote = refreshResult?.quotes.find(q=>q.id===result.id)
        if (quote) return {kind:"quoteDetail",record:quote}
      }
      if (current.kind==="payment"||current.kind==="return") return {kind:"saleDetail",id:current.id}
      if (current.kind==="material"||current.kind==="jobStatus") return {kind:"jobDetail",id:current.id}
      return null
    })
    notify(result.refund ? message+" · Refund "+money(result.refund) : message)
    return result
  }

  const screenProps = { data,open }
  const close = ()=>setPanel(null)
  const formProps = { data,close,save }
  const screens = {
    overview:frontOffice ? <FrontOfficeDashboard {...screenProps} go={go} /> :
      <Dashboard data={data} go={go} openSale={id=>open({kind:"saleDetail",id})} openQuote={record=>open({kind:"quoteDetail",record})} openJob={id=>open({kind:"jobDetail",id})} />,
    products:<Products {...screenProps} />, categories:<Groups {...screenProps} kind="categories" />, brands:<Groups {...screenProps} kind="brands" />,
    inventory:<Inventory {...screenProps} initialLow={page==="inventory/low-stock"} />, sales:<Sales {...screenProps} />, documents:<Documents {...screenProps} page={page} go={go} />,
    customers:<Customers {...screenProps} />, installations:<Installations {...screenProps} />, suppliers:<Suppliers {...screenProps} />,
    payments:<Sales {...screenProps} balancesOnly />, approvals:<Approvals {...screenProps} />,
    analytics:<Analytics {...screenProps} />, expenses:<Expenses {...screenProps} />, settings:<Settings {...screenProps} initialStaff={page==="settings/staff"} />
  }
  const showPeriod = !frontOffice&&sells&&(activePage==="overview"||activePage==="analytics"||(activePage==="products"&&can(data.user.role,"reports")))
  const from = reportStart(data.today,data.days)
  const updatedTime = new Intl.DateTimeFormat("en-GB",{hour:"2-digit",minute:"2-digit",second:"2-digit",timeZone:"Africa/Dar_es_Salaam"}).format(new Date(data.updatedAt))
  return <>
    <div className="app-shell">
      {mobile&&<button className="mobile-shade" aria-label="Close menu" onClick={()=>setMobile(false)} />}
      <aside className={`sidebar ${mobile ? "sidebar-open" : ""}`}>
        <a className="brand-link" href="/" onClick={e=>{e.preventDefault();go("overview")}} aria-label="CSolution overview"><Brand light /></a>
        <div className="store-label"><span><Store size={17} /></span><div><strong>Main store</strong><small>Shop workspace</small></div></div>
        <nav aria-label="Main navigation">
          {available.filter(g=>g.links.length).map(group=><div className="nav-group" key={group.name}>
            <h2>{group.name}</h2>
            {group.links.map(link=><a href={link.id==="overview" ? "/" : "#"+link.id} key={link.id} className={activePage===link.id ? "active" : ""}
              aria-current={activePage===link.id ? "page" : undefined} onClick={e=>{e.preventDefault();go(link.id)}}>
              <link.icon size={18} strokeWidth={1.75} /><span>{link.title}</span>{link.id==="inventory"&&stockAlerts>0&&<small>{stockAlerts}</small>}
              {link.id==="approvals"&&approvalAlerts>0&&<small>{approvalAlerts}</small>}
            </a>)}
          </div>)}
        </nav>
        <div className="sidebar-foot"><span /><small>Connect Solutions</small><strong>TZ</strong></div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <div className="breadcrumb">
            <button className="icon-btn mobile-menu" aria-label="Open menu" onClick={()=>setMobile(true)}><Menu size={22} /></button>
            <span>Workspace</span><ChevronRight size={14} /><strong>{active.title}</strong>
          </div>
          <div className="topbar-actions">
            <ActionMenu label="Quick create" caption="Create" icon={Plus} actions={createActions} />
            <button className="global-search" onClick={()=>open({kind:"search"})} aria-label="Search workspace"><Search size={17} /><span>Search workspace</span><kbd>⌘ K</kbd></button>
            <button className="icon-btn alerts-btn" aria-label={stockAlerts+" stock alerts"} title={stockAlerts+" stock alerts"} onClick={()=>go(canSeeInventory?"inventory/low-stock":"products")}><Bell size={19} />{stockAlerts>0&&<i />}</button>
            <div className="topbar-divider" />
            <div className="profile-wrap">
              <button className="profile-btn" onClick={()=>setProfile(!profile)} aria-expanded={profile} aria-label="Account menu">
                <span className="avatar">{initials(data.user.name)}</span>
                <span className="profile-name"><strong>{data.user.name}</strong><small>{data.user.role}</small></span><ChevronDown size={15} />
              </button>
              {profile&&<div className="profile-menu"><div><strong>{data.user.name}</strong><small>{data.user.email}</small></div>
                <button onClick={()=>void signOut()}><LogOut size={16} /> Sign out</button></div>}
            </div>
          </div>
        </header>
        <main className="main-area">
          <div className="page-heading">
            <div><div className="page-context"><span /> {data.user.demo ? "DEMO WORKSPACE" : "MAIN STORE"}</div>
              <h1>{active.heading}</h1><p>{active.sub}</p></div>
            {(reportPage||showPeriod||["sales","documents","expenses"].includes(activePage))&&<div className="heading-actions">
              {showPeriod&&<div className="period-picker" title={date(from)+" – "+date(data.today)}><CalendarDays size={17} />
                <Select aria-label="Date range" value={data.days} disabled={updating} onChange={e=>void changePeriod(Number(e.target.value))}>
                  <option value={7}>Last 7 days</option><option value={14}>Last 14 days</option><option value={30}>Last 30 days</option><option value={90}>Last 90 days</option>
                </Select></div>}
              {sells&&((activePage==="overview"&&!frontOffice)||activePage==="sales")&&<button className="button primary" onClick={()=>open({kind:"sale"})}><Plus size={19} /> New sale</button>}
              {activePage==="documents"&&<button className="button primary" onClick={()=>open({kind:"quote"})}><Plus size={19} /> New quotation</button>}
              {(activePage==="expenses"||activePage==="analytics")&&<button className="button primary" onClick={()=>open({kind:"expense"})}><Plus size={19} /> Record expense</button>}
            </div>}
          </div>
          <ErrorLine message={error} />
          {reportPage&&<div className="report-refresh">
            <span><i />Auto refresh · 1 min</span><time dateTime={data.updatedAt}>Updated {updatedTime}</time>
            <button className="text-button" type="button" disabled={updating} onClick={()=>void changePeriod(data.days)}><RefreshCw size={13} /> {updating ? "Updating…" : "Refresh now"}</button>
          </div>}
          <div className="page-body" key={page}>{screens[activePage as keyof typeof screens]}</div>
          <footer className="main-footer"><span>CSolution · {data.business.name}</span><span>Dar es Salaam time · TZS</span></footer>
        </main>
      </div>
    </div>
    {panel&&<WorkspaceModal key={panel.kind+("id" in panel?panel.id:"")} panel={panel} close={close} open={open} go={go} formProps={formProps} />}
    {notice&&<div className="toast" role="status"><span><Check size={16} /></span>{notice}<button className="icon-btn" aria-label="Dismiss notice" onClick={()=>setNotice("")}><X size={17} /></button></div>}
  </>
}

function WorkspaceModal({ panel, close, open, go, formProps }: {
  panel:Panel;close:()=>void;open:(panel:Panel)=>void;go:(page:string)=>void;
  formProps:{data:Snapshot;close:()=>void;save:Save}
}) {
  const {data} = formProps
  const modal = (title:string, children:React.ReactNode, wide=false, subtitle?:string)=>
    <Modal title={title} close={close} wide={wide} subtitle={subtitle}>{children}</Modal>
  const edit = (name:string) => ("record" in panel && panel.record ? "Edit " : "Add ")+name
  switch(panel.kind) {
    case "categories":
    case "brands": return modal(edit(panel.kind==="brands"?"brand":"category"),<GroupForm {...formProps} kind={panel.kind} record={panel.record} />)
    case "product": return modal(edit("product"),<ProductForm {...formProps} record={panel.record} />,true)
    case "openingStock": return modal("Register existing stock",<ProductForm {...formProps} opening />,true,"Enter the stock you counted for a product you are registering for the first time.")
    case "productDetail": {
      const product = data.products.find(item=>item.id===panel.id)
      return product ? modal(product.name,<ProductDetail data={data} product={product} open={open} />,true) :
        modal("Product details",<Empty title="Product could not be found" />)
    }
    case "customer": return modal(edit("customer"),<ContactForm {...formProps} kind="customer" record={panel.record} allowAgentCode={can(data.user.role,"manageCustomers")} />)
    case "supplier": return modal(edit("supplier"),<ContactForm {...formProps} kind="supplier" record={panel.record} />)
    case "stock": return modal("Adjust stock",<StockForm {...formProps} product={panel.record} />)
    case "purchase": return modal("Receive purchase",<PurchaseForm {...formProps} />,true)
    case "sale": return <Modal title={panel.record ? "Convert "+panel.record.number : "New sale"} close={close} checkout>
      <CartForm {...formProps} mode="sale" quote={panel.record} />
    </Modal>
    case "quote": return <Modal title={panel.record ? "Edit "+panel.record.number : "New quotation"} close={close} checkout>
      <CartForm {...formProps} mode="quote" quote={panel.record} />
    </Modal>
    case "job": return modal(panel.record?"Edit installation":"New installation",<JobForm {...formProps} record={panel.record} />,true)
    case "installationRequest": return modal("New installation request",<InstallationRequestForm {...formProps} />,true)
    case "approvalDetail": {
      const approval = data.approvals.find(item=>item.id===panel.id)
      return modal(approval?.kind==="Return" ? "Return approval" : "Sale terms approval",approval ?
        <ApprovalDetail {...formProps} approval={approval} open={open} /> : <Empty title="Approval request could not be found" />,true)
    }
    case "expense": return modal(panel.record ? "Edit expense" : "Record expense",<ExpenseForm {...formProps} job={panel.job} record={panel.record} />)
    case "expenseDetail": {
      const expense = panel.record
      return modal(expense.description,<div className="stack">
        <div className="detail-summary">
          <div><small>Amount</small><strong>{money(expense.amount)}</strong></div>
          <div><small>Date</small><strong>{date(expense.incurred)}</strong></div>
          <div><small>Category</small><strong>{expense.category}</strong></div>
        </div>
        <dl className="details-list">
          <div><dt>Scope</dt><dd>{expense.job ?? "Operating expense"}</dd></div>
          <div><dt>Payment method</dt><dd>{expense.method ?? "—"}</dd></div>
          <div><dt>Reference</dt><dd>{expense.reference || "—"}</dd></div>
          {expense.notes && <div><dt>Notes</dt><dd className="expense-note">{expense.notes}</dd></div>}
        </dl>
        {can(data.user.role,"admin") && <div className="detail-actions"><button className="button secondary" onClick={()=>open({kind:"expense",record:expense})}>Edit expense</button></div>}
      </div>)
    }
    case "purchaseReference": return modal("Edit purchase reference",<PurchaseReferenceForm {...formProps} record={panel.record} />,false,panel.record.number)
    case "deleteRecord": {
      const label = "Delete "+deletableRecords[panel.record]
      const description = panel.record==="expenses" ?
        "This permanently removes the expense from reports. Its original amount will be recorded in the activity log." :
        "This permanently removes the record. The deletion will appear in the activity log."
      return modal(label,<ConfirmAction close={close} save={formProps.save} label={label} busyLabel="Deleting…" icon={Trash2}
        title={panel.title} description={description} action={{action:"deleteRecord",record:panel.record,id:panel.id}} message="Record deleted" destructive />)
    }
    case "productStatus": {
      const label = panel.active ? "Restore product" : "Archive product"
      return modal(label,<ConfirmAction close={close} save={formProps.save} label={label} icon={panel.active ? ArchiveRestore : Archive}
        title={panel.title} description={panel.active ? "The product will be available for sale again." : "The product will be hidden from the POS. Its transaction history stays available."}
        action={{action:"productStatus",id:panel.id,active:panel.active}} message={panel.active ? "Product restored" : "Product archived"} />)
    }
    case "staffStatus": {
      const label = panel.active ? "Reactivate account" : "Deactivate account"
      return modal(label,<ConfirmAction close={close} save={formProps.save} label={label} icon={panel.active ? UserCheck : UserX}
        title={panel.title} description={panel.active ? "This staff member can sign in again with their existing password." :
          "This staff member will be signed out and will lose access until the account is reactivated."}
        action={{action:"staffStatus",id:panel.id,active:panel.active}} message={panel.active ? "Staff account reactivated" : "Staff account deactivated"} destructive={!panel.active} />)
    }
    case "staff": return modal(edit("staff account"),<StaffForm {...formProps} record={panel.record} />)
    case "settings": return modal("Edit company information",<SettingsForm {...formProps} />)
    case "customerDetail": return modal(panel.record.name,<CustomerDetail data={data} record={panel.record} open={open} />,true,panel.record.code ?? undefined)
    case "quoteDetail": {
      const quote = panel.record
      return modal(quote.number,<>
        <div className="quote-actions">
          <Badge value={quote.sale_id?"Converted":quote.valid_until&&quote.valid_until<data.today?"Expired":"Open"} />
          {quote.sale_id ? <button className="button secondary small" onClick={()=>open({kind:"saleDetail",id:quote.sale_id!})}>View sale <ArrowRight size={16} /></button> :
            (!quote.valid_until || quote.valid_until>=data.today) && <button className="button secondary small" onClick={()=>open({kind:"sale",record:quote})}>Convert to sale <ArrowRight size={16} /></button>}
        </div>
        <QuoteDocument quote={quote} business={data.business} />
      </>,true)
    }
    case "saleDetail":
    case "invoice":
    case "receipt":
    case "payment":
    case "return": return modal(({saleDetail:"Sale details",invoice:"Invoice",receipt:"Receipt",payment:"Record payment",return:can(data.user.role,"requestApprovals") ? "Request return" : "Record return"})[panel.kind],
      <LoadDetail<SaleDetail> type="sale" id={panel.id}>{detail=>{
        switch(panel.kind) {
          case "invoice":
          case "receipt": return <SaleDocument detail={detail} business={data.business} kind={panel.kind} />
          case "payment": return <PaymentForm {...formProps} close={()=>open({kind:"saleDetail",id:panel.id})} sale={detail.sale} />
          case "return": return <ReturnForm {...formProps} close={()=>open({kind:"saleDetail",id:panel.id})} detail={detail} approval={can(data.user.role,"requestApprovals")} />
          default: return <SaleView detail={detail} data={data} open={open} />
        }
      }}</LoadDetail>,panel.kind!=="payment"&&panel.kind!=="return")
    case "jobDetail":
    case "material":
    case "jobStatus": return modal(({jobDetail:"Installation details",material:"Record extra materials",jobStatus:"Update job status"})[panel.kind],
      <LoadDetail<JobDetail> type="job" id={panel.id}>{detail=>{
        if(panel.kind==="material") return <MaterialForm {...formProps} close={()=>open({kind:"jobDetail",id:panel.id})} detail={detail} />
        if(panel.kind==="jobStatus") return <JobStatusForm {...formProps} close={()=>open({kind:"jobDetail",id:panel.id})} job={detail.job} />
        return <JobView detail={detail} data={data} open={open} />
      }}</LoadDetail>,panel.kind==="jobDetail")
    case "search": return modal("Search workspace",<SearchWorkspace data={data} go={go} open={open} />)
  }
}

function ConfirmAction({ close,save,label,busyLabel,icon:Icon,title,description,action,message,destructive }: {
  close:()=>void;save:Save;label:string;busyLabel?:string;icon:LucideIcon;title:string;
  description:string;action:object;message:string;destructive?:boolean
}) {
  return <Form close={close} label={label} busyLabel={busyLabel} destructive={destructive} onSave={()=>save(action,message)}>
    <div className="confirm-card"><span className="metric-icon blue"><Icon size={19} aria-hidden="true" /></span>
      <div><strong>{title}</strong><p>{description}</p></div>
    </div>
  </Form>
}

function LoadDetail<T>({ type,id,children }: { type:"sale"|"job";id:string;children:(data:T)=>React.ReactNode }) {
  const [record,setRecord] = useState<T>()
  const [error,setError] = useState("")
  useEffect(()=>{
    const abort=new AbortController()
    void requestJSON<T>("/api/shop?detail="+type+"&id="+id,{signal:abort.signal}).then(setRecord).catch(e=>{
      if (!abort.signal.aborted) setError(e instanceof Error ? e.message : "Could not open record.")
    })
    return ()=>abort.abort()
  },[type,id])
  return record ? children(record) : error ? <ErrorLine message={error} /> : <p className="loading" role="status">Loading record…</p>
}
function SaleView({ detail,data,open }: { detail:SaleDetail;data:Snapshot;open:(panel:Panel)=>void }) {
  const s=detail.sale
  const grossProfit = s.net_cost === undefined ? null : s.net_revenue - s.net_cost
  return <div className="stack">
    <div className="record-title"><div><h3>{s.number} · {s.customer_name}</h3><p>{s.buyer_type} · {s.kind} · {date(s.created_at)} · {s.cashier}</p></div><Badge value={s.status} /></div>
    <div className="detail-summary">
      <div><small>Sale total</small><strong>{money(s.total)}</strong></div><div><small>Paid</small><strong>{money(s.paid)}</strong></div>
      <div><small>Balance due</small><strong>{money(s.balance)}</strong></div>
      {s.credits>0&&<div><small>Return credits</small><strong>{money(s.credits)}</strong></div>}
    </div>
    {grossProfit !== null && <div className="detail-summary">
      <div><small>Net sales before tax</small><strong>{money(s.net_revenue)}</strong></div>
      <div><small>Cost of items</small><strong>{money(s.net_cost ?? 0)}</strong></div>
      <div><small>{grossProfit < 0 ? "Gross loss" : "Gross profit"}</small><strong className={grossProfit < 0 ? "amount-loss" : ""}>{money(grossProfit)}</strong></div>
    </div>}
    <div className="detail-actions">
      <button className="button secondary small" onClick={()=>open({kind:"invoice",id:s.id})}><FileText size={16} /> View invoice</button>
      {s.paid>0&&<button className="button secondary small" onClick={()=>open({kind:"receipt",id:s.id})}><ReceiptText size={16} /> View receipt</button>}
      {s.balance>0&&<button className="button primary small" onClick={()=>open({kind:"payment",id:s.id})}><Plus size={16} /> Record payment</button>}
      {(can(data.user.role,"pricing")||can(data.user.role,"requestApprovals"))&&detail.lines.some(line=>line.returned<line.quantity)&&
        <button className="button secondary small" onClick={()=>open({kind:"return",id:s.id})}>{can(data.user.role,"requestApprovals") ? "Request return" : "Record return"}</button>}
    </div>
    <div className="detail-block"><h3>Items</h3><Table rows={detail.lines} columns={[
      {label:"Item",cell:l=><><strong>{l.name}</strong><small className="table-sub">{l.serial ? "S/N "+l.serial : l.sku}{l.returned>0 ? " · "+l.returned+" returned" : ""}</small>{l.warranty_until && <small className="table-sub">Warranty until {date(l.warranty_until)}</small>}</>},
      {label:"Quantity",cell:l=>num(l.quantity)+" "+l.unit},{label:"Unit price",cell:l=>money(l.price),numeric:true},
      ...(can(data.user.role,"reports")?[{label:"Unit cost",cell:(l:SaleDetail["lines"][number])=>money(l.cost??0),numeric:true}]:[]),
      {label:"Total",cell:l=><strong>{money(l.price*l.quantity)}</strong>,numeric:true}
    ]} /></div>
    {detail.payments.length>0&&<div className="detail-block"><h3>Payments</h3><Table rows={detail.payments} columns={[
      {label:"Method",cell:p=>p.method},{label:"Reference",cell:p=>p.reference||"—"},{label:"Date",cell:p=>date(p.created_at)},{label:"Amount",cell:p=>money(p.amount),numeric:true}
    ]} /></div>}
    {detail.returns.length>0&&<div className="detail-block"><h3>Returns</h3><Table rows={detail.returns} columns={[
      {label:"Product",cell:r=>r.product},{label:"Quantity",cell:r=>r.quantity},{label:"Reason",cell:r=>r.reason},
      {label:"Credit",cell:r=>money(r.credit),numeric:true},{label:"Refund",cell:r=>money(r.refund),numeric:true}
    ]} /></div>}
  </div>
}
function JobView({ detail,data,open }: { detail:JobDetail;data:Snapshot;open:(panel:Panel)=>void }) {
  const j=detail.job
  const manager = can(data.user.role,"scheduleJobs")
  const handlesJobs = can(data.user.role,"jobs")
  const canOpenSale = data.sales.some(sale=>sale.id===j.sale_id)
  return <div className="stack">
    <div className="record-title"><div><h3>{j.title}</h3><p>{j.number} · {j.customer ?? "Walk-in customer"}</p></div><Badge value={j.status} /></div>
    <div className="detail-summary">
      <div><small>Technician</small><strong>{j.technician??"Unassigned"}</strong></div>
      <div><small>{j.status==="Requested" ? "Preferred date" : "Scheduled"}</small><strong>{date(j.scheduled)}</strong></div>
      <div><small>Location</small><strong>{j.location||"—"}</strong></div>
      {j.sale && <div><small>Linked sale</small>{canOpenSale && j.sale_id ?
        <button className="text-button" onClick={()=>open({kind:"saleDetail",id:j.sale_id!})}>{j.sale}</button> : <strong>{j.sale}</strong>}</div>}
    </div>
    {j.notes&&<p className="detail-note">{j.notes}</p>}
    <div className="detail-actions">
      {handlesJobs && <button className="button secondary small" onClick={()=>open(manager?{kind:"job",record:j}:{kind:"jobStatus",id:j.id})}>
        {manager ? j.status==="Requested" ? "Schedule installation" : "Edit job" : "Update status"}</button>}
      {handlesJobs && j.status!=="Requested"&&j.status!=="Completed"&&j.status!=="Cancelled"&&<button className="button primary small" onClick={()=>open({kind:"material",id:j.id})}><Plus size={16} /> Add material</button>}
      {can(data.user.role,"reports")&&<button className="button secondary small" onClick={()=>open({kind:"expense",job:j})}><Plus size={16} /> Record expense</button>}
    </div>
    <div className="detail-block"><h3>Materials & equipment</h3><Table rows={detail.materials} empty="No materials recorded" columns={[
      {label:"Item",cell:m=><strong>{m.name}</strong>},{label:"Source",cell:m=>m.from_sale?"Linked sale":"Extra stock"},
      {label:"Quantity",cell:m=>num(m.quantity)},{label:"Serial",cell:m=>m.serial||"—"}
    ]} /></div>
    {detail.expenses.length>0&&<div className="detail-block"><h3>Job expenses</h3><Table rows={detail.expenses} columns={[
      {label:"Expense",cell:e=>e.description},{label:"Date",cell:e=>date(e.incurred)},{label:"Amount",cell:e=>money(e.amount),numeric:true}
    ]} /></div>}
  </div>
}
function SearchWorkspace({ data,go,open }: { data:Snapshot;go:(section:string)=>void;open:(panel:Panel)=>void }) {
  const [query,setQuery] = useState("")
  const links = navigationFor(data.user.role).flatMap(group=>group.links)
  const text = query.trim().toLowerCase()
  const matches = [
    ...links.map(l=>({ id:l.id,title:l.title,sub:"Page",Icon:l.icon,run:()=>go(l.id) })),
    ...data.sales.map(s=>({id:s.id,title:s.number+" · "+s.customer_name,sub:s.invoice,Icon:ReceiptText,run:()=>open({kind:"saleDetail",id:s.id})})),
    ...data.products.map(p=>({id:p.id,title:p.name,sub:p.sku,Icon:Box,run:()=>open({kind:"productDetail",id:p.id})})),
    ...data.customers.map(c=>({id:c.id,title:c.name,sub:c.code??c.kind,Icon:Users,run:()=>open({kind:"customerDetail",record:c})})),
    ...data.jobs.map(j=>({id:j.id,title:j.title,sub:j.number,Icon:RadioTower,run:()=>open({kind:"jobDetail",id:j.id})}))
  ].filter(r=>!text ? r.sub==="Page" : (r.title+" "+r.sub).toLowerCase().includes(text)).slice(0,9)
  return <div className="stack">
    <SearchBox value={query} change={setQuery} placeholder="Search pages, sales, products…" />
    {matches.length ? <div className="search-results">{matches.map(r=><button className="search-result" key={r.id} onClick={r.run}>
      <span className="metric-icon blue"><r.Icon size={17} /></span><span><strong>{r.title}</strong><small>{r.sub}</small></span><ChevronRight size={16} />
    </button>)}</div> : <Empty title="No matches found" icon={Search} />}
  </div>
}
