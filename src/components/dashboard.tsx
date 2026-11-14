"use client"

import { useId, useState, type ReactNode } from "react"
import { ArrowDownRight, ArrowRight, ArrowUpRight, CalendarDays, ChartNoAxesCombined, CheckCircle2, CircleDollarSign, ClipboardCheck, FileClock, Layers3, PackageOpen, PenLine, RadioTower, ReceiptText, TriangleAlert, Wallet, type LucideIcon } from "lucide-react"
import { can } from "@/lib/access"
import { date, dayLabel, initials, money, num, short, shopDay } from "@/lib/format"
import type { Quote, Sale, SeriesPoint, Snapshot } from "@/lib/model"
import { Badge, Empty, Select, Table } from "./ui"

export const growth = (value: number, prior: number) => prior > 0 ? (value-prior)/prior*100 : undefined
const offsetDay = (day: string, offset: number) =>
  new Date(Date.parse(day)+offset*86400000).toISOString().slice(0,10)
export const reportStart = (today: string, days: number) => offsetDay(today,1-days)

export function Metric({ label, value, icon: Icon, tone, change, note, href }: {
  label: string; value: string; icon: LucideIcon; tone: string; change?: number; note: ReactNode; href?: string
}) {
  const Card = href ? "a" : "article"
  return <Card className="metric" href={href}>
    <div className="metric-top"><span className={`metric-icon ${tone}`}><Icon size={18} strokeWidth={1.9} /></span><span>{label}</span>
      {href && <ArrowRight className="metric-arrow" size={14} aria-hidden="true" />}</div>
    <strong>{value}</strong>
    <div className="metric-note">
      {change !== undefined && <span className={`metric-change ${change < 0 ? "decline" : ""}`}>
        {change < 0 ? <ArrowDownRight size={13} /> : change > 0 ? <ArrowUpRight size={13} /> : null}
        {change > 0 ? "+" : change < 0 ? "−" : ""}{Math.abs(change).toFixed(1)}%
      </span>}
      {typeof note==="string" ? <span>{note}</span> : note}
    </div>
  </Card>
}

const chartModes = {
  sales: { label:"Sales revenue", title:"Sales performance", detail:"Revenue after returns, excluding tax." },
  collected: { label:"Payments collected", title:"Payment collections", detail:"Payments less refunds, by the date money moved." },
  net: { label:"Net profit", title:"Net profit trend", detail:"Gross profit less operating expenses." }
} as const
type ChartMode = keyof typeof chartModes

export function RevenueChart({ points, days }: { points: SeriesPoint[]; days: number }) {
  const chartId = useId()
  const [mode,setMode] = useState<ChartMode>("sales")
  const [selected,setSelected] = useState<string | null>(null)
  const activeIndex = points.findIndex(point=>point.day===selected)
  const index = activeIndex<0 ? points.length-1 : activeIndex
  const active = points[index]
  const showGross = mode==="sales" && points[0]?.profit!==undefined
  const values = points.flatMap(point=>showGross ? [point.sales,point.profit ?? 0] : [point[mode] ?? 0])
  const top = Math.max(0,...values)
  const bottom = Math.min(0,...values)
  const stepBase = 10 ** Math.floor(Math.log10(Math.max((top-bottom)/4,1)))
  const tickStep = [1,2,2.5,5,10].map(factor=>factor*stepBase).find(value=>value>=(top-bottom)/4) ?? stepBase
  const min = Math.floor(bottom/tickStep)*tickStep
  const max = Math.ceil(top/tickStep)*tickStep || (bottom<0 ? 0 : tickStep*4)
  const ticks = Array.from({length:Math.round((max-min)/tickStep)+1},(_,i)=>max-i*tickStep)
  const y = (amount: number) => 165*(max-amount)/(max-min)+9
  const x = (n: number) => 16+768*n/Math.max(points.length-1,1)
  const coords = (field: ChartMode | "profit") => points.map((point,n)=>`${x(n)},${y(point[field] ?? 0)}`).join(" ")
  const area = points.length ? `${x(0)},${y(0)} ${coords(mode)} ${x(points.length-1)},${y(0)}` : ""
  const marks = Array.from({length:Math.min(points.length,5)},(_,i)=>Math.round(i*(points.length-1)/Math.max(Math.min(points.length,5)-1,1)))
  const config = chartModes[mode]

  return <article className="panel revenue-panel">
    <div className="panel-head">
      <div><h2>{config.title}</h2><p>{config.detail}</p></div>
      <Select className="chart-mode" aria-label="Chart metric" value={mode} onChange={event=>setMode(event.target.value as ChartMode)}>
        <option value="sales">Sales revenue</option>
        <option value="collected">Payments collected</option>
        {points[0]?.net!==undefined && <option value="net">Net profit</option>}
      </Select>
    </div>
    {active ? <>
      <div className="chart-readout">
        <div className="chart-value" aria-live="polite"><span>{date(active.day)}</span><strong>{money(active[mode] ?? 0)}</strong>
          {showGross && <span className="chart-profit">Gross profit {money(active.profit ?? 0)}</span>}</div>
        <div className="chart-legend"><span><i />{config.label}</span>{showGross && <span><i />Gross profit</span>}</div>
      </div>
      <div className="chart-layout">
        <div className="chart-labels" aria-hidden="true">{ticks.map(tick=><span key={tick} style={{top:`${y(tick)/180*100}%`}}>{short(tick)}</span>)}</div>
        <div className="chart-main">
          <div className="chart-drawing">
            <svg viewBox="0 0 800 180" preserveAspectRatio="none" aria-hidden="true">
              <defs><linearGradient id={chartId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--blue)" stopOpacity=".22" /><stop offset="100%" stopColor="var(--cyan)" stopOpacity=".025" />
              </linearGradient></defs>
              {ticks.map(tick=><line key={tick} x1="0" x2="800" y1={y(tick)} y2={y(tick)} stroke="var(--line)" strokeDasharray={tick===0 ? undefined : "5 5"} vectorEffect="non-scaling-stroke" />)}
              <polygon points={area} fill={`url(#${chartId})`} />
              {showGross && <polyline points={coords("profit")} fill="none" stroke="var(--teal)" strokeWidth="2.5" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />}
              <polyline points={coords(mode)} fill="none" stroke="var(--blue)" strokeWidth="3" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
              <line x1={x(index)} x2={x(index)} y1="4" y2="176" stroke="var(--blue)" strokeOpacity=".38" strokeDasharray="4 4" vectorEffect="non-scaling-stroke" />
            </svg>
            <span className="chart-marker" aria-hidden="true" style={{left:`${x(index)/8}%`,top:`${y(active[mode] ?? 0)/1.8}%`}} />
            <div className="chart-targets" onPointerLeave={event=>{ if (event.pointerType==="mouse") setSelected(null) }}>
              {points.map((point,i)=><button type="button" key={point.day} tabIndex={i===index ? 0 : -1}
                onPointerEnter={event=>{ if (event.pointerType==="mouse") setSelected(point.day) }}
                onFocus={()=>setSelected(point.day)} onClick={()=>setSelected(point.day)}
                onKeyDown={event=>{
                  const next = event.key==="ArrowLeft" ? i-1 : event.key==="ArrowRight" ? i+1 : event.key==="Home" ? 0 : event.key==="End" ? points.length-1 : null
                  if (next===null) return
                  event.preventDefault()
                  const target = event.currentTarget.parentElement?.children[Math.max(0,Math.min(points.length-1,next))]
                  if (target instanceof HTMLElement) target.focus()
                }}
                aria-label={`${date(point.day)}, ${config.label} ${money(point[mode] ?? 0)}${showGross ? ", gross profit "+money(point.profit ?? 0) : ""}`} />)}
            </div>
          </div>
          <div className="chart-dates" aria-hidden="true">{marks.map(i=><span key={i}>{dayLabel(points[i].day)}</span>)}</div>
        </div>
      </div>
    </> : <Empty title={`No data for the last ${days} days`} icon={ChartNoAxesCombined} />}
  </article>
}

export function Dashboard({ data, go, openSale, openQuote, openJob }: {
  data: Snapshot; go: (section: string) => void; openSale: (id: string) => void; openQuote: (quote: Quote) => void; openJob: (id: string) => void
}) {
  const { kpi,previous } = data
  const sells = can(data.user.role,"sales")
  const reports = can(data.user.role,"reports")
  const reviewsApprovals = can(data.user.role,"reviewApprovals")
  const tracksJobs = can(data.user.role,"jobs")
  const low = data.products.filter(product=>product.active && product.type==="Stocked" && product.on_hand<=product.reorder)
    .sort((a,b)=>a.on_hand-b.on_hand)
  const outOfStock = low.filter(product=>product.on_hand===0).length
  const overdue = data.sales.filter(sale=>sale.balance>0 && sale.due_date && sale.due_date<data.today)
    .sort((a,b)=>(a.due_date ?? "").localeCompare(b.due_date ?? ""))
  const quoteDeadline = offsetDay(data.today,7)
  const dueQuotes = data.quotes.filter(quote=>!quote.sale_id && quote.valid_until && quote.valid_until>=data.today && quote.valid_until<=quoteDeadline)
    .sort((a,b)=>(a.valid_until ?? "").localeCompare(b.valid_until ?? ""))
  const jobs = data.jobs.filter(job=>job.status==="Scheduled" || job.status==="In progress")
    .sort((a,b)=>(a.scheduled ?? "9999").localeCompare(b.scheduled ?? "9999"))
  const lateJobs = jobs.filter(job=>job.scheduled && job.scheduled<data.today)
  const pendingJobs = can(data.user.role,"scheduleJobs") ? data.jobs.filter(job=>job.status==="Requested") : []
  const pendingApprovals = data.approvals.filter(item=>item.status==="Pending").length
  const negotiations = data.approvals.filter(approval=>approval.kind==="Sale terms" &&
    approval.summary.items.some(item=>item.listPrice!==undefined && item.price<item.listPrice))
  const waitingNegotiations = negotiations.filter(approval=>approval.status==="Pending").length
  const approvedNegotiations = negotiations.filter(approval=>approval.status==="Approved" || approval.status==="Completed").length
  const todayResults = data.series.at(-1)
  const todayExpenses = (todayResults?.overhead ?? 0)+(todayResults?.installationExpenses ?? 0)
  const start = reportStart(data.today,data.days)
  const periodSales = data.sales.filter(sale=>{
    const day = shopDay(sale.created_at)
    return day>=start && day<=data.today
  })
  const inventoryPage = can(data.user.role,"inventory") ? "inventory/low-stock" : "products"
  return <div className="dashboard">
    <section className="overview-banner" aria-label="Shop overview">
      <div className="rings" aria-hidden="true"><i /><i /><i /></div>
      <div className="overview-banner-copy">
        <span className="overview-banner-date"><CalendarDays size={15} />{date(start)} – {date(data.today)}</span>
        <h2>{data.business.name}</h2>
        <p>{sells ? `${num(kpi.saleCount)} ${kpi.saleCount===1 ? "sale" : "sales"} in this period` : `${num(kpi.stockCount)} active stocked products`}</p>
      </div>
      <div className="overview-banner-actions">
        {reports && <button type="button" onClick={()=>go("analytics")}><ChartNoAxesCombined size={17} /> View reports <ArrowRight size={15} /></button>}
        {reports && <button type="button" onClick={()=>go("expenses")}><Wallet size={17} /> Company expenses <ArrowRight size={15} /></button>}
        {sells && <button type="button" onClick={()=>go("documents")}><ReceiptText size={17} /> Documents <ArrowRight size={15} /></button>}
        {!sells && <button type="button" onClick={()=>go("products")}><PackageOpen size={17} /> Products <ArrowRight size={15} /></button>}
      </div>
    </section>

    <section className={`metric-grid overview-metrics ${reports && reviewsApprovals ? "overview-admin-metrics" : ""}`} aria-label="Shop metrics">
      {sells && <Metric label="Sales revenue" value={money(kpi.revenue)} icon={CircleDollarSign} tone="blue"
        change={growth(kpi.revenue,previous.revenue)} note={previous.revenue>0 ? "vs. previous period" : "After returns, excluding tax"} />}
      {sells && <Metric label="Payments collected" value={money(kpi.collected)} icon={Wallet} tone="cyan"
        change={growth(kpi.collected,previous.collected)} note={previous.collected>0 ? "vs. previous period" : "Payments less refunds"} />}
      {kpi.net!==undefined && <Metric label="Net profit" value={money(kpi.net)} icon={ChartNoAxesCombined} tone="teal"
        change={growth(kpi.net,previous.net ?? 0)} note={(previous.net ?? 0)>0 ? "vs. previous period" : "After operating expenses"} />}
      <Metric label={kpi.stockValue===undefined ? "Stocked products" : "Stock value"} value={kpi.stockValue===undefined ? num(kpi.stockCount) : money(kpi.stockValue)}
        icon={Layers3} tone="green" note={kpi.stockValue===undefined ? "Active inventory SKUs" : num(kpi.stockCount)+" active SKUs · at cost"} />
      {reports && <Metric label="Expenses today" value={money(todayExpenses)} icon={ReceiptText} tone="teal"
        note="Operating & installation expenses" href="#expenses" />}
      {reviewsApprovals && <Metric label="Price negotiations" value={num(approvedNegotiations+waitingNegotiations)} icon={PenLine} tone="blue"
        note={<><span className="metric-change">{num(approvedNegotiations)} approved</span>
          <span className="metric-change decline">{num(waitingNegotiations)} awaiting approval</span></>} href="#approvals" />}
    </section>

    <section className={`dashboard-grid ${sells ? "" : "no-sales"}`}>
      {sells && <RevenueChart points={data.series} days={data.days} />}
      <article className="panel overview-attention">
        <div className="panel-head"><div><h2>Needs attention</h2><p>Current alerts across the shop</p></div><span className="metric-icon cyan"><TriangleAlert size={18} /></span></div>
        <div className="overview-alerts">
          {pendingApprovals>0 && <Alert icon={ClipboardCheck} tone="blue" title={`${num(pendingApprovals)} pending ${pendingApprovals===1 ? "approval" : "approvals"}`}
            detail="Discounts, credit and returns" action={()=>go("approvals")} />}
          {pendingJobs.length>0 && <Alert icon={RadioTower} tone="teal" title={`${num(pendingJobs.length)} installation ${pendingJobs.length===1 ? "request" : "requests"}`}
            detail="Review and schedule" action={()=>openJob(pendingJobs.at(-1)!.id)} />}
          {low.length>0 && <Alert icon={PackageOpen} tone="cyan" title={`${num(low.length)} ${low.length===1 ? "product needs" : "products need"} restocking`}
            detail={outOfStock ? `${num(outOfStock)} out of stock` : low[0].name} action={()=>go(inventoryPage)} />}
          {overdue.length>0 && <Alert icon={Wallet} tone="blue" title={`${num(overdue.length)} overdue ${overdue.length===1 ? "invoice" : "invoices"}`}
            detail={`${money(overdue.reduce((sum,sale)=>sum+sale.balance,0))} due · Open oldest`} action={()=>openSale(overdue[0].id)} />}
          {dueQuotes.length>0 && <Alert icon={FileClock} tone="teal" title={`${num(dueQuotes.length)} ${dueQuotes.length===1 ? "quotation expires" : "quotations expire"} within 7 days`}
            detail={`${dueQuotes[0].number} · ${date(dueQuotes[0].valid_until)}`} action={()=>openQuote(dueQuotes[0])} />}
          {lateJobs.length>0 && <Alert icon={RadioTower} tone="cyan" title={`${num(lateJobs.length)} overdue ${lateJobs.length===1 ? "installation" : "installations"}`}
            detail={`${lateJobs[0].number} · ${date(lateJobs[0].scheduled)}`} action={()=>openJob(lateJobs[0].id)} />}
          {!pendingApprovals && !pendingJobs.length && !low.length && !overdue.length && !dueQuotes.length && !lateJobs.length && <Empty title="No alerts right now" icon={CheckCircle2} />}
        </div>
        {sells && <div className="overview-balance"><span>Total invoice balance</span><strong>{money(kpi.outstanding ?? 0)}</strong></div>}
      </article>

      {sells && <article className="panel recent-panel">
        <div className="panel-head"><div><h2>Recent sales</h2><p>Latest transactions in the selected period</p></div>
          <button className="button secondary small" onClick={()=>go("sales")}>All sales <ArrowRight size={15} /></button></div>
        <Table<Sale> rows={periodSales.slice(0,5)} pageSize={5} empty="No sales in this period" columns={[
          { label:"Sale ID",cell:s=><button className="text-button sale-ref" onClick={()=>openSale(s.id)}><ReceiptText size={15} />{s.number}</button> },
          { label:"Buyer",cell:s=><span className="customer-cell"><span className="avatar mini">{initials(s.customer_name)}</span>{s.customer_name}</span> },
          { label:"Date",cell:s=>date(s.created_at) },
          { label:"Total",cell:s=><strong>{money(s.total-s.credits)}</strong>,numeric:true },
          { label:"Status",cell:s=><Badge value={s.status} /> }
        ]} />
      </article>}

      {tracksJobs && <article className="panel jobs-panel">
        <div className="panel-head"><div><h2>Installations</h2><p>{jobs.length} active {jobs.length===1 ? "job" : "jobs"}</p></div><span className="metric-icon teal"><RadioTower size={18} /></span></div>
        {jobs.length ? <div className="job-list">{jobs.slice(0,4).map(job=><button className="job-row" key={job.id} onClick={()=>openJob(job.id)}>
          <div><strong>{job.title}</strong><small>{job.scheduled ? date(job.scheduled)+" · " : ""}{job.customer ?? job.number}</small></div><Badge value={job.status} />
        </button>)}</div> : <Empty title="No active installations" icon={RadioTower} />}
        <button className="stock-footer" onClick={()=>go("installations")}>{can(data.user.role,"scheduleJobs") ? "Installation types & prices" : "View installations"} <ArrowRight size={16} /></button>
      </article>}
    </section>
  </div>
}

function Alert({ icon: Icon, tone, title, detail, action }: {
  icon: LucideIcon; tone: string; title: string; detail: string; action: () => void
}) {
  return <button type="button" className="overview-alert" onClick={action}>
    <span className={`metric-icon ${tone}`}><Icon size={16} /></span>
    <span><strong>{title}</strong><small>{detail}</small></span>
    <ArrowRight size={15} />
  </button>
}
