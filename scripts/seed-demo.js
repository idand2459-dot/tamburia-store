/**
 * זורע נתוני דמו להדגמה ולצילומי מסך: הזמנות בכל הסטטוסים וחוות דעת,
 * מאושרות וממתינות לאישור. החיבור למסד נלקח מהקונפיגורציה של השרת.
 *
 * הרצה:
 *   node scripts/seed-demo.js                  (מוחק זריעה קודמת וזורע מחדש)
 *   node scripts/seed-demo.js --clear          (מוחק בלבד, בלי לזרוע)
 *   node scripts/seed-demo.js --clear --by-marker   (מוחק לפי סימון, בלי המניפסט)
 *
 * הסקריפט הזה אינו חלק מהמיגרציות ואינו רץ אוטומטית בשום מקום.
 * runMigrations קורא רק קבצי .sql מתוך server/db/migrations, ולכן קובץ
 * JS כאן לא יכול להיסחף לתוך עליית השרת. יש להריץ אותו ביד.
 *
 * איך --clear מוחק בדיוק את מה שנזרע, ולא יותר — שתי שכבות:
 *
 *   1. מניפסט (ברירת המחדל, והדרך הבטוחה). הזריעה כותבת את המזהים
 *      שנוצרו ל-MANIFEST_FILE, ו---clear מוחק לפי המזהים האלה בלבד.
 *      מחיקה לפי מזהה לא יכולה לתפוס שורה אחרת בטעות.
 *
 *   2. סימון (גיבוי, אם המניפסט נמחק או אבד).
 *      הזמנות  — כל הזמנת דמו מקבלת טלפון מתוך DEMO_PHONES, מקטע
 *                050-00000XX שאינו מוקצה בפועל, כך שאין סיכוי
 *                להתנגש בהזמנה אמיתית.
 *      חוות דעת — התאמה מדויקת של (reviewer_name, text) לזוגות
 *                שב-DEMO_REVIEWS. אין סימון שגלוי ללקוח.
 *
 *   --by-marker מכריח את שכבה 2 גם כשיש מניפסט.
 *
 * כל השמות פיקטיביים ומכוונים להיראות כמו נתוני דוגמה. "ישראל ישראלי"
 * הוא שם ממלא המקום המקובל בעברית, כמו John Doe.
 */

require('dotenv').config({ quiet: true });

const fs = require('fs');
const path = require('path');
const db = require('../server/config/db');
const config = require('../server/config/env');

/** רשימת המזהים שנוצרו בזריעה האחרונה. לא נכנס לגיט. */
const MANIFEST_FILE = path.join(__dirname, '.seed-demo-manifest.json');

// ── מזהי הדמו ────────────────────────────────────────────────────────────────

/** הטלפונים שמסמנים הזמנת דמו. מקטע שאינו מוקצה לשימוש אמיתי. */
const DEMO_PHONES = [
  '050-0000001',
  '050-0000002',
  '050-0000003',
  '050-0000004',
  '050-0000005',
  '050-0000006',
];

/** שלד ההזמנות. הפריטים מתמלאים בזמן ריצה ממוצרים אמיתיים במסד. */
const DEMO_ORDERS = [
  {
    phone: DEMO_PHONES[0],
    customer_name: 'ישראל ישראלי',
    customer_email: 'israel@example.com',
    delivery_method: 'delivery',
    delivery_address: 'הרצל 12, פתח תקווה',
    notes: 'נא להתקשר לפני ההגעה',
    status: 'new',
    daysAgo: 0,
    itemsFrom: ['painting', 'painting', 'tools'],
  },
  {
    phone: DEMO_PHONES[1],
    customer_name: 'שרה כהן',
    customer_email: 'sarah@example.com',
    delivery_method: 'pickup',
    delivery_address: null,
    notes: null,
    status: 'new',
    daysAgo: 0,
    itemsFrom: ['electrical', 'home'],
  },
  {
    phone: DEMO_PHONES[2],
    customer_name: 'דוד לוי',
    customer_email: null,
    delivery_method: 'delivery',
    delivery_address: 'ז׳בוטינסקי 45, פתח תקווה',
    notes: 'קומה 3, אין מעלית',
    status: 'processing',
    daysAgo: 1,
    itemsFrom: ['plumbing', 'adhesives', 'tools'],
  },
  {
    phone: DEMO_PHONES[3],
    customer_name: 'רות מזרחי',
    customer_email: 'ruth@example.com',
    delivery_method: 'pickup',
    delivery_address: null,
    notes: null,
    status: 'shipped',
    daysAgo: 3,
    itemsFrom: ['locks', 'locks'],
  },
  {
    phone: DEMO_PHONES[4],
    customer_name: 'יוסי אברהם',
    customer_email: 'yossi@example.com',
    delivery_method: 'delivery',
    delivery_address: 'רוטשילד 8, פתח תקווה',
    notes: null,
    status: 'completed',
    daysAgo: 5,
    itemsFrom: ['bathroom', 'cleaning', 'home'],
  },
  {
    phone: DEMO_PHONES[5],
    customer_name: 'מיכל פרץ',
    customer_email: 'michal@example.com',
    delivery_method: 'pickup',
    delivery_address: null,
    notes: 'אשמח לקבל חשבונית במייל',
    status: 'completed',
    daysAgo: 6,
    itemsFrom: ['garden', 'tools'],
  },
];

/** חוות הדעת. approved: false משאיר אותן במסך המודרציה. */
const DEMO_REVIEWS = [
  {
    reviewer_name: 'ישראל ישראלי',
    rating: 5,
    text: 'שירות אדיב ומקצועי. קיבלתי בדיוק את הצבע שחיפשתי, והייעוץ בחנות חסך לי קנייה מיותרת.',
    type: 'store',
    approved: true,
    daysAgo: 2,
  },
  {
    reviewer_name: 'שרה כהן',
    rating: 5,
    text: 'הזמנתי אונליין ואספתי מהחנות באותו יום. הכול היה ארוז ומוכן, בלי המתנה.',
    type: 'store',
    approved: true,
    daysAgo: 4,
  },
  {
    reviewer_name: 'דוד לוי',
    rating: 4,
    text: 'מגוון גדול ומחירים הוגנים. הייתי שמח לשעות פתיחה ארוכות יותר בשישי.',
    type: 'store',
    approved: true,
    daysAgo: 7,
  },
  {
    reviewer_name: 'רות מזרחי',
    rating: 5,
    text: 'מחשבון הצבע חסך לי נסיעה מיותרת — ידעתי בדיוק כמה ליטר להזמין ואיזה גוון.',
    type: 'store',
    approved: true,
    daysAgo: 9,
  },
  {
    reviewer_name: 'יוסי אברהם',
    rating: 5,
    text: 'קניתי כאן את כל הציוד לשיפוץ המקלחת. הסבירו לי מה מתאים למה ולא ניסו למכור לי יותר מדי.',
    type: 'store',
    approved: true,
    daysAgo: 12,
  },
  {
    reviewer_name: 'מיכל פרץ',
    rating: 4,
    text: 'המוצר עצמו מעולה ועושה את העבודה. האריזה הגיעה פתוחה קצת, אבל התוכן היה תקין.',
    type: 'product',
    approved: false,
    daysAgo: 1,
  },
  {
    reviewer_name: 'אבי גולן',
    rating: 5,
    text: 'עמיד ואיכותי, בדיוק כמו שתואר באתר. אשמח להזמין שוב.',
    type: 'product',
    approved: false,
    daysAgo: 0,
  },
];

// ── עזרים ────────────────────────────────────────────────────────────────────

/**
 * מחזיר חותמת זמן של לפני מספר ימים, בשעה קבועה כדי שהגרף ייראה יציב.
 * אם השעה הקבועה עוד לא הגיעה היום, מוזזים אחורה — אחרת הזריעה
 * יוצרת הזמנות עם תאריך עתידי, וזה נראה שגוי במסך הניהול.
 */
function daysAgoTimestamp(days) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(11, 30, 0, 0);

  const now = new Date();
  if (d > now) d.setTime(now.getTime() - 2 * 60 * 60 * 1000);
  return d;
}

/**
 * שולף מוצר אמיתי אחד לכל קטגוריה מבוקשת, כדי שההזמנות יצביעו על מוצרים
 * קיימים. נבחר המוצר היקר ביותר בקטגוריה, כדי שסכומי ההזמנות ולוח
 * הסטטיסטיקות ייראו כמו חנות פעילה ולא כמו שאריות.
 */
async function loadProductsByCategory(categories) {
  const unique = [...new Set(categories)];
  const { rows } = await db.query(
    `SELECT DISTINCT ON (category) id, name, price, category
       FROM products
      WHERE category = ANY($1::text[]) AND price > 0
      ORDER BY category, price DESC, id`,
    [unique]
  );
  return new Map(rows.map((r) => [r.category, r]));
}

/** בונה את מערך הפריטים של הזמנה מתוך המוצרים שנשלפו. */
function buildItems(itemsFrom, byCategory) {
  const items = [];
  const seen = new Map();

  for (const category of itemsFrom) {
    const product = byCategory.get(category);
    if (!product) continue;

    const existing = seen.get(product.id);
    if (existing) {
      existing.quantity++;
      continue;
    }

    const item = {
      id: product.id,
      name: product.name,
      price: Math.round(Number(product.price)),
      quantity: 1,
      selectedColor: null,
      selectedSize: null,
    };
    items.push(item);
    seen.set(product.id, item);
  }

  return items;
}

// ── מניפסט ───────────────────────────────────────────────────────────────────

/** כותב את המזהים שנוצרו, כדי שאפשר יהיה למחוק בדיוק אותם. */
function writeManifest(orderIds, reviewIds) {
  const manifest = {
    seededAt: new Date().toISOString(),
    orders: orderIds,
    reviews: reviewIds,
  };
  fs.writeFileSync(MANIFEST_FILE, JSON.stringify(manifest, null, 2) + '\n');
  return manifest;
}

/** קורא את המניפסט, או null אם אינו קיים או פגום. */
function readManifest() {
  if (!fs.existsSync(MANIFEST_FILE)) return null;
  try {
    const parsed = JSON.parse(fs.readFileSync(MANIFEST_FILE, 'utf8'));
    const orders = Array.isArray(parsed.orders) ? parsed.orders.filter(Number.isInteger) : [];
    const reviews = Array.isArray(parsed.reviews) ? parsed.reviews.filter(Number.isInteger) : [];
    if (orders.length === 0 && reviews.length === 0) return null;
    return { ...parsed, orders, reviews };
  } catch {
    console.warn('⚠ המניפסט פגום — נופל חזרה למחיקה לפי סימון.');
    return null;
  }
}

/** מוחק את קובץ המניפסט אם הוא קיים. */
function removeManifest() {
  if (fs.existsSync(MANIFEST_FILE)) fs.unlinkSync(MANIFEST_FILE);
}

// ── מחיקה ────────────────────────────────────────────────────────────────────

/** מוחק שורות לפי מזהים מטבלה נתונה, ומחזיר כמה נמחקו. */
async function deleteByIds(table, ids) {
  if (ids.length === 0) return 0;
  const { rowCount } = await db.query(
    `DELETE FROM ${table} WHERE id = ANY($1::int[])`,
    [ids]
  );
  return rowCount;
}

/** מוחק את הזמנות הדמו לפי הטלפונים המסומנים, ומחזיר כמה נמחקו. */
async function clearOrders() {
  const { rowCount } = await db.query(
    'DELETE FROM orders WHERE customer_phone = ANY($1::text[])',
    [DEMO_PHONES]
  );
  return rowCount;
}

/** מוחק את חוות הדעת של הדמו בהתאמה מדויקת לשם ולטקסט, ומחזיר כמה נמחקו. */
async function clearReviews() {
  const names = DEMO_REVIEWS.map((r) => r.reviewer_name);
  const texts = DEMO_REVIEWS.map((r) => r.text);
  const { rowCount } = await db.query(
    `DELETE FROM reviews
      WHERE (reviewer_name, text) IN (
        SELECT * FROM UNNEST($1::text[], $2::text[])
      )`,
    [names, texts]
  );
  return rowCount;
}

/**
 * מוחק את כל נתוני הדמו ומדפיס סיכום.
 * ברירת המחדל היא מחיקה לפי המזהים שבמניפסט; בלעדיו, או עם byMarker,
 * נופלים למחיקה לפי הסימון.
 */
async function clearAll({ byMarker = false } = {}) {
  const manifest = byMarker ? null : readManifest();

  let orders;
  let reviews;
  let strategy;

  if (manifest) {
    orders = await deleteByIds('orders', manifest.orders);
    reviews = await deleteByIds('reviews', manifest.reviews);
    strategy = `מניפסט (${manifest.seededAt})`;

    const missingOrders = manifest.orders.length - orders;
    const missingReviews = manifest.reviews.length - reviews;
    if (missingOrders > 0 || missingReviews > 0) {
      console.warn(
        `⚠ ${missingOrders} הזמנות ו-${missingReviews} חוות דעת מהמניפסט לא נמצאו — ` +
        'כנראה נמחקו קודם.'
      );
    }
  } else {
    orders = await clearOrders();
    reviews = await clearReviews();
    strategy = byMarker ? 'סימון (נדרש במפורש)' : 'סימון (אין מניפסט)';
  }

  console.log('\n🧹 ניקוי נתוני דמו');
  console.log(`   שיטה:             ${strategy}`);
  console.log(`   הזמנות שנמחקו:    ${orders}`);
  console.log(`   חוות דעת שנמחקו:  ${reviews}`);

  removeManifest();

  if (orders === 0 && reviews === 0) {
    console.log('\n   לא נמצאו נתוני דמו — המסד כבר נקי.');
  } else {
    console.log('\n✓ המסד חזר למצב שלפני הזריעה.');
  }

  return { orders, reviews };
}

// ── זריעה ────────────────────────────────────────────────────────────────────

/** זורע את ההזמנות ומחזיר את השורות שנוצרו. */
async function seedOrders() {
  const byCategory = await loadProductsByCategory(
    DEMO_ORDERS.flatMap((o) => o.itemsFrom)
  );

  if (byCategory.size === 0) {
    throw new Error('לא נמצאו מוצרים במסד — אין ממה לבנות הזמנות דמו');
  }

  const created = [];

  for (const spec of DEMO_ORDERS) {
    const items = buildItems(spec.itemsFrom, byCategory);
    if (items.length === 0) continue;

    const subtotal = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
    const delivery_fee = spec.delivery_method === 'delivery' ? config.orders.deliveryFee : 0;
    const total = subtotal + delivery_fee;

    const { rows } = await db.query(
      `INSERT INTO orders
         (customer_name, customer_phone, customer_email, delivery_method,
          delivery_address, notes, items, subtotal, delivery_fee, total,
          status, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9, $10, $11, $12)
       RETURNING id, total, status`,
      [
        spec.customer_name,
        spec.phone,
        spec.customer_email,
        spec.delivery_method,
        spec.delivery_address,
        spec.notes,
        JSON.stringify(items),
        subtotal,
        delivery_fee,
        total,
        spec.status,
        daysAgoTimestamp(spec.daysAgo),
      ]
    );

    created.push({ ...rows[0], name: spec.customer_name, items: items.length });
  }

  return created;
}

/** זורע את חוות הדעת ומחזיר את השורות שנוצרו. */
async function seedReviews(productId) {
  const created = [];

  for (const spec of DEMO_REVIEWS) {
    const { rows } = await db.query(
      `INSERT INTO reviews
         (reviewer_name, rating, text, type, product_id, approved, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, approved`,
      [
        spec.reviewer_name,
        spec.rating,
        spec.text,
        spec.type,
        spec.type === 'product' ? productId : null,
        spec.approved,
        daysAgoTimestamp(spec.daysAgo),
      ]
    );

    created.push({ ...rows[0], name: spec.reviewer_name, type: spec.type });
  }

  return created;
}

/** מריץ זריעה מלאה: מנקה זריעה קודמת, זורע, ומדפיס סיכום. */
async function seedAll() {
  // מסירים זריעה קודמת לפי המניפסט אם יש, ואחרת לפי הסימון — כך שהרצה
  // חוזרת מחליפה את השורות של הדמו ולא מכפילה אותן.
  const previous = readManifest();
  const removed = previous
    ? await deleteByIds('orders', previous.orders)
    : await clearOrders();
  const removedReviews = previous
    ? await deleteByIds('reviews', previous.reviews)
    : await clearReviews();

  if (removed > 0 || removedReviews > 0) {
    console.log(
      `\n(הוסרה זריעה קודמת לפי ${previous ? 'מניפסט' : 'סימון'}: ` +
      `${removed} הזמנות, ${removedReviews} חוות דעת)`
    );
  }

  const { rows: productRows } = await db.query(
    'SELECT id FROM products ORDER BY id LIMIT 1'
  );
  const productId = productRows[0]?.id ?? null;

  const orders = await seedOrders();
  const reviews = await seedReviews(productId);

  const byStatus = orders.reduce((acc, o) => {
    acc[o.status] = (acc[o.status] || 0) + 1;
    return acc;
  }, {});
  const revenue = orders.reduce((sum, o) => sum + o.total, 0);
  const approved = reviews.filter((r) => r.approved).length;

  console.log('\n🌱 נזרעו נתוני דמו');
  console.log('\n   הזמנות');
  for (const o of orders) {
    console.log(`     #${String(o.id).padEnd(5)} ${o.name.padEnd(14)} ${String(o.status).padEnd(11)} ₪${o.total}`);
  }
  console.log(`\n     סה"כ ${orders.length} הזמנות, ₪${revenue}`);
  console.log(`     לפי סטטוס: ${Object.entries(byStatus).map(([s, n]) => `${s}=${n}`).join(', ')}`);

  console.log('\n   חוות דעת');
  for (const r of reviews) {
    const state = r.approved ? 'מאושרת' : 'ממתינה';
    console.log(`     #${String(r.id).padEnd(5)} ${r.name.padEnd(14)} ${state.padEnd(9)} ${r.type}`);
  }
  console.log(`\n     ${approved} מאושרות (מוצגות בחנות)`);
  console.log(`     ${reviews.length - approved} ממתינות לאישור (מוצגות במסך המודרציה)`);

  const orderIds = orders.map((o) => o.id);
  const reviewIds = reviews.map((r) => r.id);
  writeManifest(orderIds, reviewIds);

  console.log('\n   מזהים שנוצרו');
  console.log(`     הזמנות:   ${orderIds.join(', ')}`);
  console.log(`     חוות דעת: ${reviewIds.join(', ')}`);
  console.log(`     נשמרו ב-${path.relative(process.cwd(), MANIFEST_FILE)}`);

  console.log('\n✓ מוכן לצילומי מסך.');
  console.log('  לניקוי: node scripts/seed-demo.js --clear\n');

  return { orders, reviews };
}

// ── הרצה ─────────────────────────────────────────────────────────────────────

async function main() {
  const clearOnly = process.argv.includes('--clear');
  const byMarker = process.argv.includes('--by-marker');

  await db.assertConnection();

  if (clearOnly) {
    await clearAll({ byMarker });
  } else {
    await seedAll();
  }

  await db.close();
}

if (require.main === module) {
  main().catch((err) => {
    console.error(`\n✗ ${err.message}\n`);
    db.close().finally(() => process.exit(1));
  });
}

module.exports = { DEMO_PHONES, DEMO_REVIEWS, seedAll, clearAll };
