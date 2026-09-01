/**
 * בונה את מייל עדכון הסטטוס שנשלח ללקוח.
 * הסטטוס 'new' אינו מופיע כאן, כי עליו יוצא מייל אישור נפרד.
 */
const { escapeHtml, header, footer, layout } = require('./shared');

const STATUS_LABELS = {
  processing: {
    label: 'בטיפול',
    emoji: '⚙️',
    desc: 'קיבלנו את הזמנתך ואנחנו מתחילים לטפל בה. נעדכן אותך כשהיא תהיה מוכנה.',
  },
  shipped: {
    label: 'נשלחה',
    emoji: '🚚',
    desc: 'ההזמנה שלך יצאה לדרך ותגיע אליך בקרוב. תודה על הסבלנות!',
  },
  completed: {
    label: 'הושלמה',
    emoji: '🎉',
    desc: 'ההזמנה שלך הושלמה בהצלחה!\n\nתודה שבחרת בטכניק טמבור — זה לא מובן מאליו עבורנו ואנחנו שמחים שיכולנו לעזור.\n\nנשמח לראותך שוב! 😊',
  },
};

/** מחזיר האם מוגדר מייל לסטטוס הנתון. */
function hasEmail(status) {
  return Object.prototype.hasOwnProperty.call(STATUS_LABELS, status);
}

/** מחזיר את שורת הנושא של המייל. */
function subject(order, status) {
  return `${STATUS_LABELS[status].emoji} עדכון הזמנה #${order.id} — טכניק טמבור`;
}

/** בונה שורת "תווית: ערך" בקופסת הסיכום. */
function summaryLine(label, value, { last = false } = {}) {
  const margin = last ? '' : 'margin-bottom:8px';
  return `<div style="display:flex;justify-content:space-between;${margin}">
          <span style="color:#666">${label}</span>${value}
        </div>`;
}

/** בונה את גוף המייל המלא. */
function html(order, status) {
  const cfg = STATUS_LABELS[status];
  return layout(`
${header(`${cfg.emoji} עדכון הזמנה #${order.id}`)}
    <div style="padding:32px">
      <p style="font-size:1.1rem;color:#1a1a2e">שלום ${escapeHtml(order.customer_name)},</p>
      <p style="font-size:1rem;color:#555">${cfg.desc}</p>
      <div style="background:#f8f8f8;border-radius:8px;padding:16px;margin:20px 0">
        ${summaryLine('מספר הזמנה:', `<strong>#${order.id}</strong>`)}
        ${summaryLine('סטטוס:', `<strong style="color:#e63946">${cfg.emoji} ${cfg.label}</strong>`)}
        ${summaryLine('סה"כ:', `<strong>₪${order.total}</strong>`, { last: true })}
      </div>
      <p style="color:#999;font-size:0.85rem">שאלות? צרו קשר: 03-9315750 | 050-6735040</p>
    </div>
${footer('טכניק טמבור • בר כוכבא 52, פתח תקווה')}`);
}

module.exports = { STATUS_LABELS, hasEmail, subject, html };
