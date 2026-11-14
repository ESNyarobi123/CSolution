"use client"

import { useState } from "react"
import { ArrowRight, ClipboardCheck, Clock3, CreditCard, FileText, PackageSearch, RadioTower, ReceiptText, UserRoundPlus, Wallet, type LucideIcon } from "lucide-react"
import { can } from "@/lib/access"
import { date, money, num, shopDay } from "@/lib/format"
import type { Approval, Snapshot } from "@/lib/model"
import { Metric } from "./dashboard"
import type { Save } from "./forms"
import type { Panel } from "./screens"
import { Badge, Field, Form, Select, Table, val } from "./ui"

type WorkspaceProps = { data: Snapshot; open: (panel: Panel) => void }

export function FrontOfficeDashboard({ data,open,go }: WorkspaceProps & { go: (page: string) => void }) {
  const todaySales = data.sales.filter(sale=>shopDay(sale.created_at)===data.today)
  const todayCollected = data.series.at(-1)?.collected ?? 0
  const openBalances = data.sales.filter(sale=>sale.balance>0)
  const waiting = data.approvals.filter(approval=>approval.status==="Pending")
  const ready = data.approvals.filter(approval=>approval.status==="Approved")
  const actions: { label: string; icon: LucideIcon; run: () => void }[] = [
    { label:"New sale",icon:CreditCard,run:()=>open({kind:"sale"}) },
    { label:"New quotation",icon:FileText,run:()=>open({kind:"quote"}) },
    { label:"Add customer",icon:UserRoundPlus,run:()=>open({kind:"customer"}) },
    { label:"Check stock",icon:PackageSearch,run:()=>go("products") },
    { label:"Record a payment",icon:Wallet,run:()=>go("payments") },
    { label:"Installation request",icon:RadioTower,run:()=>open({kind:"installationRequest"}) }
  ]
  return <div className="stack">
    <section className="front-desk-banner">
      <div><span><Clock3 size={14} /> {date(data.today)}</span><h2>{data.business.name}</h2></div>
      <button type="button" className="button front-desk-approval" onClick={()=>go("approvals")}>
        <ClipboardCheck size={17} /> {ready.length ? num(ready.length)+" ready to complete" : num(waiting.length)+" pending approvals"} <ArrowRight size={15} />
      </button>
    </section>
    <section className="metric-grid overview-metrics" aria-label="My front office metrics">
      <Metric label="My sales today" value={money(todaySales.reduce((sum,sale)=>sum+sale.total-sale.credits,0))}
        icon={CreditCard} tone="blue" note={num(todaySales.length)+(todaySales.length===1 ? " sale today" : " sales today")} />
      <Metric label="My collections today" value={money(todayCollected)} icon={Wallet} tone="teal" note="Payments on my invoices less refunds" />
      <Metric label="My open balances" value={money(openBalances.reduce((sum,sale)=>sum+sale.balance,0))} icon={ReceiptText} tone="cyan"
        note={num(openBalances.length)+(openBalances.length===1 ? " invoice to follow up" : " invoices to follow up")} />
    </section>
    <section className="panel front-desk-actions" aria-label="Quick actions">
      <div className="panel-head"><h2>Quick actions</h2></div>
      <div>{actions.map(({label,icon:Icon,run})=><button key={label} type="button" onClick={run}>
        <span className="metric-icon blue"><Icon size={18} /></span><strong>{label}</strong><ArrowRight size={15} />
      </button>)}</div>
    </section>
    <article className="panel">
      <div className="panel-head"><div><h2>My recent sales</h2><p>Open a sale for its invoice, receipt or payment history.</p></div>
        <button className="button secondary small" type="button" onClick={()=>go("sales")}>My sales <ArrowRight size={15} /></button></div>
      <Table rows={data.sales.slice(0,5)} empty="Your sales will appear here" columns={[
        {label:"Sale",cell:sale=><button className="text-button" type="button" onClick={()=>open({kind:"saleDetail",id:sale.id})}>{sale.number}</button>},
        {label:"Buyer",cell:sale=>sale.customer_name},{label:"Date",cell:sale=>date(sale.created_at)},
        {label:"Total",cell:sale=>money(sale.total-sale.credits),numeric:true},{label:"Status",cell:sale=><Badge value={sale.status} />}
      ]} />
    </article>
  </div>
}

const approvalFilters = ["All","Pending","Approved","Completed","Rejected"] as const

export function Approvals({ data,open }: WorkspaceProps) {
  const admin = can(data.user.role,"reviewApprovals")
  const [filter,setFilter] = useState<typeof approvalFilters[number]>(admin ? "Pending" : "All")
  const visible = filter==="All" ? data.approvals : data.approvals.filter(item=>item.status===filter)
  return <article className="panel">
    <div className="panel-head"><div><h2>{admin ? "Approval queue" : "My approval requests"}</h2>
      <p>{admin ? "Review proposed discounts, unpaid balances and returns." : "Check decisions and complete approved sales."}</p></div></div>
    <div className="sales-statuses" aria-label="Approval status">{approvalFilters.map(status=><button key={status} type="button"
      aria-pressed={filter===status} onClick={()=>setFilter(status)}>{status}
      <span>{num(status==="All" ? data.approvals.length : data.approvals.filter(item=>item.status===status).length)}</span>
    </button>)}</div>
    <Table key={filter} rows={visible} empty="No matching approval requests" columns={[
      {label:"Request",cell:approval=><button className="text-button" type="button" onClick={()=>open({kind:"approvalDetail",id:approval.id})}>
        {approval.kind==="Return" ? "Return · "+approval.summary.saleNumber : "Sale terms · "+approval.summary.buyer}
      </button>},
      ...(admin ? [{label:"Requested by",cell:(approval: Approval)=>approval.requester}] : []),
      {label:"Date",cell:approval=>date(approval.created_at)},
      {label:"Amount",cell:approval=>money(approval.summary.refund ?? approval.summary.total),numeric:true},
      {label:"Status",cell:approval=><Badge value={approval.status} />},
      {label:"Action",cell:approval=><button type="button" className="button secondary small" onClick={()=>open({kind:"approvalDetail",id:approval.id})}>
        {admin && approval.status==="Pending" ? "Review" : !admin && approval.status==="Approved" ? "Complete sale" : "View details"}
      </button>}
    ]} />
  </article>
}

export function ApprovalDetail({ approval, data, open, close, save }: WorkspaceProps & {
  approval: Approval; close: () => void; save: Save
}) {
  const [decision,setDecision] = useState("")
  const admin = can(data.user.role,"reviewApprovals")
  const isReturn = approval.kind==="Return"
  const { summary } = approval
  const detail = <div className="stack approval-detail">
    <div className="record-title"><div><h3>{summary.buyer}</h3>
      <p>{approval.requester} · {date(approval.created_at)}{summary.saleNumber && " · "+summary.saleNumber}</p></div><Badge value={approval.status} /></div>
    <dl className="details-list">
      <div><dt>Reason</dt><dd className="approval-note">{approval.reason}</dd></div>
      {!isReturn && summary.soldOn && <div><dt>Sale date</dt><dd>{date(summary.soldOn)}</dd></div>}
      {approval.reviewer && <div><dt>Reviewed by</dt><dd>{approval.reviewer} · {date(approval.reviewed_at)}</dd></div>}
      {approval.review_note && <div><dt>Decision note</dt><dd className="approval-note">{approval.review_note}</dd></div>}
    </dl>
    <div className="panel"><Table rows={summary.items.map((item,i)=>({...item,id:String(i)}))} columns={[
      {label:"Item",cell:item=><>{item.name}{item.listPrice!==undefined && item.listPrice!==item.price &&
        <small className="table-sub">Negotiated · down from {money(item.listPrice)}</small>}
        {item.note && <small className="table-sub">{item.note}</small>}</>},
      {label:"Quantity",cell:item=>num(item.quantity),numeric:true},
      {label:"Unit price",cell:item=>money(item.price),numeric:true},
      ...(summary.items.some(item=>item.listPrice!==undefined) ? [{label:"Reduction",cell:(item:typeof summary.items[number])=>
        item.listPrice!==undefined && item.listPrice!==item.price ? <strong>{money((item.listPrice-item.price)*item.quantity)}</strong> : "—",numeric:true}] : [])
    ]} /></div>
    <div className="detail-summary">
      {isReturn ? <>
        <div><small>Credit against invoice</small><strong>{money(summary.credit ?? 0)}</strong></div>
        <div><small>Refund to customer</small><strong>{money(summary.refund ?? 0)}</strong></div>
        <div><small>Return to stock</small><strong>{summary.restock ? "Yes" : "No"}</strong></div>
      </> : <>
        <div><small>Sale total</small><strong>{money(summary.total)}</strong></div>
        <div><small>Discount</small><strong>{money(summary.discount)}</strong></div>
        <div><small>Proposed payment</small><strong>{money(summary.paid)}</strong></div>
        <div><small>Balance due</small><strong>{money(summary.total-summary.paid)}</strong></div>
      </>}
    </div>
    {!isReturn && (summary.paid>0 || summary.dueDate) && <p className="checkout-hint">
      {summary.paid>0 && summary.method}{summary.paid>0 && summary.dueDate && " · "}{summary.dueDate && "Balance due "+date(summary.dueDate)}
    </p>}
  </div>
  if (admin && approval.status==="Pending") {
    return <Form close={close} submitDisabled={!decision}
      label={decision==="reject" ? "Reject request" : isReturn ? "Approve and record return" : "Approve terms"}
      onSave={form=>save({action:"reviewApproval",id:approval.id,decision,note:val(form,"note")},decision==="reject" ? "Request rejected" : "Request approved")}>
      {detail}
      <Field label="Decision"><Select value={decision} required onChange={event=>setDecision(event.target.value)}>
        <option value="">Choose a decision</option><option value="approve">Approve</option><option value="reject">Reject</option>
      </Select></Field>
      <Field label="Decision note"><textarea name="note" rows={2} maxLength={2000} required={decision==="reject"} /></Field>
      {decision==="approve" && isReturn && <p className="checkout-hint">Approval records the return, any refund and the selected stock adjustment.</p>}
    </Form>
  }
  if (!admin && approval.status==="Approved") {
    return <Form close={close} label="Complete approved sale" onSave={()=>save({action:"completeApprovedSale",id:approval.id},"Approved sale completed")}>
      {detail}
      {summary.paid>0 && <label className="checkbox"><input type="checkbox" required /> I received {money(summary.paid)} by {summary.method}.</label>}
    </Form>
  }
  return <div className="stack">{detail}
    {approval.result_sale_id && <div className="detail-actions"><button type="button" className="button secondary" onClick={()=>open({kind:"saleDetail",id:approval.result_sale_id!})}>View sale <ArrowRight size={15} /></button></div>}
  </div>
}
