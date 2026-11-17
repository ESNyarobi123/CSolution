-- Each product can carry several photos. The first photo (position 0) is the
-- cover used on lists, the sale catalog, invoices and receipts.
CREATE TABLE IF NOT EXISTS product_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  url text NOT NULL,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS product_images_product_idx ON product_images (product_id,position,created_at);

-- Every existing single photo becomes the first photo of its product.
INSERT INTO product_images (product_id,url,position)
SELECT p.id,p.image_url,0 FROM products p
WHERE p.image_url IS NOT NULL AND p.image_url <> ''
  AND NOT EXISTS (SELECT 1 FROM product_images i WHERE i.product_id=p.id);
