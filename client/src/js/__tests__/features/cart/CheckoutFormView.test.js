/**
 * The checkout form's field limits: the form stops typing where the server would refuse the order
 * (order.validator: name 30, address 200, notes 1000), so the customer does not find out only after
 * sending. The `checkout` prop is a plain object, as StoreLayout hands it down.
 */
import { Provider } from 'react-redux';
import { render, screen } from '@testing-library/react';
import CheckoutFormView from '../../../features/cart/CheckoutFormView';
import { createAppStore } from '../../../store';

function renderForm(deliveryMethod) {
  const noop = jest.fn();
  const checkout = {
    customerName: '', setCustomerName: noop,
    customerPhone: '', setCustomerPhone: noop,
    customerEmail: '', setCustomerEmail: noop,
    deliveryAddress: '', setDeliveryAddress: noop,
    orderNotes: '', setOrderNotes: noop,
  };
  const store = createAppStore({
    cart: { items: [{ id: 1, name: 'צבע', price: 10, quantity: 1 }], deliveryMethod, priceChanges: [] },
    wishlist: { items: [] },
    availability: { unavailableIds: [], unavailableVariants: [], unavailableOptions: [] },
  });
  render(<Provider store={store}><CheckoutFormView setCartStep={noop} checkout={checkout} /></Provider>);
}

test('the notes field stops at 1000 characters', () => {
  renderForm('pickup');

  expect(screen.getByLabelText('הערות להזמנה').getAttribute('maxlength')).toBe('1000');
});

test('the delivery address field stops at 200 characters', () => {
  renderForm('delivery');

  expect(screen.getByLabelText(/כתובת למשלוח/).getAttribute('maxlength')).toBe('200');
});

test('the name field keeps its limit of 30', () => {
  renderForm('pickup');

  expect(screen.getByLabelText(/שם מלא/).getAttribute('maxlength')).toBe('30');
});
