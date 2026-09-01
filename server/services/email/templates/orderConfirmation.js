/**
 * בונה את מייל אישור ההזמנה שנשלח ללקוח, אם השאיר כתובת מייל.
 */
const {
  escapeHtml, deliveryText, itemsRows,
  itemsTableHead, summaryRows, header, footer, layout,
} = require('./shared');

/** מחזיר את שורת הנושא של המייל. */
function subject(order) {
  return `✅ ההזמנה שלך התקבלה! מספר הזמנה #${order.id} — טכניק טמבור`;
}

/** בונה כפתור יצירת קשר לתחתית המייל. */
function contactButton(href, label, background) {
  return `<a href="${href}" style="background:${background};color:white;padding:10px 18px;border-radius:20px;text-decoration:none;font-size:0.85rem;font-weight:bold">${label}</a>`;
}

/** בונה את גוף המייל המלא. */
function html(order) {
  return layout(`
${header(`אישור קבלת הזמנה — מספר #${order.id}`)}

    <div style="background:#fff8e1;border-right:4px solid #f4c430;padding:12px 20px;margin:0">
      <p style="margin:0;font-size:0.82rem;color:#666">⚠️ מסמך זה הוא <strong>אישור הזמנה בלבד</strong> ואינו חשבונית מס. חשבונית מס תוצא בנפרד.</p>
    </div>

    <div style="padding:28px 32px 0">
      <p style="font-size:1.1rem;color:#1a1a2e;margin:0 0 12px">שלום ${escapeHtml(order.customer_name)},</p>
      <p style="font-size:1rem;color:#555;line-height:1.7;margin:0 0 8px">
        ההזמנה שלך התקבלה אצלנו בהצלחה! 🎉<br/>
        אנחנו נטפל בה בהקדם האפשרי וניצור איתך קשר לאישור.
      </p>
    </div>

    <div style="padding:20px 32px">
      <div style="background:#f8f8f8;border-radius:8px;padding:16px;margin-bottom:20px">
        <div style="display:flex;justify-content:space-between;margin-bottom:8px">
          <span style="color:#666">מספר הזמנה:</span><strong>#${order.id}</strong>
        </div>
        <div style="display:flex;justify-content:space-between">
          <span style="color:#666">אופן קבלה:</span><span>${deliveryText(order)}</span>
        </div>
      </div>

      <table style="width:100%;border-collapse:collapse">
        ${itemsTableHead()}
        <tbody>${itemsRows(order.items, { alignFirst: true })}</tbody>
      </table>

      <div style="background:#f8f8f8;border-radius:8px;padding:16px;margin-top:16px">
        ${summaryRows(order)}
      </div>
    </div>

    <div style="padding:0 32px 28px;text-align:center">
      <p style="color:#666;font-size:0.9rem;margin-bottom:12px">לכל שאלה אנחנו כאן בשבילך:</p>
      <div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap">
        ${contactButton('tel:039315750', '📞 03-9315750', '#1a1a2e')}
        ${contactButton('tel:0506735040', '📱 050-6735040', '#1a1a2e')}
        ${contactButton('https://wa.me/972506735040', '💬 וואטסאפ', '#25d366')}
      </div>
    </div>

${footer('טכניק טמבור • בר כוכבא 52, פתח תקווה • א׳-ה׳ 7:00-20:00 • ו׳ 7:00-15:00')}`);
}

module.exports = { subject, html };
