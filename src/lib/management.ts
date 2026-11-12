export const deletableRecords = {
  categories: "category",
  brands: "brand",
  products: "product",
  customers: "customer",
  suppliers: "supplier",
  quotations: "quotation",
  installations: "installation",
  expenses: "expense"
} as const

export type DeletableRecord = keyof typeof deletableRecords
