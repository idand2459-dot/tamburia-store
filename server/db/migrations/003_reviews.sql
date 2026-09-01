CREATE TABLE IF NOT EXISTS reviews (
  id            SERIAL PRIMARY KEY,
  reviewer_name VARCHAR(200) NOT NULL,
  rating        INTEGER      NOT NULL CHECK (rating >= 1 AND rating <= 5),
  text          TEXT         NOT NULL,
  type          VARCHAR(20)  NOT NULL DEFAULT 'store',
  product_id    INTEGER      REFERENCES products(id) ON DELETE CASCADE,
  approved      BOOLEAN      DEFAULT false,
  created_at    TIMESTAMP    DEFAULT NOW()
);
