DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'apartments_status_enum'
      AND e.enumlabel = 'not_for_sale'
  ) THEN
    ALTER TYPE apartments_status_enum ADD VALUE 'not_for_sale';
  END IF;
END
$$;
