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
import { errorFrom, NETWORK_ERROR } from '../utils/apiErrors';

/** שגיאה שהשרת החזיר, עם קוד הסטטוס שלה ומה שצירף ב-details. */
export class ApiError extends Error {
  constructor(message, status, details) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }
}

/** ApiError מתשובה שנכשלה; fallback כשהשרת לא הסביר. */
async function apiErrorFrom(res, fallback) {
  const { message, details } = await errorFrom(res, fallback);
  return new ApiError(message, res.status, details);
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

/**
 * ההודעה שמוצגת למשתמש על שגיאה כלשהי מהשירותים כאן.
 *
 * שני מסלולי כישלון ושני נוסחים: תשובה מהשרת מביאה את ההסבר שלו
 * ("חסר שם הכותב"), ואילו fetch שזרק פירושו שלא הגענו לשרת בכלל —
 * ושם אין מה לצטט אלא לבקש לבדוק את החיבור.
 */
export function messageFor(error) {
  return error instanceof ApiError ? error.message : NETWORK_ERROR;
}

/** שולף JSON, וזורק ApiError עם הודעת השרת כשהתשובה אינה תקינה. */
export async function getJson(url, { signal, fallback } = {}) {
  const res = await fetch(url, { signal });

  if (!res.ok) {
    throw await apiErrorFrom(res, fallback);
  }

  return res.json();
}

/** שולח JSON, וזורק ApiError עם הודעת השרת כשהתשובה אינה תקינה. */
export async function postJson(url, body, { signal, fallback } = {}) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  });

  if (!res.ok) {
    throw await apiErrorFrom(res, fallback);
  }

  return res.json();
}
