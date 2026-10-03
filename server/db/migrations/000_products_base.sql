-- טבלת המוצרים בצורתה המקורית, לפני כל המיגרציות שאחריה.
--
-- הטבלה נוצרה פעם ידנית, ולכן 001 מתחילה ב-ALTER TABLE products —
-- ובמסד ריק, בשכפול חדש של הפרויקט, אין מה לשנות והעלייה נכשלת.
-- הקובץ הזה ממלא את החור בלי לגעת באף מיגרציה קיימת:
--
--   * במסד קיים הוא חדש ולכן ממתין, ורץ כ-no-op: IF NOT EXISTS.
--   * במסד ריק הוא רץ ראשון (הסדר הוא לפי שם הקובץ), ו-001..010
--     ממשיכות ממנו בדיוק כפי שרצו על הטבלה שנוצרה ביד.
--
-- לכן העמודות כאן הן של אז ולא של היום: price עוד INTEGER (010 ממירה
-- ל-NUMERIC), colors עוד TEXT[] (008 ממירה ל-JSONB), ואין כאן את מה
-- ש-001, 006 ו-009 מוסיפות.
CREATE TABLE IF NOT EXISTS products (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(255) NOT NULL,
  price       INTEGER      NOT NULL,
  stock       INTEGER      NOT NULL,
  image_url   VARCHAR(500),
  category    VARCHAR(100),
  subcategory VARCHAR,
  colors      TEXT[]       DEFAULT '{}'
);
