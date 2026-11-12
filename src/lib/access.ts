export const roles = ["Admin", "Front Office", "Manager", "Cashier", "Storekeeper", "Technician"] as const
export type Role = typeof roles[number]
export type User = { id: string; name: string; email: string; role: Role; demo?: boolean }

export const capabilities = {
  catalog: ["Admin", "Manager", "Storekeeper"],
  inventory: ["Admin", "Manager", "Storekeeper"],
  sales: ["Admin", "Front Office", "Manager", "Cashier"],
  allSales: ["Admin", "Manager", "Cashier"],
  pricing: ["Admin", "Manager"],
  costs: ["Admin", "Manager", "Storekeeper"],
  customers: ["Admin", "Front Office", "Manager", "Cashier"],
  manageCustomers: ["Admin", "Manager", "Cashier"],
  jobs: ["Admin", "Manager", "Technician"],
  viewJobs: ["Admin", "Front Office", "Manager", "Technician"],
  scheduleJobs: ["Admin", "Manager"],
  requestJobs: ["Front Office"],
  requestApprovals: ["Front Office"],
  viewApprovals: ["Admin", "Front Office"],
  reviewApprovals: ["Admin"],
  reports: ["Admin", "Manager"],
  admin: ["Admin"]
} as const

export type Capability = keyof typeof capabilities
export const can = (role: Role, permission: Capability) =>
  (capabilities[permission] as readonly Role[]).includes(role)

// Human-readable labels for the permission matrix shown in Settings.
export const capabilityGroups: { name: string; items: { key: Capability; label: string }[] }[] = [
  { name: "Sales & documents", items: [
    { key: "sales", label: "Create sales, quotations, invoices and receipts" },
    { key: "allSales", label: "See every staff member's sales" },
    { key: "pricing", label: "Change prices and give discounts without approval" },
    { key: "requestApprovals", label: "Request approval for a discount, credit or return" },
    { key: "reviewApprovals", label: "Approve or reject those requests" }
  ]},
  { name: "Customers & agents", items: [
    { key: "customers", label: "Add customers and agents" },
    { key: "manageCustomers", label: "Edit and delete customers, set agent codes" }
  ]},
  { name: "Products & stock", items: [
    { key: "catalog", label: "Add and edit products, categories and brands" },
    { key: "inventory", label: "Receive stock, manage suppliers and purchases" },
    { key: "costs", label: "See buying prices and stock value" }
  ]},
  { name: "Installations", items: [
    { key: "requestJobs", label: "Submit an installation request" },
    { key: "viewJobs", label: "See installation jobs" },
    { key: "scheduleJobs", label: "Schedule jobs and assign technicians" },
    { key: "jobs", label: "Manage jobs, materials and status" }
  ]},
  { name: "Business control", items: [
    { key: "reports", label: "Profit, expenses, analytics and reports" },
    { key: "admin", label: "Staff, settings, audit log, deletions and backups" }
  ]}
]

export const ownSalesOnly = (role: Role) => can(role,"sales") && !can(role,"allSales")
