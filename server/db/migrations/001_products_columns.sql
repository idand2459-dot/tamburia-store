-- עמודות שנוספו לטבלת products לאורך הדרך.
-- הטבלה עצמה נוצרה ידנית ומכילה נתונים אמיתיים — לא נוגעים בה.
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS sku         VARCHAR(100),
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS images      JSONB   DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS in_stock    BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS sizes       TEXT[]  DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS variants    JSONB   DEFAULT '[]';
