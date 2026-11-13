/**
 * Tests for the paint calculator, through the rendered component and a fake fetch: what the
 * visitor types and clicks in, and the numbers, texts and cart call that come out. They pin
 * today's results (area, liters, buckets, pigment bottles, the bundle) so the calculation can
 * be moved out of the component without changing any of them.
 *
 * The three bundle products are fetched by the hard-coded ids 627, 628 and 416 (BF-03); the
 * fake serves them and the tests record how a missing or out-of-stock product is handled.
 *
 * Run with `npm run test:client` from the root.
 */
import '@testing-library/jest-dom';
import { render, screen, fireEvent, waitFor, act, within } from '@testing-library/react';
import PaintCalculator from '../../../features/calculators/PaintCalculator';
import { formatPrice } from '../../../utils/pricing';

const RED = {
  color_code: 'A1', color_name_he: 'אדום', hex: '#ff0000',
  ml_per_liter_light: 25, ml_per_liter_medium: 50, ml_per_liter_dark: 100,
};
const BLUE = {
  color_code: 'B2', color_name_he: 'כחול', hex: '#0000ff',
  ml_per_liter_light: 10, ml_per_liter_medium: 20, ml_per_liter_dark: 40,
};
const PAINT5 = { id: 627, name: "צבע לבן 5 ל'", price: 100, in_stock: true };
const PAINT18 = { id: 628, name: "צבע לבן 18 ל'", price: 250, in_stock: true };
const MIX = { id: 416, name: 'קולור MIX', price: 40, in_stock: true };

/** A fetch response. */
const reply = (status, body) => Promise.resolve({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body,
});

let formulasReply;
let productReplies;
let addBundleToCart;

const productCalls = () => global.fetch.mock.calls.filter(([url]) => /^\/api\/products\/\d+$/.test(url));

beforeEach(() => {
  formulasReply = () => reply(200, [RED, BLUE]);
  productReplies = { 627: PAINT5, 628: PAINT18, 416: MIX };
  addBundleToCart = jest.fn();
  global.fetch = jest.fn((url) => {
    if (url === '/api/pigment-formulas') return formulasReply();
    const match = /^\/api\/products\/(\d+)$/.exec(url);
    if (match) {
      const product = productReplies[match[1]];
      return product ? reply(200, product) : reply(404, { error: 'לא נמצא' });
    }
    throw new Error(`unexpected request: ${url}`);
  });
});

afterEach(() => {
  delete global.fetch;
});

/** Renders the calculator and waits until the formulas and the three products have arrived. */
async function setup({ withCart = true, expectFormulas = true } = {}) {
  const view = render(<PaintCalculator addBundleToCart={withCart ? addBundleToCart : undefined} />);
  if (expectFormulas) await screen.findByTitle('אדום');
  await waitFor(() => expect(productCalls()).toHaveLength(3));
  await act(async () => {});
  return view;
}

const typeWall = (n, length, height) => {
  fireEvent.change(screen.getByLabelText(`אורך קיר ${n}, במטרים`), { target: { value: String(length) } });
  fireEvent.change(screen.getByLabelText(`גובה קיר ${n}, במטרים`), { target: { value: String(height) } });
};
const calculateButton = () => screen.getByRole('button', { name: /חשב כמות צבע/ });
const calculate = () => fireEvent.click(calculateButton());
const addWindow = () => fireEvent.click(screen.getAllByRole('button', { name: '+' })[0]);
const addDoor = () => fireEvent.click(screen.getAllByRole('button', { name: '+' })[1]);
const chooseCoats = (n) => fireEvent.click(screen.getByRole('button', { name: new RegExp(`^${n} ציפוי`) }));
const chooseShade = (label) => fireEvent.click(screen.getByRole('button', { name: label }));
const bundleButton = () => screen.queryByRole('button', { name: /הוסף חבילה לעגלה|נוסף לעגלה/ });

/** The text of a result tile, found by its label. */
const tile = (label) => screen.getByText(label).closest('.paint-result-item');

describe('the area and the paint', () => {
  test('the calculate button is disabled until a wall has both a length and a height', async () => {
    await setup();
    expect(calculateButton()).toBeDisabled();

    fireEvent.change(screen.getByLabelText('אורך קיר 1, במטרים'), { target: { value: '5' } });
    expect(calculateButton()).toBeDisabled();

    fireEvent.change(screen.getByLabelText('גובה קיר 1, במטרים'), { target: { value: '2.5' } });
    expect(calculateButton()).toBeEnabled();
  });

  test('one wall, two coats (the default): area, net area and liters', async () => {
    await setup();
    typeWall(1, 5, 2.5);

    calculate();

    expect(within(tile('שטח נטו לצביעה')).getByText('12.5 מ"ר')).toBeInTheDocument();
    expect(within(tile('שטח נטו לצביעה')).getByText('(סה"כ 12.5 מ"ר פחות פתחים)')).toBeInTheDocument();
    expect(within(tile('צבע לבן')).getByText('2.5 ליטר')).toBeInTheDocument();
  });

  test('several walls add up, and a wall missing one dimension adds nothing', async () => {
    await setup();
    fireEvent.click(screen.getByRole('button', { name: '+ הוסף קיר' }));
    fireEvent.click(screen.getByRole('button', { name: '+ הוסף קיר' }));
    typeWall(1, 4, 2.5);
    typeWall(2, 3, 2);
    fireEvent.change(screen.getByLabelText('אורך קיר 3, במטרים'), { target: { value: '9' } });

    calculate();

    expect(within(tile('שטח נטו לצביעה')).getByText('(סה"כ 16.0 מ"ר פחות פתחים)')).toBeInTheDocument();
    expect(within(tile('שטח נטו לצביעה')).getByText('16.0 מ"ר')).toBeInTheDocument();
  });

  test('each window takes 1.5 m² and each door 2 m² off the area', async () => {
    await setup();
    typeWall(1, 5, 2.5);
    addWindow();
    addWindow();
    addDoor();

    calculate();

    expect(within(tile('שטח נטו לצביעה')).getByText('7.5 מ"ר')).toBeInTheDocument();
    expect(within(tile('שטח נטו לצביעה')).getByText('(סה"כ 12.5 מ"ר פחות פתחים)')).toBeInTheDocument();
    expect(within(tile('צבע לבן')).getByText('1.5 ליטר')).toBeInTheDocument();
  });

  test('openings larger than the walls leave a net area of zero, never a negative one', async () => {
    await setup();
    typeWall(1, 1, 1);
    addDoor();
    addDoor();

    calculate();

    expect(within(tile('שטח נטו לצביעה')).getByText('0.0 מ"ר')).toBeInTheDocument();
    expect(within(tile('צבע לבן')).getByText('0 ליטר')).toBeInTheDocument();
  });

  test.each([
    [1, '1.3 ליטר'],
    [2, '2.5 ליטר'],
    [3, '3.8 ליטר'],
  ])('%s coat(s) over 12.5 m² need %s (liters rounded up to one decimal)', async (coats, liters) => {
    await setup();
    typeWall(1, 5, 2.5);
    chooseCoats(coats);

    calculate();

    expect(within(tile('צבע לבן')).getByText(liters)).toBeInTheDocument();
  });

  test('the results change only when the calculate button is pressed again', async () => {
    await setup();
    typeWall(1, 5, 2.5);
    calculate();
    expect(within(tile('צבע לבן')).getByText('2.5 ליטר')).toBeInTheDocument();

    typeWall(1, 10, 2.5);
    expect(within(tile('צבע לבן')).getByText('2.5 ליטר')).toBeInTheDocument();

    calculate();
    expect(within(tile('צבע לבן')).getByText('5 ליטר')).toBeInTheDocument();
  });
});

describe('walls, windows and doors controls', () => {
  test('at most six walls can be added', async () => {
    await setup();
    for (let i = 0; i < 8; i += 1) {
      const add = screen.queryByRole('button', { name: '+ הוסף קיר' });
      if (add) fireEvent.click(add);
    }

    expect(screen.getAllByLabelText(/^אורך קיר/)).toHaveLength(6);
    expect(screen.queryByRole('button', { name: '+ הוסף קיר' })).not.toBeInTheDocument();
  });

  test('a wall can be removed, but the last one cannot', async () => {
    await setup();
    expect(screen.queryByRole('button', { name: /הסר את קיר/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '+ הוסף קיר' }));
    typeWall(1, 4, 2);
    typeWall(2, 3, 3);

    fireEvent.click(screen.getByRole('button', { name: 'הסר את קיר 1' }));

    expect(screen.getAllByLabelText(/^אורך קיר/)).toHaveLength(1);
    expect(screen.getByLabelText('אורך קיר 1, במטרים')).toHaveValue(3);
    expect(screen.queryByRole('button', { name: /הסר את קיר/ })).not.toBeInTheDocument();
  });

  test('the window and door counters never go below zero', async () => {
    await setup();
    const minus = screen.getAllByRole('button', { name: '−' });

    fireEvent.click(minus[0]);
    fireEvent.click(minus[1]);
    typeWall(1, 5, 2.5);
    calculate();

    expect(within(tile('שטח נטו לצביעה')).getByText('12.5 מ"ר')).toBeInTheDocument();
  });
});

describe('the pigment (Color MIX)', () => {
  /** 10 × 5 m wall, two coats: exactly 10 liters. */
  const tenLiters = () => { typeWall(1, 10, 5); };

  test('the first formula and the medium shade are selected, and the dose is shown', async () => {
    await setup();

    expect(screen.getByText(/מינון:/).closest('.paint-preview-note')).toHaveTextContent(
      'מינון: 50 מ"ל לכל ליטר צבע לבן · בקבוק 250מ"ל מכסה 5 ליטר'
    );
    expect(screen.getByText('תצוגה מקדימה').parentElement).toHaveTextContent('אדום — בינוני');
  });

  test.each([
    ['בהיר', 1],
    ['בינוני', 2],
    ['כהה', 4],
  ])('10 liters of the first formula in the %s shade need %s bottle(s) of 250 ml', async (shade, bottles) => {
    await setup();
    tenLiters();
    chooseShade(shade);

    calculate();

    expect(within(tile('קולור MIX יעקבי 250מ"ל')).getByText(`${bottles} בקבוק`)).toBeInTheDocument();
    expect(within(tile('קולור MIX יעקבי 250מ"ל')).getByText(`אדום — ${shade}`)).toBeInTheDocument();
  });

  test('another color uses its own dose', async () => {
    await setup();
    tenLiters();
    fireEvent.click(screen.getByTitle('כחול'));

    calculate();

    expect(within(tile('קולור MIX יעקבי 250מ"ל')).getByText('1 בקבוק')).toBeInTheDocument();
    expect(within(tile('קולור MIX יעקבי 250מ"ל')).getByText('כחול — בינוני')).toBeInTheDocument();
  });

  test('changing the shade after calculating does not change the numbers until the next calculation', async () => {
    await setup();
    tenLiters();
    calculate();
    expect(within(tile('קולור MIX יעקבי 250מ"ל')).getByText('2 בקבוק')).toBeInTheDocument();

    chooseShade('כהה');
    expect(within(tile('קולור MIX יעקבי 250מ"ל')).getByText('2 בקבוק')).toBeInTheDocument();

    calculate();
    expect(within(tile('קולור MIX יעקבי 250מ"ל')).getByText('4 בקבוק')).toBeInTheDocument();
  });

  test('without formulas there is no color card and no bottles', async () => {
    formulasReply = () => reply(200, []);
    await setup({ expectFormulas: false });
    typeWall(1, 10, 5);

    calculate();

    expect(screen.queryByText(/בחרו גוון/)).not.toBeInTheDocument();
    expect(within(tile('קולור MIX יעקבי 250מ"ל')).getByText('0 בקבוק')).toBeInTheDocument();
    expect(within(tile('קולור MIX יעקבי 250מ"ל')).getByText('לפי הגוון שתבחרו')).toBeInTheDocument();
  });

  test.each([
    ['a server failure', () => reply(500, { error: 'שגיאת שרת' })],
    ['an answer that is not an array', () => reply(200, { formulas: [RED] })],
    ['a network failure', () => Promise.reject(new TypeError('Failed to fetch'))],
  ])('%s while loading the formulas behaves like no formulas', async (_label, failing) => {
    formulasReply = failing;
    await setup({ expectFormulas: false });
    typeWall(1, 10, 5);

    calculate();

    expect(screen.queryByText(/בחרו גוון/)).not.toBeInTheDocument();
    expect(within(tile('קולור MIX יעקבי 250מ"ל')).getByText('0 בקבוק')).toBeInTheDocument();
  });
});

describe('loading', () => {
  test('requests the formulas and the three hard-coded bundle products', async () => {
    await setup();

    const urls = global.fetch.mock.calls.map(([url]) => url).sort();
    expect(urls).toEqual(['/api/pigment-formulas', '/api/products/416', '/api/products/627', '/api/products/628']);
  });
});

describe('the bundle', () => {
  /** 10 × 15 m wall, two coats, medium shade: 30 liters, 6 × 5 L or 2 × 18 L, 6 bottles. */
  const thirtyLiters = () => { typeWall(1, 10, 15); };

  test('offers the cheaper bucket size for the whole quantity, with the Color MIX bottles and the total', async () => {
    await setup();
    thirtyLiters();

    calculate();

    // 2 × 250 = 500 beats 6 × 100 = 600
    expect(within(tile('צבע לבן')).getByText("דלי 18 ל' × 2")).toBeInTheDocument();
    expect(bundleButton()).toHaveTextContent(
      `הוסף חבילה לעגלה — 2 דלי 18 ל' + 6 בקבוק קולור MIX · ${formatPrice(2 * 250 + 6 * 40)}`
    );
  });

  test('the 5 liter bucket is chosen when it is cheaper', async () => {
    productReplies[627] = { ...PAINT5, price: 50 };
    await setup();
    thirtyLiters();

    calculate();

    expect(within(tile('צבע לבן')).getByText("דלי 5 ל' × 6")).toBeInTheDocument();
    expect(bundleButton()).toHaveTextContent(`6 דלי 5 ל' + 6 בקבוק קולור MIX · ${formatPrice(6 * 50 + 6 * 40)}`);
  });

  test('a tie goes to the 5 liter bucket', async () => {
    productReplies[627] = { ...PAINT5, price: 150 };
    productReplies[628] = { ...PAINT18, price: 450 };
    await setup();
    thirtyLiters();

    calculate();

    expect(within(tile('צבע לבן')).getByText("דלי 5 ל' × 6")).toBeInTheDocument();
  });

  test('adding the bundle sends the real products with their quantities, then shows it was added', async () => {
    await setup();
    thirtyLiters();
    calculate();

    fireEvent.click(bundleButton());

    expect(addBundleToCart).toHaveBeenCalledTimes(1);
    expect(addBundleToCart).toHaveBeenCalledWith([
      { ...PAINT18, quantity: 2 },
      { ...MIX, quantity: 6 },
    ]);
    expect(bundleButton()).toHaveTextContent('נוסף לעגלה!');
    expect(bundleButton()).toBeDisabled();
  });

  test('changing any input after adding re-enables the bundle', async () => {
    await setup();
    thirtyLiters();
    calculate();
    fireEvent.click(bundleButton());
    expect(bundleButton()).toBeDisabled();

    chooseShade('כהה');

    expect(bundleButton()).toBeEnabled();
    expect(bundleButton()).toHaveTextContent('הוסף חבילה לעגלה');
  });

  test('there is no bundle button when the calculator is given no addBundleToCart', async () => {
    await setup({ withCart: false });
    thirtyLiters();

    calculate();

    expect(bundleButton()).not.toBeInTheDocument();
    expect(screen.queryByText(/אינם זמינים להזמנה/)).not.toBeInTheDocument();
  });

  test('a bucket product that is out of stock is skipped', async () => {
    productReplies[628] = { ...PAINT18, in_stock: false };
    await setup();
    thirtyLiters();

    calculate();

    expect(within(tile('צבע לבן')).getByText("דלי 5 ל' × 6")).toBeInTheDocument();
    fireEvent.click(bundleButton());
    expect(addBundleToCart).toHaveBeenCalledWith([
      { ...PAINT5, quantity: 6 },
      { ...MIX, quantity: 6 },
    ]);
  });

  test('a missing Color MIX product stays out of the cart and a tip says some items are unavailable', async () => {
    delete productReplies[416];
    await setup();
    thirtyLiters();

    calculate();

    expect(screen.getByText(/אינם זמינים להזמנה/)).toBeInTheDocument();
    fireEvent.click(bundleButton());
    expect(addBundleToCart).toHaveBeenCalledWith([{ ...PAINT18, quantity: 2 }]);
  });

  test('when both bucket sizes are missing the recommendation stays on screen, only the pigment can be added', async () => {
    delete productReplies[627];
    delete productReplies[628];
    await setup();
    thirtyLiters();

    calculate();

    expect(within(tile('צבע לבן')).getByText("דלי 5 ל' × 6")).toBeInTheDocument();
    expect(screen.getByText(/אינם זמינים להזמנה/)).toBeInTheDocument();
    fireEvent.click(bundleButton());
    expect(addBundleToCart).toHaveBeenCalledWith([{ ...MIX, quantity: 6 }]);
  });

  test('when no bundle product exists there is no bundle button, only the tip', async () => {
    productReplies = {};
    await setup();
    thirtyLiters();

    calculate();

    expect(bundleButton()).not.toBeInTheDocument();
    expect(screen.getByText(/אינם זמינים להזמנה/)).toBeInTheDocument();
  });

  test('with zero bottles the bundle holds only the paint', async () => {
    formulasReply = () => reply(200, []);
    await setup({ expectFormulas: false });
    thirtyLiters();

    calculate();

    fireEvent.click(bundleButton());
    expect(addBundleToCart).toHaveBeenCalledWith([{ ...PAINT18, quantity: 2 }]);
  });
});
