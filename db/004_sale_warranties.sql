ALTER TABLE sale_items ADD COLUMN warranty_until date;

UPDATE sale_items l SET warranty_until = (
  (s.created_at AT TIME ZONE 'Africa/Dar_es_Salaam')::date + make_interval(months => p.warranty)
)::date
FROM sales s, products p
WHERE l.sale_id=s.id AND l.product_id=p.id AND p.warranty>0;

CREATE INDEX sale_serial_lookup ON sale_items (product_id, lower(serial)) WHERE serial<>'';
CREATE INDEX installation_serial_lookup ON installation_items (product_id, lower(serial)) WHERE serial<>'';
