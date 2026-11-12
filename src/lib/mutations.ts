import { randomUUID } from "node:crypto"
import { z } from "zod"
import { can, ownSalesOnly, roles, type Capability, type User } from "./access"
import { hashPassword } from "./auth"
import { first, rows, transaction, type Client } from "./db"
import { buyerTypes, customerTypes, expenseCategories, jobStatuses, methods, productTypes, type ApprovalSummary, type BuyerType, type Product } from "./model"
import { deletableRecords, type DeletableRecord } from "./management"
import { saleSummary } from "./queries"

const id = z.uuid()
const name = z.string().trim().min(1, "Enter a name.").max(160)
const text = z.string().trim().max(2000).default("")
const amount = z.number().int().min(0).max(9999999999)
const transactionAmount = z.number().int().min(0).max(99_999_999_999_999)
const quantity = z.number().int().min(1).max(100000)
const day = z.iso.date()
const contact = {
  id: id.optional(), name, phone: z.string().trim().max(40).default(""),
  email: z.union([z.email(), z.literal("")]).default(""), address: text
}
const line = z.object({ productId: id, quantity, price: amount.optional(), expectedUnitPrice: amount.optional(), serial: z.string().trim().max(100).optional() })
const cart = {
  customerId: id.nullable(), buyerType: z.enum(buyerTypes).optional(), newBuyer: z.object({ name }).optional(),
  lines: z.array(line).min(1).max(100), expectedTotal: transactionAmount.optional(),
  discount: amount.default(0), tax: amount.default(0)
}
const saleInput = z.object({ action: z.literal("sale"), ...cart, requestId: id, quoteId: id.optional(), quoteVersion: z.number().int().positive().optional(), paid: transactionAmount.default(0),
  method: z.enum(methods), reference: text, dueDate: day.nullable(),
  installation: z.object({ title: name, location: text, technicianId: id.nullable(), scheduled: day.nullable() }).optional() })
const returnInput = z.object({ action: z.literal("return"), requestId: id, saleId: id, lineId: id, quantity, restock: z.boolean(), reason: name })
const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("group"), kind: z.enum(["categories", "brands"]), id: id.optional(), name, description: text }),
  z.object({ action: z.literal("product"), id: id.optional(), name, sku: z.string().trim().min(1).max(60),
    categoryId: id.nullable(), brandId: id.nullable(), type: z.enum(productTypes), unit: z.string().trim().min(1).max(15),
    description: text, cost: amount, price: amount, agentPrice: amount.nullable(),
    reorder: z.number().int().min(0).max(100000), warranty: z.number().int().min(0).max(120),
    initialStock: z.number().int().min(0).max(100000).default(0), imageUrl: z.string().max(2000).nullable(), active: z.boolean().default(true) }),
  z.object({ action: z.literal("customer"), ...contact, kind: z.enum(customerTypes), code: z.string().trim().max(60).default("") }),
  z.object({ action: z.literal("supplier"), ...contact }),
  z.object({ action: z.literal("stock"), productId: id, delta: z.number().int().min(-100000).max(100000).refine(n => n !== 0), reason: name }),
  z.object({ action: z.literal("purchase"), supplierId: id, reference: text,
    lines: z.array(z.object({ productId: id, quantity, cost: amount })).min(1).max(100) }),
  saleInput,
  z.object({ action: z.literal("quote"), ...cart, id: id.optional(), requestId: id.optional(), quoteVersion: z.number().int().positive().optional(), validUntil: day.nullable() }),
  z.object({ action: z.literal("payment"), requestId: id, saleId: id, amount: transactionAmount.min(1), method: z.enum(methods), reference: text }),
  returnInput,
  z.object({ action: z.literal("requestSaleApproval"), sale: saleInput, reason: name }),
  z.object({ action: z.literal("requestReturnApproval"), item: returnInput }),
  z.object({ action: z.literal("reviewApproval"), id, decision: z.enum(["approve","reject"]), note: text }),
  z.object({ action: z.literal("completeApprovedSale"), id }),
  z.object({ action: z.literal("job"), id: id.optional(), title: name, customerId: id.nullable(), saleId: id.nullable(),
    technicianId: id.nullable(), location: text, notes: text, scheduled: day.nullable(), status: z.enum(jobStatuses) }),
  z.object({ action: z.literal("installationRequest"), title: name, customerId: id.nullable(), saleId: id.nullable(),
    location: z.string().trim().min(1,"Enter the installation location.").max(2000), notes: text, scheduled: day.nullable() }),
  z.object({ action: z.literal("jobStatus"), id, status: z.enum(jobStatuses), notes: text }),
  z.object({ action: z.literal("material"), jobId: id, productId: id, quantity, serial: z.string().trim().max(100).default("") }),
  z.object({ action: z.literal("expense"), id: id.optional(), description: name, amount: amount.min(1), incurred: day, jobId: id.nullable(), category: z.enum(expenseCategories).optional(),
    method: z.enum(methods).nullable().optional(), reference: z.string().trim().max(160).optional(), notes: text.optional() }),
  z.object({ action: z.literal("purchaseReference"), id, reference: text }),
  z.object({ action: z.literal("productStatus"), id, active: z.boolean() }),
  z.object({ action: z.literal("staffStatus"), id, active: z.boolean() }),
  z.object({ action: z.literal("deleteRecord"), record: z.enum(Object.keys(deletableRecords) as DeletableRecord[]), id }),
  z.object({ action: z.literal("settings"), ...contact, invoicePrefix: z.string().trim().regex(/^[A-Za-z0-9]{1,12}$/, "Use 1–12 letters or digits for the invoice prefix.") }),
  z.object({ action: z.literal("staff"), id: id.optional(), name, email: z.email().max(254), role: z.enum(roles), active: z.boolean(),
    password: z.union([z.string().min(12).max(200), z.literal("")]) })
])

type Action = z.infer<typeof schema>
type Checkout = Extract<Action, { action: "sale" | "quote" }>
const rules: Record<Action["action"], Capability> = {
  group: "catalog", product: "catalog", customer: "customers", supplier: "inventory", stock: "inventory", purchase: "inventory",
  sale: "sales", quote: "sales", payment: "sales", return: "pricing", job: "jobs", jobStatus: "jobs", material: "jobs",
  requestSaleApproval: "requestApprovals", requestReturnApproval: "requestApprovals", reviewApproval: "reviewApprovals", completeApprovedSale: "requestApprovals",
  installationRequest: "requestJobs", expense: "reports", settings: "admin", staff: "admin",
  purchaseReference: "admin", productStatus: "admin", staffStatus: "admin", deleteRecord: "admin"
}

export class ShopError extends Error {
  constructor(message: string, public status = 400) { super(message) }
}

function required<T>(value: T | undefined, message: string): T {
  if (!value) throw new ShopError(message, 404)
  return value
}

function apportioned(part: number, total: number, base: number) {
  if (base === 0) return 0
  const divisor = BigInt(base)
  return Number((BigInt(part) * BigInt(total) * 2n + divisor) / (divisor * 2n))
}

async function audit(db: Client, user: User, action: string, detail: string) {
  await db.query("INSERT INTO audit_logs (staff_id,action,detail) VALUES ($1,$2,$3)", [user.id,action,detail])
}

const linkedRecordMessage: Record<DeletableRecord, string> = {
  categories: "Move products out of this category before deleting it.",
  brands: "Remove this brand from its products before deleting it.",
  products: "This product has transaction history. Archive it to remove it from the POS.",
  customers: "This customer has linked sales, quotations or installations. You can still edit their details.",
  suppliers: "This supplier has recorded purchases. You can still edit their details.",
  quotations: "This quotation is linked to a completed sale.",
  installations: "This installation has recorded materials or expenses. Keep the job and update its status instead.",
  expenses: "This expense is linked to another record."
}

async function deleteRecord(db: Client, user: User, record: DeletableRecord, recordId: string) {
  const label = deletableRecords[record]
  // Table and column names are chosen only from the validated record types.
  const title = record === "quotations" ? "number" : record === "installations" ? "title" : record === "expenses" ? "description" : "name"
  const columns = record === "products" ? ",sku,on_hand" :
    record === "quotations" ? ",sale_id" :
    record === "installations" ? ",sale_id,status,completed_at" :
    record === "expenses" ? ",amount,incurred::text,job_id" : ""
  const item = required(await first(db, `SELECT ${title} AS title${columns} FROM ${record} WHERE id=$1 FOR UPDATE`, [recordId]), "Record could not be found.")
  if (record === "products") {
    if (item.on_hand > 0) throw new ShopError("This product still has stock. Adjust its stock before deleting it.",409)
    const quoted = await first(db, "SELECT id FROM quotations WHERE lines @> $1::jsonb LIMIT 1",
      [JSON.stringify([{ productId:recordId }])])
    if (quoted) throw new ShopError("This product is used in a quotation. Archive it to keep the quotation history.",409)
  }
  if (record === "quotations" && item.sale_id) throw new ShopError(linkedRecordMessage.quotations,409)
  if (record === "installations" && (item.sale_id || item.completed_at || !["Scheduled","Cancelled"].includes(item.status))) {
    throw new ShopError("Only scheduled or cancelled installations without completed work or a linked sale can be deleted.",409)
  }
  try {
    await db.query(`DELETE FROM ${record} WHERE id=$1`,[recordId])
  } catch (error) {
    if ((error as { code?: string }).code === "23503") throw new ShopError(linkedRecordMessage[record],409)
    throw error
  }
  const detail = record === "expenses" ? `${item.title} · TZS ${item.amount} · ${item.incurred}${item.job_id ? " · Job "+item.job_id : ""}` :
    record === "products" ? `${item.title} · ${item.sku}` : item.title
  await audit(db,user,`Deleted ${label}`,detail)
  return { id: recordId }
}

async function lockStaffChanges(db: Client, user: User) {
  await db.query("SELECT pg_advisory_xact_lock(804514)")
  if (!await first(db,"SELECT id FROM staff WHERE id=$1 AND active AND role='Admin'",[user.id])) {
    throw new ShopError("Administrator access is required.",403)
  }
}

const demoEmail = () => process.env.CSOLUTION_DEMO === "1" ? process.env.CSOLUTION_ADMIN_EMAIL?.trim().toLowerCase() : undefined

async function moveStock(db: Client, user: User, productId: string, delta: number, kind: string, reference: string) {
  if (!delta) return
  const changed = await first(db, "UPDATE products SET on_hand=on_hand+$1 WHERE id=$2 AND type='Stocked' AND on_hand+$1>=0 RETURNING id", [delta,productId])
  if (!changed) throw new ShopError("There is insufficient stock for this action.", 409)
  await db.query("INSERT INTO stock_movements (product_id,kind,delta,reference,staff_id) VALUES ($1,$2,$3,$4,$5)",
    [productId,kind,delta,reference,user.id])
}

async function addPayment(db: Client, user: User, saleId: string, requestId: string, paid: number, method: string, reference: string) {
  if (paid > 0) await db.query("INSERT INTO payments (request_id,sale_id,amount,method,reference,staff_id) VALUES ($1,$2,$3,$4,$5,$6)",
    [requestId,saleId,paid,method,reference,user.id])
}

async function checkTech(db: Client, tech: string | null) {
  if (tech) required(await first(db, "SELECT id FROM staff WHERE id=$1 AND role='Technician' AND active", [tech]), "Choose an active technician.")
}

type CheckoutPerson = { id:string | null; name:string; address:string; phone:string; kind:typeof customerTypes[number] }

async function person(db: Client, customerId: string | null): Promise<CheckoutPerson> {
  return customerId ? required(await first<CheckoutPerson>(db, "SELECT id,name,address,phone,kind FROM customers WHERE id=$1", [customerId]), "Customer could not be found.") :
    { id: null, name: "Walk-in customer", address: "", phone: "", kind: "Retail" }
}

async function checkoutBuyer(db: Client, user: User, input: Checkout, preview = false): Promise<CheckoutPerson & { buyerType:BuyerType }> {
  if (input.newBuyer) {
    if (input.customerId || (input.buyerType !== "Customer" && input.buyerType !== "Agent")) {
      throw new ShopError("Choose an existing account or enter a name for a new customer or agent.")
    }
    const buyerName = input.newBuyer.name.replace(/\s+/g," ")
    const agent = input.buyerType==="Agent"
    const key = input.buyerType + ":" + buyerName.toLowerCase()
    await db.query("SELECT pg_advisory_xact_lock(hashtextextended($1,1))",[key])
    const existing = await first(db,`SELECT id FROM customers
      WHERE lower(regexp_replace(trim(name),'[[:space:]]+',' ','g'))=lower($1) AND (kind='Agent')=$2 LIMIT 1`,[buyerName,agent])
    if (existing) throw new ShopError("An account with this name already exists. Select it from the matching results.",409)
    if (preview) return { id:null,name:buyerName,kind:agent ? "Agent" : "Retail",address:"",phone:"",buyerType:input.buyerType }
    const created = required(await first<CheckoutPerson>(db,"INSERT INTO customers (name,kind) VALUES ($1,$2) RETURNING id,name,kind,address,phone",
      [buyerName,agent ? "Agent" : "Retail"]),"Buyer could not be created.")
    await audit(db,user,"Customer saved",buyerName)
    return { ...created, buyerType:input.buyerType }
  }
  const customer = await person(db,input.customerId)
  const buyerType = !customer.id ? "Walk-in" : customer.kind==="Agent" ? "Agent" : "Customer"
  if (input.buyerType && input.buyerType!==buyerType) throw new ShopError("Choose a buyer that matches the selected buyer type.",409)
  return { ...customer, buyerType }
}

async function checkSerial(db: Client, productId: string, serial: string) {
  const existing = await first(db, `SELECT l.id FROM sale_items l
    WHERE l.product_id=$1 AND l.serial<>'' AND lower(l.serial)=lower($2)
    AND NOT EXISTS (SELECT 1 FROM returns r WHERE r.sale_item_id=l.id AND r.restock)
    UNION ALL
    SELECT i.id FROM installation_items i WHERE i.product_id=$1 AND i.serial<>'' AND lower(i.serial)=lower($2)
    LIMIT 1`, [productId,serial])
  if (existing) throw new ShopError(`Serial ${serial} is already recorded as sold or installed.`,409)
}

async function checkout(db: Client, user: User, input: Checkout, options?: { request?: boolean; approved?: ApprovalSummary }) {
  const frontOffice = ownSalesOnly(user.role)
  const edited = input.action === "quote" && input.id ? required(await first(db,
    "SELECT id,sale_id,version FROM quotations WHERE id=$1 FOR UPDATE",[input.id]),"Quotation could not be found.") : undefined
  if (edited && input.quoteVersion === undefined) throw new ShopError("Reopen the quotation before editing it.",409)
  if (edited?.sale_id) throw new ShopError("This quotation has already been converted to a sale.",409)
  const quote = input.action === "sale" && input.quoteId ? required(await first(db,
    `SELECT *,valid_until IS NOT NULL AND valid_until < (now() AT TIME ZONE 'Africa/Dar_es_Salaam')::date AS expired
      FROM quotations WHERE id=$1 AND ($2::uuid IS NULL OR created_by=$2) FOR UPDATE`,
    [input.quoteId,frontOffice ? user.id : null]), "Quotation could not be found.") : undefined
  const currentQuote = edited ?? quote
  if (frontOffice && quote && input.quoteVersion===undefined) throw new ShopError("Reopen the quotation before converting it.",409)
  if (currentQuote && input.quoteVersion !== undefined && input.quoteVersion !== currentQuote.version) {
    throw new ShopError("This quotation was updated elsewhere. Reopen it to review the latest details.",409)
  }
  if (quote?.sale_id || quote?.expired) throw new ShopError("This quotation has already been converted or has expired.", 409)
  const customer = quote ? { ...await person(db,quote.customer_id),name:quote.customer_name,buyerType:quote.buyer_type } :
    await checkoutBuyer(db,user,input,options?.request)
  const lines: typeof input.lines = quote ? quote.lines : input.lines
  const productIds = [...new Set(lines.map(l => l.productId))].sort()
  const products = await rows<Product>(db, "SELECT * FROM products WHERE id=ANY($1::uuid[]) AND active ORDER BY id FOR UPDATE", [productIds])
  const byId = new Map(products.map(product => [product.id, product]))
  const totals = new Map<string,number>()
  const editPrice = can(user.role, "pricing")
  const items = lines.map(entry => {
    const product = required(byId.get(entry.productId), "An item is no longer available.")
    const usual = customer.buyerType === "Agent" ? (product.agent_price ?? product.price) : product.price
    const unitPrice = entry.price ?? usual
    if (!quote && !editPrice && unitPrice !== usual) throw new ShopError("A manager must approve custom prices.", 403)
    if (entry.expectedUnitPrice !== undefined && entry.expectedUnitPrice !== unitPrice) {
      throw new ShopError(`The price of ${product.name} changed. Review the updated items before saving.`,409)
    }
    if (entry.serial && (product.type !== "Stocked" || entry.quantity !== 1)) {
      throw new ShopError("A serial number can only be entered for a single stocked unit.")
    }
    if (product.type === "Stocked") totals.set(product.id, (totals.get(product.id) ?? 0) + entry.quantity)
    return { ...entry, product, price: unitPrice }
  })
  const subtotal = items.reduce((sum, item) => sum + item.quantity * item.price, 0)
  const cost = items.reduce((sum, item) => sum + item.quantity * (item.product.cost ?? 0), 0)
  const discount = quote?.discount ?? input.discount
  const tax = quote?.tax ?? input.tax
  const total = subtotal - discount + tax
  if (discount > subtotal) throw new ShopError("Discount cannot exceed the subtotal.")
  if (frontOffice && !quote && tax) throw new ShopError("Only management can set tax adjustments.",403)
  if (!quote && discount && !editPrice && !(input.action==="sale" && (options?.request || options?.approved))) {
    throw new ShopError("A discount requires approval.",403)
  }
  if (Math.max(subtotal,total,cost) >= 1e14) throw new ShopError("Transaction total exceeds the supported limit.")
  if (input.expectedTotal !== undefined && input.expectedTotal !== total) {
    throw new ShopError("The total changed. Review the updated items before saving.",409)
  }
  if (input.action === "quote") {
    const values = [customer.id,customer.name,
      JSON.stringify(items.map(({ productId,quantity,price,product }) => ({ productId,quantity,price,name:product.name }))),
      discount,tax,total,input.validUntil,customer.buyerType]
    const saved = required(edited ?
      await first(db,"UPDATE quotations SET customer_id=$1,customer_name=$2,lines=$3,discount=$4,tax=$5,total=$6,valid_until=$7,buyer_type=$8,version=version+1 WHERE id=$9 RETURNING id,number",[...values,edited.id]) :
      await first(db,"INSERT INTO quotations (customer_id,customer_name,lines,discount,tax,total,valid_until,buyer_type,request_id,created_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id,number",[...values,input.requestId ?? null,user.id]),
      "Quotation could not be saved.")
    await audit(db,user,edited ? "Quotation updated" : "Quotation created",saved.number)
    return saved
  }
  for (const [productId, count] of totals) {
    const item = byId.get(productId)!
    if (count > item.on_hand) throw new ShopError(`${item.name} has only ${item.on_hand} ${item.unit} available.`,409)
  }
  const serials = new Set<string>()
  for (const item of items) {
    if (!item.serial) continue
    const key = item.productId + ":" + item.serial.toLowerCase()
    if (serials.has(key)) throw new ShopError(`Serial ${item.serial} appears twice in this sale.`,409)
    await checkSerial(db,item.productId,item.serial)
    serials.add(key)
  }
  if (input.paid > total) throw new ShopError("Payment cannot exceed the sale total.")
  if (input.paid < total && !customer.id && !(options?.request && input.newBuyer)) throw new ShopError("Choose a customer for an unpaid balance.")
  if (frontOffice && (discount>0 || input.paid<total) && !options?.request && !options?.approved) {
    throw new ShopError("Request approval for the discount or unpaid balance.",403)
  }
  if (input.installation) {
    if (frontOffice) {
      if (input.installation.technicianId) throw new ShopError("Only management can assign a technician.",403)
      if (!input.installation.location) throw new ShopError("Enter the installation location.")
    } else {
      if (!can(user.role,"scheduleJobs")) throw new ShopError("Only management can schedule an installation.",403)
      await checkTech(db,input.installation.technicianId)
    }
  }
  const summary: ApprovalSummary = {buyer:customer.name,total,discount,paid:input.paid,method:input.method,dueDate:input.dueDate,
    items:items.map(item=>({name:item.product.name,quantity:item.quantity,price:item.price}))}
  if (options?.request) {
    if (!discount && input.paid===total) throw new ShopError("This sale does not require approval.")
    return { summary }
  }
  const approved = options?.approved
  if (approved && (summary.total!==approved.total || summary.buyer!==approved.buyer || summary.items.length!==approved.items.length ||
    !summary.items.every((item,index)=>item.price===approved.items[index].price && item.quantity===approved.items[index].quantity))) {
    throw new ShopError("The buyer or prices changed. Submit a new approval request.",409)
  }
  const serviceOnly = items.every(item => item.product.type === "Service")
  const includesService = items.some(item => item.product.type === "Service") || Boolean(input.installation)
  const kind = serviceOnly ? "Service only" : includesService ? "Equipment + installation" : "Equipment"
  const saleId = randomUUID()
  const saved = required(await first(db, `INSERT INTO sales (id,request_id,invoice,customer_id,customer_name,customer_address,customer_phone,
    cashier_id,kind,subtotal,discount,tax,total,cost,due_date,buyer_type)
    VALUES ($1,$2,(SELECT invoice_prefix FROM business WHERE id=1)||'-'||nextval('invoice_number'),$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
    RETURNING id,number,invoice`, [saleId,input.requestId,customer.id,customer.name,customer.address,customer.phone,user.id,
    kind,subtotal,discount,tax,total,cost,input.dueDate,customer.buyerType]), "Sale could not be saved.")
  for (const item of items) {
    await db.query(`INSERT INTO sale_items (sale_id,product_id,name,quantity,price,cost,type,serial,unit,warranty_until)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,CASE WHEN $10::integer>0 THEN
        ((now() AT TIME ZONE 'Africa/Dar_es_Salaam')::date + make_interval(months=>$10::integer))::date END)`,
      [saleId,item.productId,item.product.name,item.quantity,item.price,item.product.cost,item.product.type,item.serial ?? "",item.product.unit,item.product.warranty])
  }
  for (const [productId,count] of totals) await moveStock(db,user,productId,-count,"Sale",saved.number)
  await addPayment(db,user,saleId,input.requestId,input.paid,input.method,input.reference)
  if (input.installation) {
    const job = input.installation
    await db.query("INSERT INTO installations (title,customer_id,sale_id,technician_id,location,scheduled,status,created_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)",
      [job.title,customer.id,saleId,job.technicianId,job.location,job.scheduled,frontOffice ? "Requested" : "Scheduled",user.id])
  }
  if (quote) await db.query("UPDATE quotations SET sale_id=$1 WHERE id=$2", [saleId,quote.id])
  await audit(db,user,"Sale completed",saved.number)
  return saved
}

async function lockSale(db: Client, user: User, saleId: string) {
  return required(await first(db,`SELECT id,customer_id FROM sales WHERE id=$1
    AND ($2::uuid IS NULL OR cashier_id=$2) FOR UPDATE`,[saleId,ownSalesOnly(user.role) ? user.id : null]),"Sale could not be found.")
}

async function recordReturn(db: Client, user: User, input: z.infer<typeof returnInput>, preview = false, approved?: ApprovalSummary) {
  await lockSale(db,user,input.saleId)
  const sale = required(await first(db,saleSummary + " WHERE s.id=$1",[input.saleId]),"Sale could not be found.")
  const item = required(await first(db,`SELECT l.*,COALESCE((SELECT sum(quantity) FROM returns WHERE sale_item_id=l.id),0) AS returned
    FROM sale_items l WHERE l.id=$1 AND l.sale_id=$2`,[input.lineId,input.saleId]),"Sale line could not be found.")
  if (item.returned + input.quantity > item.quantity) throw new ShopError("Quantity exceeds the remaining units on this sale.",409)
  if (input.restock && item.type !== "Stocked") throw new ShopError("Only stocked products can be restocked.")
  const remaining = (await first(db,`SELECT sum(l.quantity) - COALESCE(
    (SELECT sum(r.quantity) FROM returns r JOIN sale_items li ON li.id=r.sale_item_id WHERE li.sale_id=$1),0) AS quantity
    FROM sale_items l WHERE l.sale_id=$1`,[input.saleId]))!.quantity
  const finalReturn = remaining === input.quantity
  const prorated = apportioned((item.returned+input.quantity)*item.price,sale.total,sale.subtotal) -
    apportioned(item.returned*item.price,sale.total,sale.subtotal)
  const credit = finalReturn ? sale.total-sale.credits : Math.min(sale.total-sale.credits,prorated)
  const prior = await first(db,"SELECT COALESCE(sum(r.tax_credit),0) AS tax FROM returns r JOIN sale_items l ON l.id=r.sale_item_id WHERE l.sale_id=$1",[input.saleId])
  const taxRemaining = sale.tax-(prior?.tax ?? 0)
  const minTaxCredit = Math.max(0,credit-(sale.total-sale.credits-taxRemaining))
  const taxCredit = Math.max(minTaxCredit,Math.min(credit,taxRemaining,finalReturn ? taxRemaining :
    apportioned(sale.credits+credit,sale.tax,sale.total)-(prior?.tax ?? 0)))
  const refund = Math.max(0,credit-sale.balance)
  const summary: ApprovalSummary = {buyer:sale.customer_name,saleNumber:sale.number,total:sale.total,paid:sale.paid,discount:sale.discount,
    refund,credit,restock:input.restock,items:[{name:item.name,quantity:input.quantity,price:item.price}]}
  if (preview) return { id:input.saleId,refund,summary }
  if (approved && (approved.refund!==refund || approved.credit!==credit)) {
    throw new ShopError("The refund or credit amount changed. Ask staff to submit a new request.",409)
  }
  if (input.restock) {
    await db.query("UPDATE products SET cost=round((cost*on_hand+$1::numeric*$2)/(on_hand+$2)) WHERE id=$3 AND type='Stocked'",[item.cost,input.quantity,item.product_id])
    await moveStock(db,user,item.product_id,input.quantity,"Return",sale.number)
  }
  await db.query("INSERT INTO returns (request_id,sale_item_id,quantity,refund,credit,tax_credit,restock,reason) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)",
    [input.requestId,input.lineId,input.quantity,refund,credit,taxCredit,input.restock,input.reason])
  await audit(db,user,"Return recorded",sale.number)
  return { id:input.saleId,refund,summary }
}

async function requestApproval(db: Client, user: User, input: Extract<Action, { action:"requestSaleApproval"|"requestReturnApproval" }>) {
  const payload = input.action==="requestSaleApproval" ? input.sale : input.item
  const kind = input.action==="requestSaleApproval" ? "Sale terms" : "Return"
  const reason = input.action==="requestSaleApproval" ? input.reason : input.item.reason
  await db.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))",[payload.requestId])
  const existing = await first(db,"SELECT requested_by,kind FROM approval_requests WHERE id=$1",[payload.requestId])
  if (existing) {
    if (existing.requested_by!==user.id || existing.kind!==kind) throw new ShopError("This approval request is already in use.",409)
    return { id:payload.requestId }
  }
  const result = payload.action==="sale" ? await checkout(db,user,payload,{request:true}) : await recordReturn(db,user,payload,true)
  await db.query("INSERT INTO approval_requests (id,kind,requested_by,reason,payload,summary) VALUES ($1,$2,$3,$4,$5,$6)",
    [payload.requestId,kind,user.id,reason,JSON.stringify(payload),JSON.stringify(result.summary)])
  await audit(db,user,"Approval requested",kind+" · "+payload.requestId)
  return { id:payload.requestId }
}

async function reviewApproval(db: Client, user: User, input: Extract<Action, { action:"reviewApproval" }>) {
  if (input.decision==="reject" && !input.note) throw new ShopError("Enter a reason for rejecting this request.")
  const approval = required(await first(db,"SELECT * FROM approval_requests WHERE id=$1 FOR UPDATE",[input.id]),"Approval request could not be found.")
  if (approval.status!=="Pending") throw new ShopError("This request has already been reviewed.",409)
  let status = input.decision==="reject" ? "Rejected" : "Approved"
  let result: { id:string; refund:number } | undefined
  if (status==="Approved" && approval.kind==="Return") {
    result = await recordReturn(db,user,returnInput.parse(approval.payload),false,approval.summary)
    status = "Completed"
  }
  await db.query(`UPDATE approval_requests SET status=$2,reviewed_by=$3,review_note=$4,reviewed_at=now(),result_sale_id=$5 WHERE id=$1`,
    [input.id,status,user.id,input.note,result?.id ?? null])
  await audit(db,user,input.decision==="reject" ? "Approval rejected" : "Approval granted",approval.kind+" · "+input.id)
  return { id:input.id,refund:result?.refund }
}

async function completeApprovedSale(db: Client, user: User, approvalId: string) {
  const approval = required(await first(db,"SELECT * FROM approval_requests WHERE id=$1 AND requested_by=$2 AND kind='Sale terms' FOR UPDATE",
    [approvalId,user.id]),"Approval request could not be found.")
  if (approval.status==="Completed") return { id:approval.result_sale_id }
  if (approval.status!=="Approved") throw new ShopError("This sale is waiting for administrator approval.",409)
  const sale = await checkout(db,user,saleInput.parse(approval.payload),{approved:approval.summary})
  await db.query("UPDATE approval_requests SET status='Completed',result_sale_id=$2 WHERE id=$1",[approvalId,sale.id])
  await audit(db,user,"Approved sale completed",approvalId+" · "+sale.number)
  return sale
}

export async function changeShop(raw: unknown, user: User) {
  const parsed = schema.safeParse(raw)
  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    throw new ShopError(issue.path.join(" · ") + " — " + issue.message)
  }
  const input = parsed.data
  if (!can(user.role,rules[input.action])) throw new ShopError("You do not have permission for this action.",403)
  if ((input.action === "quote" || input.action === "expense") && input.id && !can(user.role,"admin")) {
    throw new ShopError("Administrator access is required to edit this record.",403)
  }
  return transaction(async db => {
    if ("requestId" in input && input.requestId) {
      await db.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [input.requestId])
      if (input.action === "sale") {
        const existing = await first(db,"SELECT id,number,invoice,cashier_id FROM sales WHERE request_id=$1",[input.requestId])
        if (existing) {
          if (existing.cashier_id !== user.id) throw new ShopError("This sale request is already in use.",409)
          return { id:existing.id,number:existing.number,invoice:existing.invoice }
        }
        if (ownSalesOnly(user.role) && await first(db,"SELECT id FROM approval_requests WHERE id=$1",[input.requestId])) {
          throw new ShopError("Complete the sale from its approval request.",409)
        }
      } else if (input.action === "quote" && !input.id) {
        const existing = await first(db,"SELECT id,number,created_by FROM quotations WHERE request_id=$1",[input.requestId])
        if (existing) {
          if (existing.created_by !== user.id) throw new ShopError("This quotation request is already in use.",409)
          return { id:existing.id,number:existing.number }
        }
      } else if (input.action === "payment") {
        await lockSale(db,user,input.saleId)
        const existing = await first(db,"SELECT sale_id FROM payments WHERE request_id=$1",[input.requestId])
        if (existing) {
          if (existing.sale_id!==input.saleId) throw new ShopError("This payment request is already in use.",409)
          return { id:input.saleId }
        }
      } else if (input.action === "return") {
        const existing = await first(db,`SELECT l.sale_id,r.refund FROM returns r JOIN sale_items l ON l.id=r.sale_item_id WHERE r.request_id=$1`,[input.requestId])
        if (existing) {
          if (existing.sale_id!==input.saleId) throw new ShopError("This return request is already in use.",409)
          return { id:input.saleId,refund:existing.refund }
        }
      }
    }
    switch (input.action) {
      case "deleteRecord":
        return deleteRecord(db,user,input.record,input.id)
      case "productStatus": {
        const item = required(await first(db,"SELECT id,sku,active,on_hand FROM products WHERE id=$1 FOR UPDATE",[input.id]),"Product could not be found.")
        if (item.active === input.active) return { id:input.id }
        if (!input.active && item.on_hand > 0) throw new ShopError("Adjust the remaining stock to zero before archiving this product.",409)
        await db.query("UPDATE products SET active=$1 WHERE id=$2",[input.active,input.id])
        await audit(db,user,input.active ? "Product restored" : "Product archived",item.sku)
        return { id:input.id }
      }
      case "group": {
        const saved = input.id ?
          await first(db,`UPDATE ${input.kind} SET name=$1,description=$2 WHERE id=$3 RETURNING id`,[input.name,input.description,input.id]) :
          await first(db,`INSERT INTO ${input.kind} (name,description) VALUES ($1,$2) RETURNING id`,[input.name,input.description])
        await audit(db,user,"Catalog group saved",input.name)
        return required(saved,"Catalog group could not be found.")
      }
      case "product": {
        if (input.initialStock > 0 && (input.id || input.type !== "Stocked")) {
          throw new ShopError("Opening stock applies when registering a stocked product.")
        }
        if (input.imageUrl) {
          const uploaded = /^\/api\/images\/([0-9a-f-]{36})$/.exec(input.imageUrl)
          if (uploaded && id.safeParse(uploaded[1]).success) {
            required(await first(db,"SELECT id FROM images WHERE id=$1",[uploaded[1]]),"Upload the image again.")
          } else {
            const url = URL.parse(input.imageUrl)
            if (!url || !["https:","http:"].includes(url.protocol) || url.username || url.password) throw new ShopError("Enter an HTTP or HTTPS image URL.")
          }
        }
        if (input.id) {
          const current = required(await first<Product>(db,"SELECT * FROM products WHERE id=$1 FOR UPDATE",[input.id]),"Product could not be found.")
          if (current.active && !input.active && current.on_hand > 0) throw new ShopError("Adjust the remaining stock to zero before archiving this product.",409)
          if (current.type !== input.type && (current.on_hand > 0 ||
              await first(db,"SELECT id FROM stock_movements WHERE product_id=$1 LIMIT 1",[input.id]))) {
            throw new ShopError("This product has stock history. Create a separate product for a different item type.",409)
          }
          if (current.type === "Stocked" && current.on_hand > 0 && current.cost !== input.cost) {
            throw new ShopError("Stock cost is updated by purchases while units are on hand.")
          }
        }
        const values = [input.name,input.sku.toUpperCase(),input.categoryId,input.brandId,input.type,input.unit,input.description,
          input.cost,input.price,input.agentPrice,input.type === "Stocked" ? input.reorder : 0,input.warranty,input.imageUrl,input.active]
        const saved = required(input.id ?
          await first(db,`UPDATE products SET name=$1,sku=$2,category_id=$3,brand_id=$4,type=$5,unit=$6,description=$7,cost=$8,price=$9,
            agent_price=$10,reorder=$11,warranty=$12,image_url=$13,active=$14 WHERE id=$15 RETURNING id`,[...values,input.id]) :
          await first(db,`INSERT INTO products (name,sku,category_id,brand_id,type,unit,description,cost,price,agent_price,reorder,warranty,image_url,active)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING id`,values),"Product could not be found.")
        if (!input.id && input.type === "Stocked") await moveStock(db,user,saved.id,input.initialStock,"Opening stock","Initial inventory")
        await audit(db,user,"Product saved",input.sku.toUpperCase())
        return saved
      }
      case "customer":
      case "supplier": {
        const values = [input.name,input.phone,input.email,input.address]
        let saved
        if (input.action === "customer") {
          if (!can(user.role,"manageCustomers") && (input.id || input.code)) {
            throw new ShopError("Only authorized staff can edit customer accounts or assign agent codes.",403)
          }
          const valuesWithType = [...values,input.kind,input.kind === "Agent" ? input.code || null : null]
          saved = input.id ?
            await first(db,"UPDATE customers SET name=$1,phone=$2,email=$3,address=$4,kind=$5,code=$6 WHERE id=$7 RETURNING id",[...valuesWithType,input.id]) :
            await first(db,"INSERT INTO customers (name,phone,email,address,kind,code) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id",valuesWithType)
        } else {
          saved = input.id ?
            await first(db,"UPDATE suppliers SET name=$1,phone=$2,email=$3,address=$4 WHERE id=$5 RETURNING id",[...values,input.id]) :
            await first(db,"INSERT INTO suppliers (name,phone,email,address) VALUES ($1,$2,$3,$4) RETURNING id",values)
        }
        await audit(db,user,input.action === "customer" ? "Customer saved" : "Supplier saved",input.name)
        return required(saved,"Record could not be found.")
      }
      case "stock":
        await moveStock(db,user,input.productId,input.delta,"Adjustment",input.reason)
        await audit(db,user,"Stock adjusted",input.reason)
        return { id: input.productId }
      case "purchase": {
        const total = input.lines.reduce((sum,item) => sum + item.quantity * item.cost,0)
        if (total >= 1e14) throw new ShopError("Purchase total exceeds the supported limit.")
        const items = [...input.lines].sort((a,b) => a.productId.localeCompare(b.productId))
        const saved = (await first(db,"INSERT INTO purchases (supplier_id,reference,total) VALUES ($1,$2,$3) RETURNING id,number",
          [input.supplierId,input.reference,total]))!
        for (const item of items) {
          const product = required(await first<Product>(db,"SELECT * FROM products WHERE id=$1 AND type='Stocked' AND active FOR UPDATE",[item.productId]),"Choose an active stocked product.")
          await db.query("UPDATE products SET cost=round((cost*on_hand+$1::numeric*$2)/ (on_hand+$2)) WHERE id=$3",[item.cost,item.quantity,item.productId])
          await db.query("INSERT INTO purchase_items (purchase_id,product_id,quantity,cost) VALUES ($1,$2,$3,$4)",[saved.id,item.productId,item.quantity,item.cost])
          await moveStock(db,user,item.productId,item.quantity,"Purchase",saved.number)
        }
        await audit(db,user,"Purchase received",saved.number)
        return saved
      }
      case "purchaseReference": {
        const previous = required(await first(db,"SELECT id,number,reference FROM purchases WHERE id=$1 FOR UPDATE",[input.id]),"Purchase could not be found.")
        if (previous.reference !== input.reference) {
          await db.query("UPDATE purchases SET reference=$1 WHERE id=$2",[input.reference,input.id])
          await audit(db,user,"Purchase reference updated",`${previous.number} · ${previous.reference || "—"} → ${input.reference || "—"}`)
        }
        return { id:input.id }
      }
      case "quote":
      case "sale":
        return checkout(db,user,input)
      case "requestSaleApproval":
      case "requestReturnApproval":
        return requestApproval(db,user,input)
      case "reviewApproval":
        return reviewApproval(db,user,input)
      case "completeApprovedSale":
        return completeApprovedSale(db,user,input.id)
      case "payment": {
        const sale = required(await first(db,saleSummary + " WHERE s.id=$1",[input.saleId]),"Sale could not be found.")
        if (input.amount > sale.balance) throw new ShopError("Payment exceeds the outstanding balance.",409)
        await addPayment(db,user,input.saleId,input.requestId,input.amount,input.method,input.reference)
        await audit(db,user,"Payment received",sale.invoice)
        return { id: input.saleId }
      }
      case "return": {
        const result = await recordReturn(db,user,input)
        return {id:result.id,refund:result.refund}
      }
      case "installationRequest": {
        const sale = input.saleId ? await lockSale(db,user,input.saleId) : undefined
        const customerId = sale ? sale.customer_id : input.customerId
        if (!sale && !customerId) throw new ShopError("Choose a customer or a linked sale.")
        const saved = required(await first(db,`INSERT INTO installations (title,customer_id,sale_id,location,scheduled,notes,status,created_by)
          VALUES ($1,$2,$3,$4,$5,$6,'Requested',$7) RETURNING id,number`,
          [input.title,customerId,input.saleId,input.location,input.scheduled,input.notes,user.id]),"Installation request could not be saved.")
        await audit(db,user,"Installation requested",saved.number)
        return saved
      }
      case "job": {
        if (!can(user.role,"scheduleJobs")) throw new ShopError("Only management can schedule jobs.",403)
        await checkTech(db,input.technicianId)
        const sale = input.saleId ? required(await first(db,"SELECT customer_id FROM sales WHERE id=$1",[input.saleId]),"Sale could not be found.") : undefined
        if (input.id) {
          const previous = required(await first(db,"SELECT sale_id FROM installations WHERE id=$1 FOR UPDATE",[input.id]),"Job could not be found.")
          if (previous.sale_id !== input.saleId) throw new ShopError("A job’s linked sale is fixed when the job is created.")
        }
        const values = [input.title,sale ? sale.customer_id : input.customerId,input.saleId,input.technicianId,input.location,input.notes,input.scheduled,input.status]
        const saved = required(input.id ?
          await first(db,`UPDATE installations SET title=$1,customer_id=$2,sale_id=$3,technician_id=$4,location=$5,notes=$6,scheduled=$7,
            status=$8,completed_at=CASE WHEN $8='Completed' THEN COALESCE(completed_at,now()) ELSE completed_at END WHERE id=$9 RETURNING id,number`,[...values,input.id]) :
          await first(db,`INSERT INTO installations (title,customer_id,sale_id,technician_id,location,notes,scheduled,status,completed_at)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,CASE WHEN $8='Completed' THEN now() END) RETURNING id,number`,values),"Job could not be found.")
        await audit(db,user,"Installation saved",saved.number)
        return saved
      }
      case "jobStatus": {
        if (input.status==="Requested" && !can(user.role,"scheduleJobs")) throw new ShopError("Only management can move a job back to requests.",403)
        const saved = required(await first(db,`UPDATE installations SET status=$1,notes=$2,
          completed_at=CASE WHEN $1='Completed' THEN COALESCE(completed_at,now()) ELSE completed_at END
          WHERE id=$3 AND ($4::boolean=false OR technician_id=$5) RETURNING id,number`,
          [input.status,input.notes,input.id,user.role === "Technician",user.id]),"Job could not be found.")
        await audit(db,user,"Installation updated",saved.number)
        return saved
      }
      case "material": {
        const job = required(await first(db,"SELECT number,status FROM installations WHERE id=$1 AND ($2::boolean=false OR technician_id=$3) FOR UPDATE",
          [input.jobId,user.role === "Technician",user.id]),"Job could not be found.")
        if (["Requested","Completed","Cancelled"].includes(job.status)) throw new ShopError("Schedule or reopen the job before adding materials.")
        const item = required(await first<Product>(db,"SELECT * FROM products WHERE id=$1 AND active AND type='Stocked' FOR UPDATE",
          [input.productId]),"Choose an active stocked product.")
        if (input.serial && input.quantity !== 1) throw new ShopError("Add serialized units one at a time.")
        if (input.serial) await checkSerial(db,item.id,input.serial)
        await moveStock(db,user,item.id,-input.quantity,"Installation",job.number)
        await db.query("INSERT INTO installation_items (job_id,product_id,quantity,cost,serial) VALUES ($1,$2,$3,$4,$5)",
          [input.jobId,item.id,input.quantity,item.cost,input.serial])
        await audit(db,user,"Installation material used",job.number + " · " + item.name)
        return { id: input.jobId }
      }
      case "expense": {
        const values = [input.description,input.amount,input.jobId,input.incurred]
        if (input.id) {
          const previous = required(await first(db,"SELECT description,amount,job_id,incurred::text,category,method,reference,notes FROM expenses WHERE id=$1 FOR UPDATE",[input.id]),"Expense could not be found.")
          await db.query(`UPDATE expenses SET description=$1,amount=$2,job_id=$3,incurred=$4,category=$5,method=$6,reference=$7,notes=$8 WHERE id=$9`,
            [...values,input.category ?? previous.category,input.method === undefined ? previous.method : input.method,
              input.reference ?? previous.reference,input.notes ?? previous.notes,input.id])
          await audit(db,user,"Expense updated",
            `${previous.description} · TZS ${previous.amount} · ${previous.incurred}${previous.job_id ? " · Job "+previous.job_id : ""} → ${input.description} · TZS ${input.amount} · ${input.incurred}${input.jobId ? " · Job "+input.jobId : ""}`)
          return { id:input.id }
        }
        const saved = await first(db,`INSERT INTO expenses (description,amount,job_id,incurred,category,method,reference,notes)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,[...values,input.category ?? "Other",input.method ?? null,input.reference ?? "",input.notes ?? ""])
        await audit(db,user,"Expense recorded",input.description)
        return saved
      }
      case "settings":
        await db.query("UPDATE business SET name=$1,phone=$2,email=$3,address=$4,invoice_prefix=$5 WHERE id=1",
          [input.name,input.phone,input.email,input.address,input.invoicePrefix.toUpperCase()])
        await audit(db,user,"Business settings saved",input.name)
        return { id: "business" }
      case "staffStatus": {
        await lockStaffChanges(db,user)
        const target = required(await first(db,"SELECT id,email,active FROM staff WHERE id=$1 FOR UPDATE",[input.id]),"Staff record could not be found.")
        if (target.id === user.id) throw new ShopError("You cannot deactivate your own account.",409)
        if (target.email === demoEmail()) throw new ShopError("The demo administrator account is fixed.",409)
        if (target.active === input.active) return { id:input.id }
        await db.query("UPDATE staff SET active=$1 WHERE id=$2",[input.active,input.id])
        await db.query("DELETE FROM sessions WHERE staff_id=$1",[input.id])
        await audit(db,user,input.active ? "Staff account reactivated" : "Staff account deactivated",target.email)
        return { id:input.id }
      }
      case "staff": {
        await lockStaffChanges(db,user)
        if (input.id === user.id && (input.role !== "Admin" || !input.active)) throw new ShopError("Keep your own administrator access active.")
        const passwordHash = input.password ? await hashPassword(input.password) : null
        if (!input.id && !passwordHash) throw new ShopError("Enter a password with at least 12 characters.")
        const email = input.email.toLowerCase()
        const target = input.id ? required(await first(db,"SELECT email,role,active FROM staff WHERE id=$1 FOR UPDATE",[input.id]),"Staff record could not be found.") : undefined
        if (demoEmail() && (email === demoEmail() || target?.email === demoEmail())) {
          throw new ShopError("The demo administrator account is fixed.")
        }
        const saved = required(input.id ?
          await first(db,"UPDATE staff SET name=$1,email=$2,role=$3,active=$4,password_hash=COALESCE($5,password_hash) WHERE id=$6 RETURNING id",
            [input.name,email,input.role,input.active,passwordHash,input.id]) :
          await first(db,"INSERT INTO staff (name,email,role,active,password_hash) VALUES ($1,$2,$3,$4,$5) RETURNING id",
            [input.name,email,input.role,input.active,passwordHash]),"Staff record could not be found.")
        if (target && (passwordHash || target.active !== input.active || target.role !== input.role || target.email !== email)) await db.query("DELETE FROM sessions WHERE staff_id=$1",[saved.id])
        await audit(db,user,"Staff account saved",email)
        return saved
      }
    }
  })
}
