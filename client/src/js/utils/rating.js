/**
 * עיגול ממוצע דירוג לתצוגה.
 *
 * ספרה אחת אחרי הנקודה בכל מקום: הכרזה, רצועת חוות הדעת ועמוד המוצר.
 * "4.71" נראה כמו מדידה ולא כמו דירוג, ושתי הספרות גם לא אומרות כלום
 * מעל חמש-עשרה ביקורות.
 *
 * שלושת הרכיבים חישבו בעצמם reduce/length/toFixed(1) באותה שורה בדיוק,
 * והכרזה לקחה את average מ-/api/reviews/stats כמו שהוא — ולכן היא
 * היחידה שהציגה שתי ספרות. עכשיו יש מקום אחד שקובע את הצורה.
 *
 * ה-API ממשיך להחזיר שתי ספרות. זה נתון, והעיגול הוא החלטה של התצוגה.
 */

/** מעגל ממוצע לספרה אחת. מחזיר null כשאין מה להציג. */
export function formatRating(average) {
  const num = Number(average);
  if (!Number.isFinite(num)) return null;
  return num.toFixed(1);
}

/** מחשב ממוצע מרשימת חוות דעת ומעגל אותו. null כשהרשימה ריקה. */
export function averageRating(reviews) {
  if (!Array.isArray(reviews) || reviews.length === 0) return null;
  const sum = reviews.reduce((total, review) => total + review.rating, 0);
  return formatRating(sum / reviews.length);
}
