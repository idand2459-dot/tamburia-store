/**
 * ממפה מזהה קטגוריה לרכיב אייקון של Lucide.
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
