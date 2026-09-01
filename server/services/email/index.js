/**
 * הממשק היחיד שדרכו הקונטרולרים שולחים מיילים.
 * אף פונקציה כאן אינה זורקת — כולן מחזירות { sent, reason? }.
 */
const config = require('../../config/env');
const { send } = require('./transporter');
const newOrder = require('./templates/newOrder');
const orderConfirmation = require('./templates/orderConfirmation');
const orderStatus = require('./templates/orderStatus');

/** שולח לחנות הודעה על הזמנה חדשה. */
function sendNewOrderToStore(order) {
  return send({
    to: config.mail.to,
    subject: newOrder.subject(order),
    html: newOrder.html(order),
  });
}

/** שולח ללקוח אישור הזמנה, אם השאיר כתובת מייל. */
function sendOrderConfirmationToCustomer(order) {
  return send({
    to: order.customer_email,
    subject: orderConfirmation.subject(order),
    html: orderConfirmation.html(order),
  });
}

/** שולח ללקוח עדכון סטטוס, אם מוגדר מייל לסטטוס הזה. */
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
