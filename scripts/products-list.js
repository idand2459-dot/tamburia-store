/**
 * מייצר את רשימת המוצרים לצילום: קובץ CSV לעבודה במחשב, וקובץ HTML
 * מודפס שלוקחים ביד לחנות.
 *
 * הרצה:
 *   npm run products:list
 *
 * פלט:
 *   design-assets/product-list.csv    — id, שם, קטגוריה, תת-קטגוריה, מק"ט, מחיר, יש תמונה
 *   design-assets/product-list.html   — דף להדפסה ב-A4, מסודר לפי קטגוריות
 *
 * שני הקבצים הם פלט ולא מקור — הם ב-.gitignore ונוצרים מחדש בכל הרצה.
 *
 * "יש תמונה" הוא true רק כששדה image_url מלא *וגם* הקובץ שהוא מצביע
 * עליו קיים בתיקיית ההעלאות. זו ההבחנה שכל התרגיל נשען עליה: במסד יש
 * מאה מוצרים עם image_url, אבל כמעט כל הקבצים האלה אינם קיימים, ולכן
 * מוצר עם כתובת תמונה הוא עדיין מוצר בלי תמונה.
 *
 * בתוך כל קטגוריה מופיעים קודם המוצרים בלי תמונה — הם מה שבאים לצלם.
 */
const fs = require('fs');
const path = require('path');
const db = require('../server/config/db');
const productModel = require('../server/models/product.model');
const { fileExists } = require('./lib/uploads');
const { load: loadCategories } = require('./lib/categories');

const OUT_DIR = path.join(__dirname, '..', 'design-assets');
const CSV_PATH = path.join(OUT_DIR, 'product-list.csv');
const HTML_PATH = path.join(OUT_DIR, 'product-list.html');

const CSV_HEADER = ['id', 'name', 'category', 'subcategory', 'sku', 'price', 'has_real_image'];

/** מנקה ערך לתא CSV: ציטוט כשצריך, והכפלת מרכאות שבתוכו. */
function csvCell(value) {
  const text = value === null || value === undefined ? '' : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** בורח מתווים שיש להם משמעות ב-HTML. */
function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * מחזיר את המוצרים מועשרים בשמות הקטגוריות ובתשובה אם יש להם תמונה,
 * ממוינים לפי סדר הקטגוריות בחנות ובתוך כל קטגוריה — חסרי תמונה קודם.
 */
function prepare(products, taxonomy) {
  const { order, categoryNames, subcategoryNames } = taxonomy;

  // קטגוריה שקיימת במסד אבל לא בעץ של הקליינט תרד לסוף במקום להיעלם:
  // עדיף להדפיס אותה מתחת לכותרת עם המזהה הגולמי מאשר שהמוצרים שלה
  // פשוט לא יגיעו לרשימה שיוצאים איתה לחנות.
  const rank = (category) => (category in order ? order[category] : Number.MAX_SAFE_INTEGER);

  return products
    .map((p) => ({
      id: p.id,
      name: p.name || '',
      category: p.category || '',
      categoryName: categoryNames[p.category] || p.category || 'ללא קטגוריה',
      subcategoryName: subcategoryNames[p.subcategory] || p.subcategory || '',
      sku: p.sku || '',
      price: p.price,
      hasRealImage: fileExists(p.image_url),
    }))
    .sort((a, b) =>
      rank(a.category) - rank(b.category) ||
      a.categoryName.localeCompare(b.categoryName, 'he') ||
      Number(a.hasRealImage) - Number(b.hasRealImage) ||
      a.id - b.id
    );
}

/** כותב את ה-CSV. BOM בהתחלה כדי שאקסל יפתח את העברית נכון. */
function writeCsv(rows) {
  const lines = [CSV_HEADER.join(',')];

  for (const row of rows) {
    lines.push([
      row.id,
      row.name,
      row.categoryName,
      row.subcategoryName,
      row.sku,
      row.price,
      row.hasRealImage,
    ].map(csvCell).join(','));
  }

  fs.writeFileSync(CSV_PATH, '﻿' + lines.join('\r\n') + '\r\n', 'utf8');
}

/** מקבץ את השורות לפי קטגוריה, תוך שמירה על הסדר שהגיעו בו. */
function groupByCategory(rows) {
  const groups = [];
  for (const row of rows) {
    const last = groups[groups.length - 1];
    if (last && last.name === row.categoryName) last.rows.push(row);
    else groups.push({ name: row.categoryName, rows: [row] });
  }
  return groups;
}

/** בונה את דף ההדפסה. CSS בתוך הקובץ, כדי שיהיה קובץ אחד שנפתח מכל מקום. */
function writeHtml(rows, stats) {
  const groups = groupByCategory(rows);
  const printed = new Date().toLocaleDateString('he-IL', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  });

  const sections = groups.map((group) => {
    const missing = group.rows.filter((r) => !r.hasRealImage).length;

    const items = group.rows.map((row) => `
      <li class="row${row.hasRealImage ? ' row--has-image' : ''}">
        <span class="box"></span>
        <span class="id">${row.id}</span>
        <span class="text">
          <span class="name">${escapeHtml(row.name)}</span>
          ${row.subcategoryName ? `<span class="sub">${escapeHtml(row.subcategoryName)}</span>` : ''}
        </span>
        ${row.hasRealImage ? '<span class="mark">יש תמונה</span>' : ''}
      </li>`).join('');

    return `
    <section class="cat">
      <h2>${escapeHtml(group.name)}
        <span class="count">${missing} לצילום · ${group.rows.length} סה״כ</span>
      </h2>
      <ol class="rows">${items}
      </ol>
    </section>`;
  }).join('');

  const html = `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
<meta charset="utf-8">
<title>רשימת מוצרים לצילום — טכניק טמבור</title>
<style>
  @page { size: A4; margin: 12mm 10mm; }

  :root {
    --ink: #1a1a1a;
    --muted: #6b6b6b;
    --line: #d8d8d8;
    --accent: #0b6b3a;
  }

  * { box-sizing: border-box; }

  body {
    margin: 0;
    padding: 12mm 10mm;
    font-family: "Segoe UI", Arial, sans-serif;
    font-size: 11pt;
    line-height: 1.35;
    color: var(--ink);
    background: #fff;
  }

  header {
    border-bottom: 2px solid var(--ink);
    padding-bottom: 6px;
    margin-bottom: 14px;
  }
  h1 { font-size: 16pt; margin: 0 0 4px; }
  .meta { font-size: 9.5pt; color: var(--muted); }
  .meta strong { color: var(--ink); }

  .hint {
    margin: 10px 0 16px;
    padding: 7px 10px;
    border: 1px solid var(--line);
    border-radius: 4px;
    font-size: 9.5pt;
    color: var(--muted);
  }
  .hint code { font-family: Consolas, monospace; color: var(--ink); }

  .cat { break-inside: auto; margin-bottom: 14px; }

  h2 {
    font-size: 12.5pt;
    margin: 0 0 6px;
    padding: 4px 8px;
    background: #f0f0f0;
    border-right: 4px solid var(--ink);
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    break-after: avoid;
  }
  h2 .count { font-size: 9pt; font-weight: normal; color: var(--muted); }

  ol.rows { list-style: none; margin: 0; padding: 0; }

  .row {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 3.5px 4px;
    border-bottom: 1px solid #ececec;
    break-inside: avoid;
  }

  .box {
    flex: none;
    width: 13px;
    height: 13px;
    border: 1.4px solid var(--ink);
    border-radius: 2px;
  }

  .id {
    flex: none;
    width: 52px;
    font-size: 14pt;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    letter-spacing: 0.5px;
    direction: ltr;
    text-align: right;
  }

  .text { flex: 1; min-width: 0; }
  .name { display: block; }
  .sub { display: block; font-size: 8.5pt; color: var(--muted); }

  .mark {
    flex: none;
    font-size: 8pt;
    color: var(--accent);
    border: 1px solid var(--accent);
    border-radius: 999px;
    padding: 1px 7px;
    white-space: nowrap;
  }

  .row--has-image .id, .row--has-image .name { color: #7a7a7a; }

  @media print {
    body { padding: 0; }
    .hint { break-inside: avoid; }
  }
</style>
</head>
<body>

<header>
  <h1>רשימת מוצרים לצילום</h1>
  <div class="meta">
    הודפס ${printed} ·
    <strong>${stats.total}</strong> מוצרים ·
    <strong>${stats.withImage}</strong> עם תמונה ·
    <strong>${stats.withoutImage}</strong> לצילום
  </div>
</header>

<div class="hint">
  <strong>לפני שמתחילים:</strong> באייפון — הגדרות ← מצלמה ← עיצובים ← <strong>הכי תואם</strong>.
  זה שומר JPG במקום HEIC, שהמחשב לא יודע לפתוח.<br>
  <strong>שם הקובץ</strong> לפי המספר הגדול: <code>&lt;מספר&gt;.jpg</code> — למשל <code>247.jpg</code>.
  זווית נוספת לאותו מוצר: <code>247-2.jpg</code>, <code>247-3.jpg</code>.
  מוצר שאינו ברשימה: <code>new-&lt;תיאור&gt;.jpg</code>.<br>
  <strong>הצילום:</strong> המוצר לבדו בפריים, ממלא את רובו, על רקע פשוט ואחיד, באור יום.
  הרקע יוסר ממילא — מה שחשוב זה שהמוצר יהיה חד וגדול. מסמנים ✓ בריבוע אחרי הצילום.
</div>

${sections}

</body>
</html>
`;

  fs.writeFileSync(HTML_PATH, html, 'utf8');
}

async function main() {
  const taxonomy = loadCategories();
  const products = await productModel.list();
  const rows = prepare(products, taxonomy);

  const withImage = rows.filter((r) => r.hasRealImage).length;
  const stats = { total: rows.length, withImage, withoutImage: rows.length - withImage };

  fs.mkdirSync(OUT_DIR, { recursive: true });
  writeCsv(rows);
  writeHtml(rows, stats);

  const rel = (p) => path.relative(path.join(__dirname, '..'), p).replace(/\\/g, '/');

  console.log(`סה״כ מוצרים:        ${stats.total}`);
  console.log(`עם תמונה אמיתית:    ${stats.withImage}`);
  console.log(`בלי תמונה (לצילום): ${stats.withoutImage}`);
  console.log();
  console.log(`  ✓  ${rel(CSV_PATH)}`);
  console.log(`  ✓  ${rel(HTML_PATH)}   ← לפתוח בדפדפן ולהדפיס (Ctrl+P)`);
}

main()
  .catch((err) => {
    console.error(err.message);
    process.exitCode = 1;
  })
  .finally(() => db.close());
