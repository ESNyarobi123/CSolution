-- Front Office can ask to change a recorded sale. Admin approval applies the edit.
ALTER TABLE approval_requests DROP CONSTRAINT approval_requests_kind_check;
ALTER TABLE approval_requests ADD CONSTRAINT approval_requests_kind_check
  CHECK (kind IN ('Sale terms', 'Return', 'Sale edit'));
