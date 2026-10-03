/**
 * מתרגם שם צבע לגוון, לפי אותה פלטה שטופס המוצר מציע.
 *
 * הפלטה נקראת מ-client/src/js/utils/colorPalette.js — אותו קובץ
 * שהאדמין רואה — ולא מועתקת לכאן. הסיבה והשיטה זהות לאלה של
 * scripts/lib/categories.js: מודול ES שאי אפשר לעשות לו require,
 * ורשימה שאסור שיהיו לה שני עותקים שמתיישנים בנפרד.
 *
 * כלל ההתאמה מועתק ממיגרציה 008, שהמירה את כל הצבעים שכבר במסד:
 * התאמה מדויקת, אחר כך שם שמכיל אחד מהם כמילה ("חום אגוז" → אגוז),
 * ואם אין — גוון ריק. גוון ריק הוא מצב חוקי ולא כישלון: "מספר 2"
 * ו"על הטיח" יושבים בעמודת הצבעים של מוצרים אמיתיים ואינם צבעים
 * כלל, ועמוד המוצר מצייר להם עיגול מפוספס.
 */
const fs = require('fs');
const path = require('path');

const SOURCE = path.join(
  __dirname, '..', '..', 'client', 'src', 'js', 'utils', 'colorPalette.js'
);

let cached = null;

/** קורא את הפלטה של הקליינט, פעם אחת לכל ריצה. */
function load() {
  if (cached) return cached;

  let source;
  try {
    source = fs.readFileSync(SOURCE, 'utf8');
  } catch (err) {
    throw new Error(`לא נמצאה הפלטה של הקליינט (${SOURCE}): ${err.message}`);
  }

  // מסירים רק את מילת ה-export, ומשאירים את ההגדרות כפי שהן.
  const plain = source.replace(/^export\s+(const|function)\s/gm, '$1 ');

  let palette;
  try {
    // eslint-disable-next-line no-new-func
    palette = new Function(`${plain}\nreturn PALETTE;`)();
  } catch (err) {
    throw new Error(
      `לא הצלחתי לקרוא את ${path.basename(SOURCE)}: ${err.message}\n` +
      'אם נוספו לקובץ import־ים, צריך לעדכן את scripts/lib/palette.js.'
    );
  }

  if (!Array.isArray(palette) || palette.length === 0) {
    throw new Error(`${path.basename(SOURCE)} לא החזיר פלטה.`);
  }

  const shades = palette.flatMap((group) => group.colors);
  cached = {
    shades,
    byName: new Map(shades.map((shade) => [shade.name, shade.hex])),
  };
  return cached;
}

/** מחזיר את הגוון של שם צבע, או מחרוזת ריקה כשאין התאמה. */
function hexFor(name) {
  const { shades, byName } = load();
  const trimmed = String(name ?? '').trim();
  if (!trimmed) return '';

  const exact = byName.get(trimmed);
  if (exact) return exact;

  // "חום אגוז" → אגוז. הראשון שמופיע בשם מנצח, כמו במיגרציה 008,
  // ולכן "כתום/שחור" הוא כתום.
  let best = null;
  for (const shade of shades) {
    const at = trimmed.indexOf(shade.name);
    if (at === -1) continue;
    if (best === null || at < best.at) best = { at, hex: shade.hex };
  }

  return best ? best.hex : '';
}

/** ממיר רשימת שמות מופרדת בנקודה-פסיק לצורה { name, hex }. */
function parseColors(raw) {
  return String(raw ?? '')
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((name) => ({ name, hex: hexFor(name) }));
}

module.exports = { load, parseColors, SOURCE };
