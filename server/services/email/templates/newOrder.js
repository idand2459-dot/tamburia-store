/**
 * בונה את מייל ההזמנה החדשה שנשלח לחנות, עם פרטי הלקוח,
 * הפריטים, הסיכום וקישור למסך הניהול.
 */
const config = require('../../../config/env');
const {
  escapeHtml, deliveryText, itemsRows,
  itemsTableHead, summaryRows, header, footer, layout,
} = require('./shared');

/** מחזיר את שורת הנושא של המייל. */
function subject(order) {
  return `📦 הזמנה חדשה #${order.id} — ${order.customer_name} — ₪${order.total}`;
}

/** בונה כותרת סעיף עם קו הפרדה. */
function sectionTitle(text) {
  return `<h2 style="color:#1a1a2e;margin:0 0 16px;font-size:16px;border-bottom:2px solid #e63946;padding-bottom:8px">${text}</h2>`;
}

/** בונה שורה בטבלת פרטי הלקוח. */
function detailRow(label, value, { bold = false, width } = {}) {
  const labelStyle = `padding:6px 0;color:#666${width ? `;width:${width}` : ''}`;
  const valueStyle = `padding:6px 0${bold ? ';font-weight:bold' : ''}`;
  return `<tr><td style="${labelStyle}">${label}</td><td style="${valueStyle}">${value}</td></tr>`;
}

/** בונה את גוף המייל המלא. */
function html(order) {
  return layout(`
${header(`הזמנה חדשה #${order.id}`)}

    <div style="padding:24px 32px">
      ${sectionTitle('פרטי לקוח')}
      <table style="width:100%;border-collapse:collapse">
        ${detailRow('שם:', escapeHtml(order.customer_name), { bold: true, width: '120px' })}
        ${detailRow('טלפון:', escapeHtml(order.customer_phone), { bold: true })}
        ${order.customer_email ? detailRow('אימייל:', escapeHtml(order.customer_email)) : ''}
        ${detailRow('אופן קבלה:', deliveryText(order))}
        ${order.notes ? detailRow('הערות:', escapeHtml(order.notes)) : ''}
      </table>
    </div>

    <div style="padding:0 32px 24px">
      ${sectionTitle('פריטים שהוזמנו')}
      <table style="width:100%;border-collapse:collapse">
        ${itemsTableHead()}
        <tbody>${itemsRows(order.items)}</tbody>
      </table>
    </div>

    <div style="padding:0 32px 28px">
      <div style="background:#f8f8f8;border-radius:8px;padding:16px">
        ${summaryRows(order)}
      </div>
    </div>

    <div style="padding:0 32px 32px;text-align:center">
      <a href="${config.adminUrl}" style="background:#e63946;color:white;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:15px">
        כניסה לאדמין לניהול ההזמנה
      </a>
    </div>

${footer('טכניק טמבור • בר כוכבא 52, פתח תקווה • 03-9315750')}`);
}

module.exports = { subject, html };
