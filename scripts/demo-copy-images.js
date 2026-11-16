/**
 * Copies the tracked demo images (demo-assets/uploads/) into uploads/ for the hosted demo (plan 006,
 * Phase 5). Part of the Render build command:
 *
 *   npm ci && npm ci --prefix client && npm run build:client && node scripts/demo-copy-images.js
 *
 * Render's disk is ephemeral and uploads are switched off in demo mode, so this set is rebuilt on every
 * deploy and is the only image source. Only content-named WebP files are copied (a hex name and .webp);
 * anything else in the folder is ignored. With no demo-assets folder yet (the owner has not approved a
 * catalogue) it copies nothing and the products show the category fallback. It writes no database.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SOURCE = path.join(ROOT, 'demo-assets', 'uploads');
const TARGET = path.join(ROOT, 'uploads');
const NAME = /^[0-9a-f]{16}\.webp$/;

if (!fs.existsSync(SOURCE)) {
  console.log('אין demo-assets/uploads — לא הועתקו תמונות (המוצרים יציגו את אייקון הקטגוריה).');
  process.exit(0);
}

fs.mkdirSync(TARGET, { recursive: true });
const files = fs.readdirSync(SOURCE).filter((name) => NAME.test(name));
for (const name of files) fs.copyFileSync(path.join(SOURCE, name), path.join(TARGET, name));
console.log(`✓ הועתקו ${files.length} תמונות הדגמה אל uploads/`);
