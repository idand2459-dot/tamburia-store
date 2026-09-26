/**
 * ממפה מזהה קטגוריה לרכיב אייקון של Lucide.
 *
 * שדה ה-icon שב-categories.js נשאר אימוג'י (מחרוזת) — קוד אחר עדיין מסתמך
 * עליו — ולכן המפה הזו היא מסלול מקביל: מי שמרנדר אייקון קטגוריה שולף מכאן
 * רכיב, ולא קורא את שדה ה-icon.
 */
import {
  Paintbrush, Wrench, ShowerHead, CookingPot, SprayCan,
  Flower2, Pipette, Paperclip, Lock, Droplet, Zap, House,
} from 'lucide-react';

const CATEGORY_ICONS = {
  painting: Paintbrush,
  tools: Wrench,
  bathroom: ShowerHead,
  kitchen: CookingPot,
  cleaning: SprayCan,
  garden: Flower2,
  plumbing: Pipette,
  adhesives: Paperclip,
  locks: Lock,
  faucets: Droplet,
  electrical: Zap,
  home: House,
};

export default CATEGORY_ICONS;
