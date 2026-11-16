/**
 * Characterization tests for the CSV side of useAdminProducts: how a chosen file is turned into
 * previewed rows and error lines (handleCsvFile), and the downloadable template. They were
 * written against the code as it stood inside the hook and stay unchanged when the parsing
 * moves to utils/productCsv.js (P3). The POSTs of the import itself are pinned in
 * useAdminProducts.test.js.
 *
 * Run with `npm run test:client` from the root.
 */
import { renderHook, act, waitFor } from '@testing-library/react';
import { useAdminProducts } from '../../hooks/useAdminProducts';
import { createAdminApi } from '../../services/adminService';

const adminApi = createAdminApi(() => {});
const HEADER = 'name,price,in_stock,sku,category,colors,description';
const BOM = String.fromCharCode(0xFEFF);

/** Renders the hook over a fake fetch whose product list is empty. */
async function setup() {
  global.fetch = jest.fn(() => Promise.resolve({ ok: true, status: 200, json: async () => [] }));
  const { result } = renderHook(() => useAdminProducts(adminApi));
  await waitFor(() => expect(result.current.productsLoaded).toBe(true));
  return result;
}

/** Feeds a CSV text to the hook the way the file input does and waits for the preview. */
async function chooseFile(result, text) {
  const input = { files: [new File([text], 'products.csv')], value: 'products.csv' };
  act(() => { result.current.handleCsvFile({ target: input }); });
  await waitFor(() => expect(result.current.csvPreview).not.toBeNull());
  return input;
}

afterEach(() => {
  delete global.fetch;
});

describe('handleCsvFile', () => {
  test('turns each valid line into a row: price as a number, in_stock false only for the word false, colors split', async () => {
    const result = await setup();

    await chooseFile(result, [
      HEADER,
      'מברשת,25,true,TT-001,painting,"לבן,שחור",איכותית',
      'סיליקון,18.5,false,,adhesives,,',
      'מסור,40,yes,TT-3,tools, כחול , ',
    ].join('\n'));

    expect(result.current.csvErrors).toEqual([]);
    expect(result.current.csvPreview).toEqual([
      { name: 'מברשת', price: 25, in_stock: true, sku: 'TT-001', category: 'painting', colors: ['לבן', 'שחור'], description: 'איכותית' },
      { name: 'סיליקון', price: 18.5, in_stock: false, sku: '', category: 'adhesives', colors: [], description: '' },
      { name: 'מסור', price: 40, in_stock: true, sku: 'TT-3', category: 'tools', colors: ['כחול'], description: '' },
    ]);
  });

  test('a comma inside quotes stays in the cell, and the quotes themselves are dropped', async () => {
    const result = await setup();

    await chooseFile(result, [HEADER, 'צבע,10,true,A,painting,,"עמיד, מהיר ייבוש"'].join('\n'));

    expect(result.current.csvPreview[0].description).toBe('עמיד, מהיר ייבוש');
  });

  test('empty lines are skipped but still count in the line numbers of the messages', async () => {
    const result = await setup();

    await chooseFile(result, [HEADER, '', ',5,true,A,painting,,', '  ', 'נעילה,x,true,B,locks,,'].join('\n'));

    expect(result.current.csvPreview).toEqual([]);
    expect(result.current.csvErrors).toEqual([
      'שורה 3: חסר שם',
      'שורה 5: מחיר לא תקין "x" — עד שתי ספרות אחרי הנקודה',
    ]);
  });

  test.each([
    ['a missing name', ',5,true,A,painting,,', 'שורה 2: חסר שם'],
    ['a price that is not a number', 'פריט,abc,true,A,painting,,', 'שורה 2: מחיר לא תקין "abc" — עד שתי ספרות אחרי הנקודה'],
    ['a price with three decimals', 'פריט,5.123,true,A,painting,,', 'שורה 2: מחיר לא תקין "5.123" — עד שתי ספרות אחרי הנקודה'],
    ['a missing price', 'פריט', 'שורה 2: מחיר לא תקין "" — עד שתי ספרות אחרי הנקודה'],
    ['an unknown category', 'פריט,5,true,A,toys,,', 'שורה 2: קטגוריה לא תקינה "toys"'],
    ['a missing category', 'פריט,5,true,A,,,', 'שורה 2: קטגוריה לא תקינה ""'],
  ])('%s is reported with its line and the line is left out', async (_label, line, message) => {
    const result = await setup();

    await chooseFile(result, [HEADER, line].join('\n'));

    expect(result.current.csvPreview).toEqual([]);
    expect(result.current.csvErrors).toEqual([message]);
  });

  test('valid and invalid lines can be mixed; errors keep their original line numbers', async () => {
    const result = await setup();

    await chooseFile(result, [HEADER, 'אחד,1,true,A,home,,', 'שניים,zzz,true,B,home,,', 'שלושה,3,true,C,home,,'].join('\n'));

    expect(result.current.csvPreview.map((r) => r.name)).toEqual(['אחד', 'שלושה']);
    expect(result.current.csvErrors).toEqual(['שורה 3: מחיר לא תקין "zzz" — עד שתי ספרות אחרי הנקודה']);
  });

  test.each([
    ['a header only', HEADER],
    ['an empty file', ''],
  ])('%s is reported as an empty file', async (_label, text) => {
    const result = await setup();

    await chooseFile(result, text);

    expect(result.current.csvPreview).toEqual([]);
    expect(result.current.csvErrors).toEqual(['קובץ ריק']);
  });

  test('clears the input value so the same file can be chosen again, and clears an earlier import result', async () => {
    const result = await setup();

    const input = await chooseFile(result, [HEADER, 'אחד,1,true,A,home,,'].join('\n'));

    expect(input.value).toBe('');
    expect(result.current.importResult).toBeNull();
  });

  test('choosing no file changes nothing', async () => {
    const result = await setup();

    act(() => { result.current.handleCsvFile({ target: { files: [], value: '' } }); });

    expect(result.current.csvPreview).toBeNull();
    expect(result.current.csvErrors).toEqual([]);
  });

  test('resetCsv clears the preview, the errors and the import result', async () => {
    const result = await setup();
    await chooseFile(result, [HEADER, 'אחד,x,true,A,home,,'].join('\n'));
    expect(result.current.csvErrors).toHaveLength(1);

    act(() => { result.current.resetCsv(); });

    expect(result.current.csvPreview).toBeNull();
    expect(result.current.csvErrors).toEqual([]);
    expect(result.current.importResult).toBeNull();
  });
});

describe('downloadTemplate', () => {
  const TEMPLATE_LINE = 'מברשת צבע 3 אינץ\',25,true,TT-001,painting,"לבן,שחור",מברשת איכותית';
  let blobParts;
  let clicked;
  let RealBlob;
  let realClick;

  beforeEach(() => {
    blobParts = [];
    clicked = [];
    RealBlob = global.Blob;
    global.Blob = class extends RealBlob {
      constructor(parts, options) {
        super(parts, options);
        blobParts.push({ parts, options });
      }
    };
    URL.createObjectURL = jest.fn(() => 'blob:fake');
    realClick = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function click() { clicked.push({ href: this.href, download: this.download }); };
  });

  afterEach(() => {
    global.Blob = RealBlob;
    HTMLAnchorElement.prototype.click = realClick;
    delete URL.createObjectURL;
  });

  test('downloads a BOM-prefixed example file with a header line and one example line', async () => {
    const result = await setup();

    result.current.downloadTemplate();

    expect(blobParts).toHaveLength(1);
    expect(blobParts[0].options).toEqual({ type: 'text/csv;charset=utf-8;' });
    expect(blobParts[0].parts).toEqual([BOM + HEADER + '\n' + TEMPLATE_LINE]);
    expect(clicked).toEqual([{ href: 'blob:fake', download: 'tamburia-template.csv' }]);
  });

  test('the example line is itself a valid line for the parser', async () => {
    const result = await setup();
    result.current.downloadTemplate();
    const template = blobParts[0].parts[0].replace(BOM, '');

    await chooseFile(result, template);

    expect(result.current.csvErrors).toEqual([]);
    expect(result.current.csvPreview).toEqual([
      { name: 'מברשת צבע 3 אינץ\'', price: 25, in_stock: true, sku: 'TT-001', category: 'painting', colors: ['לבן', 'שחור'], description: 'מברשת איכותית' },
    ]);
  });
});
