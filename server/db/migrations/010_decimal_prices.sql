-- מחירים עם אגורות.
--
-- products.price היה INTEGER, ו-PostgreSQL מעגל בשקט כל ערך עשרוני
-- שנכנס לעמודה כזו: 12.90 נשמר 13. כך גם הסכומים בהזמנות — הזמנה של
-- מוצר ב-12.90 לא הייתה יכולה להישמר בסכום הנכון.
--
-- NUMERIC(10,2) ולא REAL/DOUBLE: מדויק, בלי שגיאות עיגול של float.
-- ההמרה משלם לעשרוני אינה מאבדת דבר — כל מחיר קיים נשאר בדיוק כפי
-- שהוא (30 → 30.00). מה שכבר עוגל בעבר לא חוזר מכאן; זה דורש את
-- המחיר המקורי, וזו החלטה על נתונים ולא על סכמה.
--
-- מחיר הגרסאות יושב ב-products.variants (JSONB), ומספר ב-JSONB הוא
-- כבר numeric מדויק — אין שם מה להמיר. מה שמגביל אותו לשתי ספרות הוא
-- הוולידציה בשרת (server/utils/money.js).
ALTER TABLE products
  ALTER COLUMN price TYPE NUMERIC(10,2) USING price::NUMERIC(10,2);

ALTER TABLE orders
  ALTER COLUMN subtotal     TYPE NUMERIC(10,2) USING subtotal::NUMERIC(10,2),
  ALTER COLUMN delivery_fee TYPE NUMERIC(10,2) USING delivery_fee::NUMERIC(10,2),
  ALTER COLUMN total        TYPE NUMERIC(10,2) USING total::NUMERIC(10,2);
