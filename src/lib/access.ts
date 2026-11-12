export const roles = ["Admin", "Manager", "Cashier", "Storekeeper", "Technician"] as const
export type Role = typeof roles[number]
export type User = { id: string; name: string; email: string; role: Role; demo?: boolean }

export const capabilities = {
  catalog: ["Admin", "Manager", "Storekeeper"],
  inventory: ["Admin", "Manager", "Storekeeper"],
  sales: ["Admin", "Manager", "Cashier"],
  pricing: ["Admin", "Manager"],
  costs: ["Admin", "Manager", "Storekeeper"],
  customers: ["Admin", "Manager", "Cashier"],
  jobs: ["Admin", "Manager", "Technician"],
  reports: ["Admin", "Manager"],
  admin: ["Admin"]
} as const

export type Capability = keyof typeof capabilities
export const can = (role: Role, permission: Capability) =>
  (capabilities[permission] as readonly Role[]).includes(role)
