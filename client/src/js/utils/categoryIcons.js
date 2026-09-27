/**
 * ממפה מזהה קטגוריה לרכיב אייקון של Lucide.
 *
 * המפה הזו היא מקור האמת לאייקון של כל מושג באתר, לא רק ברשת הקטגוריות.
 * מושג שמופיע כאן — צביעה, אינסטלציה, מנעולים, גינה, כלי עבודה — חייב
 * להופיע עם אותו אייקון בכל מקום שבו הוא מוזכר: מחשבון הפרויקט, מחשבון
 * הצבע, הכפתור הצף, עמוד ההחזרות, האודות ורצועת ההודעות. לפני שמוסיפים
 * אייקון למושג שקיים כאן — בודקים מה כתוב כאן ומשתמשים בו.
 *
 * שני חריגים מכוונים: מפתח הברגים שליד "טכניק טמבור" בניווט, בפוטר
 * וברצועה הוא סמל המותג ולא המושג "אינסטלציה"; ו-DoorOpen במחשבון הצבע
 * סופר דלתות בחדר ואינו המושג "מנעולים".
 *
 * שדה ה-icon שב-categories.js נשאר אימוג'י (מחרוזת) — קוד אחר עדיין מסתמך
 * עליו — ולכן המפה הזו היא מסלול מקביל: מי שמרנדר אייקון קטגוריה שולף מכאן
 * רכיב, ולא קורא את שדה ה-icon.
 */
import {
  PaintRoller, Hammer, ShowerHead, CookingPot, SprayCan,
  Sprout, Wrench, Pipette, Lock, Droplet, Zap, House,
} from 'lucide-react';

const CATEGORY_ICONS = {
  painting: PaintRoller,
  tools: Hammer,
  bathroom: ShowerHead,
  kitchen: CookingPot,
  cleaning: SprayCan,
  garden: Sprout,
  plumbing: Wrench,
  adhesives: Pipette,
  locks: Lock,
  faucets: Droplet,
  electrical: Zap,
  home: House,
};

export default CATEGORY_ICONS;
