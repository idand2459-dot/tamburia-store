/**
 * רשימת הליקוט של הזמנה: אילו שורות כבר הוכנו.
 *
 * השרת שומר את הסימון ב-order.picked_items, קבוצת האינדקסים של
 * השורות שהוכנו ב-order.items (מיגרציה 011, ושם גם למה עמודה נפרדת
 * ולא שדה בתוך items). הפונקציות כאן טהורות, כדי שההוק שמעדכן את
 * המסך והרכיבים שמציגים אותו יקראו את אותו מבנה באותה דרך.
 */

/** האם שורה בהזמנה סומנה כמוכנה. */
export function isPicked(order, line) {
  return Array.isArray(order?.picked_items) && order.picked_items.includes(line);
}

/**
 * מחזיר עותק של picked_items עם שורה אחת מסומנת או לא, ממוין כמו
 * שהשרת מחזיר. שאר השורות נשארות כמו שהן — לכן החזרה אחרי כישלון
 * מחזירה רק את השורה שנכשלה, ולא מוחקת סימון אחר שנעשה בינתיים.
 */
export function withLine(pickedItems, line, picked) {
  const rest = (Array.isArray(pickedItems) ? pickedItems : []).filter((i) => i !== line);
  return picked ? [...rest, line].sort((a, b) => a - b) : rest;
}

/** כמה שורות הוכנו מתוך כמה, והאם כולן. */
export function pickProgress(order) {
  const total = Array.isArray(order?.items) ? order.items.length : 0;
  const done = Array.isArray(order?.picked_items)
    ? order.picked_items.filter((line) => line >= 0 && line < total).length
    : 0;
  return { done, total, complete: total > 0 && done === total };
}
