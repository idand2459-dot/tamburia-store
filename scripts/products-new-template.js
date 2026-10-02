/**
 * מייצר את גיליון האקסל שבו ממלאים את פרטי המוצרים החדשים.
 *
 *   npm run products:new-template
 *
 * מקור: photos/processed/new/*.webp — כל צילום של מוצר שלא היה
 *       ברשימה המודפסת, כלומר לא היה בקטלוג.
 * יעד:  design-assets/new-products.xlsx
 *
 * שורה אחת לכל תמונה, עם עמודת "קובץ תמונה" כבר מלאה ונעולה: היא
 * מה שמקשר בין השורה לצילום, ושינוי שלה היה מנתק אותם. כל השאר ריק
 * וממתין למילוי.
 *
 * הקטגוריה ותת-הקטגוריה הן רשימות נפתחות שנגזרות מעץ הקטגוריות של
 * החנות, כדי שלא יוקלד שם שאינו קיים. הרשימות יושבות בגיליון שלישי
 * מוסתר, כי אימות נתונים באקסל מוגבל ל-255 תווים כשהרשימה כתובה
 * בתוכו — ו-85 שמות תתי-קטגוריות בעברית עוברים את זה פי כמה.
 *
 * הסקריפט אינו כותב למסד ואינו נוגע בתמונות. המילוי עובר אחר כך
 * דרך npm run products:import-new, שמאמת כל שורה לפני שהוא יוצר.
 */
const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');
const { load: loadCategories } = require('./lib/categories');

const ROOT = path.join(__dirname, '..');
const NEW_DIR = path.join(ROOT, 'photos', 'processed', 'new');
const OUT_PATH = path.join(ROOT, 'design-assets', 'new-products.xlsx');

const SHEET = 'מוצרים חדשים';
const HELP_SHEET = 'הוראות';
const LISTS_SHEET = 'רשימות';

/**
 * העמודות, בסדר שבו ממלאים אותן.
 *
 * width הוא ברוחב תווים של אקסל. הוא נדיב יותר לשדות שכותבים בהם
 * משפט — שם ותיאור — כי עמודה צרה בעברית נראית כמו טעות ולא כמו
 * טקסט שנמשך.
 */
const COLUMNS = [
  { key: 'image', header: 'קובץ תמונה', width: 26, locked: true },
  { key: 'name', header: 'שם', width: 34 },
  { key: 'category', header: 'קטגוריה', width: 18 },
  { key: 'subcategory', header: 'תת-קטגוריה', width: 20 },
  { key: 'price', header: 'מחיר', width: 10 },
  { key: 'variants', header: 'גדלים ומחירים', width: 26 },
  { key: 'colors', header: 'צבעים', width: 22 },
  { key: 'sku', header: 'מק"ט', width: 14 },
  { key: 'description', header: 'תיאור', width: 40 },
  { key: 'illustrative', header: 'תמונה להמחשה (כן/לא)', width: 22 },
  { key: 'inStock', header: 'במלאי (כן/לא)', width: 16 },
];

/** ההסבר לכל עמודה, ומה ייכתב בה בשורת הדוגמה. */
const HELP = [
  {
    column: 'קובץ תמונה',
    what: 'שם קובץ הצילום. מולא מראש ונעול — הוא מה שמקשר בין השורה לתמונה.',
    example: 'new-מברשת-כחולה.webp',
  },
  {
    column: 'שם',
    what: 'שם המוצר כפי שיופיע בחנות. חובה.',
    example: 'מברשת צבע 3 אינץ\'',
  },
  {
    column: 'קטגוריה',
    what: 'נבחרת מהרשימה הנפתחת. חובה.',
    example: 'מוצרי צביעה',
  },
  {
    column: 'תת-קטגוריה',
    what: 'נבחרת מהרשימה הנפתחת, וחייבת להיות שייכת לקטגוריה שנבחרה. אפשר להשאיר ריק.',
    example: 'אביזרי צביעה',
  },
  {
    column: 'מחיר',
    what: 'מספר שלם בשקלים. אפשר להשאיר ריק רק אם מילאת "גדלים ומחירים".',
    example: '25',
  },
  {
    column: 'גדלים ומחירים',
    what: 'למוצר שנמכר בכמה מידות במחירים שונים. הצורה: גודל:מחיר, מופרדים בנקודה-פסיק. '
      + 'כל מחיר גדול מאפס, וכל תווית מופיעה פעם אחת. כשיש גדלים, מחיר המוצר הוא הזול שבהם.',
    example: '3 מטר:25; 5 מטר:35',
  },
  {
    column: 'צבעים',
    what: 'שמות הצבעים שהמוצר נמכר בהם, מופרדים בנקודה-פסיק. הגוון נגזר מהשם אוטומטית, '
      + 'ואפשר לדייק אותו אחר כך בטופס המוצר.',
    example: 'אדום; חום אגוז',
  },
  {
    column: 'מק"ט',
    what: 'המק"ט של החנות. אפשר להשאיר ריק.',
    example: 'TT-104',
  },
  {
    column: 'תיאור',
    what: 'משפט או שניים שמופיעים בעמוד המוצר. אפשר להשאיר ריק.',
    example: 'מברשת סינתטית לצבעי מים ולצבעי שמן',
  },
  {
    column: 'תמונה להמחשה (כן/לא)',
    what: 'כן כשהתמונה מדגימה את סוג המוצר ולא את הפריט המדויק (למשל מוצר שמגיע בכמה גוונים). '
      + 'ריק = לא.',
    example: 'לא',
  },
  {
    column: 'במלאי (כן/לא)',
    what: 'ריק = כן. "לא" מסמן מוצר שאזל, והוא יוצג בחנות אבל לא יהיה ניתן להזמנה.',
    example: 'כן',
  },
];

/** מחזיר את קבצי ה-new-*.webp שממתינים, לפי סדר האלפבית. */
function newImages() {
  if (!fs.existsSync(NEW_DIR)) return [];
  return fs.readdirSync(NEW_DIR)
    .filter((file) => /^new-.+\.webp$/i.test(file))
    .sort((a, b) => a.localeCompare(b, 'he'));
}

/**
 * בונה את גיליון הרשימות שהתפריטים הנפתחים מצביעים אליו.
 *
 * הוא מוסתר כי הוא תשתית ולא נתונים: מי שממלא את הטופס לא אמור
 * לראות אותו, ובוודאי לא לערוך אותו.
 */
function buildLists(workbook, taxonomy) {
  const sheet = workbook.addWorksheet(LISTS_SHEET, {
    views: [{ rightToLeft: true }],
    state: 'veryHidden',
  });

  const categories = taxonomy.categories.map((category) => category.name);
  const subcategories = taxonomy.categories.flatMap(
    (category) => category.subcategories.map((sub) => sub.name)
  );

  sheet.getColumn(1).width = 26;
  sheet.getColumn(2).width = 26;
  sheet.getCell('A1').value = 'קטגוריות';
  sheet.getCell('B1').value = 'תתי-קטגוריות';

  categories.forEach((name, i) => { sheet.getCell(`A${i + 2}`).value = name; });
  subcategories.forEach((name, i) => { sheet.getCell(`B${i + 2}`).value = name; });

  return {
    categories: `${LISTS_SHEET}!$A$2:$A$${categories.length + 1}`,
    subcategories: `${LISTS_SHEET}!$B$2:$B$${subcategories.length + 1}`,
    yesNo: '"כן,לא"',
  };
}

/** בונה את גיליון ההוראות. */
function buildHelp(workbook, imageCount) {
  const sheet = workbook.addWorksheet(HELP_SHEET, { views: [{ rightToLeft: true }] });

  sheet.getColumn(1).width = 24;
  sheet.getColumn(2).width = 86;
  sheet.getColumn(3).width = 34;

  sheet.mergeCells('A1:C1');
  const title = sheet.getCell('A1');
  title.value = 'מוצרים חדשים מיום הצילומים — איך ממלאים';
  title.font = { bold: true, size: 14 };
  title.alignment = { vertical: 'middle' };
  sheet.getRow(1).height = 26;

  sheet.mergeCells('A2:C2');
  const intro = sheet.getCell('A2');
  intro.value = `בגיליון "${SHEET}" יש ${imageCount} שורות, אחת לכל מוצר שצולם ואינו בקטלוג. `
    + 'ממלאים שורה שורה; שורה שלא מולאה פשוט לא תיובא. '
    + 'בסיום שומרים את הקובץ במקומו ומריצים במסוף:  npm run products:import-new';
  intro.alignment = { wrapText: true, vertical: 'top' };
  sheet.getRow(2).height = 46;

  const header = sheet.addRow(['עמודה', 'מה כותבים', 'דוגמה']);
  header.font = { bold: true };
  header.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEFEFEF' } };
    cell.border = { bottom: { style: 'thin', color: { argb: 'FFBBBBBB' } } };
  });

  for (const row of HELP) {
    const added = sheet.addRow([row.column, row.what, row.example]);
    added.getCell(1).font = { bold: true };
    added.getCell(2).alignment = { wrapText: true, vertical: 'top' };
    added.getCell(3).alignment = { vertical: 'top' };
    added.height = 34;
  }

  sheet.addRow([]);
  const note = sheet.addRow([
    '',
    'הייבוא רץ קודם כריצה יבשה: הוא מדפיס מה נמצא בכל שורה ומה פסול בה, ואינו נוגע במסד. '
    + 'רק npm run products:import-new -- --apply יוצר את המוצרים בפועל.',
    '',
  ]);
  note.getCell(2).alignment = { wrapText: true, vertical: 'top' };
  note.getCell(2).font = { italic: true };
  note.height = 34;
}

/** בונה את גיליון המילוי עצמו. */
function buildSheet(workbook, images, ranges) {
  const sheet = workbook.addWorksheet(SHEET, { views: [{ rightToLeft: true, state: 'frozen', ySplit: 1 }] });

  sheet.columns = COLUMNS.map((column) => ({ key: column.key, width: column.width }));

  const header = sheet.addRow(COLUMNS.map((column) => column.header));
  header.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  header.height = 24;
  header.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F2937' } };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
  });

  images.forEach((file) => {
    const row = sheet.addRow({ image: file });
    row.height = 20;

    // עמודת התמונה נעולה ואפורה: היא הקשר לצילום, ולא שדה למילוי.
    const imageCell = row.getCell(1);
    imageCell.protection = { locked: true };
    imageCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F4F6' } };
    imageCell.font = { color: { argb: 'FF6B7280' } };

    // שאר התאים פתוחים. בלי זה ההגנה על הגיליון הייתה נועלת הכול.
    for (let i = 2; i <= COLUMNS.length; i += 1) {
      row.getCell(i).protection = { locked: false };
    }
  });

  if (images.length === 0) return sheet;

  const lastRow = images.length + 1;

  /** מוסיף אימות נתונים לעמודה שלמה, משורה 2 ועד האחרונה. */
  function validate(columnIndex, formula, message) {
    for (let rowNumber = 2; rowNumber <= lastRow; rowNumber += 1) {
      sheet.getRow(rowNumber).getCell(columnIndex).dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: [formula],
        showErrorMessage: true,
        errorStyle: 'error',
        errorTitle: 'ערך לא מהרשימה',
        error: message,
      };
    }
  }

  validate(3, ranges.categories, 'בחרו קטגוריה מהרשימה הנפתחת.');
  validate(4, ranges.subcategories, 'בחרו תת-קטגוריה מהרשימה הנפתחת. היא חייבת להשתייך לקטגוריה שבחרתם.');
  validate(10, ranges.yesNo, 'כן או לא.');
  validate(11, ranges.yesNo, 'כן או לא.');

  /* הגנה בלי סיסמה: היא קיימת כדי שלא תימחק בטעות עמודת התמונה,
     ולא כדי לחסום מישהו. באקסל מסירים אותה בלחיצה אחת. */
  sheet.protect('', {
    selectLockedCells: true,
    selectUnlockedCells: true,
    formatColumns: true,
    formatRows: true,
  });

  return sheet;
}

async function main() {
  const taxonomy = loadCategories();
  const images = newImages();

  if (images.length === 0) {
    console.log(`אין תמונות של מוצרים חדשים ב-${path.relative(ROOT, NEW_DIR).replace(/\\/g, '/')}.`);
    console.log('קבצים בשם new-*.jpg שעברו את npm run images:products מגיעים לשם.');
    console.log('\nנכתב גיליון ריק בכל זאת, כדי שיהיה אפשר להתחיל למלא ידנית.');
  }

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'טכניק טמבור';
  workbook.created = new Date();

  const ranges = buildLists(workbook, taxonomy);
  buildSheet(workbook, images, ranges);
  buildHelp(workbook, images.length);

  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
  await workbook.xlsx.writeFile(OUT_PATH);

  const out = path.relative(ROOT, OUT_PATH).replace(/\\/g, '/');
  console.log(`${images.length} מוצרים חדשים ממתינים למילוי.`);
  console.log(`\n  ✓  ${out}`);
  console.log('\nממלאים בגיליון "מוצרים חדשים" (יש גיליון "הוראות" לצדו),');
  console.log('שומרים במקום, ואז:  npm run products:import-new');
}

main().catch((err) => {
  console.error(err.message);
  process.exitCode = 1;
});
