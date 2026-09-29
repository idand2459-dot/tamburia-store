/**
 * אילו מוצרים ששמורים אצל הלקוח כבר אינם בקטלוג.
 *
 * העגלה, המועדפים והנצפים לאחרונה נשמרים ב-localStorage כצילום של
 * המוצר ברגע שנשמר — שם, מחיר ותמונה. הצילום הזה לא מתעדכן לעולם,
 * ולכן מוצר שהוסתר מאז ממשיך להיראות שם כאילו אפשר לקנות אותו.
 *
 * ההוק שואל את השרת פעם אחת על כל המזהים ביחד, ומחזיר את מי שלא חזר.
 * החנות מגישה רק מוצרים פעילים (server/controllers/product.controller),
 * ולכן "לא חזר" פירושו מוסתר או נמחק — ומבחינת הלקוח אלה אותו דבר.
 *
 * כישלון רשת אינו חוסם: הסט נשאר ריק, וההזמנה תיעצר בשרת אם באמת
 * יש בה מוצר שאינו נמכר. עדיף כך מאשר לחסום עגלה תקינה בגלל ניתוק.
 */
import { useState, useEffect, useMemo } from 'react';
import { getProducts } from '../services/productService';

/* התקרה של פרמטר ids בשרת. עגלה או רשימת מועדפים לא מגיעות לשם
   בפועל; מעבר לזה פשוט לא נבדק, וזו אותה נפילה-לטובה של כישלון רשת. */
const MAX_IDS = 100;

/** מחזיר את קבוצת המזהים שאינם בקטלוג, מתוך המזהים שנשלחו. */
export function useAvailability(ids) {
  // המפתח הוא מחרוזת ולא מערך: המערך נוצר מחדש בכל רינדור, והאפקט
  // היה רץ שוב בכל הקלדה בעגלה.
  const key = useMemo(() => (
    [...new Set((ids || []).filter(Boolean))].slice(0, MAX_IDS).sort((a, b) => a - b).join(',')
  ), [ids]);

  const [unavailableIds, setUnavailableIds] = useState(() => new Set());

  useEffect(() => {
    if (!key) {
      setUnavailableIds(new Set());
      return undefined;
    }

    const controller = new AbortController();

    getProducts({ ids: key, signal: controller.signal })
      .then(({ products }) => {
        const inCatalog = new Set(products.map((product) => product.id));
        setUnavailableIds(new Set(
          key.split(',').map(Number).filter((id) => !inCatalog.has(id))
        ));
      })
      .catch(() => { /* ניתוק — לא חוסמים את הלקוח */ });

    return () => controller.abort();
  }, [key]);

  return unavailableIds;
}
