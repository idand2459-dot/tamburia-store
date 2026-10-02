-- צבעי מוצר הופכים מרשימת שמות לרשימת אובייקטים { name, hex }.
--
-- עד כאן colors היה text[], והגוון נקבע בקליינט לפי מפה של 15 שמות
-- מדויקים. כל שם אחר — "אגוז", "טיק", "חום כהה" — קיבל #ccc, אותו אפור
-- לכולם, שנראה כמו צבע אמיתי ולא כמו "אין לנו גוון". הגוון הוא נתון של
-- המוצר, ולכן מקומו במסד ולא בטבלה בקוד.
--
-- ההמרה כאן היא חד-פעמית, והמפה מועתקת לתוכה במכוון: מיגרציה מתארת מה
-- קרה בנקודת זמן, ואסור לה להשתנות כשהפלטה בקליינט תשתנה.
--
-- שלוש דרגות התאמה לכל שם:
--   1. התאמה מדויקת לשם בטבלה
--   2. שם שמכיל אחד מהם כמילה ("חום כהה" → חום, "לבן שלג" → לבן).
--      הראשון שמופיע בשם מנצח, ולכן "כתום/שחור" הוא כתום.
--   3. אין התאמה — hex ריק. עמוד המוצר מציג עיגול מפוספס במקום גוון,
--      וזה הדבר הנכון: "מספר 1", "על הטיח" ו-"1 מטר" אינם צבעים בכלל,
--      והם שליש מהערכים שיש בעמודה הזו.

ALTER TABLE products ADD COLUMN IF NOT EXISTS colors_json JSONB NOT NULL DEFAULT '[]'::jsonb;

WITH shade(name, hex) AS (VALUES
  -- בסיסיים
  ('לבן', '#ffffff'), ('שחור', '#1a1a1a'), ('אפור', '#888888'),
  ('כחול', '#2563eb'), ('אדום', '#dc2626'), ('ירוק', '#16a34a'),
  ('צהוב', '#eab308'), ('כתום', '#ea580c'), ('חום', '#92400e'),
  ('בז''', '#d4b896'), ('כסף', '#c0c0c0'), ('כסוף', '#c0c0c0'),
  ('זהב', '#d4af37'), ('ורוד', '#ec4899'), ('סגול', '#9333ea'),
  ('תכלת', '#38bdf8'), ('כרום', '#b8bcc0'), ('פחם', '#36454f'),
  ('בורדו', '#6b1e2e'), ('ברונזה', '#a0713a'), ('זית', '#6b7a3a'),
  ('קרם', '#f5f0e1'), ('נחושת', '#b87333'), ('ניקל', '#9aa0a6'),
  ('תפוז', '#f97316'),
  -- גווני עץ
  ('אגוז', '#6b4423'), ('טיק', '#a0703d'), ('אלון', '#c89f6d'),
  ('מהגוני', '#7b3f2f'), ('ערמון', '#7c4a2d'), ('דובדבן', '#9b3b2a'),
  ('וונגה', '#3b2c26'), ('אורן', '#d9b27c')
)
UPDATE products p
   SET colors_json = COALESCE((
         SELECT jsonb_agg(
                  jsonb_build_object('name', t.c, 'hex', COALESCE(
                    (SELECT s.hex FROM shade s WHERE s.name = t.c),
                    (SELECT s.hex FROM shade s
                      WHERE position(s.name IN t.c) > 0
                      ORDER BY position(s.name IN t.c), length(s.name) DESC
                      LIMIT 1),
                    ''
                  ))
                  ORDER BY t.ord)
           FROM unnest(p.colors) WITH ORDINALITY AS t(c, ord)
       ), '[]'::jsonb)
 WHERE p.colors IS NOT NULL AND array_length(p.colors, 1) > 0;

ALTER TABLE products DROP COLUMN colors;
ALTER TABLE products RENAME COLUMN colors_json TO colors;
