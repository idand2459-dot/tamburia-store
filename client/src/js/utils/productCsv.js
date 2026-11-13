/**
 * Product CSV: reading an import file into rows and error lines, and the text of the example
 * file the admin can download.
 *
 * Plain functions moved unchanged out of hooks/useAdminProducts.js (P3). The hook keeps the
 * file reading, the state and the download.
 */
import { CATEGORIES } from '../pages/admin/adminConstants';
import { parsePriceInput } from './pricing';

const CSV_IDS = CATEGORIES.map(c => c.id);

/** מפרק טקסט CSV לשורות מוצרים ומאתר שגיאות. */
export function parseProductCsv(text) {
  const lines = text.trim().split('\n'); if (lines.length < 2) return { rows: [], errors: ['קובץ ריק'] };
  const errors = [], rows = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim(); if (!line) continue;
    const cols = []; let cur = '', inQ = false;
    for (let c = 0; c < line.length; c++) {
      if (line[c] === '"') inQ = !inQ;
      else if (line[c] === ',' && !inQ) { cols.push(cur.trim()); cur = ''; }
      else cur += line[c];
    }
    cols.push(cur.trim());
    const [n, p, is, sk, cat, col, desc] = cols;
    if (!n) { errors.push(`שורה ${i+1}: חסר שם`); continue; }
    const price = parsePriceInput(p);
    if (price === null) { errors.push(`שורה ${i+1}: מחיר לא תקין "${p ?? ''}" — עד שתי ספרות אחרי הנקודה`); continue; }
    if (!cat || !CSV_IDS.includes(cat)) { errors.push(`שורה ${i+1}: קטגוריה לא תקינה "${cat}"`); continue; }
    rows.push({ name: n, price, in_stock: is !== 'false', sku: sk||'', category: cat, colors: col ? col.split(',').map(c=>c.trim()).filter(Boolean) : [], description: desc||'' });
  }
  return { rows, errors };
}

/** הטקסט של קובץ ה-CSV לדוגמה לייבוא מוצרים (עם BOM, כדי שאקסל יקרא עברית). */
export function productCsvTemplate() {
  const csv = ['name,price,in_stock,sku,category,colors,description', 'מברשת צבע 3 אינץ\',25,true,TT-001,painting,"לבן,שחור",מברשת איכותית'].join('\n');
  return '﻿' + csv;
}
