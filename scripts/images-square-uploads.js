/**
 * משלים לריבוע תמונות שכבר הועלו דרך האדמין — חד-פעמי.
 *
 *   npm run images:square-uploads                          — רק מראה מה ישתנה
 *   npm run images:square-uploads -- --since 2026-10-01    — מתאריך אחר (ברירת מחדל: היום)
 *   npm run images:square-uploads -- --apply
 *   npm run images:square-uploads -- --revert <תיקיית גיבוי>
 *
 * מאז שההעלאה משלימה כל תמונה לריבוע (server/services/image.service,
 * processImage), תמונות חדשות ממלאות את החלון בלי לחתוך. אלה שהועלו
 * לפני כן הן 3:4 מהמצלמה, וה-object-fit: cover חותך להן את התחתית.
 * הסקריפט מעביר אותן בדיוק באותו עיבוד.
 *
 * מה נכלל: קבצים בתיקיית ההעלאות ששונו מתאריך --since ואילך ואינם
 * ריבועיים. תמונה ריבועית לא נוגעים בה.
 *
 * שם הקובץ נגזר מהתוכן, ולכן תמונה מעובדת היא קובץ חדש בשם חדש — לא
 * דריסה של הישן. כך גם מי שהתמונה הישנה שמורה אצלו במטמון מקבל את
 * החדשה מיד. ההפניות במסד (image_url ו-images) מוחלפות בטרנזקציה אחת,
 * ורק אחרי שהיא נשמרה הקבצים הישנים יוצאים מ-uploads — אל תיקיית
 * הגיבוי, יחד עם manifest.json שממנו --revert מחזיר הכול.
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const db = require('../server/config/db');
const { processImage, contentName } = require('../server/services/image.service');
const { UPLOADS_DIR } = require('../server/middleware/upload');
const { pathToUrl } = require('./lib/uploads');

const ROOT = path.join(__dirname, '..');
const BACKUP_ROOT = path.join(ROOT, 'design-assets');

// ───────────────────────────── ארגומנטים ─────────────────────────────

/** קורא את דגלי שורת הפקודה, ונופל על ארגומנט שלא מוכר. */
function parseArgs(argv) {
  const today = new Date();
  const opts = {
    apply: false,
    revert: null,
    since: new Date(today.getFullYear(), today.getMonth(), today.getDate()),
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--apply') {
      opts.apply = true;
    } else if (arg === '--since') {
      const value = argv[i + 1];
      if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) throw new Error('--since צריך תאריך בצורה YYYY-MM-DD');
      const [y, m, d] = value.split('-').map(Number);
      opts.since = new Date(y, m - 1, d);
      i += 1;
    } else if (arg === '--revert') {
      opts.revert = argv[i + 1];
      if (!opts.revert) throw new Error('--revert צריך את תיקיית הגיבוי');
      i += 1;
    } else {
      throw new Error(`ארגומנט לא מוכר: ${arg}`);
    }
  }
  return opts;
}

/** חותמת זמן לשם תיקיית הגיבוי: 2026-10-01_11-42-05. */
function stamp() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}-${p(d.getMinutes())}-${p(d.getSeconds())}`;
}

const rel = (p) => path.relative(ROOT, p);

// ───────────────────────────── מסד ─────────────────────────────

/** המוצרים שמפנים לכתובת — כתמונה ראשית או ברשימת התמונות. */
async function productsUsing(client, url) {
  const { rows } = await client.query(
    'SELECT id, name FROM products WHERE image_url = $1 OR images @> jsonb_build_array($1::text) ORDER BY id',
    [url]
  );
  return rows;
}

/** מחליף כתובת תמונה בכל מקום שהיא מופיעה, ומחזיר את מזהי המוצרים. */
async function replaceUrl(client, from, to) {
  const { rows } = await client.query(
    `UPDATE products
     SET image_url = CASE WHEN image_url = $1 THEN $2 ELSE image_url END,
         images = COALESCE((
           SELECT jsonb_agg(CASE WHEN e = to_jsonb($1::text) THEN to_jsonb($2::text) ELSE e END)
           FROM jsonb_array_elements(images) AS e
         ), '[]'::jsonb)
     WHERE image_url = $1 OR images @> jsonb_build_array($1::text)
     RETURNING id`,
    [from, to]
  );
  return rows.map((row) => row.id);
}

// ───────────────────────────── עיבוד ─────────────────────────────

/** הקבצים בתיקיית ההעלאות מתאריך נתון שאינם ריבועיים, עם מידותיהם. */
async function findCandidates(since) {
  const found = { square: [], candidates: [], unreadable: [] };
  for (const name of fs.readdirSync(UPLOADS_DIR).sort()) {
    const full = path.join(UPLOADS_DIR, name);
    const stat = fs.statSync(full);
    if (!stat.isFile() || name.startsWith('.') || stat.mtime < since) continue;

    try {
      // דרך Buffer ולא נתיב: ב-Windows המטמון של sharp מחזיק את הקובץ
      // פתוח, והעברתו לגיבוי אחר כך הייתה נכשלת.
      const meta = await sharp(fs.readFileSync(full)).metadata();
      const entry = { name, width: meta.width, height: meta.height, bytes: stat.size };
      (meta.width === meta.height ? found.square : found.candidates).push(entry);
    } catch {
      found.unreadable.push(name);
    }
  }
  return found;
}

/** מדפיס את מה שנמצא. */
function printPlan(found, usage, since) {
  console.log(`\nתמונות ב-uploads מ-${since.toLocaleDateString('he-IL')}:`);
  console.log(`  ${found.candidates.length} לא ריבועיות — יושלמו לריבוע`);
  console.log(`  ${found.square.length} כבר ריבועיות — לא ישתנו`);
  if (found.unreadable.length) console.log(`  ${found.unreadable.length} לא נקראו: ${found.unreadable.join(', ')}`);

  for (const file of found.candidates) {
    const products = usage.get(file.name);
    const who = products.length ? products.map((p) => `${p.id} ${p.name}`).join(' · ') : 'לא בשימוש באף מוצר';
    console.log(`  ${file.name}  ${file.width}×${file.height}  ← ${who}`);
  }
}

/** מריץ את ההשלמה לריבוע, עם גיבוי ודו"ח. */
async function apply(found) {
  const backupDir = path.join(BACKUP_ROOT, `square-backup-${stamp()}`);
  fs.mkdirSync(backupDir, { recursive: true });

  // 1. הגיבוי קודם לכל שינוי: עותק של כל קובץ מקורי
  for (const file of found.candidates) {
    fs.copyFileSync(path.join(UPLOADS_DIR, file.name), path.join(backupDir, file.name));
  }

  // 2. הקבצים החדשים. כתיבה עם wx — שם שכבר קיים הוא אותו תוכן בדיוק.
  const results = [];
  for (const file of found.candidates) {
    const output = await processImage(fs.readFileSync(path.join(UPLOADS_DIR, file.name)));
    const newName = contentName(output);
    const meta = await sharp(output).metadata();
    try {
      fs.writeFileSync(path.join(UPLOADS_DIR, newName), output, { flag: 'wx' });
    } catch (err) {
      if (err.code !== 'EEXIST') throw err;
    }
    results.push({
      from: file.name, to: newName,
      before: `${file.width}x${file.height}`, after: `${meta.width}x${meta.height}`,
      bytesBefore: file.bytes, bytesAfter: output.length, products: [],
    });
  }

  // 3. ההפניות במסד, בטרנזקציה אחת
  await db.withTransaction(async (client) => {
    for (const r of results) {
      r.products = await replaceUrl(client, pathToUrl(r.from), pathToUrl(r.to));
    }
  });

  // 4. רק אחרי ה-COMMIT: הקבצים הישנים יוצאים מ-uploads (העותק בגיבוי)
  for (const r of results) {
    const stillUsed = await productsUsing(db.pool, pathToUrl(r.from));
    if (stillUsed.length === 0) fs.rmSync(path.join(UPLOADS_DIR, r.from), { force: true });
    r.oldFileRemoved = stillUsed.length === 0;
  }

  const manifest = { createdAt: new Date().toISOString(), uploadsDir: rel(UPLOADS_DIR), results };
  fs.writeFileSync(path.join(backupDir, 'manifest.json'), JSON.stringify(manifest, null, 1));
  return { backupDir, results };
}

/** מחזיר את מה ש---apply עשה, לפי ה-manifest שבתיקיית הגיבוי. */
async function revert(dir) {
  const backupDir = path.resolve(ROOT, dir);
  const { results } = JSON.parse(fs.readFileSync(path.join(backupDir, 'manifest.json'), 'utf8'));

  for (const r of results) {
    fs.copyFileSync(path.join(backupDir, r.from), path.join(UPLOADS_DIR, r.from));
  }
  let products = 0;
  await db.withTransaction(async (client) => {
    for (const r of results) products += (await replaceUrl(client, pathToUrl(r.to), pathToUrl(r.from))).length;
  });
  for (const r of results) {
    if ((await productsUsing(db.pool, pathToUrl(r.to))).length === 0) {
      fs.rmSync(path.join(UPLOADS_DIR, r.to), { force: true });
    }
  }
  console.log(`\nהוחזרו ${results.length} תמונות, ${products} הפניות במסד.`);
}

// ───────────────────────────── ראשי ─────────────────────────────

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.revert) { await revert(opts.revert); return; }

  const found = await findCandidates(opts.since);
  const usage = new Map();
  for (const file of found.candidates) usage.set(file.name, await productsUsing(db.pool, pathToUrl(file.name)));
  printPlan(found, usage, opts.since);

  if (!opts.apply) {
    console.log('\nריצה יבשה — לא שונה דבר. להפעלה: npm run images:square-uploads -- --apply');
    return;
  }
  if (found.candidates.length === 0) { console.log('\nאין מה לעבד.'); return; }

  const { backupDir, results } = await apply(found);
  const productIds = new Set(results.flatMap((r) => r.products));
  const before = results.reduce((s, r) => s + r.bytesBefore, 0);
  const after = results.reduce((s, r) => s + r.bytesAfter, 0);

  console.log('\nדו"ח:');
  for (const r of results) {
    console.log(`  ${r.from} ${r.before} → ${r.to} ${r.after}  מוצרים: ${r.products.join(', ') || '—'}`);
  }
  console.log(`\n${results.length} תמונות הושלמו לריבוע, ${productIds.size} מוצרים עודכנו במסד.`);
  console.log(`גודל: ${(before / 1024).toFixed(0)}KB → ${(after / 1024).toFixed(0)}KB`);
  console.log(`גיבוי:  ${rel(backupDir)}`);
  console.log(`לביטול:  npm run images:square-uploads -- --revert ${rel(backupDir)}`);
}

main()
  .catch((err) => { console.error(err.message); process.exitCode = 1; })
  .finally(() => db.close());
