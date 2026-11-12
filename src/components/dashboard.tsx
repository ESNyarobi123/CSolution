"use client"

import { useState } from "react"
import { ArrowDownRight, ArrowRight, ArrowUpRight, Box, ChartNoAxesCombined, CircleDollarSign, Layers3, PackageOpen, RadioTower, ReceiptText, TriangleAlert, Wallet, type LucideIcon } from "lucide-react"
import { can } from "@/lib/access"
import { date, dayLabel, initials, money, num, short } from "@/lib/format"
import type { Sale, SeriesPoint, Snapshot } from "@/lib/model"
import { Badge, Empty, Table } from "./ui"

function Metric({ label, value, icon: Icon, tone, change, note }: {
  label: string; value: string; icon: LucideIcon; tone: string; change?: number; note: string
}) {
  return <article className="metric">
    <div className="metric-top"><span className={`metric-icon ${tone}`}><Icon size={19} strokeWidth={1.9} /></span><span>{label}</span></div>
    <strong>{value}</strong>
    <div className="metric-note">
      {change !== undefined && <span className={`metric-change ${change < 0 ? "decline" : ""}`}>
        {change < 0 ? <ArrowDownRight size={13} /> : <ArrowUpRight size={13} />}{Math.abs(change).toFixed(1)}%
      </span>}
      <span>{note}</span>
    </div>
  </article>
}
const growth = (value: number, prior: number) => prior > 0 ? (value-prior)/prior*100 : undefined

export function RevenueChart({ points, days }: { points: SeriesPoint[]; days: number }) {
  const [selected,setSelected] = useState<number | null>(null)
  const index = selected === null ? points.length-1 : Math.min(selected,points.length-1)
  const top = Math.max(0,...points.map(p => Math.max(p.sales,p.profit ?? 0)))
  const bottom = Math.min(0,...points.map(p => Math.min(p.sales,p.profit ?? 0)))
  const stepBase = 10 ** Math.floor(Math.log10(Math.max((top-bottom)/4,1)))
  const tickStep = [1,2,2.5,5,10].map(factor => factor * stepBase).find(value => value >= (top-bottom)/4) ?? stepBase
  const min = Math.floor(bottom/tickStep)*tickStep
  const max = Math.max(tickStep*4,Math.ceil(top/tickStep)*tickStep)
  const ticks = Array.from({ length: Math.round((max-min)/tickStep)+1 }, (_,i) => max-i*tickStep)
  const y = (amount: number) => 154 * (max-amount)/(max-min) + 13
  const x = (n: number) => 22 + (756 * n)/Math.max(points.length-1,1)
  const coords = (field: "sales" | "profit") => points.map((p,n) => `${x(n)},${y(p[field] ?? 0)}`).join(" ")
  const area = points.length ? `22,${y(0)} ${coords("sales")} ${x(points.length-1)},${y(0)}` : ""
  const active = points[index]
  const labelEvery = Math.max(1,Math.ceil(points.length/8))
  const pointNames = points.filter((_,i) => i % labelEvery === 0 || i === points.length-1)
  return <article className="panel revenue-panel">
    <div className="panel-head"><div><h2>Sales performance</h2><p>{points[0]?.profit === undefined ? "Daily sales" : "Daily sales and gross profit"} over the last {days} days.</p></div>
      <div className="chart-legend"><span><i />Sales</span>{points[0]?.profit !== undefined && <span><i />Profit</span>}</div>
    </div>
    {points.length ? <>
      <div className="chart-value" aria-live="polite"><span>{active ? dayLabel(active.day) : ""}</span><strong>{active ? money(active.sales) : ""}</strong>{active?.profit !== undefined && <span className="chart-profit">Profit {money(active.profit)}</span>}</div>
      <div className="chart-layout">
        <div className="chart-labels" aria-hidden="true">{ticks.map(tick => <span key={tick}>{short(tick)}</span>)}</div>
        <div className="chart-main">
          <div className="chart-drawing">
            <svg viewBox="0 0 800 180" preserveAspectRatio="none" aria-hidden="true">
              <defs><linearGradient id="sales-area" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--blue)" stopOpacity=".20"/><stop offset="100%" stopColor="var(--cyan)" stopOpacity=".02"/>
              </linearGradient></defs>
              {ticks.map(tick => <line key={tick} x1="0" x2="800" y1={y(tick)} y2={y(tick)} stroke="var(--line)" strokeDasharray="5 5" vectorEffect="non-scaling-stroke" />)}
              <polygon points={area} fill="url(#sales-area)" />
              {points[0]?.profit !== undefined && <polyline points={coords("profit")} fill="none" stroke="var(--teal)" strokeWidth="2.5" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />}
              <polyline points={coords("sales")} fill="none" stroke="var(--blue)" strokeWidth="3" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
              {active && <><line x1={x(index)} x2={x(index)} y1="7" y2="171" stroke="var(--blue)" strokeOpacity=".24" strokeDasharray="4 4" vectorEffect="non-scaling-stroke" />
                <circle cx={x(index)} cy={y(active.sales)} r="5" fill="var(--blue)" stroke="white" strokeWidth="2" vectorEffect="non-scaling-stroke" /></>}
            </svg>
            <div className="chart-targets" onMouseLeave={() => setSelected(null)}>
              {points.map((p,i) => <button key={p.day} onMouseEnter={() => setSelected(i)} onFocus={() => setSelected(i)}
                onClick={() => setSelected(i)} aria-label={dayLabel(p.day) + ", sales " + money(p.sales) + (p.profit === undefined ? "" : ", profit " + money(p.profit))} />)}
            </div>
          </div>
          <div className="chart-dates" aria-hidden="true">{pointNames.map(p => <span key={p.day}>{dayLabel(p.day)}</span>)}</div>
        </div>
      </div>
    </> : <Empty title="Sales data is unavailable" icon={ChartNoAxesCombined} />}
  </article>
}

export function Dashboard({ data, go, openSale, openJob }: {
  data: Snapshot; go: (section: string) => void; openSale: (id: string) => void; openJob: (id: string) => void
}) {
  const { kpi,previous } = data
  const low = data.products.filter(p => p.active && p.type === "Stocked" && p.on_hand <= p.reorder).sort((a,b) => a.on_hand-b.on_hand)
  const jobs = data.jobs.filter(job => job.status === "Scheduled" || job.status === "In progress")
  const stockValue = kpi.stockValue
  const sells = can(data.user.role,"sales")
  const tracksJobs = can(data.user.role,"jobs")
  return <div className="dashboard">
    <section className="metric-grid" aria-label="Shop metrics">
      {sells && <Metric label="Total sales" value={money(kpi.revenue)} icon={CircleDollarSign} tone="blue" change={growth(kpi.revenue,previous.revenue)} note={previous.revenue > 0 ? "vs. previous period" : num(kpi.saleCount) + " transactions"} />}
      {kpi.profit !== undefined && <Metric label="Gross profit" value={money(kpi.profit)} icon={ChartNoAxesCombined} tone="teal"
        change={growth(kpi.profit,previous.profit ?? 0)} note={(previous.profit ?? 0)>0 ? "vs. previous period" : "After direct costs"} />}
      <Metric label={stockValue !== undefined ? "Stock value" : "Stocked products"} value={stockValue !== undefined ? money(stockValue) : num(kpi.stockCount)}
        icon={Layers3} tone="cyan" note={stockValue !== undefined ? num(kpi.stockCount) + " stocked products" : "Active inventory SKUs"} />
      {kpi.outstanding !== undefined && <Metric label="Outstanding" value={money(kpi.outstanding)} icon={Wallet} tone="green" note="Across unpaid invoices" />}
    </section>
    <section className={`dashboard-grid ${sells ? "" : "no-sales"}`}>
      {sells && <RevenueChart points={data.series} days={data.days} />}
      <article className="panel stock-panel">
        <div className="stock-hero">
          <div className="rings" aria-hidden="true"><i /><i /><i /></div>
          <span className="stock-hero-icon"><TriangleAlert size={19} /></span>
          <div><h2>Stock watch</h2><p>{low.length} {low.length === 1 ? "item needs" : "items need"} restocking</p></div>
        </div>
        {low.length ? <div className="stock-list">{low.slice(0,3).map(product => <div className="stock-row" key={product.id}>
          <span className="stock-icon"><Box size={16} /></span><div><strong>{product.name}</strong><small>{product.sku}</small></div>
          <span className="stock-count">{num(product.on_hand)} {product.unit}</span>
        </div>)}</div> : <Empty title="Stock levels are healthy" icon={PackageOpen} />}
        <button className="stock-footer" onClick={() => go(data.user.role === "Cashier" || data.user.role === "Technician" ? "products" : "inventory/low-stock")}>View inventory <ArrowRight size={16} /></button>
      </article>
      {sells && <article className="panel recent-panel">
        <div className="panel-head"><div><h2>Recent sales</h2><p>Latest transactions across the shop.</p></div>
          {data.sales.length > 0 && <button className="button secondary small" onClick={() => go("sales")}>View all <ArrowRight size={15} /></button>}</div>
        <Table<Sale> rows={data.sales.slice(0,5)} pageSize={5} empty="No recent sales" columns={[
          { label:"Sale ID",cell:s=><button className="text-button sale-ref" onClick={() => openSale(s.id)}><ReceiptText size={15} />{s.number}</button> },
          { label:"Customer",cell:s=><span className="customer-cell"><span className="avatar mini">{initials(s.customer_name)}</span>{s.customer_name}</span> },
          { label:"Date",cell:s=>date(s.created_at) },
          { label:"Total",cell:s=><strong>{money(s.total)}</strong>,numeric:true },
          { label:"Status",cell:s=><Badge value={s.status} /> }
        ]} />
      </article>}
      {tracksJobs && <article className="panel jobs-panel">
        <div className="panel-head"><div><h2>Installations</h2><p>{jobs.length} active {jobs.length === 1 ? "job" : "jobs"}</p></div><span className="metric-icon teal"><RadioTower size={18} /></span></div>
        {jobs.length ? <div className="job-list">{jobs.slice(0,4).map(job => <button className="job-row" key={job.id} onClick={() => openJob(job.id)}>
          <div><strong>{job.title}</strong><small>{job.customer ?? job.location ?? job.number}</small></div><Badge value={job.status} />
        </button>)}</div> : <Empty title="No active installations" icon={RadioTower} />}
        {jobs.length > 0 && <button className="stock-footer" onClick={() => go("installations")}>View installations <ArrowRight size={16} /></button>}
      </article>}
    </section>
  </div>
}
