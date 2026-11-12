const formatter = new Intl.NumberFormat("en-TZ", { maximumFractionDigits: 0 })
const compact = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 2 })
const dateFormatter = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Africa/Dar_es_Salaam" })
const shopDayFormatter = new Intl.DateTimeFormat("sv-SE", {
  timeZone: "Africa/Dar_es_Salaam", year: "numeric", month: "2-digit", day: "2-digit"
})
export const shopDay = (value: string) => shopDayFormatter.format(new Date(value))
const chartDate = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "Africa/Dar_es_Salaam" })
export const num = (value: number) => formatter.format(value)
export const money = (value: number) => "TZS " + num(value)
export const short = (value: number) => compact.format(value)
export const date = (value: string | null | undefined) => value ? dateFormatter.format(new Date(value)) : "—"
export const dayLabel = (value: string) => chartDate.format(new Date(value))
export const initials = (value: string) => value.trim().split(/\s+/).slice(0,2).map(s => s[0]).join("").toUpperCase()

export class RequestError extends Error {
  constructor(message: string, public status: number) { super(message) }
}

export async function requestJSON<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, init)
  if (response.status === 401 && path.startsWith("/api/shop")) {
    location.reload()
    throw new Error("Sign in again to continue.")
  }
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new RequestError(data.error ?? "Request failed. Try again.",response.status)
  return data as T
}
