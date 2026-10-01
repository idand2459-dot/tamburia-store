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
import { errorMessageFrom, NETWORK_ERROR } from '../utils/apiErrors';
import { parsePriceInput } from '../utils/pricing';

const CSV_IDS = CATEGORIES.map(c => c.id);

/** בונה את גוף הבקשה של מוצר מתוך שדות הטופס וכתובות התמונות. */
function productBody(fields, imageUrls) {
  const { name, price, inStock, colors, category, sku, description, variants, imageIllustrative } = fields;
  const validVariants = variants.filter(v => v.label.trim() && v.price !== '');
  return {
    /* parsePriceInput ולא parseInt: parseInt("12.90") הוא 12, וזה היה
       אחד משלושת המקומות שמחיר עשרוני נחתך בהם בדרך למסד. */
    name, price: parsePriceInput(price) ?? 0, in_stock: inStock,
    image_url: imageUrls[0] || '', images: imageUrls.slice(1),
    /* שורה בלי שם נזרקת כאן ולא בשרת: שורה ריקה בטופס היא שורה שעוד
       לא מולאה, ולא שגיאה שצריך לעצור עליה. */
    colors: colors
      .map(c => ({ name: c.name.trim(), hex: c.hex || '' }))
      .filter(c => c.name),
    category, sku, description,
    image_illustrative: Boolean(imageIllustrative),
    variants: validVariants.map(v => ({ label: v.label.trim(), price: parsePriceInput(v.price) }))
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
    const price = parsePriceInput(p);
    if (price === null) { errors.push(`שורה ${i+1}: מחיר לא תקין "${p ?? ''}" — עד שתי ספרות אחרי הנקודה`); continue; }
    if (!cat || !CSV_IDS.includes(cat)) { errors.push(`שורה ${i+1}: קטגוריה לא תקינה "${cat}"`); continue; }
    rows.push({ name: n, price, in_stock: is !== 'false', sku: sk||'', category: cat, colors: col ? col.split(',').map(c=>c.trim()).filter(Boolean) : [], description: desc||'' });
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
  /* האם הרשימה כבר הגיעה מהשרת. עד אז products הוא [] — וזה לא אותו
     דבר כמו "אין מוצרים": בלי הדגל, כל קטגוריה בכתובת הייתה נראית
     ריקה ברגע הראשון, ולשונית המוצרים הייתה מאפסת אותה ל"הכל". */
  const [productsLoaded, setProductsLoaded] = useState(false);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [productsError, setProductsError] = useState('');

  const [csvPreview, setCsvPreview] = useState(null);
  const [csvErrors, setCsvErrors] = useState([]);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);

  /**
   * טוען את רשימת המוצרים מהשרת.
   *
   * ?active=all במפורש: השרת מחזיר מוצרים גלויים בלבד לכל מי ששואל,
   * גם לאדמין מחובר, כדי שגלישה בחנות תיראה כמו שהיא נראית ללקוח.
   * הרשימה כאן היא היחידה שצריכה גם את המוסתרים.
   */
  const fetchProducts = useCallback(() => {
    api('/api/products?active=all')
      .then(r => r.json())
      .then(data => {
        if (!Array.isArray(data)) return;
        setProducts(data);
        setProductsLoaded(true);
      })
      .catch(() => {});
  }, [api]);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);

  /**
   * מעלה קבצי תמונה ומחזיר את כתובותיהם.
   *
   * מחזיר { ok } ולא רק מערך, כי העלאה שנכשלה הייתה מחזירה [] —
   * ואז המוצר היה נשמר בלי התמונות, בשקט. השומר למעלה עוצר במקום.
   */
  const uploadImages = useCallback(async (files) => {
    const formData = new FormData();
    files.forEach(f => formData.append('images', f));
    const res = await api('/api/upload-multiple', { method: 'POST', body: formData });

    if (!res.ok) {
      return { ok: false, error: await errorMessageFrom(res, 'העלאת התמונות נכשלה. המוצר לא נשמר.') };
    }

    const body = await res.json().catch(() => ({}));
    return { ok: true, imageUrls: body.imageUrls || [] };
  }, [api]);

  /**
   * יוצר מוצר חדש מתוך שדות הטופס והתמונות שנבחרו.
   * מחזיר true בהצלחה בלבד, כדי שהטופס לא יתאפס על כישלון.
   */
  const createProduct = useCallback(async (fields, newImages) => {
    setUploadingImages(true);
    try {
      let allImageUrls = [];
      if (newImages.length > 0) {
        const upload = await uploadImages(newImages);
        if (!upload.ok) { setProductsError(upload.error); return false; }
        allImageUrls = upload.imageUrls;
      }

      const res = await api('/api/products', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(productBody(fields, allImageUrls))
      });

      if (!res.ok) {
        setProductsError(await errorMessageFrom(res, 'הוספת המוצר נכשלה.'));
        return false;
      }

      setProductsError(''); fetchProducts();
      return true;
    } catch {
      setProductsError(NETWORK_ERROR);
      return false;
    } finally {
      // ב-finally ולא בכל מסלול בנפרד: כך הכפתור משתחרר גם כשהבקשה
      // זרקה, ולא נשאר נעול על "מעלה..." עד רענון הדף.
      setUploadingImages(false);
    }
  }, [api, uploadImages, fetchProducts]);

  /**
   * שומר את השינויים במוצר קיים.
   * מחזיר true בהצלחה בלבד, כדי שהעריכה לא תיזרק על כישלון.
   */
  const updateProduct = useCallback(async (id, fields, existingImages, newImages) => {
    setUploadingImages(true);
    try {
      let newUrls = [];
      if (newImages.length > 0) {
        const upload = await uploadImages(newImages);
        if (!upload.ok) { setProductsError(upload.error); return false; }
        newUrls = upload.imageUrls;
      }

      const allUrls = [...existingImages, ...newUrls];
      const res = await api('/api/products/' + id, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(productBody(fields, allUrls))
      });

      if (!res.ok) {
        setProductsError(await errorMessageFrom(res, 'שמירת המוצר נכשלה.'));
        return false;
      }

      setProductsError(''); fetchProducts();
      return true;
    } catch {
      setProductsError(NETWORK_ERROR);
      return false;
    } finally {
      setUploadingImages(false);
    }
  }, [api, uploadImages, fetchProducts]);

  /** מוחק מוצר לאחר אישור המשתמש. */
  /**
   * מוחק מוצר ומחזיר מה קרה, כדי שהכרטיס יציג את זה במקום שבו לחצו.
   *
   * בלי window.confirm: האישור הוא חלק מהכרטיס (AdminProductCard). כאן
   * היה confirm, ודפדפן שחוסם חלונות קופצים — דפדפן מוטמע, או מי שסימן
   * "מנע מהדף ליצור תיבות דו-שיח נוספות" — מחזיר ממנו false בלי להציג
   * כלום. הלחיצה לא שלחה בקשה ולא אמרה דבר.
   *
   * מחזיר { status: 'deleted' }, { status: 'has_orders', message } —
   * מוצר שנמכר אינו נמחק, והכרטיס מציע להסתיר אותו — או
   * { status: 'error', message }.
   */
  const deleteProduct = useCallback(async (product) => {
    try {
      const res = await api('/api/products/' + product.id, { method: 'DELETE' });
      if (res.ok) {
        setProductsError('');
        fetchProducts();
        return { status: 'deleted' };
      }

      const body = await res.json().catch(() => null);
      const message = typeof body?.error === 'string' && body.error.trim()
        ? body.error
        : 'מחיקת המוצר נכשלה. אפשר לנסות שוב.';
      if (res.status === 409 && body?.details?.reason === 'has_orders') {
        return { status: 'has_orders', message };
      }
      return { status: 'error', message };
    } catch {
      return { status: 'error', message: NETWORK_ERROR };
    }
  }, [api, fetchProducts]);

  /**
   * שולח עדכון של שדה בודד, ומחזיר true רק כשהשמירה הצליחה.
   *
   * השרת כותב רק את מה שנשלח (parseUpdate עובר על השדות שקיימים בגוף
   * הבקשה בלבד), ולכן וריאנטים, תמונות, צבעים ומידות שלא נכללו כאן
   * נשארים כפי שהם. זו הסיבה שאפשר לשנות מחיר בלי לשלוח את כל המוצר,
   * וזה מכוסה בבדיקה — test/smoke-products.js, "עדכון חלקי".
   */
  const patchProduct = useCallback(async (id, patch, failMessage) => {
    try {
      const res = await api('/api/products/' + id, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });

      if (!res.ok) {
        setProductsError(await errorMessageFrom(res, failMessage));
        return false;
      }
      setProductsError(''); fetchProducts();
      return true;
    } catch {
      setProductsError(NETWORK_ERROR);
      return false;
    }
  }, [api, fetchProducts]);

  /** מחליף את סימון המלאי של המוצר. */
  const toggleStock = useCallback((product) => (
    patchProduct(product.id, { in_stock: !product.in_stock }, 'עדכון המלאי נכשל.')
  ), [patchProduct]);

  /**
   * מסתיר את המוצר מהחנות, או מחזיר אותו אליה.
   *
   * זו החלופה למחיקה: המוצר נשאר במסד עם כל מה שמפנה אליו — הזמנות
   * ישנות, ביקורות, מחשבון הצבע — ופשוט מפסיק להופיע בחנות. לכן זו
   * פעולה בלי אישור, בניגוד ל-deleteProduct: אפשר לבטל אותה בלחיצה.
   */
  const toggleActive = useCallback((product) => (
    patchProduct(
      product.id,
      { active: product.active === false },
      'הסתרת המוצר נכשלה.'
    )
  ), [patchProduct]);

  /**
   * משנה את מחיר המוצר בלבד — עריכת המחיר המהירה בלשונית המוצרים.
   *
   * מוצר עם וריאנטים אינו מגיע לכאן: המחיר שלו נגזר מהזול שבהם, ושליחת
   * price לבדו הייתה קובעת לו מחיר שאינו תואם את הגרסאות. לשונית
   * המוצרים פותחת לו את הטופס המלא במקום.
   */
  const updatePrice = useCallback((product, price) => (
    patchProduct(product.id, { price }, 'עדכון המחיר נכשל.')
  ), [patchProduct]);

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
    products, productsLoaded, fetchProducts, productsError,
    createProduct, updateProduct, deleteProduct, toggleStock, toggleActive, updatePrice, uploadingImages,
    csvPreview, csvErrors, importing, importResult,
    downloadTemplate, handleCsvFile, handleImport, resetCsv, clearImportResult,
  };
}
