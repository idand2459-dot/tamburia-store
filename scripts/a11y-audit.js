/**
 * בדיקת נגישות של כל דפי החנות, לפי ת"י 5568 (WCAG 2.1 AA).
 *
 *   npm run a11y               — מריץ ומדפיס סיכום, נכשל אם יש ממצאים
 *   npm run a11y -- --report   — כותב גם דו"ח מלא ל-docs/a11y-report.md
 *   A11Y_ALL=1                 — כל הרכיבים שנכשלו, לא רק הדוגמאות הראשונות
 *
 * מרים שרת משלו על פורט 3200 (כמו test/run-all.js), ומגיש את
 * client/build — ולכן צריך build עדכני: npm run build:client.
 *
 * הדפדפן הוא ה-Chrome המותקן במחשב, דרך puppeteer-core, ולא Chromium
 * שמורד עם החבילה. נתיב אחר: CHROME_PATH.
 *
 * מעבר ל-axe, נבדקים כאן דברים ש-axe לא בודק או בודק חלקית:
 * H1 אחד לכל דף ובלי דילוג ברמות הכותרות, lang ו-dir על html,
 * קישור "דלג לתוכן" כרכיב הממוקד הראשון, והיעדר גלילה אופקית
 * ברוחב 640 (מסך 1280 בהגדלה של 200%) וברוחב 320 (WCAG 1.4.10).
 *
 * גם מסך ההזמנות של האדמין נבדק, עם רשימת ליקוט פתוחה. לשם כך הבדיקה
 * מתחברת (ADMIN_PASSWORD מהסביבה, לא מודפס) ויוצרת שתי הזמנות זמניות,
 * שנמחקות בסוף.
 */
process.env.MAIL_ENABLED = 'false';
process.env.DB_LOG_QUERIES = 'false';
process.env.PORT = process.env.A11Y_PORT || '3200';

const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');
const { login } = require('../test/helpers');

const AXE_SOURCE = fs.readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');
const WRITE_REPORT = process.argv.includes('--report');

const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/usr/bin/google-chrome',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].filter(Boolean);

// dark: לאתר יש כללי prefers-color-scheme: dark, ולכן גם הם נבדקים לניגודיות.
const VIEWPORTS = {
  desktop: { viewport: { width: 1366, height: 900 } },
  mobile: { viewport: { width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } },
  dark: { viewport: { width: 1366, height: 900 }, scheme: 'dark' },
};

// 640 = מסך 1280 בהגדלה של 200%; 320 = הרוחב ש-WCAG 1.4.10 מחייב.
const REFLOW_WIDTHS = [640, 320];

const IMPACT_ORDER = ['critical', 'serious', 'moderate', 'minor'];

/** מחזיר את רשימת הדפים, עם קטגוריה ומוצר אמיתיים מהמסד. */
async function buildPages(baseUrl) {
  const res = await fetch(`${baseUrl}/api/products`);
  const products = await res.json();
  const product = products.find((p) => Number(p.price) > 0 && p.image_url) || products[0];

  const cartItem = {
    id: product.id, name: product.name, price: Number(product.price),
    image_url: product.image_url, quantity: 2, selectedColor: null, selectedSize: null,
  };

  return [
    { name: 'בית', path: '/' },
    { name: 'קטגוריה', path: `/category/${product.category}` },
    { name: 'מוצר', path: `/product/${product.id}` },
    { name: 'עגלה', path: '/cart', storage: { 'tamburia-cart': [cartItem] } },
    { name: "צ'קאאוט", path: '/checkout', storage: { 'tamburia-cart': [cartItem] }, checkErrors: true },
    { name: 'הזמנות שלי', path: '/orders/lookup' },
    { name: 'מועדפים', path: '/wishlist', storage: { 'tamburia-wishlist': [product] } },
    { name: 'אודות', path: '/about' },
    { name: 'צור קשר', path: '/contact' },
    { name: 'החזרות', path: '/returns' },
    { name: 'הצהרת נגישות', path: '/accessibility' },
    { name: '404', path: '/no-such-page-a11y' },
  ];
}

/* שם הלקוח של ההזמנות הזמניות, וכך גם מזהים אותן לניקוי. */
const A11Y_CUSTOMER = 'בדיקת נגישות';

/**
 * מכין את מסך ההזמנות של האדמין: עוגיית התחברות ושתי הזמנות בטיפול
 * משני מוצרים מתומחרים — באחת שורה אחת מסומנת מתוך שתיים, והיא נפתחת
 * בדף; השנייה כולה מוכנה, ולכן הכפתור שלה מודגש. כך נבדקים שני מצבי
 * השורה, ההתקדמות וההדגשה. מחזיר את הדף לבדיקה ופונקציית ניקוי.
 *
 * ריצה שנקטעה באמצע לא הגיעה לניקוי, ולכן קודם נמחקות הזמנות שנשארו
 * ממנה — לפי שם הלקוח, שאיש מלבד הבדיקה הזו אינו משתמש בו.
 */
async function prepareAdminOrders(baseUrl, products) {
  const cookie = await login(baseUrl);
  const call = (method, url, body) => fetch(`${baseUrl}/api${url}`, {
    method,
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: body && JSON.stringify(body),
  }).then((res) => res.json());

  const priced = products
    .filter((p) => Number(p.price) > 0 && !(p.variants || []).length)
    .sort((a, b) => Boolean(b.image_url) - Boolean(a.image_url))
    .slice(0, 2);
  const items = priced.map((p) => ({ id: p.id, name: p.name, price: Number(p.price), quantity: 2 }));

  const leftovers = await call('GET', `/orders?search=${encodeURIComponent(A11Y_CUSTOMER)}`);
  for (const old of leftovers.filter((o) => o.customer_name === A11Y_CUSTOMER)) {
    await call('DELETE', `/orders/${old.id}`);
  }

  /** יוצר הזמנה בטיפול ומסמן בה את השורות הנתונות. */
  async function orderWith(picked) {
    const order = await call('POST', '/orders', {
      customer_name: A11Y_CUSTOMER, customer_phone: '0500000000', delivery_method: 'pickup', items,
    });
    await call('PUT', `/orders/${order.id}/status`, { status: 'processing' });
    for (const line of picked) await call('PUT', `/orders/${order.id}/items/${line}/picked`, { picked: true });
    return order.id;
  }

  const openId = await orderWith([0]);
  const readyId = await orderWith(items.map((_, line) => line));
  const [name, value] = cookie.split('=');

  return {
    spec: {
      name: 'אדמין — הזמנות',
      path: '/admin/orders',
      cookie: { name, value },
      // פותח את ההזמנה החלקית, כדי שרשימת הליקוט תהיה על המסך
      prepare: (page) => page.evaluate((id) => {
        const card = [...document.querySelectorAll('.order-card')]
          .find((c) => c.querySelector('.order-card-number')?.textContent === `#${id}`);
        card?.querySelector('.order-card-head')?.click();
      }, openId),
    },
    cleanup: () => Promise.all([openId, readyId].map((id) => call('DELETE', `/orders/${id}`))),
  };
}

/** בודק את מבנה הכותרות, השפה וקישור הדילוג, בתוך הדף. */
function inspectStructure() {
  const visible = (el) => {
    const s = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    return s.display !== 'none' && s.visibility !== 'hidden' && (r.width > 0 || r.height > 0);
  };
  // מודאל פתוח (aria-modal) הוא מה שהקורא רואה; הדף שמאחוריו מוסתר.
  // :not([inert]) — תפריט הניווט הוא dialog שנשאר ב-DOM גם סגור.
  const modal = document.querySelector('[aria-modal="true"]:not([inert])');
  const scope = modal || document;
  // .visually-hidden נחשבת: היא שם בשביל הקורא. inert לא: הקורא לא רואה אותה.
  const shown = (h) => visible(h) || h.classList.contains('visually-hidden');
  const headings = [...scope.querySelectorAll('h1,h2,h3,h4,h5,h6')]
    .filter((h) => shown(h) && !h.closest('[aria-hidden="true"], [inert]'))
    .map((h) => ({ level: Number(h.tagName[1]), text: h.textContent.trim().slice(0, 50) }));

  const issues = [];
  const h1s = headings.filter((h) => h.level === 1);
  if (h1s.length !== 1) issues.push(`${h1s.length} כותרות H1 (${h1s.map((h) => h.text).join(' | ')})`);
  if (headings.length && headings[0].level !== 1) issues.push(`הכותרת הראשונה היא H${headings[0].level}`);
  for (let i = 1; i < headings.length; i += 1) {
    if (headings[i].level > headings[i - 1].level + 1) {
      issues.push(`דילוג H${headings[i - 1].level}→H${headings[i].level} ב"${headings[i].text}"`);
    }
  }

  const html = document.documentElement;
  if (html.lang !== 'he') issues.push(`lang="${html.lang}"`);
  if (html.dir !== 'rtl') issues.push(`dir="${html.dir}"`);

  return { issues, headings };
}

/** מחזיר את הרכיב הראשון שמקבל פוקוס ב-Tab, ואת היעד שלו. */
async function firstTabStop(page) {
  await page.evaluate(() => { document.activeElement?.blur(); window.focus(); });
  await page.keyboard.press('Tab');
  return page.evaluate(() => {
    const el = document.activeElement;
    if (!el || el === document.body) return null;
    const href = el.getAttribute('href') || '';
    const target = href.startsWith('#') ? document.getElementById(href.slice(1)) : null;
    return { text: el.textContent.trim(), href, targetExists: Boolean(target) };
  });
}

/**
 * מחזיר את הרכיבים שבולטים מעבר לרוחב המסך.
 *
 * לא scrollWidth: ל-html ול-body יש overflow-x: clip (base/_reset.css),
 * ולכן רכיב רחב מדי לא יוצר גלילה אופקית — הוא פשוט נחתך, וזה כישלון
 * באותה מידה (תוכן שאבד). רכיב בתוך מיכל שגולל או חותך בעצמו (רצועת
 * ההודעות, שורת צ'יפים נגללת) אינו בעיה, כל עוד המיכל עצמו בתוך המסך.
 */
function findOverflow() {
  const vw = document.documentElement.clientWidth;
  const out = (r) => r.width > 0 && r.height > 0 && (r.left < -1 || r.right > vw + 1);
  const clippedInside = (el) => {
    for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
      if (getComputedStyle(p).overflowX !== 'visible' && !out(p.getBoundingClientRect())) return true;
    }
    return false;
  };
  return [...document.querySelectorAll('body *')]
    .filter((el) => out(el.getBoundingClientRect())
      && !el.closest('[aria-hidden="true"], [inert], .visually-hidden, .skip-link')
      && getComputedStyle(el).visibility !== 'hidden'
      && !clippedInside(el))
    // רק הבולט החיצוני: הילדים שלו בולטים יחד איתו
    .filter((el, _, all) => !all.some((o) => o !== el && o.contains(el)))
    .slice(0, 5)
    .map((el) => {
      const r = el.getBoundingClientRect();
      return `${el.tagName.toLowerCase()}.${[...el.classList].join('.')} (${Math.round(r.left)}…${Math.round(r.right)})`;
    });
}

/**
 * לוחץ "שלח הזמנה" בטופס ריק ובודק שהשגיאות נגישות: המיקוד עבר לשדה
 * שגוי, הוא מסומן aria-invalid, וההודעה שלו מקושרת אליו ומוצגת.
 */
async function checkFormErrors(page) {
  const issues = [];
  await page.evaluate(() => document.querySelector('.cart-cta')?.click());
  await new Promise((r) => setTimeout(r, 300));
  const state = await page.evaluate(() => {
    const el = document.activeElement;
    const ids = (el?.getAttribute('aria-describedby') || '').split(' ').filter(Boolean);
    const messages = ids.map((id) => document.getElementById(id)?.textContent.trim()).filter(Boolean);
    const label = el?.labels?.[0]?.textContent.trim();
    return {
      tag: el?.tagName, id: el?.id, invalid: el?.getAttribute('aria-invalid'), messages, label,
      invalidCount: document.querySelectorAll('[aria-invalid="true"]').length,
    };
  });
  if (state.tag !== 'INPUT') issues.push(`אחרי שליחה ריקה המיקוד על ${state.tag || 'כלום'} ולא על שדה`);
  if (state.invalid !== 'true') issues.push(`השדה בפוקוס (${state.id}) אינו aria-invalid`);
  if (!state.messages.length) issues.push(`לשדה בפוקוס (${state.id}) אין הודעת שגיאה מקושרת`);
  if (!state.label) issues.push(`לשדה בפוקוס (${state.id}) אין תווית`);
  return { issues, state };
}

/** פותח דף מוכן לבדיקה: אחסון מקומי, תנועה מופחתת וטעינה מלאה. */
async function openPage(browser, baseUrl, spec, { viewport, scheme = 'light' }) {
  const page = await browser.newPage();
  await page.setViewport(viewport);
  await page.emulateMediaFeatures([
    { name: 'prefers-reduced-motion', value: 'reduce' },
    { name: 'prefers-color-scheme', value: scheme },
  ]);
  await page.evaluateOnNewDocument((storage) => {
    localStorage.clear();
    for (const [key, value] of Object.entries(storage)) localStorage.setItem(key, JSON.stringify(value));
  }, spec.storage || {});
  if (spec.cookie) await page.setCookie({ ...spec.cookie, url: baseUrl });
  await page.goto(`${baseUrl}${spec.path}`, { waitUntil: 'networkidle0', timeout: 30000 });
  // גלילה עד הסוף, כדי שרכיבי Reveal ותמונות עצלות יופיעו.
  await page.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += 400) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 30));
    }
    window.scrollTo(0, 0);
  });
  if (spec.prepare) await spec.prepare(page);
  await new Promise((r) => setTimeout(r, 600));
  return page;
}

/** מריץ את כל הבדיקות על דף אחד בתצוגה אחת. */
async function auditPage(browser, baseUrl, spec, viewportName) {
  const page = await openPage(browser, baseUrl, spec, VIEWPORTS[viewportName]);
  await page.evaluate(AXE_SOURCE);
  const runAxe = () => page.evaluate(() => window.axe.run(document, {
    runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'] },
    resultTypes: ['violations'],
  }));
  const axe = await runAxe();
  const structure = await page.evaluate(inspectStructure);
  // כשמגירה פתוחה העמוד שמאחור inert, והתחנה הראשונה שייכת למגירה —
  // שם בודקים שהמיקוד נשאר בתוכה, ולא את קישור הדילוג.
  const modalOpen = await page.evaluate(() => Boolean(document.querySelector('[aria-modal="true"]:not([inert])')));
  const tab = await firstTabStop(page);
  if (modalOpen) {
    const inside = await page.evaluate(() => Boolean(document.activeElement?.closest('[aria-modal="true"]')));
    if (!inside) structure.issues.push('מגירה פתוחה, אבל Tab הוציא את המיקוד ממנה');
  } else if (!tab || !/דלג/.test(tab.text) || !tab.targetExists) {
    structure.issues.push(`הרכיב הראשון ב-Tab אינו קישור "דלג לתוכן" תקין (${tab ? `"${tab.text.slice(0, 30)}"` : 'אין'})`);
  }

  // הטופס במצב שגיאה הוא מצב אחר של הדף, ו-axe רץ עליו שוב.
  if (spec.checkErrors && viewportName !== 'dark') {
    const form = await checkFormErrors(page);
    structure.issues.push(...form.issues);
    const again = await runAxe();
    const seen = new Set(axe.violations.map((v) => v.id));
    axe.violations.push(...again.violations.filter((v) => !seen.has(v.id)));
  }

  const reflow = [];
  if (viewportName === 'desktop') {
    for (const width of REFLOW_WIDTHS) {
      await page.setViewport({ width, height: 800 });
      await new Promise((r) => setTimeout(r, 300));
      const culprits = await page.evaluate(findOverflow);
      if (culprits.length) reflow.push({ width, culprits });
    }
  }

  await page.close();
  return { viewport: viewportName, violations: axe.violations, structure, reflow };
}

/** מאחד ממצאי axe לפי חוק, על פני כל הדפים והתצוגות. */
function groupViolations(results) {
  const byRule = new Map();
  for (const r of results) {
    for (const v of r.violations) {
      if (!byRule.has(v.id)) {
        byRule.set(v.id, { id: v.id, impact: v.impact, help: v.help, helpUrl: v.helpUrl, tags: v.tags, where: [], targets: new Set() });
      }
      const entry = byRule.get(v.id);
      entry.where.push(`${r.page} (${r.viewport}, ${v.nodes.length})`);
      for (const n of (process.env.A11Y_ALL ? v.nodes : v.nodes.slice(0, 4))) entry.targets.add(`${n.target.join(' ')} — ${n.failureSummary.split('\n').slice(1, 2).join('').trim()}`);
    }
  }
  return [...byRule.values()].sort((a, b) => IMPACT_ORDER.indexOf(a.impact) - IMPACT_ORDER.indexOf(b.impact));
}

/** כותב את הדו"ח המלא כ-Markdown. */
function renderReport(results, grouped) {
  const lines = ['# דו"ח נגישות אוטומטי', '', `נוצר: ${new Date().toISOString().slice(0, 16).replace('T', ' ')}`,
    '', 'axe-core עם תגיות wcag2a, wcag2aa, wcag21a, wcag21aa ו-best-practice, בדסקטופ (1366), במובייל (390) ובדסקטופ במצב כהה (prefers-color-scheme: dark).', ''];
  lines.push('## ממצאי axe, לפי חומרה', '');
  if (!grouped.length) lines.push('אין ממצאים.', '');
  for (const g of grouped) {
    lines.push(`### [${g.impact}] ${g.id} — ${g.help}`, '', `- דפים: ${g.where.join(', ')}`, `- תיעוד: ${g.helpUrl}`);
    for (const t of (process.env.A11Y_ALL ? [...g.targets] : [...g.targets].slice(0, 6))) lines.push(`  - \`${t}\``);
    lines.push('');
  }
  lines.push('## בדיקות מבנה (כותרות, שפה, דילוג לתוכן)', '');
  const structural = results.filter((r) => r.structure.issues.length);
  if (!structural.length) lines.push('אין ממצאים.', '');
  for (const r of structural) lines.push(`- ${r.page} (${r.viewport}): ${r.structure.issues.join('; ')}`);
  lines.push('', '## גלילה אופקית בהגדלה (640px = ‏200%, 320px = WCAG 1.4.10)', '');
  const reflow = results.filter((r) => r.reflow.length);
  if (!reflow.length) lines.push('אין ממצאים.', '');
  for (const r of reflow) {
    for (const f of r.reflow) lines.push(`- ${r.page} ברוחב ${f.width}: בולטים מעבר למסך: ${f.culprits.join(', ')}`);
  }
  return `${lines.join('\n')}\n`;
}

async function main() {
  const executablePath = CHROME_CANDIDATES.find((p) => fs.existsSync(p));
  if (!executablePath) throw new Error('לא נמצא Chrome. הגדר CHROME_PATH.');

  const db = require('../server/config/db');
  const { createApp } = require('../server/app');
  await db.assertConnection();
  const server = createApp().listen(Number(process.env.PORT));
  await new Promise((resolve) => server.once('listening', resolve));
  const baseUrl = `http://127.0.0.1:${process.env.PORT}`;

  const browser = await puppeteer.launch({ executablePath, headless: true, args: ['--lang=he-IL'] });
  const results = [];
  let admin = null;
  try {
    const pages = await buildPages(baseUrl);
    admin = await prepareAdminOrders(baseUrl, await (await fetch(`${baseUrl}/api/products`)).json());
    pages.push(admin.spec);
    for (const spec of pages) {
      for (const viewport of Object.keys(VIEWPORTS)) {
        const r = await auditPage(browser, baseUrl, spec, viewport);
        results.push({ page: spec.name, path: spec.path, ...r });
        const count = r.violations.length + r.structure.issues.length + r.reflow.length;
        console.log(`${count === 0 ? '✓' : '✗'} ${spec.name} (${viewport}) ${count ? `— ${count} ממצאים` : ''}`);
      }
    }
  } finally {
    await admin?.cleanup();
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
    await db.close();
  }

  const grouped = groupViolations(results);
  const report = renderReport(results, grouped);
  if (WRITE_REPORT) {
    const out = path.join(__dirname, '..', 'docs', 'a11y-report.md');
    fs.writeFileSync(out, report);
    console.log(`\nדו"ח: ${path.relative(process.cwd(), out)}`);
  }
  console.log(`\n${report}`);

  const failing = grouped.length + results.filter((r) => r.structure.issues.length || r.reflow.length).length;
  process.exit(failing === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error('בדיקת הנגישות נכשלה:', err);
  process.exit(1);
});
