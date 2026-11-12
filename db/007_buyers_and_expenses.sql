ALTER TABLE sales ADD COLUMN buyer_type text NOT NULL DEFAULT 'Walk-in'
  CHECK (buyer_type IN ('Walk-in','Customer','Agent'));
UPDATE sales s SET buyer_type=CASE WHEN c.kind='Agent' THEN 'Agent' ELSE 'Customer' END
  FROM customers c WHERE c.id=s.customer_id;

ALTER TABLE quotations ADD COLUMN buyer_type text NOT NULL DEFAULT 'Walk-in'
  CHECK (buyer_type IN ('Walk-in','Customer','Agent'));
UPDATE quotations q SET buyer_type=CASE WHEN c.kind='Agent' THEN 'Agent' ELSE 'Customer' END
  FROM customers c WHERE c.id=q.customer_id;
ALTER TABLE quotations ADD COLUMN request_id uuid UNIQUE,
  ADD COLUMN created_by uuid REFERENCES staff(id);

ALTER TABLE expenses ADD COLUMN category text NOT NULL DEFAULT 'Other'
  CHECK (category IN ('Transport','Utilities','Rent','Wages','Office supplies','Marketing','Other')),
  ADD COLUMN method text CHECK (method IN ('Cash','Mobile money','Bank transfer','Card')),
  ADD COLUMN reference text NOT NULL DEFAULT '',
  ADD COLUMN notes text NOT NULL DEFAULT '';
