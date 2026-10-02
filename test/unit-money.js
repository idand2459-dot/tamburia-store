/**
 * בודק את server/utils/money.js בבידוד: הפענוח, החשבון באגורות
 * והתצוגה. בלי רשת ובלי מסד.
 *
 * כל השכבות שמעליו — הוולידטורים, pricing.service, המיילים — נשענות
 * עליו, ולכן כשל כאן הוא הסימן המהיר ביותר לכך שמחיר עשרוני יעוגל
 * או יושווה לא נכון.
 */
const {
  parsePrice, toAgorot, fromAgorot, lineTotal, formatAmount, formatPrice, MAX_PRICE,
} = require('../server/utils/money');

let passed = 0;
let failed = 0;

/** רושם תוצאה של בדיקה בודדת. */
function check(name, condition, actual) {
  if (condition) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    console.log(`  ✗ ${name} — קיבלנו: ${JSON.stringify(actual)}`);
  }
}

console.log('\n── פענוח מחיר');
check('12.9 → 12.9', parsePrice(12.9) === 12.9, parsePrice(12.9));
check('"12.90" → 12.9', parsePrice('12.90') === 12.9, parsePrice('12.90'));
check('30 → 30', parsePrice(30) === 30, parsePrice(30));
check('0.01 → 0.01', parsePrice(0.01) === 0.01, parsePrice(0.01));
check('12.999 נדחה ולא מעוגל', parsePrice(12.999) === null, parsePrice(12.999));
check('0 אינו מחיר כברירת מחדל', parsePrice(0) === null, parsePrice(0));
check('0 מתקבל עם allowZero', parsePrice(0, { allowZero: true }) === 0, parsePrice(0, { allowZero: true }));
check('שלילי נדחה', parsePrice(-1) === null, parsePrice(-1));
check('פסיק נדחה בשרת', parsePrice('12,90') === null, parsePrice('12,90'));
check('ריק, null ו-true נדחים',
  [parsePrice(''), parsePrice(null), parsePrice(undefined), parsePrice(true)].every((v) => v === null));
check('התקרה מתקבלת', parsePrice(MAX_PRICE) === MAX_PRICE, parsePrice(MAX_PRICE));
check('מעל התקרה נדחה', parsePrice(MAX_PRICE + 1) === null, parsePrice(MAX_PRICE + 1));

console.log('\n── אגורות');
check('12.9 ו-"12.90" הם 1290 אגורות', toAgorot(12.9) === 1290 && toAgorot('12.90') === 1290,
  [toAgorot(12.9), toAgorot('12.90')]);
check('0.1 + 0.2 הוא 30 אגורות', toAgorot(0.1 + 0.2) === 30, toAgorot(0.1 + 0.2));
check('1.005 (float 1.00499…) לא נשבר', Number.isInteger(toAgorot(1.005)), toAgorot(1.005));
check('fromAgorot(3870) → 38.7', fromAgorot(3870) === 38.7, fromAgorot(3870));
check('3 × 12.9 → 38.7 ולא 38.699999999999996', lineTotal(12.9, 3) === 38.7, lineTotal(12.9, 3));
check('7 × 0.1 → 0.7', lineTotal(0.1, 7) === 0.7, lineTotal(0.1, 7));

console.log('\n── תצוגה');
check('עשרוני — שתי ספרות', formatPrice(12.9) === '₪12.90', formatPrice(12.9));
check('שלם — בלי נקודה', formatPrice(30) === '₪30', formatPrice(30));
check('אגורה', formatPrice(0.01) === '₪0.01', formatPrice(0.01));
check('שארית float מעוגלת לשלם', formatAmount(30.000000000004) === '30', formatAmount(30.000000000004));
check('מחרוזת מהמסד', formatAmount('12.90') === '12.90', formatAmount('12.90'));

console.log(`\n${failed === 0 ? '✓' : '✗'} עברו ${passed}, נכשלו ${failed}`);
process.exitCode = failed === 0 ? 0 : 1;
