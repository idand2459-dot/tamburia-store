/**
 * בודק את כלל המודרציה של services/review.service בבידוד, בלי מסד:
 * מודל מזויף נטען למקום של models/review.model.
 *
 * הכלל: הרשימה והסטטיסטיקה הציבוריות הן של מאושרות בלבד, גם כשהבקשה
 * מנסה אחרת; חוות דעת חדשה נשמרת תמיד לא-מאושרת.
 */
const path = require('path');

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

const calls = [];
const fakeModel = {
  list: async (options) => { calls.push(['list', options]); return []; },
  count: async (options) => { calls.push(['count', options]); return 0; },
  stats: async (options) => { calls.push(['stats', options]); return { total: 0 }; },
  create: async (data) => { calls.push(['create', data]); return { id: 1, ...data }; },
  findById: async (id) => (id === 1 ? { id: 1 } : null),
  update: async (id, data) => (id === 1 ? { id: 1, ...data } : null),
  remove: async (id) => (id === 1 ? { id: 1 } : null),
};
const modelPath = require.resolve(path.join(__dirname, '../server/models/review.model'));
require.cache[modelPath] = { id: modelPath, filename: modelPath, loaded: true, exports: fakeModel };

const service = require('../server/services/review.service');
const last = (op) => calls.filter(([name]) => name === op).pop()[1];

async function main() {
  console.log('\n── הציבור');
  await service.listPublic({ type: 'store' });
  check('רשימה ציבורית: approved = true', last('list').approved === true, last('list'));

  await service.listPublic({ approved: false });
  check('גם כשהבקשה ביקשה approved=false', last('list').approved === true, last('list'));

  await service.publicStats({ approved: false });
  check('סטטיסטיקה ציבורית: approved = true', last('stats').approved === true, last('stats'));

  console.log('\n── ניהול');
  await service.listAll({});
  check('רשימת ניהול: בלי כפיית approved, עם שם המוצר',
    last('list').approved === undefined && last('list').withProductName === true, last('list'));

  await service.listAll({ approved: false });
  check('ניהול יכול לסנן ממתינות', last('list').approved === false, last('list'));

  console.log('\n── כתיבה');
  await service.createReview({ reviewer_name: 'א', rating: 5, text: 'ב', approved: true });
  check('חוות דעת חדשה נשמרת לא-מאושרת, גם אם נשלח true', last('create').approved === false, last('create'));

  check('אישור מעדכן approved', (await service.setApproved(1, true)).approved === true);
  for (const [name, run] of [
    ['getReview', () => service.getReview(9)],
    ['updateReview', () => service.updateReview(9, { text: 'x' })],
    ['setApproved', () => service.setApproved(9, true)],
    ['removeReview', () => service.removeReview(9)],
  ]) {
    const err = await run().catch((e) => e);
    check(`${name} על מזהה שאינו קיים → 404`, err.status === 404, err.status);
  }

  console.log('\n── דפדוף');
  calls.length = 0;
  const flat = await service.listPublic({});
  check('בלי limit/offset: אין ספירה', flat.total === undefined && !calls.some(([op]) => op === 'count'), calls);
  const paged = await service.listPublic({ offset: 0 });
  check('עם offset: יש total', paged.total === 0, paged);
}

main()
  .catch((err) => { failed++; console.log(`  ✗ ${err.stack}`); })
  .finally(() => {
    console.log(`\n${failed === 0 ? '✓' : '✗'} עברו ${passed}, נכשלו ${failed}`);
    process.exitCode = failed === 0 ? 0 : 1;
  });
