/**
 * "נקודת ההתחלה" של לשונית הסטטיסטיקות — התאריך שממנו הסיכומים נספרים.
 *
 * אין בשרת מספרים שמורים לאפס: כל מה שהלשונית מציגה מחושב מההזמנות
 * עצמן. לכן "אפס" כאן אינו מוחק דבר אלא קובע מאיזה רגע סופרים, וכל
 * מה שקדם לו יוצא מהחישוב. ההזמנות נשארות במקומן — לשונית ההזמנות,
 * חיפוש הלקוח לפי טלפון והייצוא לאקסל אינם מושפעים — ולחיצה על "בטל
 * איפוס" מחזירה את התמונה המלאה.
 *
 * נשמר ב-localStorage ולכן הוא מקומי לדפדפן: איפוס שנעשה בטלפון אינו
 * מופיע במחשב שבחנות. זו ההחלטה שנבחרה — שמירה בשרת הייתה דורשת
 * עמודה או טבלת הגדרות, וזה שינוי גדול יותר ממה שהכפתור הזה שווה.
 */
import { useState, useCallback } from 'react';

const STORAGE_KEY = 'tamburia_admin_stats_since';

/** קורא את נקודת ההתחלה השמורה, או null כשאין. */
function readBaseline() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    // ערך פגום (עריכה ידנית, גרסה ישנה) נחשב כאילו אין איפוס בכלל
    return Number.isNaN(new Date(raw).getTime()) ? null : raw;
  } catch {
    return null;
  }
}

/** מחזיר את נקודת ההתחלה, ואת שתי הפעולות שמשנות אותה. */
export function useStatsBaseline() {
  const [since, setSince] = useState(readBaseline);

  /** קובע את הרגע הזה כנקודת ההתחלה של הסיכומים. */
  const resetStats = useCallback(() => {
    const now = new Date().toISOString();
    try {
      window.localStorage.setItem(STORAGE_KEY, now);
    } catch {
      /* אין אחסון — האיפוס תקף לגלישה הזו בלבד */
    }
    setSince(now);
  }, []);

  /** מבטל את האיפוס ומחזיר את הסיכומים לכל ההיסטוריה. */
  const clearBaseline = useCallback(() => {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* כנ"ל */
    }
    setSince(null);
  }, []);

  return { since, resetStats, clearBaseline };
}
