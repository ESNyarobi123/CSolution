ALTER TABLE returns ADD COLUMN credit numeric(14,0) NOT NULL DEFAULT 0 CHECK (credit >= 0);
ALTER TABLE returns ADD COLUMN tax_credit numeric(14,0) NOT NULL DEFAULT 0 CHECK (tax_credit >= 0 AND tax_credit <= credit);
