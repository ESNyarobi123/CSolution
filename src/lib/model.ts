import type { Role, User } from "./access"

export const productTypes = ["Stocked", "Non-stock", "Service"] as const
export const customerTypes = ["Retail", "Business", "Agent"] as const
export const buyerTypes = ["Walk-in", "Customer", "Agent"] as const
export type BuyerType = typeof buyerTypes[number]
export const expenseCategories = ["Transport", "Utilities", "Rent", "Wages", "Office supplies", "Marketing", "Other"] as const
export const methods = ["Cash", "Mobile money", "Bank transfer", "Card"] as const
export const jobStatuses = ["Requested", "Scheduled", "In progress", "Completed", "Cancelled"] as const
export type Business = { name: string; phone: string; email: string; address: string; invoice_prefix: string; currency: string }
export type Group = { id: string; name: string; description: string; product_count: number }
export type Product = {
  id: string; name: string; sku: string; category_id: string | null; brand_id: string | null;
  category: string | null; brand: string | null; type: typeof productTypes[number]; unit: string;
  description: string; cost?: number; price: number; agent_price: number | null;
  reorder: number; warranty: number; on_hand: number; active: boolean; image_url: string | null
}
export type Person = { id: string; name: string; phone: string; email: string; address: string }
export type Customer = Person & { kind: typeof customerTypes[number]; code: string | null; sales_count: number; outstanding: number }
export type Purchase = { id: string; number: string; supplier: string; reference: string; total: number; created_at: string }
export type StockMovement = { id: string; product_id: string; product: string; sku: string; kind: string; delta: number; reference: string; staff: string; created_at: string }
export type SerialRecord = { id: string; serial: string; product: string; sku: string; reference: string;
  source: string; customer: string | null; warranty_until: string | null; status: string }
export type Sale = {
  id: string; number: string; invoice: string; customer_id: string | null; customer_name: string;
  customer_address: string; customer_phone: string; buyer_type: BuyerType; cashier: string; kind: string; subtotal: number;
  discount: number; tax: number; total: number; cost?: number; net_revenue: number; net_cost?: number; paid: number; credits: number;
  balance: number; due_date: string | null; last_payment_at: string | null; created_at: string; status: "Paid" | "Partial" | "Unpaid" | "Returned"
}
export type Line = { productId: string; quantity: number; price?: number; serial?: string }
export type SaleLine = {
  id: string; product_id: string; name: string; sku: string; unit: string; quantity: number; price: number;
  cost?: number; type: string; serial: string; warranty_until: string | null; returned: number
}
export type SaleDetail = { sale: Sale; lines: SaleLine[]; payments: { id: string; method: string; amount: number; reference: string; created_at: string }[]; returns: { id: string; product: string; quantity: number; credit: number; refund: number; reason: string; created_at: string }[] }
export type Quote = { id: string; version: number; number: string; customer_id: string | null; customer_name: string; buyer_type: BuyerType; lines: (Line & { name: string; price: number })[]; discount: number; tax: number; total: number; valid_until: string | null; sale_id: string | null; created_at: string }
export type Job = { id: string; number: string; title: string; customer_id: string | null; customer: string | null; sale_id: string | null; sale: string | null; technician_id: string | null; technician: string | null; location: string; status: typeof jobStatuses[number]; scheduled: string | null; notes: string; material_cost?: number; extra_cost?: number; created_at: string }
export type JobDetail = { job: Job; materials: { id: string; name: string; quantity: number; serial: string; cost?: number; from_sale: boolean }[]; expenses: Expense[] }
export type Expense = { id: string; description: string; amount: number; job_id: string | null; job: string | null; incurred: string; category: typeof expenseCategories[number]; method: typeof methods[number] | null; reference: string; notes: string }
export type Staff = { id: string; name: string; email: string; role: Role; active: boolean }
export type SeriesPoint = { day: string; sales: number; collected: number; profit?: number; net?: number; overhead?: number }
export type Breakdown = { name: string; product_id: string | null; sku: string | null; sales: number; units: number; profit: number }
export type ApprovalSummary = {
  buyer: string; total: number; paid: number; discount: number; method?: typeof methods[number];
  dueDate?: string | null; soldOn?: string | null; saleNumber?: string; refund?: number; credit?: number; restock?: boolean;
  items: { name: string; quantity: number; price: number }[]
}
export type Approval = {
  id: string; kind: "Sale terms" | "Return"; status: "Pending" | "Approved" | "Rejected" | "Completed";
  requester: string; reason: string; reviewer: string | null; review_note: string; reviewed_at: string | null;
  created_at: string; result_sale_id: string | null; summary: ApprovalSummary
}
export type Snapshot = {
  user: User; business: Business; today: string; days: number; updatedAt: string;
  kpi: { revenue: number; collected: number; profit?: number; net?: number; overhead?: number; stockValue?: number; stockCount: number; outstanding?: number; saleCount: number };
  previous: { revenue: number; collected: number; profit?: number; net?: number };
  series: SeriesPoint[]; categories: Group[]; brands: Group[]; products: Product[]; customers: Customer[];
  suppliers: Person[]; purchases: Purchase[]; movements: StockMovement[]; serials: SerialRecord[]; sales: Sale[]; quotes: Quote[];
  jobs: Job[]; expenses: Expense[]; staff: Staff[]; audit: { id: string; action: string; detail: string; staff: string; created_at: string }[];
  approvals: Approval[];
  breakdown: { products: Breakdown[]; brands: Breakdown[]; categories: Breakdown[]; agents: Breakdown[] }
}
