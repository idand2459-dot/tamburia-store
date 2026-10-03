/**
 * בודק את כלל הנראות של services/product.service בבידוד, בלי מסד:
 * מודל מזויף נטען למקום של models/product.model, ורושם מה השירות ביקש.
 *
 * הכלל: לקוח רואה גלויים בלבד; אדמין רואה גלויים בלבד אלא אם ביקש
 * ?active במפורש; מוצר מוסתר בודד הוא 404 ללקוח ונגיש לאדמין.
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

// ── מודל מזויף: זוכר את הסינון האחרון שקיבל
const calls = [];
const PRODUCTS = {
  1: { id: 1, name: 'גלוי', active: true, category: 'painting', subcategory: null },
  2: { id: 2, name: 'מוסתר', active: false, category: 'painting', subcategory: null },
};
const fakeModel = {
  list: async (filters) => { calls.push(['list', filters]); return []; },
  count: async (filters) => { calls.push(['count', filters]); return 0; },
  findById: async (id) => PRODUCTS[id] || null,
  update: async (id, data) => (PRODUCTS[id] ? { ...PRODUCTS[id], ...data } : null),
  listCategories: async (opts) => { calls.push(['listCategories', opts]); return []; },
};
const modelPath = require.resolve(path.join(__dirname, '../server/models/product.model'));
require.cache[modelPath] = { id: modelPath, filename: modelPath, loaded: true, exports: fakeModel };

const service = require('../server/services/product.service');
const lastFilters = () => calls.filter(([op]) => op === 'list').pop()[1];

async function main() {
  console.log('\n── רשימה');
  await service.listProducts({ category: 'painting' });
  check('לקוח: active = true', lastFilters().active === true, lastFilters());

  await service.listProducts({ active: false, activeRequested: 'false' });
  check('לקוח ששלח ?active=false: עדיין true', lastFilters().active === true, lastFilters());

  await service.listProducts({}, { isAdmin: true });
  check('אדמין בלי ?active: גלויים בלבד', lastFilters().active === true, lastFilters());

  await service.listProducts({ active: false, activeRequested: 'false' }, { isAdmin: true });
  check('אדמין עם ?active=false: מוסתרים', lastFilters().active === false, lastFilters());

  await service.listProducts({ activeRequested: 'all' }, { isAdmin: true });
  check('אדמין עם ?active=all: בלי סינון', lastFilters().active === undefined, lastFilters());
  check('activeRequested אינו מגיע למודל', !('activeRequested' in lastFilters()), lastFilters());

  calls.length = 0;
  const flat = await service.listProducts({});
  check('בלי דפדוף: אין שאילתת ספירה, total לא מוגדר',
    flat.total === undefined && !calls.some(([op]) => op === 'count'), calls);
  const paged = await service.listProducts({ limit: 8 });
  check('עם limit: יש total', paged.total === 0, paged);

  console.log('\n── מוצר בודד');
  check('גלוי ללקוח', (await service.getProduct(1)).id === 1);
  const hidden = await service.getProduct(2).catch((e) => e);
  check('מוסתר ללקוח → 404', hidden.status === 404, hidden.status);
  const missing = await service.getProduct(99).catch((e) => e);
  check('אותה הודעה בדיוק כמו למזהה שאינו קיים',
    missing.status === 404 && hidden.message.replace('2', '#') === missing.message.replace('99', '#'),
    [hidden.message, missing.message]);
  check('מוסתר לאדמין — נגיש (טופס העריכה)', (await service.getProduct(2, { isAdmin: true })).id === 2);

  console.log('\n── קטגוריות ועדכון');
  await service.listCategories();
  const cat = calls.filter(([op]) => op === 'listCategories').pop();
  check('קטגוריות: גלויים בלבד', cat && cat[1].activeOnly === true, cat);

  const notFound = await service.updateProduct(99, { price: 10 }).catch((e) => e);
  check('עדכון של מזהה שאינו קיים → 404', notFound.status === 404, notFound.status);
}

main()
  .catch((err) => { failed++; console.log(`  ✗ ${err.stack}`); })
  .finally(() => {
    console.log(`\n${failed === 0 ? '✓' : '✗'} עברו ${passed}, נכשלו ${failed}`);
    process.exitCode = failed === 0 ? 0 : 1;
  });
