/**
 * הממשק היחיד שדרכו הקונטרולרים שולחים מיילים.
 * אף פונקציה כאן אינה זורקת — כולן מחזירות { sent, reason? }.
 */
const config = require('../../config/env');
const { send } = require('./transporter');
const newOrder = require('./templates/newOrder');
const orderConfirmation = require('./templates/orderConfirmation');
const orderStatus = require('./templates/orderStatus');

/**
 * בונה את ההודעה ושולח אותה. בניית התבנית בתוך ה-try: תבנית שזורקת (נתון חסר בהזמנה)
 * הייתה מפילה את הבקשה אחרי שההזמנה כבר נשמרה, ולא אמורה לעלות יותר ממייל שלא יצא.
 */
async function deliver(label, build) {
  let message;
  try {
    message = build();
  } catch (err) {
    // The label and the error's class only: the message of a template failure can quote order data.
    const name = typeof err?.name === 'string' && /^[A-Za-z]{1,40}$/.test(err.name) ? err.name : 'Error';
    console.error(`✗ mail build failed | ${label} | ${name}`);
    return { sent: false, reason: 'build_failed' };
  }
  return send(message, { label });
}

/**
 * The fixed label a mail log line uses: the kind of mail and the order number (a number the system
 * assigned, not customer data). Never a name, address or subject.
 */
function labelOf(kind, order) {
  return order && Number.isInteger(order.id) ? `${kind} #${order.id}` : kind;
}

/** שולח לחנות הודעה על הזמנה חדשה. */
function sendNewOrderToStore(order) {
  return deliver(labelOf('new-order store', order), () => ({
    to: config.mail.to,
    subject: newOrder.subject(order),
    html: newOrder.html(order),
  }));
}

/** שולח ללקוח אישור הזמנה, אם השאיר כתובת מייל. */
function sendOrderConfirmationToCustomer(order) {
  return deliver(labelOf('order-confirmation customer', order), () => ({
    to: order.customer_email,
    subject: orderConfirmation.subject(order),
    html: orderConfirmation.html(order),
  }));
}

/** שולח ללקוח עדכון סטטוס, אם מוגדר מייל לסטטוס הזה. */
function sendStatusUpdateToCustomer(order, status) {
  if (!orderStatus.hasEmail(status)) {
    return { sent: false, reason: `אין מייל מוגדר לסטטוס "${status}"` };
  }
  return deliver(labelOf('status-update customer', order), () => ({
    to: order.customer_email,
    subject: orderStatus.subject(order, status),
    html: orderStatus.html(order, status),
  }));
}

module.exports = {
  sendNewOrderToStore,
  sendOrderConfirmationToCustomer,
  sendStatusUpdateToCustomer,
};
