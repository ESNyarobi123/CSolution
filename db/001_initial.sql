CREATE TABLE IF NOT EXISTS business (
  id integer PRIMARY KEY CHECK (id = 1),
  name text NOT NULL,
  phone text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  address text NOT NULL DEFAULT '',
  invoice_prefix text NOT NULL DEFAULT 'INV',
  currency text NOT NULL DEFAULT 'TZS' CHECK (currency = 'TZS')
);
INSERT INTO business (id, name, address) VALUES (1, 'Connect Solutions', 'Dar es Salaam, Tanzania') ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS staff (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  role text NOT NULL CHECK (role IN ('Admin','Manager','Cashier','Storekeeper','Technician')),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS sessions (
  token_hash text PRIMARY KEY,
  staff_id uuid NOT NULL REFERENCES staff(id),
  expires_at timestamptz NOT NULL
);
CREATE TABLE IF NOT EXISTS login_attempts (
  email text PRIMARY KEY,
  count integer NOT NULL,
  reset_at timestamptz NOT NULL
);
CREATE TABLE IF NOT EXISTS categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS category_name ON categories (lower(name));
CREATE TABLE IF NOT EXISTS brands (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS brand_name ON brands (lower(name));
CREATE TABLE IF NOT EXISTS products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  sku text NOT NULL UNIQUE,
  category_id uuid REFERENCES categories(id),
  brand_id uuid REFERENCES brands(id),
  type text NOT NULL CHECK (type IN ('Stocked','Non-stock','Service')),
  unit text NOT NULL DEFAULT 'pcs',
  description text NOT NULL DEFAULT '',
  cost numeric(14,0) NOT NULL CHECK (cost >= 0),
  price numeric(14,0) NOT NULL CHECK (price >= 0),
  agent_price numeric(14,0) CHECK (agent_price >= 0),
  reorder integer NOT NULL DEFAULT 0 CHECK (reorder >= 0),
  warranty integer NOT NULL DEFAULT 0 CHECK (warranty >= 0),
  on_hand integer NOT NULL DEFAULT 0 CHECK (on_hand >= 0),
  active boolean NOT NULL DEFAULT true,
  image_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS images (
  id uuid PRIMARY KEY,
  content_type text NOT NULL,
  data bytea NOT NULL
);
CREATE TABLE IF NOT EXISTS customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('Retail','Business','Agent')),
  phone text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  address text NOT NULL DEFAULT '',
  code text UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  phone text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  address text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE SEQUENCE IF NOT EXISTS sale_number START 1001;
CREATE SEQUENCE IF NOT EXISTS invoice_number START 1001;
CREATE SEQUENCE IF NOT EXISTS quote_number START 1001;
CREATE SEQUENCE IF NOT EXISTS job_number START 1001;
CREATE SEQUENCE IF NOT EXISTS purchase_number START 1001;
CREATE TABLE IF NOT EXISTS sales (
  id uuid PRIMARY KEY,
  request_id uuid UNIQUE NOT NULL,
  number text NOT NULL UNIQUE DEFAULT ('CS-' || nextval('sale_number')),
  invoice text NOT NULL UNIQUE,
  customer_id uuid REFERENCES customers(id),
  customer_name text NOT NULL,
  customer_address text NOT NULL DEFAULT '',
  customer_phone text NOT NULL DEFAULT '',
  cashier_id uuid NOT NULL REFERENCES staff(id),
  kind text NOT NULL CHECK (kind IN ('Equipment','Equipment + installation','Service only')),
  subtotal numeric(14,0) NOT NULL CHECK (subtotal >= 0),
  discount numeric(14,0) NOT NULL DEFAULT 0 CHECK (discount >= 0),
  tax numeric(14,0) NOT NULL DEFAULT 0 CHECK (tax >= 0),
  total numeric(14,0) NOT NULL CHECK (total >= 0),
  cost numeric(14,0) NOT NULL CHECK (cost >= 0),
  due_date date,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (subtotal - discount + tax = total)
);
CREATE TABLE IF NOT EXISTS sale_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id uuid NOT NULL REFERENCES sales(id),
  product_id uuid NOT NULL REFERENCES products(id),
  name text NOT NULL,
  quantity integer NOT NULL CHECK (quantity > 0),
  price numeric(14,0) NOT NULL CHECK (price >= 0),
  cost numeric(14,0) NOT NULL CHECK (cost >= 0),
  type text NOT NULL CHECK (type IN ('Stocked','Non-stock','Service')),
  serial text NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid UNIQUE NOT NULL,
  sale_id uuid NOT NULL REFERENCES sales(id),
  amount numeric(14,0) NOT NULL CHECK (amount > 0),
  method text NOT NULL CHECK (method IN ('Cash','Mobile money','Bank transfer','Card')),
  reference text NOT NULL DEFAULT '',
  staff_id uuid NOT NULL REFERENCES staff(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS quotations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  number text NOT NULL UNIQUE DEFAULT ('QT-' || nextval('quote_number')),
  customer_id uuid REFERENCES customers(id),
  customer_name text NOT NULL,
  lines jsonb NOT NULL,
  discount numeric(14,0) NOT NULL CHECK (discount >= 0),
  tax numeric(14,0) NOT NULL CHECK (tax >= 0),
  total numeric(14,0) NOT NULL CHECK (total >= 0),
  valid_until date,
  sale_id uuid UNIQUE REFERENCES sales(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  number text NOT NULL UNIQUE DEFAULT ('PO-' || nextval('purchase_number')),
  supplier_id uuid NOT NULL REFERENCES suppliers(id),
  reference text NOT NULL DEFAULT '',
  total numeric(14,0) NOT NULL CHECK (total >= 0),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS purchase_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_id uuid NOT NULL REFERENCES purchases(id),
  product_id uuid NOT NULL REFERENCES products(id),
  quantity integer NOT NULL CHECK (quantity > 0),
  cost numeric(14,0) NOT NULL CHECK (cost >= 0)
);
CREATE TABLE IF NOT EXISTS installations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  number text NOT NULL UNIQUE DEFAULT ('JOB-' || nextval('job_number')),
  title text NOT NULL,
  customer_id uuid REFERENCES customers(id),
  sale_id uuid REFERENCES sales(id),
  technician_id uuid REFERENCES staff(id),
  location text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'Scheduled' CHECK (status IN ('Scheduled','In progress','Completed','Cancelled')),
  scheduled date,
  completed_at timestamptz,
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS installation_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES installations(id),
  product_id uuid NOT NULL REFERENCES products(id),
  quantity integer NOT NULL CHECK (quantity > 0),
  cost numeric(14,0) NOT NULL CHECK (cost >= 0),
  serial text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  description text NOT NULL,
  amount numeric(14,0) NOT NULL CHECK (amount > 0),
  job_id uuid REFERENCES installations(id),
  incurred date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS stock_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES products(id),
  kind text NOT NULL,
  delta integer NOT NULL CHECK (delta <> 0),
  reference text NOT NULL,
  staff_id uuid NOT NULL REFERENCES staff(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS returns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid UNIQUE NOT NULL,
  sale_item_id uuid NOT NULL REFERENCES sale_items(id),
  quantity integer NOT NULL CHECK (quantity > 0),
  refund numeric(14,0) NOT NULL CHECK (refund >= 0),
  restock boolean NOT NULL,
  reason text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id uuid NOT NULL REFERENCES staff(id),
  action text NOT NULL,
  detail text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS sales_date ON sales (created_at);
CREATE INDEX IF NOT EXISTS sales_customer ON sales (customer_id);
CREATE INDEX IF NOT EXISTS sales_items_sale ON sale_items (sale_id);
CREATE INDEX IF NOT EXISTS payments_sale ON payments (sale_id);
CREATE INDEX IF NOT EXISTS returns_item ON returns (sale_item_id);
CREATE INDEX IF NOT EXISTS stock_history ON stock_movements (product_id, created_at DESC);
CREATE INDEX IF NOT EXISTS installations_sale ON installations (sale_id);
CREATE INDEX IF NOT EXISTS expenses_job ON expenses (job_id);
CREATE INDEX IF NOT EXISTS installation_items_job ON installation_items (job_id);
