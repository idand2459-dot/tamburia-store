/**
 * "נקודת ההתחלה" של לשונית הסטטיסטיקות — התאריך שממנו הסיכומים נספרים.
 *
 * אין בשרת מספרים שמורים לאפס: כל מה שהלשונית מציגה מחושב מההזמנות
 * עצמן. לכן "אפס" כאן אינו מוחק דבר אלא קובע מאיזה רגע סופרים, וכל
 * מה שקדם לו יוצא מהחישוב. ההזמנות נשארות במקומן — לשונית ההזמנות,
 * חיפוש הלקוח לפי טלפון והייצוא לאקסל אינם מושפעים — ולחיצה על "בטל
 * איפוס" מחזירה את התמונה המלאה.
 *
 * ההגדרה נשמרת במסד (settings.stats_counting_from) ולא ב-localStorage,
 * כדי שאיפוס שנעשה בטלפון ייראה גם במחשב שבחנות. הביטול הוא PUT עם
 * value: null — השרת מוחק את השורה, וקריאה הבאה מחזירה null.
 *
 * Receives the admin API (adminApi, see services/adminService.js) as an argument, so an
 * expired session still returns the admin to the password screen.
 *
 * loading מוחזק כדי שהלשונית לא תצייר סיכומים לפני שידוע ממתי סופרים:
 * בלעדיו היו מהבהבים המספרים של כל ההיסטוריה ורק אחר כך המסוננים.
 */
import { useState, useEffect, useCallback } from 'react';
import { errorMessageFrom, NETWORK_ERROR } from '../utils/apiErrors';

const SETTING_KEY = 'stats-counting-from';

/** מחזיר את נקודת ההתחלה, ואת שתי הפעולות שמשנות אותה. */
export function useStatsBaseline(adminApi) {
  const [since, setSince] = useState(null);
  const [loading, setLoading] = useState(true);
  const [baselineError, setBaselineError] = useState('');

  /** שולף את נקודת ההתחלה מהשרת. */
  const load = useCallback(async () => {
    try {
      const res = await adminApi.getSetting(SETTING_KEY);
      if (!res.ok) {
        // 401 כבר טופל בעוטף; כאן נשארת רק תקלה אמיתית
        setBaselineError(await errorMessageFrom(res, 'טעינת נקודת ההתחלה של הסיכומים נכשלה.'));
        return;
      }
      const body = await res.json();
      setSince(body.value ?? null);
      setBaselineError('');
    } catch {
      setBaselineError(NETWORK_ERROR);
    } finally {
      // ב-finally: גם כשהטעינה נכשלה הלשונית צריכה להיפתח ולהציג את
      // הסיכומים המלאים, ולא להישאר על מסך המתנה.
      setLoading(false);
    }
  }, [adminApi]);

  useEffect(() => { load(); }, [load]);

  /** כותב ערך חדש, ומעדכן את המצב המקומי רק כשהשרת אישר. */
  const save = useCallback(async (value, failMessage) => {
    try {
      const res = await adminApi.saveSetting(SETTING_KEY, value);

      if (!res.ok) {
        setBaselineError(await errorMessageFrom(res, failMessage));
        return;
      }

      // הערך שחזר ולא זה שנשלח: השרת מנרמל אותו ל-ISO
      const body = await res.json();
      setSince(body.value ?? null);
      setBaselineError('');
    } catch {
      setBaselineError(NETWORK_ERROR);
    }
  }, [adminApi]);

  /** קובע את הרגע הזה כנקודת ההתחלה של הסיכומים. */
  const resetStats = useCallback(() => (
    save(new Date().toISOString(), 'איפוס הסיכומים נכשל.')
  ), [save]);

  /** מבטל את האיפוס ומחזיר את הסיכומים לכל ההיסטוריה. */
  const clearBaseline = useCallback(() => (
    save(null, 'ביטול האיפוס נכשל.')
  ), [save]);

  return { since, loading, baselineError, resetStats, clearBaseline };
}
