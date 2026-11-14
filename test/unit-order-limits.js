/**
 * The length limits of an order (P8.1 step C): notes 1000 characters, delivery address 200, item
 * name 255. They apply when an order is created and when an admin edits one, and a value exactly at
 * the limit is accepted. No network and no database.
 */
const { parseCreate, parseUpdate } = require('../server/api/order/order.validator');

let passed = 0;
let failed = 0;

/** Records the result of one check. */
function check(name, condition, actual) {
  if (condition) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    console.log(`  ✗ ${name} — got: ${JSON.stringify(actual)}`);
  }
}

/** Runs fn; returns the error it threw, or null. */
function thrown(fn) {
  try {
    fn();
    return null;
  } catch (err) {
    return err;
  }
}

const item = (overrides = {}) => ({ id: 1, name: 'Brush', price: 10, quantity: 1, ...overrides });
const order = (overrides = {}) => ({
  delivery_method: 'pickup', customer_name: 'Dana', customer_phone: '0501234567', items: [item()], ...overrides,
});
const delivery = (overrides = {}) => order({ delivery_method: 'delivery', delivery_address: 'הרצל 1, פתח תקווה', ...overrides });

/** True when fn throws a 400 whose message names the field and its limit. */
function refusedFor(fn, field, limit) {
  const err = thrown(fn);
  return Boolean(err) && err.status === 400 && err.message.includes(field) && err.message.includes(String(limit));
}

console.log('\n── notes: 1000');
check('1000 characters are accepted', parseCreate(order({ notes: 'x'.repeat(1000) })).notes.length === 1000);
check('1001 characters → 400 naming the field and the limit',
  refusedFor(() => parseCreate(order({ notes: 'x'.repeat(1001) })), 'notes', 1000), (thrown(() => parseCreate(order({ notes: 'x'.repeat(1001) }))) || {}).message);
check('the limit counts the trimmed text (spaces around it do not count)',
  parseCreate(order({ notes: `  ${'x'.repeat(1000)}  ` })).notes.length === 1000);
check('no notes, null and blank notes are still allowed',
  parseCreate(order()).notes === null && parseCreate(order({ notes: null })).notes === null && parseCreate(order({ notes: '   ' })).notes === null);
check('an admin edit: 1000 accepted, 1001 → 400',
  parseUpdate({ notes: 'x'.repeat(1000) }).notes.length === 1000 && refusedFor(() => parseUpdate({ notes: 'x'.repeat(1001) }), 'notes', 1000));

console.log('\n── delivery_address: 200');
check('200 characters are accepted', parseCreate(delivery({ delivery_address: `פתח תקווה ${'x'.repeat(190)}` })).delivery_address.length === 200);
check('201 characters → 400 naming the field and the limit',
  refusedFor(() => parseCreate(delivery({ delivery_address: `פתח תקווה ${'x'.repeat(191)}` })), 'delivery_address', 200));
check('a pickup order sends no address, so the limit never applies to it',
  parseCreate(order({ delivery_address: 'x'.repeat(5000) })).delivery_address === null);
check('an admin edit: 200 accepted, 201 → 400',
  parseUpdate({ delivery_address: `פתח תקווה ${'x'.repeat(190)}` }).delivery_address.length === 200
  && refusedFor(() => parseUpdate({ delivery_address: `פתח תקווה ${'x'.repeat(191)}` }), 'delivery_address', 200));

console.log('\n── items[].name: 255');
check('255 characters are accepted', parseCreate(order({ items: [item({ name: 'x'.repeat(255) })] })).items[0].name.length === 255);
check('256 characters → 400 naming the item and the limit',
  refusedFor(() => parseCreate(order({ items: [item({ name: 'x'.repeat(256) })] })), 'items[0].name', 255));
check('the second line is named by its own index',
  refusedFor(() => parseCreate(order({ items: [item(), item({ name: 'x'.repeat(256) })] })), 'items[1].name', 255));
check('an empty name is still refused as missing',
  (thrown(() => parseCreate(order({ items: [item({ name: '  ' })] }))) || {}).message === 'items[0].name חסר');

console.log('\n── what did not change');
check('name 30, phone and email limits are the same',
  refusedFor(() => parseCreate(order({ customer_name: 'x'.repeat(31) })), 'customer_name', 30)
  && refusedFor(() => parseCreate(order({ customer_phone: `05${'1'.repeat(60)}` })), 'customer_phone', 50)
  && refusedFor(() => parseCreate(order({ customer_email: `${'x'.repeat(200)}@example.com` })), 'customer_email', 200));
check('a normal order parses as before', (() => {
  const data = parseCreate(delivery({ notes: 'להתקשר לפני', customer_email: 'dana@example.com' }));
  return data.customer_name === 'Dana' && data.notes === 'להתקשר לפני' && data.items.length === 1 && data.status === 'new';
})());

console.log(`\n${failed === 0 ? '✓' : '✗'} passed ${passed}, failed ${failed}`);
process.exitCode = failed === 0 ? 0 : 1;
