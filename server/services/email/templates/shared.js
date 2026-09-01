/**
 * חלקים משותפים לכל מיילי המערכת.
 * ה-HTML הועבר כפי שהיה, למעט הוספת בריחת תווים (escape).
 */

/**
 * חוסם HTML injection: שם לקוch או הערה שמכילים < או & היו שוברים
 * את מבנה המייל, ובמקרה גרוע מזריקים תוכן זר.
 */
function escapeHtml(value) {
  if (value == null) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** תיאור אופן הקבלה — זהה בכל המיילים */
function deliveryText(order) {
  return order.delivery_method === 'pickup'
    ? '🏪 איסוף עצמי — בר כוכבא 52, פתח תקווה'
    : `🚚 משלוח לכתובת: ${escapeHtml(order.delivery_address)}`;
}

/** תיאור פריט: שם + גוון + מידה */
function itemLabel(item) {
  const color = item.selectedColor ? ` (${escapeHtml(item.selectedColor)})` : '';
  const size = item.selectedSize ? ` — ${escapeHtml(item.selectedSize)}` : '';
  return `${escapeHtml(item.name)}${color}${size}`;
}

/**
 * שורות טבלת הפריטים.
 * alignFirst קיים כי מייל החנות ומייל הלקוח נבדלו בפרט הזה בלבד.
 */
function itemsRows(items, { alignFirst = false } = {}) {
  const align = alignFirst ? ';text-align:right' : '';
  return items.map((item) =>
    `<tr>
      <td style="padding:8px;border-bottom:1px solid #eee${align}">${itemLabel(item)}</td>
      <td style="padding:8px;border-bottom:1px solid #eee;text-align:center">${item.quantity}</td>
      <td style="padding:8px;border-bottom:1px solid #eee;text-align:left">₪${item.price * item.quantity}</td>
    </tr>`
  ).join('');
}

/** כותרת הטבלה — זהה בשני מיילי ההזמנה */
function itemsTableHead() {
  return `<thead>
          <tr style="background:#f8f8f8">
            <th style="padding:10px 8px;text-align:right;color:#555">מוצר</th>
            <th style="padding:10px 8px;text-align:center;color:#555">כמות</th>
            <th style="padding:10px 8px;text-align:left;color:#555">מחיר</th>
          </tr>
        </thead>`;
}

/** שלוש שורות הסיכום — זהות בשני מיילי ההזמנה */
function summaryRows(order) {
  return `<div style="display:flex;justify-content:space-between;margin-bottom:8px;color:#666">
          <span>סכום מוצרים:</span><span>₪${order.subtotal}</span>
        </div>
        <div style="display:flex;justify-content:space-between;margin-bottom:12px;color:#666">
          <span>משלוח:</span><span>${order.delivery_fee > 0 ? `₪${order.delivery_fee}` : 'חינם'}</span>
        </div>
        <div style="display:flex;justify-content:space-between;font-size:18px;font-weight:bold;color:#1a1a2e;border-top:2px solid #e63946;padding-top:12px">
          <span>סה"כ לתשלום:</span><span>₪${order.total}</span>
        </div>`;
}

/** באנר הכותרת — זהה בכל המיילים, משתנה רק בשורת המשנה */
function header(subtitle) {
  return `<div style="background:linear-gradient(135deg,#1a1a2e,#16213e);padding:28px 32px;text-align:center">
      <h1 style="color:white;margin:0;font-size:22px">🔧 טכניק טמבור</h1>
      <p style="color:#e63946;margin:8px 0 0;font-size:16px;font-weight:bold">${subtitle}</p>
    </div>`;
}

/** תחתית — מבנה זהה, טקסט משתנה */
function footer(text) {
  return `<div style="background:#f0f0f0;padding:16px 32px;text-align:center;color:#999;font-size:12px">
      ${text}
    </div>`;
}

/** המסגרת החיצונית — זהה בכל המיילים */
function layout(inner) {
  return `
<!DOCTYPE html>
<html dir="rtl" lang="he">
<head><meta charset="UTF-8"></head>
<body style="font-family:Arial,sans-serif;background:#f5f5f5;margin:0;padding:20px">
  <div style="max-width:600px;margin:0 auto;background:white;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.1)">
${inner}
  </div>
</body>
</html>`;
}

module.exports = {
  escapeHtml, deliveryText, itemLabel, itemsRows,
  itemsTableHead, summaryRows, header, footer, layout,
};
