import { spawn } from "node:child_process"
import { getUser } from "@/lib/auth"
import { can } from "@/lib/access"
import { pool } from "@/lib/db"

export async function GET() {
  const user = await getUser()
  if (!user || !can(user.role,"admin")) return Response.json({error:"Access denied."},{status:403})
  if (user.demo) return Response.json({error:"Sign in with an administrator password to download a database backup."},{status:403})
  const config = { ...process.env }
  if (process.env.DATABASE_URL) {
    const url = new URL(process.env.DATABASE_URL)
    config.PGHOST = url.hostname
    config.PGPORT = url.port || "5432"
    config.PGUSER = decodeURIComponent(url.username)
    config.PGPASSWORD = decodeURIComponent(url.password)
    config.PGDATABASE = decodeURIComponent(url.pathname.slice(1))
    if (url.searchParams.has("sslmode")) config.PGSSLMODE = url.searchParams.get("sslmode")!
  }
  const command = spawn("pg_dump",["--no-owner","--no-privileges","--format=custom","--exclude-table-data=sessions","--exclude-table-data=login_attempts"],{env:config})
  const parts: Buffer[] = []
  try {
    const result = await new Promise<number|null>((resolve,reject)=>{
      command.stdout.on("data",chunk=>parts.push(chunk))
      command.stderr.resume()
      command.on("error",reject)
      command.on("close",resolve)
    })
    if (result !== 0) throw new Error("pg_dump failed.")
    await pool.query("INSERT INTO audit_logs (staff_id,action,detail) VALUES ($1,'Database backup downloaded','PostgreSQL archive')",[user.id])
    return new Response(Uint8Array.from(Buffer.concat(parts)),{ headers:{
      "content-type":"application/octet-stream","content-disposition":'attachment; filename="csolutions-shop.dump"',"cache-control":"no-store"
    }})
  } catch(error) {
    console.error("Backup failed",error)
    return Response.json({error:"Database backup failed. Check the PostgreSQL tools on the server."},{status:500})
  }
}
