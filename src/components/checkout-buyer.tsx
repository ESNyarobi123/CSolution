"use client"

import { useState } from "react"
import { Search, UserRoundPlus } from "lucide-react"
import { buyerTypes, type BuyerType, type Customer } from "@/lib/model"
import { initials } from "@/lib/format"
import { Field } from "./ui"

export const buyerNameKey = (name: string) => name.trim().replace(/\s+/g," ").toLowerCase()
export const isBuyerAccount = (type: BuyerType, customer: Customer) =>
  type!=="Walk-in" && (type==="Agent")===(customer.kind==="Agent")

export function CheckoutBuyer({ type, name, account, ambiguousName, customers, onType, onName, onSelect }: {
  type: BuyerType
  name: string
  account?: Customer
  ambiguousName: boolean
  customers: Customer[]
  onType: (value: BuyerType) => void
  onName: (value: string) => void
  onSelect: (customer: Customer) => void
}) {
  const [showSearch,setShowSearch] = useState(false)
  const [query,setQuery] = useState("")
  const search = buyerNameKey(query)
  const matches = showSearch ? customers.filter(customer=>isBuyerAccount(type,customer) &&
    (!search || [customer.name,customer.phone,customer.code].some(value=>value && buyerNameKey(value).includes(search))))
    .sort((a,b)=>Number(buyerNameKey(b.name)===search)-Number(buyerNameKey(a.name)===search)).slice(0,5) : []
  const label = type==="Agent" ? "Agent or reseller" : "Customer"

  function closeSearch() {
    setShowSearch(false)
    setQuery("")
  }

  function selectAccount(customer: Customer) {
    onSelect(customer)
    closeSearch()
  }

  return <div className="buyer-picker">
    <fieldset className="payment-options">
      <legend>Buyer type</legend>
      {buyerTypes.map(value=><label key={value}>
        <input type="radio" name="buyerTypeChoice" checked={type===value} onChange={()=>{
          closeSearch()
          onType(value)
        }} /><span>{value==="Agent" ? "Agent / Reseller" : value}</span>
      </label>)}
    </fieldset>
    {type!=="Walk-in" && <>
      <Field label={label+" name"}>
        <input type="text" value={name} maxLength={160} required autoComplete="off" placeholder={"Enter "+label.toLowerCase()+" name"}
          onChange={event=>onName(event.target.value)} onKeyDown={event=>{
            if (event.key==="Enter") event.preventDefault()
          }} />
      </Field>
      {name.trim() && !ambiguousName && <p className="checkout-hint buyer-new-note" aria-live="polite">{account ?
        <>Using existing account: {account.name}.</> : <><UserRoundPlus size={15} /> This name will be saved with the record.</>}</p>}
      <button type="button" className="buyer-account-action" aria-expanded={showSearch} onClick={()=>{
        if (showSearch) closeSearch()
        else setShowSearch(true)
      }}><Search size={14} /> {showSearch ? "Hide account search" : "Choose an existing account"}</button>
      {showSearch && <>
        <Field label="Search accounts">
          <input type="search" value={query} placeholder="Name, phone or account code" onChange={event=>setQuery(event.target.value)}
            onKeyDown={event=>{
              if (event.key!=="Enter") return
              event.preventDefault()
              if (matches.length===1) selectAccount(matches[0])
            }} />
        </Field>
        {matches.length ? <div className="buyer-matches" aria-label="Matching accounts">
          {matches.map(customer=><button type="button" key={customer.id} onClick={()=>selectAccount(customer)}>
            <span className="avatar mini">{initials(customer.name)}</span><span><strong>{customer.name}</strong>
              {(customer.phone || customer.code) && <small>{[customer.code,customer.phone].filter(Boolean).join(" · ")}</small>}</span>
          </button>)}
        </div> : <p className="checkout-hint">No matching accounts.</p>}
      </>}
    </>}
  </div>
}
