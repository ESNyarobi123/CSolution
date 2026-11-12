import type { Metadata } from "next"
import "@fontsource-variable/inter"
import "@fontsource-variable/plus-jakarta-sans"
import "./globals.css"

export const metadata: Metadata = {
  title: "CSolution · Shop Management",
  description: "Manage Connect Solutions inventory, sales, invoices and installations.",
  icons: { icon: "/csolution-logo.jpeg" }
}

export default function Layout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>
}
