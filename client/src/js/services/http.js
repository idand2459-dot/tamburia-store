/**
 * הבסיס המשותף לשירותי ה-API של חזית החנות.
 *
 * שלושה דברים שכל שירות כאן צריך ואף אחד מהם אינו שייך לדומיין
 * מסוים: בניית כתובת עם query, קריאת JSON שמכבדת שגיאות שרת,
 * והבחנה בין שגיאה אמיתית לבין בקשה שבוטלה.
 *
 * מסך הניהול אינו עובר דרך כאן. יש לו עוטף fetch משלו (api ב-
 * pages/admin/Admin.js) שמזהה 401 ומחזיר את המנהל למסך ההתחברות,
 * וזו התנהגות שאין לה מקום בחזית: לקורא אנונימי אין לאן לחזור.
 */
import { errorMessageFrom } from '../utils/apiErrors';

/** שגיאה שהשרת החזיר, עם קוד הסטטוס שלה. */
export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

/** האם השגיאה היא 404 — משאב שאינו קיים, להבדיל מתקלה. */
export function isNotFound(error) {
  return error instanceof ApiError && error.status === 404;
}

/**
 * האם הבקשה בוטלה דרך AbortController.
 *
 * הקוראים צריכים להבדיל: ביטול אינו כישלון אלא בדיוק מה שביקשנו,
 * ואסור לו להדליק מצב שגיאה ברכיב שממילא כבר לא מציג את התשובה.
 */
export function isAbortError(error) {
  return error?.name === 'AbortError';
}

/**
 * בונה כתובת עם query string, בלי פרמטרים ריקים.
 *
 * בלי פרמטרים כלל מוחזרת הכתובת נקייה, בלי '?' תלוי באוויר — כך
 * getProducts() פונה בדיוק ל-/api/products, כמו הקריאה שקדמה לו.
 */
export function buildUrl(path, params = {}) {
  const search = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    search.set(key, String(value));
  });

  const query = search.toString();
  return query ? `${path}?${query}` : path;
}

/** שולף JSON, וזורק ApiError עם הודעת השרת כשהתשובה אינה תקינה. */
export async function getJson(url, { signal } = {}) {
  const res = await fetch(url, { signal });

  if (!res.ok) {
    throw new ApiError(await errorMessageFrom(res), res.status);
  }

  return res.json();
}
