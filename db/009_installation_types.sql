-- Installation types are the priced services a sale or a job can include, such as
-- "Network installation" or "Router configuration". They are service products, so
-- the price, cost and profit keep flowing through the normal sale and report code.
ALTER TABLE products ADD COLUMN IF NOT EXISTS installation boolean NOT NULL DEFAULT false;

-- The installation types agreed for a job, stored with the job so a standalone
-- request still shows what the customer is paying for.
ALTER TABLE installations ADD COLUMN IF NOT EXISTS services jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Shops that already sell installation services get them as selectable types once.
UPDATE products p SET installation = true
  FROM categories c
  WHERE p.category_id = c.id AND c.name = 'Services' AND p.type = 'Service' AND NOT p.installation;
