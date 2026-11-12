ALTER TABLE sale_items ADD COLUMN unit text;
UPDATE sale_items l SET unit=p.unit FROM products p WHERE l.product_id=p.id;
ALTER TABLE sale_items ALTER COLUMN unit SET NOT NULL;
