/**
 * Unit tests for utils/productCsv.js, called directly. The behavior through the hook (the file
 * input, the preview, the import) is pinned in hooks/useAdminProducts.csv.test.js; these cover
 * the parser and the template text on their own.
 *
 * Run with `npm run test:client` from the root.
 */
import { parseProductCsv, productCsvTemplate } from './productCsv';

const HEADER = 'name,price,in_stock,sku,category,colors,description';
const TEMPLATE_LINE = 'מברשת צבע 3 אינץ\',25,true,TT-001,painting,"לבן,שחור",מברשת איכותית';

test('parses valid lines into rows', () => {
  const { rows, errors } = parseProductCsv([HEADER, 'מברשת,25,true,TT-001,painting,"לבן,שחור",איכותית'].join('\n'));

  expect(errors).toEqual([]);
  expect(rows).toEqual([
    { name: 'מברשת', price: 25, in_stock: true, sku: 'TT-001', category: 'painting', colors: ['לבן', 'שחור'], description: 'איכותית' },
  ]);
});

test('reports a line with its 1-based line number and skips it', () => {
  const { rows, errors } = parseProductCsv([HEADER, 'א,1,true,A,home,,', ',2,true,B,home,,', 'ג,bad,true,C,home,,', 'ד,4,true,D,nope,,'].join('\n'));

  expect(rows.map((r) => r.name)).toEqual(['א']);
  expect(errors).toEqual([
    'שורה 3: חסר שם',
    'שורה 4: מחיר לא תקין "bad" — עד שתי ספרות אחרי הנקודה',
    'שורה 5: קטגוריה לא תקינה "nope"',
  ]);
});

test('a text with no lines after the header is an empty file', () => {
  expect(parseProductCsv(HEADER)).toEqual({ rows: [], errors: ['קובץ ריק'] });
  expect(parseProductCsv('')).toEqual({ rows: [], errors: ['קובץ ריק'] });
});

test('every category the admin offers is accepted', () => {
  const ids = ['painting', 'kitchen', 'bathroom', 'tools', 'cleaning', 'garden', 'plumbing', 'adhesives', 'locks', 'faucets', 'electrical', 'home'];

  const { rows, errors } = parseProductCsv([HEADER, ...ids.map((id) => `x,1,true,,${id},,`)].join('\n'));

  expect(errors).toEqual([]);
  expect(rows.map((r) => r.category)).toEqual(ids);
});

test('the template starts with a BOM, has the header and one example line', () => {
  const template = productCsvTemplate();

  expect(template.charCodeAt(0)).toBe(0xFEFF);
  expect(template.slice(1).split('\n')).toEqual([HEADER, TEMPLATE_LINE]);
});

test('the example line of the template parses without errors', () => {
  const { rows, errors } = parseProductCsv(productCsvTemplate().slice(1));

  expect(errors).toEqual([]);
  expect(rows).toHaveLength(1);
});
