"use client"

import { useEffect, useState } from "react"
import { Download, Printer, Share2 } from "lucide-react"
import type { Business, Quote, SaleDetail } from "@/lib/model"
import { date, money, num } from "@/lib/format"
import { ErrorLine } from "./ui"

type Doc = {
  title: string; number: string; issued: string; due?: string | null; customer: string; address?: string; phone?: string;
  items: { name: string; quantity: number; price: number; serial?: string }[]; totals: { label: string; amount: number }[];
  paymentList?: { method: string; amount: number; reference: string; created_at: string }[]
}

async function createDocumentPdf(doc: Doc, business: Business) {
  const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib")
  const pdf = await PDFDocument.create()
  pdf.setTitle(doc.title + " " + doc.number)
  const font = await pdf.embedFont(StandardFonts.Helvetica)
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold)
  const logoResponse = await fetch("/csolution-logo.jpeg")
  const logo = await pdf.embedJpg(await logoResponse.arrayBuffer())
  const navy = rgb(.03,.11,.24), blue = rgb(.02,.28,.72), muted = rgb(.31,.40,.50), line = rgb(.85,.90,.95)
  const clean = (text: string) => Array.from(text).map(char => {
    try { font.encodeText(char); return char } catch { return "?" }
  }).join("")
  const split = (text: string, max: number) => {
    const lines: string[] = []
    let next = ""
    for (const char of clean(text)) {
      if (font.widthOfTextAtSize(next + char,10) > max || char === "\n") { lines.push(next.trim()); next = char === "\n" ? "" : char }
      else next += char
    }
    if (next) lines.push(next.trim())
    return lines
  }
  let page = pdf.addPage([595.28,841.89])
  let y = 798
  const write = (text: string, x: number, position: number, options: { size?: number; strong?: boolean; right?: boolean; color?: typeof navy } = {}) => {
    const value = clean(text)
    const type = options.strong ? bold : font
    const size = options.size ?? 10
    page.drawText(value,{ x:options.right ? x-type.widthOfTextAtSize(value,size) : x, y:position, size,font:type,color:options.color ?? navy })
  }
  const rule = (at: number) => page.drawLine({ start:{x:42,y:at},end:{x:553,y:at},thickness:.8,color:line })
  const addPage = () => {
    page = pdf.addPage([595.28,841.89])
    y=798
    write(doc.title + " " + doc.number,42,y,{ strong:true,color:blue })
    y-=28
  }
  page.drawImage(logo,{x:42,y:y-53,width:62,height:62})
  write(business.name,114,y-10,{size:17,strong:true})
  split(business.address,280).slice(0,2).forEach((s,i)=>write(s,114,y-29-i*12,{color:muted}))
  const contact = [business.phone,business.email].filter(Boolean).join(" · ")
  if(contact) split(contact,280).slice(0,1).forEach(s=>write(s,114,y-56,{color:muted}))
  write(doc.title,553,y-10,{size:23,strong:true,right:true,color:blue})
  write(doc.number,553,y-30,{strong:true,right:true})
  y-=83
  rule(y); y-=24
  write("BILL TO",42,y,{strong:true,color:muted})
  write("Issued " + date(doc.issued),553,y,{right:true})
  y-=18
  write(doc.customer,42,y,{strong:true})
  if (doc.due) write((doc.title==="Quotation" ? "Valid until " : "Due ") + date(doc.due),553,y,{right:true})
  for (const text of [doc.address,doc.phone].filter(Boolean)) {
    for (const row of split(text!,280).slice(0,3)) { y-=14; write(row,42,y,{color:muted}) }
  }
  y-=32
  const header = () => {
    page.drawRectangle({x:42,y:y-21,width:511,height:24,color:rgb(.93,.96,.99)})
    write("Item",51,y-12,{strong:true});write("Qty",352,y-12,{strong:true,right:true})
    write("Unit price",443,y-12,{strong:true,right:true});write("Amount",545,y-12,{strong:true,right:true})
    y-=37
  }
  header()
  for (const item of doc.items) {
    const label = split(item.name + (item.serial ? " · S/N " + item.serial : ""),266)
    const height = Math.max(label.length*13+12,28)
    if(y-height<60){ addPage();header() }
    label.forEach((s,i)=>write(s,51,y-i*13))
    write(num(item.quantity),352,y,{right:true})
    write(num(item.price),443,y,{right:true})
    write(num(item.price*item.quantity),545,y,{right:true,strong:true})
    y-=height
    rule(y+12)
  }
  if (y-doc.totals.length*20<55) addPage()
  y-=12
  for (const total of doc.totals) {
    write(total.label,320,y,{strong:true})
    write(money(total.amount),553,y,{strong:true,right:true,color:blue})
    y-=20
  }
  if(doc.paymentList?.length) {
    if(y<102) addPage()
    y-=15
    write("PAYMENTS",42,y,{strong:true,color:muted})
    y-=20
    for(const payment of doc.paymentList){
      const paymentLabel = split([date(payment.created_at),payment.method,payment.reference].filter(Boolean).join(" · "),360)
      if(y-paymentLabel.length*13<55) addPage()
      paymentLabel.forEach((s,i)=>write(s,42,y-i*13))
      write(money(payment.amount),553,y,{right:true})
      y-=paymentLabel.length*13+8
    }
  }
  const pages = pdf.getPages()
  for (let i=0;i<pages.length;i++) {
    page=pages[i]
    rule(45)
    write("CSolution · " + doc.number,42,29,{color:muted,size:9})
    write((i+1)+" / "+pages.length,553,29,{right:true,color:muted,size:9})
  }
  return new File([new Uint8Array(await pdf.save())],doc.number+".pdf",{type:"application/pdf"})
}

function downloadDocument(file: File) {
  const url = URL.createObjectURL(file)
  const link = document.createElement("a")
  link.href=url
  link.download=file.name
  link.click()
  setTimeout(()=>URL.revokeObjectURL(url),1500)
}

export function SaleDocument({ detail, business, kind }: { detail: SaleDetail; business: Business; kind: "invoice"|"receipt" }) {
  const s = detail.sale
  const refunds = detail.returns.reduce((total,record)=>total+record.refund,0)
  const doc: Doc = {
    title:kind==="invoice" ? "Invoice" : "Receipt",number:kind==="invoice" ? s.invoice : "RC-"+s.number,
    issued:kind==="receipt" ? (detail.payments.at(-1)?.created_at ?? s.created_at) : s.created_at,due:kind==="invoice" ? s.due_date : null,customer:s.customer_name,address:s.customer_address,phone:s.customer_phone,
    items:detail.lines,totals:[{label:"Subtotal",amount:s.subtotal},...(s.discount ? [{label:"Discount",amount:-s.discount}] : []),
      ...(s.tax ? [{label:"Tax",amount:s.tax}] : []),{label:"Invoice total",amount:s.total},
      ...(s.credits ? [{label:"Return credits",amount:-s.credits}] : []),...(kind==="receipt" && refunds ? [{label:"Refunded",amount:-refunds}] : []),{label:"Paid",amount:s.paid},{label:"Balance due",amount:s.balance}],
    paymentList:kind==="receipt" ? detail.payments : undefined
  }
  return <DocumentView doc={doc} business={business} />
}

export function QuoteDocument({ quote, business }: { quote: Quote; business: Business }) {
  const subtotal = quote.lines.reduce((sum,line)=>sum+line.quantity*line.price,0)
  return <DocumentView business={business} doc={{
    title:"Quotation",number:quote.number,issued:quote.created_at,due:quote.valid_until,customer:quote.customer_name,items:quote.lines,
    totals:[{label:"Subtotal",amount:subtotal},...(quote.discount ? [{label:"Discount",amount:-quote.discount}] : []),
      ...(quote.tax ? [{label:"Tax",amount:quote.tax}] : []),{label:"Total",amount:quote.total}]
  }} />
}

function DocumentView({ doc, business }: { doc: Doc; business: Business }) {
  const [busy,setBusy] = useState(false)
  const [error,setError] = useState("")
  const [canShare,setCanShare] = useState(false)
  useEffect(()=>{
    setCanShare(navigator.canShare?.({files:[new File([""],"document.pdf",{type:"application/pdf"})]}) ?? false)
  },[])
  async function exportPdf(share = false) {
    setBusy(true); setError("")
    try {
      const file = await createDocumentPdf(doc,business)
      if (share) await navigator.share({files:[file],title:doc.title+" "+doc.number})
      else downloadDocument(file)
    } catch (error) {
      if (!(error instanceof DOMException && error.name==="AbortError")) {
        setError(share ? "Could not open sharing. Download the PDF to attach it in WhatsApp." : "PDF download failed. Try printing this document.")
      }
    }
    finally { setBusy(false) }
  }
  return <div className="document-view">
    <div className="document-actions"><button className="button secondary" onClick={()=>window.print()}><Printer size={17} /> Print</button>
      {canShare && <button className="button secondary" disabled={busy} onClick={()=>void exportPdf(true)}><Share2 size={17} /> Share PDF</button>}
      <button className="button primary" disabled={busy} onClick={()=>void exportPdf()}><Download size={17} />{busy ? "Preparing…" : "Download PDF"}</button></div>
    <ErrorLine message={error} />
    <section className="print-doc">
      <header className="paper-head"><div><img src="/csolution-logo.jpeg" alt="Connect Solutions logo" /><div><strong>{business.name}</strong><small>{business.address}</small><small>{[business.phone,business.email].filter(Boolean).join(" · ")}</small></div></div>
        <div><h3>{doc.title}</h3><strong>{doc.number}</strong></div></header>
      <div className="paper-meta"><div><span>Bill to</span><strong>{doc.customer}</strong>{doc.address && <small>{doc.address}</small>}{doc.phone && <small>{doc.phone}</small>}</div>
        <div><span>Issued {date(doc.issued)}</span>{doc.due && <span>{doc.title==="Quotation" ? "Valid until" : "Due"} {date(doc.due)}</span>}</div></div>
      <table><thead><tr><th>Item</th><th>Qty</th><th className="numeric">Unit price</th><th className="numeric">Amount</th></tr></thead>
        <tbody>{doc.items.map((item,i)=><tr key={i}><td><strong>{item.name}</strong>{item.serial && <small className="table-sub">S/N {item.serial}</small>}</td><td>{num(item.quantity)}</td><td className="numeric">{num(item.price)}</td><td className="numeric">{num(item.price*item.quantity)}</td></tr>)}</tbody></table>
      <div className="paper-totals">{doc.totals.map(t=><div key={t.label}><span>{t.label}</span><strong>{money(t.amount)}</strong></div>)}</div>
      {!!doc.paymentList?.length && <div className="paper-payments"><h4>Payments</h4>{doc.paymentList.map((p,i)=><p key={i}>{p.method} · {date(p.created_at)} {p.reference && " · "+p.reference}<strong>{money(p.amount)}</strong></p>)}</div>}
    </section>
  </div>
}
