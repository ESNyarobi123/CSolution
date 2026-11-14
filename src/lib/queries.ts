import { can, ownSalesOnly, type User } from "./access"
import { first, pool, rows } from "./db"
import type { Approval, Breakdown, Business, Customer, Expense, Group, Job, JobDetail, Person, Product, Purchase, Quote, Sale, SaleDetail, SerialRecord, SeriesPoint, Snapshot, Staff, StockMovement } from "./model"

export const saleSummary = `
  WITH pay AS (
    SELECT sale_id,sum(amount) AS paid,max(created_at) AS last_payment_at FROM payments GROUP BY sale_id
  ), ret AS (
    SELECT li.sale_id,sum(r.credit) AS credits,sum(r.refund) AS refunds,sum(r.tax_credit) AS tax_credits,
      sum(CASE WHEN r.restock THEN li.cost*r.quantity ELSE 0 END) AS restocked_cost
    FROM returns r JOIN sale_items li ON r.sale_item_id=li.id GROUP BY li.sale_id
  )
  SELECT s.id,s.number,s.invoice,s.customer_id,s.customer_name,s.customer_address,s.customer_phone,s.buyer_type,pay.last_payment_at,
    u.name AS cashier,s.kind,s.subtotal,s.discount,s.tax,s.total,s.cost,s.due_date::text,s.created_at,
    s.total-s.tax-COALESCE(ret.credits,0)+COALESCE(ret.tax_credits,0) AS net_revenue,
    s.cost-COALESCE(ret.restocked_cost,0) AS net_cost,
    COALESCE(pay.paid,0)-COALESCE(ret.refunds,0) AS paid, COALESCE(ret.credits,0) AS credits,
    s.total-COALESCE(ret.credits,0)-COALESCE(pay.paid,0)+COALESCE(ret.refunds,0) AS balance,
    CASE WHEN COALESCE(ret.credits,0)>0 AND s.total=ret.credits THEN 'Returned'
      WHEN s.total-COALESCE(ret.credits,0)<=COALESCE(pay.paid,0)-COALESCE(ret.refunds,0) THEN 'Paid'
      WHEN COALESCE(pay.paid,0)-COALESCE(ret.refunds,0)>0 THEN 'Partial' ELSE 'Unpaid' END AS status
  FROM sales s JOIN staff u ON s.cashier_id=u.id LEFT JOIN pay ON pay.sale_id=s.id LEFT JOIN ret ON ret.sale_id=s.id`

const jobSummary = `
  SELECT j.id,j.number,j.title,j.customer_id,COALESCE(c.name,s.customer_name) AS customer,j.sale_id,s.number AS sale,
    j.technician_id,u.name AS technician,j.location,j.status,j.scheduled::text,j.notes,j.services,j.created_at,
    COALESCE((SELECT sum(cost*quantity) FROM installation_items WHERE job_id=j.id),0) AS material_cost,
    COALESCE((SELECT sum(amount) FROM expenses WHERE job_id=j.id),0) AS extra_cost
  FROM installations j LEFT JOIN customers c ON c.id=j.customer_id LEFT JOIN sales s ON s.id=j.sale_id
  LEFT JOIN staff u ON u.id=j.technician_id`

const expenseList = `SELECT e.id,e.description,e.amount,e.job_id,j.number AS job,e.incurred::text,e.category,e.method,e.reference,e.notes
  FROM expenses e LEFT JOIN installations j ON j.id=e.job_id`
const localDay = "(now() AT TIME ZONE 'Africa/Dar_es_Salaam')::date"
const dailyResults = `WITH dates AS (
  SELECT generate_series(${localDay}-($1::int*2-1),${localDay},interval '1 day')::date AS day
), entries AS (
  SELECT (created_at AT TIME ZONE 'Africa/Dar_es_Salaam')::date AS day,
    total-tax AS revenue, total-tax-cost AS profit, 1 AS sale_count, 0 AS overhead, 0 AS collected FROM sales
    WHERE ($2::uuid IS NULL OR cashier_id=$2)
  UNION ALL
  SELECT (r.created_at AT TIME ZONE 'Africa/Dar_es_Salaam')::date,-r.credit+r.tax_credit,
    -r.credit+r.tax_credit+CASE WHEN r.restock THEN l.cost*r.quantity ELSE 0 END,0,0,-r.refund
  FROM returns r JOIN sale_items l ON l.id=r.sale_item_id JOIN sales s ON s.id=l.sale_id
    WHERE ($2::uuid IS NULL OR s.cashier_id=$2)
  UNION ALL
  SELECT incurred,0,CASE WHEN job_id IS NOT NULL THEN -amount ELSE 0 END,0,CASE WHEN job_id IS NULL THEN amount ELSE 0 END,0
    FROM expenses WHERE $2::uuid IS NULL
  UNION ALL
  SELECT (created_at AT TIME ZONE 'Africa/Dar_es_Salaam')::date,0,-quantity*cost,0,0,0 FROM installation_items WHERE $2::uuid IS NULL
  UNION ALL
  SELECT (p.created_at AT TIME ZONE 'Africa/Dar_es_Salaam')::date,0,0,0,0,p.amount
    FROM payments p JOIN sales s ON s.id=p.sale_id WHERE ($2::uuid IS NULL OR s.cashier_id=$2)
)
SELECT dates.day::text,COALESCE(sum(revenue),0) AS sales,COALESCE(sum(profit),0) AS profit,
  COALESCE(sum(sale_count),0) AS sale_count, COALESCE(sum(overhead),0) AS overhead, COALESCE(sum(collected),0) AS collected
FROM dates LEFT JOIN entries ON dates.day=entries.day GROUP BY dates.day ORDER BY dates.day`

function groupCounts(table: "categories" | "brands") {
  const foreignKey = table === "categories" ? "category_id" : "brand_id"
  return rows<Group>(pool, `SELECT g.*,count(p.id) AS product_count FROM ${table} g
    LEFT JOIN products p ON p.${foreignKey}=g.id AND p.active GROUP BY g.id ORDER BY g.name`)
}

async function breakdown(days: number) {
  const data = await rows<Breakdown & { kind: keyof Snapshot["breakdown"] }>(pool, `
    WITH movement AS (
      SELECT l.product_id,s.customer_id,s.buyer_type,l.quantity,
        CASE WHEN s.subtotal=0 THEN 0 ELSE l.quantity*l.price*(s.subtotal-s.discount)/s.subtotal END AS revenue,
        l.quantity*l.cost AS cost
      FROM sale_items l JOIN sales s ON s.id=l.sale_id
      WHERE (s.created_at AT TIME ZONE 'Africa/Dar_es_Salaam')::date BETWEEN ${localDay}-($1::int-1) AND ${localDay}
      UNION ALL
      SELECT l.product_id,s.customer_id,s.buyer_type,-r.quantity,-r.credit+r.tax_credit,
        CASE WHEN r.restock THEN -l.cost*r.quantity ELSE 0 END
      FROM returns r JOIN sale_items l ON l.id=r.sale_item_id JOIN sales s ON s.id=l.sale_id
      WHERE (r.created_at AT TIME ZONE 'Africa/Dar_es_Salaam')::date BETWEEN ${localDay}-($1::int-1) AND ${localDay}
    )
    SELECT d.kind,d.name,d.product_id,d.sku,
      round(sum(m.revenue)) AS sales,sum(m.quantity) AS units,round(sum(m.revenue-m.cost)) AS profit
    FROM movement m JOIN products p ON m.product_id=p.id LEFT JOIN categories c ON c.id=p.category_id
    LEFT JOIN brands b ON b.id=p.brand_id LEFT JOIN customers a ON a.id=m.customer_id AND m.buyer_type='Agent'
    CROSS JOIN LATERAL (VALUES
      ('products',p.name,p.id,p.sku),('categories',c.name,NULL,NULL),
      ('brands',b.name,NULL,NULL),('agents',a.name,NULL,NULL)
    ) d(kind,name,product_id,sku)
    WHERE d.name IS NOT NULL GROUP BY d.kind,d.name,d.product_id,d.sku ORDER BY sales DESC,d.name,d.sku`, [days])
  const result: Snapshot["breakdown"] = { products: [], brands: [], categories: [], agents: [] }
  for (const { kind, ...item } of data) result[kind].push(item)
  return result
}

export async function getSnapshot(user: User, days = 7): Promise<Snapshot> {
  const financials = can(user.role, "reports")
  const costs = can(user.role, "costs")
  const sells = can(user.role, "sales")
  const inventory = can(user.role, "inventory")
  const managesJobs = can(user.role, "jobs")
  const viewsJobs = can(user.role, "viewJobs")
  const technician = user.role === "Technician"
  const admin = can(user.role, "admin")
  const ownSales = ownSalesOnly(user.role)
  const salesOwner = ownSales ? user.id : null
  const ownRequests = can(user.role,"requestJobs")
  const jobScope = technician ? " WHERE j.technician_id=$1" : ownRequests ? " WHERE j.created_by=$1" : ""
  const [business, date, products, categories, brands, customers, suppliers, purchases, movements,
    sales, quotes, jobs, staff, expenses, audit, daily, stock, report, balance, serials, approvals] = await Promise.all([
    first<Business>(pool, "SELECT name,phone,email,address,invoice_prefix,currency FROM business WHERE id=1"),
    first<{ today: string }>(pool, `SELECT ${localDay}::text AS today`),
    rows<Product>(pool, `SELECT p.id,p.name,p.sku,p.category_id,p.brand_id,c.name AS category,b.name AS brand,p.type,
      p.unit,p.description,${costs ? "p.cost," : ""}p.price,p.agent_price,p.reorder,p.warranty,p.on_hand,p.active,p.image_url,p.installation
      FROM products p LEFT JOIN categories c ON c.id=p.category_id LEFT JOIN brands b ON b.id=p.brand_id
      ${ownSales ? "WHERE p.active" : ""} ORDER BY p.active DESC,p.name`),
    groupCounts("categories"), groupCounts("brands"),
    sells ? rows<Customer>(pool, `SELECT c.*,count(s.id) AS sales_count,COALESCE(sum(s.balance),0) AS outstanding
      FROM customers c LEFT JOIN (${saleSummary}${ownSales ? " WHERE s.cashier_id=$1" : ""}) s ON s.customer_id=c.id
      GROUP BY c.id ORDER BY c.name`, ownSales ? [user.id] : []) : [],
    inventory ? rows<Person>(pool, "SELECT id,name,phone,email,address FROM suppliers ORDER BY name") : [],
    inventory ? rows<Purchase>(pool, `SELECT p.id,p.number,s.name AS supplier,p.reference,p.total,p.created_at
      FROM purchases p JOIN suppliers s ON s.id=p.supplier_id ORDER BY p.created_at DESC`) : [],
    inventory ? rows<StockMovement>(pool, `SELECT m.id,m.product_id,p.name AS product,p.sku,m.kind,m.delta,m.reference,u.name AS staff,m.created_at
      FROM stock_movements m JOIN products p ON p.id=m.product_id JOIN staff u ON u.id=m.staff_id ORDER BY m.created_at DESC`) : [],
    sells ? rows<Sale>(pool, saleSummary + (ownSales ? " WHERE s.cashier_id=$1" : "") + " ORDER BY s.created_at DESC", ownSales ? [user.id] : []).then(items => {
      if (financials) return items
      return items.map(({ cost: _cost, net_cost: _netCost, ...item }) => item)
    }) : [],
    sells ? rows<Quote>(pool, `SELECT id,version,number,customer_id,customer_name,buyer_type,lines,discount,tax,total,valid_until::text,sale_id,created_at
      FROM quotations ${ownSales ? "WHERE created_by=$1" : ""} ORDER BY created_at DESC`, ownSales ? [user.id] : []) : [],
    viewsJobs ? rows<Job>(pool, jobSummary + jobScope + " ORDER BY j.created_at DESC", jobScope ? [user.id] : []).then(items => {
      if (financials) return items
      return items.map(({ material_cost: _materials, extra_cost: _expenses, ...item }) => item)
    }) : [],
    admin ? rows<Staff>(pool, "SELECT id,name,email,role,active FROM staff ORDER BY name") :
      managesJobs ? rows<Staff>(pool, "SELECT id,name,role,active,'' AS email FROM staff WHERE role='Technician' AND active ORDER BY name") : [],
    financials ? rows<Expense>(pool, expenseList + " ORDER BY e.incurred DESC,e.created_at DESC") : [],
    admin ? rows<Snapshot["audit"][number]>(pool, `SELECT a.id,a.action,a.detail,u.name AS staff,a.created_at
      FROM audit_logs a JOIN staff u ON u.id=a.staff_id ORDER BY a.created_at DESC`) : [],
    sells ? rows<Omit<Required<SeriesPoint>, "net"> & { sale_count: number }>(pool, dailyResults, [days,salesOwner]) : [],
    first(pool, `SELECT count(*) FILTER (WHERE active) AS skus,${financials ? "COALESCE(sum(cost*on_hand),0)" : "0"} AS value
      FROM products WHERE type='Stocked'`),
    financials ? breakdown(days) : { products: [], brands: [], categories: [], agents: [] },
    sells ? first(pool, "SELECT COALESCE(sum(balance),0) AS value FROM (" + saleSummary + (ownSales ? " WHERE s.cashier_id=$1" : "") + ") s", ownSales ? [user.id] : []) : undefined,
    inventory ? rows<SerialRecord>(pool, `SELECT DISTINCT ON (product_id,lower(serial))
      id,serial,product,sku,reference,source,customer,warranty_until,status
      FROM (
        SELECT l.id,l.product_id,l.serial,l.name AS product,p.sku,s.number AS reference,'Sale' AS source,
          s.customer_name AS customer,l.warranty_until::text,
          CASE WHEN r.restock THEN 'Restocked' WHEN r.id IS NOT NULL THEN 'Returned' ELSE 'Sold' END AS status,
          COALESCE(r.created_at,s.created_at) AS activity
        FROM sale_items l JOIN sales s ON l.sale_id=s.id JOIN products p ON p.id=l.product_id
        LEFT JOIN returns r ON r.sale_item_id=l.id WHERE l.serial<>''
        UNION ALL
        SELECT i.id,i.product_id,i.serial,p.name,p.sku,j.number,'Extra installation material',
          COALESCE(c.name,s.customer_name),NULL,'Installed',i.created_at
        FROM installation_items i JOIN products p ON p.id=i.product_id JOIN installations j ON j.id=i.job_id
        LEFT JOIN customers c ON c.id=j.customer_id LEFT JOIN sales s ON s.id=j.sale_id WHERE i.serial<>''
      ) tracked ORDER BY product_id,lower(serial),activity DESC`) : [],
    can(user.role,"viewApprovals") ? rows<Approval>(pool, `SELECT a.id,a.kind,a.status,
      requester.name AS requester,a.reason,reviewer.name AS reviewer,a.review_note,a.reviewed_at,a.created_at,a.result_sale_id,a.summary
      FROM approval_requests a JOIN staff requester ON requester.id=a.requested_by LEFT JOIN staff reviewer ON reviewer.id=a.reviewed_by
      WHERE ($1::uuid IS NULL OR a.requested_by=$1) ORDER BY (a.status='Pending') DESC,a.created_at DESC`,
      [can(user.role,"reviewApprovals") ? null : user.id]) : []
  ])
  const aggregate = (data: typeof daily) => data.reduce((a, p) => ({
    revenue: a.revenue + p.sales, profit: a.profit + p.profit, net: a.net + p.profit - p.overhead,
    overhead: a.overhead + p.overhead, collected: a.collected + p.collected, saleCount: a.saleCount + p.sale_count
  }), { revenue: 0, profit: 0, net: 0, overhead: 0, collected: 0, saleCount: 0 })
  const current = daily.slice(days)
  const total = aggregate(current)
  const prior = aggregate(daily.slice(0, days))
  return {
    user, business: business!, today: date!.today, days, updatedAt: new Date().toISOString(),
    kpi: { revenue: total.revenue, collected: total.collected, saleCount: total.saleCount, stockCount: stock!.skus,
      ...(financials ? { profit: total.profit, net: total.net, overhead: total.overhead, stockValue: stock!.value } : {}),
      ...(sells ? { outstanding: balance?.value ?? 0 } : {}) },
    previous: { revenue: prior.revenue, collected: prior.collected, ...(financials ? { profit: prior.profit, net: prior.net } : {}) },
    series: current.map(p => ({ day: p.day, sales: p.sales, collected: p.collected,
      ...(financials ? { profit: p.profit, net: p.profit-p.overhead, overhead: p.overhead } : {}) })),
    products, categories, brands, customers, suppliers, purchases, movements, serials, sales, quotes, jobs, staff, expenses, audit, approvals, breakdown: report
  }
}

export async function getSale(id: string, user: User): Promise<SaleDetail | undefined> {
  const sale = await first<Sale>(pool, saleSummary + " WHERE s.id=$1 AND ($2::uuid IS NULL OR s.cashier_id=$2)", [id,ownSalesOnly(user.role) ? user.id : null])
  if (!sale) return undefined
  if (!can(user.role, "reports")) {
    delete sale.cost
    delete sale.net_cost
  }
  const [lines, payments, returned] = await Promise.all([
    rows<SaleDetail["lines"][number]>(pool, `SELECT l.id,l.product_id,l.name,p.sku,l.unit,l.quantity,l.price,l.list_price,l.type,l.serial,l.warranty_until::text,
      ${can(user.role, "reports") ? "l.cost," : ""}COALESCE(sum(r.quantity),0) AS returned
      FROM sale_items l JOIN products p ON p.id=l.product_id LEFT JOIN returns r ON r.sale_item_id=l.id
      WHERE l.sale_id=$1 GROUP BY l.id,p.id ORDER BY l.id`, [id]),
    rows<SaleDetail["payments"][number]>(pool, "SELECT id,method,amount,reference,created_at FROM payments WHERE sale_id=$1 ORDER BY created_at", [id]),
    rows<SaleDetail["returns"][number]>(pool, `SELECT r.id,l.name AS product,r.quantity,r.credit,r.refund,r.reason,r.created_at
      FROM returns r JOIN sale_items l ON l.id=r.sale_item_id WHERE l.sale_id=$1 ORDER BY r.created_at`, [id])
  ])
  return { sale, lines, payments, returns: returned }
}

export async function getJob(id: string, user: User): Promise<JobDetail | undefined> {
  const scope = user.role === "Technician" ? " AND j.technician_id=$2" : can(user.role,"requestJobs") ? " AND j.created_by=$2" : ""
  const financials = can(user.role, "reports")
  const job = await first<Job>(pool, jobSummary + " WHERE j.id=$1" + scope, scope ? [id,user.id] : [id])
  if (!job) return undefined
  if (!financials) {
    delete job.material_cost
    delete job.extra_cost
  }
  const [materials, expenses] = await Promise.all([
    rows<JobDetail["materials"][number]>(pool, `SELECT i.id,p.name,i.quantity,i.serial,${financials ? "i.cost," : ""}false AS from_sale
      FROM installation_items i JOIN products p ON i.product_id=p.id WHERE i.job_id=$1
      UNION ALL
      SELECT l.id,l.name,(l.quantity-COALESCE(sum(r.quantity),0))::integer,l.serial,${financials ? "l.cost," : ""}true
      FROM sale_items l LEFT JOIN returns r ON r.sale_item_id=l.id
      WHERE l.sale_id=$2 AND l.type<>'Service' GROUP BY l.id HAVING l.quantity>COALESCE(sum(r.quantity),0)`, [id, job.sale_id]),
    financials ? rows<Expense>(pool, expenseList + " WHERE e.job_id=$1 ORDER BY e.incurred DESC", [id]) : []
  ])
  return { job, materials, expenses }
}
