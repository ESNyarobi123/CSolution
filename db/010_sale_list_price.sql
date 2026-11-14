-- Keep the shelf price of a line when it was sold at a negotiated price, so
-- management can see the reduction afterwards while invoices and receipts keep
-- showing only the agreed price.
ALTER TABLE sale_items ADD COLUMN IF NOT EXISTS list_price numeric(14,0);
