/**
 * The portfolio demo's checkout (plan 006, Phase 4): the fields are filled by a button from the three
 * fictional identities and cannot be typed, the free-text notes are not offered, and the submit area
 * says nothing is processed. The real store's checkout is unchanged (CheckoutFormView.test.js).
 */
import '@testing-library/jest-dom';
import { Provider } from 'react-redux';
import { useState } from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import CheckoutFormView, { CheckoutFormFooter } from '../../../features/cart/CheckoutFormView';
import { createAppStore } from '../../../store';
import { resetDemoModeForTests } from '../../../hooks/useDemoMode';
import { getDemoInfo } from '../../../services/demoService';

jest.mock('../../../services/demoService');

const IDENTITIES = [
  { key: 'demo-1', customer_name: 'דנה דמו', customer_phone: '050-0000011', customer_email: 'dana.demo@example.invalid', delivery_address: 'רחוב הדגמה 1, פתח תקווה' },
  { key: 'demo-2', customer_name: 'יוסי דוגמה', customer_phone: '050-0000012', customer_email: 'yossi.example@example.invalid', delivery_address: 'שדרות לדוגמה 2, קריית אונו' },
];

/** The form with real state behind it, as StoreLayout holds it. */
function Harness({ deliveryMethod, onSnapshot }) {
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [orderNotes, setOrderNotes] = useState('');
  const checkout = {
    customerName, setCustomerName, customerPhone, setCustomerPhone, customerEmail, setCustomerEmail,
    deliveryAddress, setDeliveryAddress, orderNotes, setOrderNotes,
    submittingOrder: false, handlePlaceOrder: jest.fn(), orderError: '', pendingOrder: null,
  };
  onSnapshot({ customerName, customerPhone, customerEmail, deliveryAddress, orderNotes });
  const store = createAppStore({
    cart: { items: [{ id: 1, name: 'צבע', price: 10, quantity: 1 }], deliveryMethod, priceChanges: [] },
    wishlist: { items: [] },
    availability: { unavailableIds: [], unavailableVariants: [], unavailableOptions: [] },
  });
  return (
    <Provider store={store}>
      <CheckoutFormView setCartStep={() => {}} checkout={checkout} />
      <CheckoutFormFooter checkout={checkout} />
    </Provider>
  );
}

let latest;
const renderForm = (deliveryMethod = 'delivery') => render(<Harness deliveryMethod={deliveryMethod} onSnapshot={(s) => { latest = s; }} />);

beforeEach(() => {
  resetDemoModeForTests();
  getDemoInfo.mockReset();
});

describe('in the demo', () => {
  beforeEach(() => getDemoInfo.mockResolvedValue({ demo: true, identities: IDENTITIES }));

  test('"מילוי פרטי הדגמה" fills the name, phone, email and address from an identity', async () => {
    renderForm('delivery');

    fireEvent.click(await screen.findByRole('button', { name: 'מילוי פרטי הדגמה' }));

    expect(latest).toMatchObject({
      customerName: 'דנה דמו', customerPhone: '050-0000011', customerEmail: 'dana.demo@example.invalid',
      deliveryAddress: 'רחוב הדגמה 1, פתח תקווה', orderNotes: '',
    });
    expect(screen.getByLabelText(/שם מלא/)).toHaveValue('דנה דמו');
    expect(screen.getByRole('status')).toHaveTextContent('דנה דמו');
  });

  test('each click moves to the next identity, and wraps around', async () => {
    renderForm('delivery');
    const button = await screen.findByRole('button', { name: 'מילוי פרטי הדגמה' });

    fireEvent.click(button);
    fireEvent.click(button);
    expect(latest.customerName).toBe('יוסי דוגמה');
    expect(latest.deliveryAddress).toBe('שדרות לדוגמה 2, קריית אונו');

    fireEvent.click(button);
    expect(latest.customerName).toBe('דנה דמו');
  });

  test('the detail fields are read-only', async () => {
    renderForm('delivery');
    await screen.findByRole('button', { name: 'מילוי פרטי הדגמה' });

    for (const label of [/שם מלא/, /טלפון/, /אימייל/, /כתובת למשלוח/]) {
      expect(screen.getByLabelText(label)).toHaveAttribute('readonly');
    }
  });

  test('there is no free-text notes field', async () => {
    renderForm('pickup');
    await screen.findByRole('button', { name: 'מילוי פרטי הדגמה' });

    expect(screen.queryByLabelText('הערות להזמנה')).not.toBeInTheDocument();
  });

  test('a notice under the submit button says nothing is processed, shipped, charged or emailed', async () => {
    renderForm('pickup');

    expect(await screen.findByText(/הזמנת הדגמה: לא תטופל/)).toHaveTextContent('לא ייגבה תשלום');
    expect(screen.getByRole('button', { name: /שלח הזמנה/ })).toBeInTheDocument();
  });
});

describe('on the real store', () => {
  beforeEach(() => getDemoInfo.mockResolvedValue({ demo: false }));

  test('no fill button, editable fields, the notes field, and no demo notice', async () => {
    renderForm('delivery');
    await waitFor(() => expect(getDemoInfo).toHaveBeenCalled());

    expect(screen.queryByRole('button', { name: 'מילוי פרטי הדגמה' })).not.toBeInTheDocument();
    expect(screen.getByLabelText(/שם מלא/)).not.toHaveAttribute('readonly');
    expect(screen.getByLabelText('הערות להזמנה')).toBeInTheDocument();
    expect(screen.queryByText(/הזמנת הדגמה/)).not.toBeInTheDocument();
  });
});
