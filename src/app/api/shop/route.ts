import { z } from "zod"
import { can } from "@/lib/access"
import { getUser, sameOrigin } from "@/lib/auth"
import { changeShop, ShopError } from "@/lib/mutations"
import { getJob, getSale, getSnapshot } from "@/lib/queries"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const user = await getUser()
  if (!user) return Response.json({ error: "Sign in again to continue." }, { status: 401 })
  const search = new URL(request.url).searchParams
  const detail = search.get("detail")
  if (detail) {
    const id = z.uuid().safeParse(search.get("id"))
    if (!id.success) return Response.json({ error: "Invalid record." }, { status: 400 })
    const permission = detail === "sale" ? "sales" : detail === "job" ? "jobs" : undefined
    if (!permission || !can(user.role,permission)) return Response.json({ error: "Access denied." }, { status: 403 })
    const data = detail === "sale" ? await getSale(id.data,user) : await getJob(id.data,user)
    return data ? Response.json(data) : Response.json({ error: "Record could not be found." }, { status: 404 })
  }
  const days = Number(search.get("days"))
  return Response.json(await getSnapshot(user,[7,14,30,90].includes(days) ? days : 7))
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "Invalid request origin." }, { status: 403 })
  const user = await getUser()
  if (!user) return Response.json({ error: "Sign in again to continue." }, { status: 401 })
  try {
    const body = await request.json().catch(() => null)
    return Response.json(await changeShop(body,user))
  } catch (error) {
    if (error instanceof ShopError) return Response.json({ error: error.message }, { status: error.status })
    const code = (error as { code?: string }).code
    if (code === "23505") return Response.json({ error: "That name, code or reference is already in use." }, { status: 409 })
    if (code === "23503") return Response.json({ error: "A linked record could not be found." }, { status: 400 })
    if (code === "40P01" || code === "40001") return Response.json({ error: "A concurrent update interrupted the action. Try again." }, { status: 409 })
    console.error("Shop write failed", error)
    return Response.json({ error: "The change could not be saved. Try again." }, { status: 500 })
  }
}
