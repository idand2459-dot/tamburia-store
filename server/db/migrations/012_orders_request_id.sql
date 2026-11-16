-- Idempotent order creation (P7.4).
--
-- request_id is chosen by the client once per order attempt and sent again unchanged when the
-- attempt is retried; request_hash is the SHA-256 of the normalized order the first request
-- carried, so the same id with a different order can be told apart from a real retry.
-- Both are NULL for orders created before this migration and for clients that send no id.
--
-- The unique index is what makes concurrent duplicates impossible: whichever INSERT commits first
-- owns the id, and the others see a conflict. It is partial because most rows have no id.
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS request_id   VARCHAR(64),
  ADD COLUMN IF NOT EXISTS request_hash CHAR(64);

CREATE UNIQUE INDEX IF NOT EXISTS orders_request_id_key
  ON orders (request_id)
  WHERE request_id IS NOT NULL;
