/**
 * The checkout footer when an order was sent and not confirmed: the notice replaces the submit
 * button, offers sending the original again, and makes cancelling a two-step decision with the
 * duplicate warning. The `checkout` prop is a plain object, as StoreLayout hands it down.
 */
import { Provider } from 'react-redux';
import { render, screen, fireEvent } from '@testing-library/react';
import { CheckoutFormFooter } from '../../../features/cart/CheckoutFormView';
import { createAppStore } from '../../../store';

const PENDING = { submittedAt: new Date(2026, 10, 14, 9, 30).getTime(), itemCount: 4, total: 550, persisted: true, conflict: false };

function renderFooter(overrides = {}) {
  const checkout = {
    customerName: 'דנה', customerPhone: '0501234567', customerEmail: '', deliveryAddress: '', orderNotes: '',
    submittingOrder: false, orderError: '', handlePlaceOrder: jest.fn(),
    pendingOrder: null, retryPendingOrder: jest.fn(), cancelPendingOrder: jest.fn(),
    ...overrides,
  };
  const store = createAppStore({
    cart: { items: [{ id: 1, name: 'צבע', price: 10, quantity: 1 }], deliveryMethod: 'pickup', priceChanges: [] },
    wishlist: { items: [] },
    availability: { unavailableIds: [], unavailableVariants: [], unavailableOptions: [] },
  });
  render(<Provider store={store}><CheckoutFormFooter checkout={checkout} /></Provider>);
  return checkout;
}

test('without an unresolved order the footer shows the submit button and no notice', () => {
  renderFooter();

  expect(screen.getByRole('button', { name: /שלח הזמנה/ }).disabled).toBe(false);
  expect(screen.queryByText('יש הזמנה שלא אושרה')).toBeNull();
});

test('an unresolved order replaces the submit button with the notice and what the customer needs to recognise it', () => {
  renderFooter({ pendingOrder: PENDING });

  expect(screen.queryByRole('button', { name: /^שלח הזמנה/ })).toBeNull();
  expect(screen.getByRole('heading', { name: /יש הזמנה שלא אושרה/ })).toBeTruthy();
  expect(screen.getByText(/4 פריטים/)).toBeTruthy();
  expect(screen.getByText(/ייתכן שההזמנה התקבלה/)).toBeTruthy();
  expect(screen.queryByText(/לא נשמרה במכשיר/)).toBeNull();
});

test('"send again" sends the original through retryPendingOrder', () => {
  const checkout = renderFooter({ pendingOrder: PENDING });

  fireEvent.click(screen.getByRole('button', { name: /שלחו שוב את ההזמנה הקודמת/ }));

  expect(checkout.retryPendingOrder).toHaveBeenCalledTimes(1);
  expect(checkout.handlePlaceOrder).not.toHaveBeenCalled();
});

test('cancelling takes a second click, after the duplicate warning', () => {
  const checkout = renderFooter({ pendingOrder: PENDING });

  fireEvent.click(screen.getByRole('button', { name: 'בטלו והתחילו מחדש' }));
  expect(checkout.cancelPendingOrder).not.toHaveBeenCalled();
  expect(screen.getByText(/שליחה חדשה תיצור הזמנה נוספת/)).toBeTruthy();

  fireEvent.click(screen.getByRole('button', { name: /כן, בטלו/ }));
  expect(checkout.cancelPendingOrder).toHaveBeenCalledTimes(1);
});

test('"back" in the warning keeps the order', () => {
  const checkout = renderFooter({ pendingOrder: PENDING });

  fireEvent.click(screen.getByRole('button', { name: 'בטלו והתחילו מחדש' }));
  fireEvent.click(screen.getByRole('button', { name: 'חזרה' }));

  expect(checkout.cancelPendingOrder).not.toHaveBeenCalled();
  expect(screen.getByRole('button', { name: /שלחו שוב/ })).toBeTruthy();
});

test('an order that could not be stored says that a reload will lose it', () => {
  renderFooter({ pendingOrder: { ...PENDING, persisted: false } });

  expect(screen.getByText(/אחרי רענון הדף אי אפשר יהיה לשחזר אותה/)).toBeTruthy();
});

test('a conflict offers only cancelling', () => {
  renderFooter({ pendingOrder: { ...PENDING, conflict: true } });

  expect(screen.queryByRole('button', { name: /שלחו שוב/ })).toBeNull();
  expect(screen.getByText(/כבר שימש בשרת להזמנה אחרת/)).toBeTruthy();
  expect(screen.getByRole('button', { name: 'בטלו והתחילו מחדש' })).toBeTruthy();
});

test('while a request is in flight both actions are disabled', () => {
  renderFooter({ pendingOrder: PENDING, submittingOrder: true });

  expect(screen.getByRole('button', { name: /שולח הזמנה/ }).disabled).toBe(true);
  expect(screen.getByRole('button', { name: 'בטלו והתחילו מחדש' }).disabled).toBe(true);
});

test('the unknown-outcome message from the hook is shown above the notice', () => {
  renderFooter({ pendingOrder: PENDING, orderError: 'לא קיבלנו אישור מהשרת' });

  expect(screen.getByRole('alert').textContent).toContain('לא קיבלנו אישור מהשרת');
});
