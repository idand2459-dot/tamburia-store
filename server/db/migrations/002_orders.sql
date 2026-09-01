CREATE TABLE IF NOT EXISTS orders (
  id               SERIAL PRIMARY KEY,
  customer_name    VARCHAR(200) NOT NULL,
  customer_phone   VARCHAR(50)  NOT NULL,
  customer_email   VARCHAR(200),
  delivery_method  VARCHAR(20)  NOT NULL,
  delivery_address TEXT,
  notes            TEXT,
  items            JSONB        NOT NULL,
  subtotal         INTEGER      NOT NULL,
  delivery_fee     INTEGER      NOT NULL DEFAULT 0,
  total            INTEGER      NOT NULL,
  status           VARCHAR(50)  NOT NULL DEFAULT 'new',
  created_at       TIMESTAMP    DEFAULT NOW()
);
