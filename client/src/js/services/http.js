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

/**
 * הבקשה לא נענתה בזמן שהוקצב לה. זה לא כישלון ידוע: השרת עשוי היה לקבל אותה ולבצע אותה,
 * ורק התשובה לא הגיעה. מי שהבקשה שלו משנה מצב חייב להתייחס לזה כאל תוצאה לא ידועה.
 */
export class TimeoutError extends Error {
  constructor(timeoutMs) {
    super(`הבקשה לא נענתה תוך ${timeoutMs}ms`);
    this.name = 'TimeoutError';
    this.timeoutMs = timeoutMs;
  }
}

/**
 * signal שמתבטל כשהמקורי מתבטל או כשעבר הזמן. AbortController ו-setTimeout ולא
 * AbortSignal.timeout: האחרון חסר בדפדפנים שמתחת ל-Chrome 103 ול-Safari 16.
 */
function withTimeout(signal, timeoutMs) {
  if (!timeoutMs) return { signal, timedOut: () => false, clear: () => {} };

  const controller = new AbortController();
  let timedOut = false;
  const onAbort = () => controller.abort();
  if (signal?.aborted) controller.abort();
  else signal?.addEventListener('abort', onAbort);

  const timer = setTimeout(() => { timedOut = true; controller.abort(); }, timeoutMs);
  return {
    signal: controller.signal,
    timedOut: () => timedOut,
    clear: () => { clearTimeout(timer); signal?.removeEventListener('abort', onAbort); },
  };
}

/**
 * שולח JSON, וזורק ApiError עם הודעת השרת כשהתשובה אינה תקינה.
 * עם timeoutMs, בקשה שלא נענתה בזמן (כולל קריאת הגוף) נקטעת וזורקת TimeoutError.
 */
export async function postJson(url, body, { signal, fallback, timeoutMs } = {}) {
  const guard = withTimeout(signal, timeoutMs);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: guard.signal,
    });

    if (!res.ok) {
      throw await apiErrorFrom(res, fallback);
    }

    return await res.json();
  } catch (error) {
    if (guard.timedOut()) throw new TimeoutError(timeoutMs);
    throw error;
  } finally {
    guard.clear();
  }
}
