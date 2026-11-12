"use client"

import { useEffect, useId, useLayoutEffect, useRef, useState, type FormEvent, type KeyboardEvent, type ReactNode } from "react"
import type { Product } from "@/lib/model"
import { createPortal } from "react-dom"
import { Box, ChevronLeft, ChevronRight, ChevronDown, CircleAlert, Ellipsis, Search, X, type LucideIcon } from "lucide-react"

export function Brand({ light = false }: { light?: boolean }) {
  return <div className={`brand ${light ? "brand-light" : ""}`}>
    <span className="brand-mark"><img src="/csolution-logo.jpeg" alt="" /></span>
    <span><strong>CSolution<span className="brand-dot">.</span></strong><small>CONNECT SOLUTIONS</small></span>
  </div>
}

const statusTones: Record<string,string> = {
  Paid:"green", Active:"green", Completed:"green", "In stock":"green", Retail:"slate", Business:"blue",
  Agent:"teal", Partial:"teal", Unpaid:"navy", Returned:"slate", "Low stock":"teal", "Out of stock":"navy",
  "In progress":"blue", Scheduled:"teal", Cancelled:"slate", Converted:"green", Open:"blue", Expired:"slate",
  Archived:"slate", Inactive:"slate", Sold:"blue", Restocked:"green", Installed:"teal", "Non-stock":"teal", Service:"blue", Stocked:"green"
}
export function Badge({ value }: { value: string }) {
  return <span className={`badge ${statusTones[value] ?? "slate"}`}><i />{value}</span>
}

export function Empty({ title = "No records yet", description, icon: Icon = Box }: {
  title?: string; description?: string; icon?: LucideIcon
}) {
  return <div className="empty"><span><Icon size={22} /></span><strong>{title}</strong>{description && <p>{description}</p>}</div>
}

export function ProductPhoto({ product, large = false }: { product: Product; large?: boolean }) {
  const [broken,setBroken] = useState<string | null>(null)
  return <span className={large ? "product-photo" : "product-thumb"}>
    {product.image_url && product.image_url !== broken ?
      <img src={product.image_url} alt={large ? product.name : ""} referrerPolicy="no-referrer" onError={()=>setBroken(product.image_url)} /> :
      <Box size={large ? 32 : 18} aria-hidden="true" />}
  </span>
}

export function Modal({ title, subtitle, close, wide, checkout, children }: {
  title: string; subtitle?: string; close: () => void; wide?: boolean; checkout?: boolean; children: ReactNode
}) {
  const modal = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  useEffect(() => {
    const dialog = modal.current
    dialog?.showModal()
    if (checkout && matchMedia("(min-width: 851px)").matches) {
      dialog?.querySelector<HTMLInputElement>("[data-checkout-focus]")?.focus({preventScroll:true})
    }
    return () => dialog?.close()
  }, [checkout])
  return <dialog ref={modal} aria-labelledby={titleId} className={checkout ? "dialog checkout-dialog" : wide ? "dialog wide" : "dialog"}
    onCancel={event => { event.preventDefault(); close() }} onClick={event => { if (event.target === event.currentTarget) close() }}>
    <div className="dialog-shell">
      <header className="dialog-head">
        <div><h2 id={titleId}>{title}</h2>{subtitle && <p>{subtitle}</p>}</div>
        <button type="button" className="icon-btn" onClick={close} aria-label="Close"><X size={20} /></button>
      </header>
      <div className="dialog-content">{children}</div>
    </div>
  </dialog>
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return <label className="field"><span>{label}</span>{children}{hint && <small>{hint}</small>}</label>
}

export function Select({ children, ...props }: React.ComponentProps<"select">) {
  return <span className="select-wrap"><select {...props}>{children}</select><ChevronDown size={15} aria-hidden="true" /></span>
}

export function ErrorLine({ message }: { message: string }) {
  return message ? <div className="error-line" role="alert"><CircleAlert size={17} />{message}</div> : null
}

export function Form({ onSave, close, label = "Save changes", busyLabel = "Saving…", destructive = false, footerSummary, submitDisabled = false, children }: {
  onSave: (form: FormData) => Promise<unknown>; close: () => void; label?: string; busyLabel?: string; destructive?: boolean; footerSummary?: ReactNode; submitDisabled?: boolean; children: ReactNode
}) {
  const [error,setError] = useState("")
  const [saving,setSaving] = useState(false)
  const busy = useRef(false)
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy.current) return
    const data = new FormData(event.currentTarget)
    busy.current = true
    setError("")
    setSaving(true)
    try { await onSave(data) }
    catch (e) { setError(e instanceof Error ? e.message : "Could not save the record.") }
    finally { busy.current = false; setSaving(false) }
  }
  return <form onSubmit={submit} className={footerSummary ? "record-form checkout-form" : "record-form"}>
    {footerSummary ? <div inert={saving}>{children}</div> : children}
    <div className="form-end">
      <ErrorLine message={error} />
      <div className="form-footer">
        {footerSummary && <div className="checkout-footer-summary">{footerSummary}</div>}
        <button type="button" className="button secondary" onClick={close} disabled={saving} autoFocus={destructive}>Cancel</button>
        <button className={destructive ? "button danger" : "button primary"} disabled={saving || submitDisabled}>{saving ? busyLabel : label}</button>
      </div>
    </div>
  </form>
}

export type MenuAction = {
  label: string
  icon: LucideIcon
  run: () => void
  destructive?: boolean
}

export function ActionMenu({ label, actions, icon: Icon = Ellipsis, caption }: {
  label: string; actions: MenuAction[]; icon?: LucideIcon; caption?: string
}) {
  const [open,setOpen] = useState(false)
  const trigger = useRef<HTMLButtonElement>(null)
  const menu = useRef<HTMLDivElement>(null)
  const focusLast = useRef(false)
  const menuId = useId()
  const items = () => Array.from(menu.current?.querySelectorAll<HTMLButtonElement>("[role=menuitem]") ?? [])

  function close(restoreFocus = false) {
    if (restoreFocus) trigger.current?.focus()
    setOpen(false)
  }

  useLayoutEffect(() => {
    if (!open || !trigger.current || !menu.current) return
    const button = trigger.current
    const popup = menu.current
    function place() {
      const bounds = button.getBoundingClientRect()
      const gap = 6
      const margin = 8
      const below = window.innerHeight - bounds.bottom - gap - margin
      const above = bounds.top - gap - margin
      const useAbove = popup.scrollHeight > below && above > below
      popup.style.maxHeight = Math.max(0,useAbove ? above : below)+"px"
      popup.style.left = Math.max(margin,Math.min(bounds.right-popup.offsetWidth,window.innerWidth-popup.offsetWidth-margin))+"px"
      popup.style.top = (useAbove ? bounds.top-gap-popup.offsetHeight : bounds.bottom+gap)+"px"
    }
    function dismiss(event: Event) {
      if (event.target instanceof Node && !button.contains(event.target) && !popup.contains(event.target)) setOpen(false)
    }
    function scroll(event: Event) {
      if (event.target instanceof Node && popup.contains(event.target)) return
      place()
    }
    place()
    const buttons = Array.from(popup.querySelectorAll<HTMLButtonElement>("[role=menuitem]"))
    const initialItem = focusLast.current ? buttons.at(-1) : buttons[0]
    initialItem?.focus({ preventScroll:true })
    document.addEventListener("pointerdown",dismiss,true)
    document.addEventListener("focusin",dismiss)
    window.addEventListener("resize",place)
    window.addEventListener("scroll",scroll,true)
    return () => {
      document.removeEventListener("pointerdown",dismiss,true)
      document.removeEventListener("focusin",dismiss)
      window.removeEventListener("resize",place)
      window.removeEventListener("scroll",scroll,true)
    }
  },[open])

  function navigate(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Tab") {
      close(true)
      return
    }
    if (event.key === "Escape") {
      event.preventDefault()
      event.stopPropagation()
      close(true)
      return
    }
    const buttons = items()
    const index = buttons.indexOf(document.activeElement as HTMLButtonElement)
    const targets: Record<string,number> = {
      ArrowDown:(index+1)%buttons.length,
      ArrowUp:(index-1+buttons.length)%buttons.length,
      Home:0,
      End:buttons.length-1
    }
    if (event.key in targets) {
      event.preventDefault()
      buttons[targets[event.key]]?.focus()
    }
  }

  if (!actions.length) return null
  return <>
    <button ref={trigger} type="button" className={caption ? "button secondary quick-create" : "icon-btn row-action-trigger"}
      aria-label={label} title={label} aria-haspopup="menu" aria-expanded={open} aria-controls={open ? menuId : undefined}
      onClick={()=>{ focusLast.current=false;setOpen(!open) }}
      onKeyDown={event=>{
        if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return
        event.preventDefault()
        focusLast.current=event.key==="ArrowUp"
        setOpen(true)
      }}>
      <Icon size={18} aria-hidden="true" />{caption&&<span>{caption}</span>}{caption&&<ChevronDown size={13} aria-hidden="true" />}
    </button>
    {open&&createPortal(
      <div ref={menu} id={menuId} className="action-menu" role="menu" aria-label={label} onKeyDown={navigate}>
        {actions.map(({label:actionLabel,icon:ActionIcon,run,destructive})=><button key={actionLabel} type="button" role="menuitem" tabIndex={-1}
          data-destructive={destructive || undefined} onClick={()=>{ close(true);run() }}><ActionIcon size={16} aria-hidden="true" />{actionLabel}</button>)}
      </div>, document.body)}
  </>
}

export function SearchBox({ value, change, placeholder = "Search records…" }: { value: string; change: (value: string) => void; placeholder?: string }) {
  return <label className="search-box"><Search size={17} /><input type="search" aria-label={placeholder} placeholder={placeholder} value={value} onChange={e => change(e.target.value)} /></label>
}

export type Column<T> = { label: string; cell: (row: T) => ReactNode; numeric?: boolean; actions?: boolean }

function columnClass<T>(column: Column<T>) {
  if (column.actions) return "table-action-cell"
  return column.numeric ? "numeric" : undefined
}
export function Table<T extends { id: string }>({ rows, columns, empty, pageSize = 10 }: {
  rows: T[]; columns: Column<T>[]; empty?: string; pageSize?: number
}) {
  const [page,setPage] = useState(1)
  if (!rows.length) return <Empty title={empty} />
  const pages = Math.ceil(rows.length / pageSize)
  const current = Math.min(page,pages)
  const offset = (current-1)*pageSize
  return <>
    <div className="table-scroll"><table>
      <thead><tr>{columns.map(column => <th key={column.label} scope="col" className={columnClass(column)}>{column.label}</th>)}</tr></thead>
      <tbody>{rows.slice(offset,offset+pageSize).map(row => <tr key={row.id}>{columns.map(column =>
        <td key={column.label} className={columnClass(column)}>{column.cell(row)}</td>)}</tr>)}</tbody>
    </table></div>
    {pages > 1 && <div className="table-footer"><span>{offset+1}–{Math.min(offset+pageSize,rows.length)} of {rows.length}</span>
      <div><button type="button" className="icon-btn" disabled={current===1} aria-label="Previous page" onClick={() => setPage(current-1)}><ChevronLeft size={17} /></button>
        <button type="button" className="icon-btn" disabled={current===pages} aria-label="Next page" onClick={() => setPage(current+1)}><ChevronRight size={17} /></button></div>
    </div>}
  </>
}

export const val = (form: FormData, key: string) => String(form.get(key) ?? "").trim()
export const opt = (form: FormData, key: string) => val(form,key) || null
export const numberVal = (form: FormData, key: string) => Number(val(form,key))
