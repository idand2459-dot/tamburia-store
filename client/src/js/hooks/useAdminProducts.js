/**
 * נתוני המוצרים של מסך הניהול: הרשימה, השמירה, המחיקה וייבוא ה-CSV.
 *
 * מקבל את עוטף ה-fetch (api) כארגומנט ולא יוצר אותו בעצמו, כי אותו
 * עוטף מטפל ב-401 ומחזיר למסך ההתחברות — הוא שייך למסך הניהול
 * כולו, ושלושת ההוקים חולקים אותו.
 *
 * הטופס עצמו אינו כאן: שדות המוצר הם state של ProductFormTab, וההוק
 * מקבל אותם כארגומנט בזמן השמירה. כך אין לו מה לדעת על ה-UI.
 */
import { useState, useEffect, useCallback } from 'react';
import { CATEGORIES } from '../pages/admin/adminConstants';

const CSV_IDS = CATEGORIES.map(c => c.id);

/** בונה את גוף הבקשה של מוצר מתוך שדות הטופס וכתובות התמונות. */
function productBody(fields, imageUrls) {
  const { name, price, inStock, colors, category, sku, description, variants } = fields;
  const validVariants = variants.filter(v => v.label.trim() && v.price !== '');
  return {
    name, price: parseInt(price) || 0, in_stock: inStock,
    image_url: imageUrls[0] || '', images: imageUrls.slice(1),
    colors: colors.split(',').map(c => c.trim()).filter(Boolean),
    category, sku, description,
    variants: validVariants.map(v => ({ label: v.label.trim(), price: parseFloat(v.price) }))
  };
}

/** מפרק טקסט CSV לשורות מוצרים ומאתר שגיאות. */
export function parseCSV(text) {
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
    if (!p || isNaN(parseInt(p))) { errors.push(`שורה ${i+1}: מחיר לא תקין`); continue; }
    if (!cat || !CSV_IDS.includes(cat)) { errors.push(`שורה ${i+1}: קטגוריה לא תקינה "${cat}"`); continue; }
    rows.push({ name: n, price: parseInt(p), in_stock: is !== 'false', sku: sk||'', category: cat, colors: col ? col.split(',').map(c=>c.trim()).filter(Boolean) : [], description: desc||'' });
  }
  return { rows, errors };
}

/** מוריד קובץ CSV לדוגמה לייבוא מוצרים. */
export function downloadTemplate() {
  const csv = ['name,price,in_stock,sku,category,colors,description', 'מברשת צבע 3 אינץ\',25,true,TT-001,painting,"לבן,שחור",מברשת איכותית'].join('\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = 'tamburia-template.csv'; a.click();
}

/** מנהל את רשימת המוצרים, עדכוניה וייבוא ה-CSV. */
export function useAdminProducts(api) {
  const [products, setProducts] = useState([]);
  const [uploadingImages, setUploadingImages] = useState(false);

  const [csvPreview, setCsvPreview] = useState(null);
  const [csvErrors, setCsvErrors] = useState([]);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);

  /** טוען את רשימת המוצרים מהשרת. */
  const fetchProducts = useCallback(() => {
    api('/api/products').then(r => r.json()).then(data => setProducts(Array.isArray(data) ? data : [])).catch(() => {});
  }, [api]);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);

  /** מעלה קבצי תמונה ומחזיר את כתובותיהם. */
  const uploadImages = useCallback(async (files) => {
    const formData = new FormData();
    files.forEach(f => formData.append('images', f));
    const res = await api('/api/upload-multiple', { method: 'POST', body: formData });
    return (await res.json()).imageUrls || [];
  }, [api]);

  /** יוצר מוצר חדש מתוך שדות הטופס והתמונות שנבחרו. */
  const createProduct = useCallback(async (fields, newImages) => {
    setUploadingImages(true);
    let allImageUrls = newImages.length > 0 ? await uploadImages(newImages) : [];
    await api('/api/products', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(productBody(fields, allImageUrls))
    });
    setUploadingImages(false); fetchProducts();
  }, [api, uploadImages, fetchProducts]);

  /** שומר את השינויים במוצר קיים. */
  const updateProduct = useCallback(async (id, fields, existingImages, newImages) => {
    setUploadingImages(true);
    let newUrls = newImages.length > 0 ? await uploadImages(newImages) : [];
    const allUrls = [...existingImages, ...newUrls];
    await api('/api/products/' + id, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(productBody(fields, allUrls))
    });
    setUploadingImages(false); fetchProducts();
  }, [api, uploadImages, fetchProducts]);

  /** מוחק מוצר לאחר אישור המשתמש. */
  const deleteProduct = useCallback(async (id) => {
    if (!window.confirm('למחוק את המוצר?')) return;
    await api('/api/products/' + id, { method: 'DELETE' });
    fetchProducts();
  }, [api, fetchProducts]);

  /** מחליף את סימון המלאי של המוצר. */
  const toggleStock = useCallback(async (product) => {
    await api('/api/products/' + product.id, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: product.name, price: product.price, in_stock: !product.in_stock, image_url: product.image_url || '', images: product.images || [], colors: product.colors || [], category: product.category, sku: product.sku || '', description: product.description || '' })
    });
    fetchProducts();
  }, [api, fetchProducts]);

  /** מנקה את תצוגת ה-CSV, לפתיחה נקייה של לשונית הייבוא. */
  const resetCsv = useCallback(() => {
    setCsvPreview(null); setCsvErrors([]); setImportResult(null);
  }, []);

  /** קורא את קובץ ה-CSV שנבחר ומציג תצוגה מקדימה. */
  const handleCsvFile = useCallback((e) => {
    const file = e.target.files[0]; if (!file) return;
    setCsvPreview(null); setCsvErrors([]); setImportResult(null);
    const reader = new FileReader();
    reader.onload = evt => { const { rows, errors } = parseCSV(evt.target.result); setCsvPreview(rows); setCsvErrors(errors); };
    reader.readAsText(file, 'UTF-8'); e.target.value = '';
  }, []);

  /** מייבא לשרת את המוצרים שנקראו מה-CSV. */
  const handleImport = useCallback(async () => {
    if (!csvPreview?.length) return;
    setImporting(true); let success = 0, failed = 0;
    for (const row of csvPreview) {
      try {
        const r = await api('/api/products', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...row, image_url: '', images: [] }) });
        if (r.ok) success++; else failed++;
      } catch { failed++; }
    }
    setImporting(false); setImportResult({ success, failed }); setCsvPreview(null); fetchProducts();
  }, [api, csvPreview, fetchProducts]);

  /** מנקה את תוצאת הייבוא בלבד. */
  const clearImportResult = useCallback(() => setImportResult(null), []);

  return {
    products, fetchProducts,
    createProduct, updateProduct, deleteProduct, toggleStock, uploadingImages,
    csvPreview, csvErrors, importing, importResult,
    downloadTemplate, handleCsvFile, handleImport, resetCsv, clearImportResult,
  };
}
