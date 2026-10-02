-- שני שינויים שהמסך החדש של הניהול צריך.

-- 1. הסטטוס 'ready_for_pickup' — הזמנת איסוף שמחכה ללקוח בחנות.
--    עד כה רשימת הסטטוסים התקיימה בוולידטור בלבד; כתיבה ישירה למסד
--    יכלה להכניס כל מחרוזת. הרשימה נרשמת כאן כדי שגם המסד ידחה ערך
--    שאינו מוכר.
--
--    NOT VALID במכוון: הטבלה מכילה הזמנות אמיתיות, ואם אחת מהן נושאת
--    סטטוס היסטורי שאינו ברשימה — המיגרציה לא תיפול עליה. האילוץ נאכף
--    על כל כתיבה מכאן והלאה, כולל עדכון של שורה ותיקה.
ALTER TABLE orders
  DROP CONSTRAINT IF EXISTS orders_status_check;

ALTER TABLE orders
  ADD CONSTRAINT orders_status_check
  CHECK (status IN ('new', 'processing', 'ready_for_pickup', 'shipped', 'completed'))
  NOT VALID;

-- 2. image_illustrative — התמונה של המוצר היא להמחשה בלבד.
--    יש מוצרים (ראש מקלחת, למשל) שמגיעים מספק אחר בכל פעם, והתצלום
--    מראה פריט מייצג ולא את מה שיישלח בדיוק.
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS image_illustrative BOOLEAN NOT NULL DEFAULT false;
