"use client"

import { useState, type FormEvent } from "react"
import { ArrowRight, ChartNoAxesCombined, Layers3, ShieldCheck } from "lucide-react"
import { Brand, ErrorLine, Field } from "./ui"
import { requestJSON } from "@/lib/format"

export function SignIn({ demo }: { demo: boolean }) {
  const [working,setWorking] = useState(false)
  const [error,setError] = useState("")
  async function enter(data: object) {
    setWorking(true)
    setError("")
    try {
      await requestJSON("/api/auth",{ method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(data) })
      location.replace("/")
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sign-in failed.")
      setWorking(false)
    }
  }
  function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    void enter({ email: form.get("email"), password: form.get("password") })
  }
  return <main className="signin">
    <section className="signin-brand">
      <Brand light />
      <div className="signin-copy">
        <div className="signin-symbol"><Layers3 size={34} /></div>
        <h1>Manage your networking shop in one place.</h1>
        <p>Track inventory, process sales and keep a service history for every installation.</p>
        <div className="signin-feature"><ChartNoAxesCombined size={20} /> Shop management</div>
      </div>
      <div className="rings" aria-hidden="true"><i /><i /><i /></div>
      <small className="signin-location">Connect Solutions · Dar es Salaam</small>
    </section>
    <section className="signin-main">
      <div className="signin-form">
        <div className="signin-lock"><ShieldCheck size={22} /></div>
        <h2>Sign in to CSolution</h2>
        <p>Use your staff account to open the shop workspace.</p>
        <form onSubmit={signIn}>
          <Field label="Email address"><input name="email" type="email" autoComplete="username" placeholder="you@example.com" required /></Field>
          <Field label="Password"><input name="password" type="password" autoComplete="current-password" placeholder="Enter your password" required /></Field>
          <ErrorLine message={error} />
          <button className="button primary" disabled={working}>{working ? "Opening workspace…" : "Sign in"}<ArrowRight size={17} /></button>
          {demo && <button className="button secondary" disabled={working} type="button" onClick={() => void enter({action:"demo"})}>Open demo workspace<ArrowRight size={17} /></button>}
        </form>
      </div>
    </section>
  </main>
}
