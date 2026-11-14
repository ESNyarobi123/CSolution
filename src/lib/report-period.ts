export const reportPresets = ["today","week","month","7","14","30","90"] as const
export type ReportPeriod = { preset: typeof reportPresets[number] } | { preset: "custom"; from: string; to: string }
export type ReportRange = { from: string; to: string }
export const maxReportDays = 366
const dayMs = 86_400_000

export const offsetDay = (day: string, offset: number) =>
  new Date(Date.parse(day)+offset*dayMs).toISOString().slice(0,10)
export const rangeDays = ({ from,to }: ReportRange) => (Date.parse(to)-Date.parse(from))/dayMs+1

export function reportRange(today: string, period: ReportPeriod): ReportRange {
  if (period.preset==="custom") return { from:period.from,to:period.to }
  if (period.preset==="today") return { from:today,to:today }
  if (period.preset==="week") {
    const weekday = new Date(today).getUTCDay()
    return {from:offsetDay(today,-((weekday+6)%7)),to:today}
  }
  if (period.preset==="month") return {from:today.slice(0,7)+"-01",to:today}
  return {from:offsetDay(today,1-Number(period.preset)),to:today}
}
