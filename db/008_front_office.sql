ALTER TABLE staff DROP CONSTRAINT staff_role_check;
ALTER TABLE staff ADD CONSTRAINT staff_role_check
  CHECK (role IN ('Admin','Front Office','Manager','Cashier','Storekeeper','Technician'));

ALTER TABLE installations ADD COLUMN created_by uuid REFERENCES staff(id);
ALTER TABLE installations DROP CONSTRAINT installations_status_check;
ALTER TABLE installations ADD CONSTRAINT installations_status_check
  CHECK (status IN ('Requested','Scheduled','In progress','Completed','Cancelled'));

CREATE INDEX sales_cashier ON sales(cashier_id);
CREATE INDEX quotations_creator ON quotations(created_by);
CREATE INDEX installations_creator ON installations(created_by);

CREATE TABLE approval_requests (
  id uuid PRIMARY KEY,
  kind text NOT NULL CHECK (kind IN ('Sale terms','Return')),
  requested_by uuid NOT NULL REFERENCES staff(id),
  reason text NOT NULL,
  status text NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending','Approved','Rejected','Completed')),
  payload jsonb NOT NULL,
  summary jsonb NOT NULL,
  reviewed_by uuid REFERENCES staff(id),
  review_note text NOT NULL DEFAULT '',
  reviewed_at timestamptz,
  result_sale_id uuid REFERENCES sales(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX approval_requests_requester ON approval_requests(requested_by,created_at DESC);
