const config = require('../../config/env');
const { send } = require('./transporter');
const newOrder = require('./templates/newOrder');
const orderConfirmation = require('./templates/orderConfirmation');
const orderStatus = require('./templates/orderStatus');

/**
 * הממשק היחיד שהקונטרולרים מכירים.
 * אף פונקציה כאן לא זורקת — כולן מחזירות { sent, reason? }.
 */

/** הודעה לחנות על הזמנה חדשה */
function sendNewOrderToStore(order) {
  return send({
    to: config.mail.to,
    subject: newOrder.subject(order),
    html: newOrder.html(order),
  });
}

/** אישור ללקוח. מדלג בשקט אם הלקוח לא השאיר מייל. */
function sendOrderConfirmationToCustomer(order) {
  return send({
    to: order.customer_email,
    subject: orderConfirmation.subject(order),
    html: orderConfirmation.html(order),
  });
}

/** עדכון סטטוס ללקוח. יש סטטוסים שלא שולחים עליהם כלום. */
function sendStatusUpdateToCustomer(order, status) {
  if (!orderStatus.hasEmail(status)) {
    return { sent: false, reason: `אין מייל מוגדר לסטטוס "${status}"` };
  }
  return send({
    to: order.customer_email,
    subject: orderStatus.subject(order, status),
    html: orderStatus.html(order, status),
  });
}

module.exports = {
  sendNewOrderToStore,
  sendOrderConfirmationToCustomer,
  sendStatusUpdateToCustomer,
};
