# Product photos — the shooting-day pipeline

> How products get real photographs, and how the same shoot doubles as a stock count.
> Linked from the [README](../README.md). The steps that change the database are dry runs
> unless given `--apply`, and each `--apply` prints the `--revert` that undoes it.

The catalogue was imported pointing at image files that were never uploaded, so the
storefront fell back to a category icon. The fix is to photograph the products in the
shop and run them through a local pipeline. Nothing here is generative: the product's
own pixels are kept exactly as photographed, and all that is removed is the background.

The shoot doubles as a stock count, so the same day's photos decide three things: which
products get a real image, which are no longer in the shop, and which are new. The full
sequence in order is written up in Hebrew below under
[יום הצילומים — לפי הסדר](#יום-הצילומים--לפי-הסדר); what follows here is what each step
does and why.

**1. Print the shooting list.**

```bash
npm run products:list
```

Writes `design-assets/product-list.csv` and `design-assets/product-list.html`. Open the
HTML and print it (A4, RTL, grouped by category, products without a photo listed first).
Each line has a checkbox and the product id in large digits — that id is the filename.
`has_real_image` is true only when `image_url` is set **and** the file it points at
actually exists in `uploads/`, which is the distinction that matters: a row can have an
image URL and still have no image.

**2. Shoot, naming each file after the product id.**

`247.jpg` for the main shot, `247-2.jpg` / `247-3.jpg` for extra angles, and
`new-<anything>.jpg` for a product that is not in the database yet. On an iPhone, set
Settings → Camera → Formats → **Most Compatible** first, or the phone writes HEIC, which
the pipeline reports and skips rather than guessing at. Copy the files into `photos/raw/`.

**3. Process.**

```bash
npm run images:products
```

For each photo: auto-orient from EXIF, remove the background, crop to the product's
bounding box, centre it on a pure white 1200x1200 canvas at up to 80% of the frame
(never upscaled past the source), flatten and export WebP at quality 82 into
`photos/processed/`. Roughly 6-8 seconds per photo on a laptop CPU.

The run touches neither the database nor `uploads/`. It writes `photos/preview.html` —
open it in the browser to see every result next to its original, with a red **לבדיקה**
badge and a reason on anything suspect: a mask covering under 5% or over 90% of the
frame, a product crop under 500px on its long side, a filename that matches no product,
or two files claiming the same slot. Re-running skips photos whose output is newer than
the source; `--force` redoes everything.

**4. Attach.**

```bash
npm run images:products -- --apply
```

Copies the processed images into `uploads/` as `product-<id>-<hash>.webp` and sets
`image_url` and `images` through the product model. The hash is the first 8 hex digits of
the file's own content: `/uploads` is served with a one-week `max-age`, so re-shooting a
product and writing it back to the same name would sit in the cache of everyone who
already saw the old one. Different content is a different name, which every browser
fetches immediately. Flagged images are skipped unless `--include-flagged` is passed.
Before writing a single row it saves the previous `image_url` and `images` of everything
it is about to change to `design-assets/image-backup-<timestamp>.json`, and prints the
command that undoes it:

```bash
npm run images:products -- --revert design-assets/image-backup-....json
```

Revert restores the database rows only; files already copied into `uploads/` stay where
they are. A re-shoot leaves the previous file behind under its old hash, and the apply
run lists every `product-*.webp` that no longer belongs to any product rather than
deleting it — the most recent backup still points at those files, and deleting them would
leave `--revert` restoring a URL with nothing behind it.

**5. Hide what is not on the shelf.**

The shoot doubles as a stock count: every product still sold gets photographed, so a
product with no processed image is a product that is no longer in the shop.

```bash
npm run products:hide-unphotographed
```

A dry run by default — it touches nothing. It lists every **active** product with no
`photos/processed/<id>.webp`, grouped by category with id, name, price and whether it
already had a real image, and writes the same list to
`design-assets/to-hide-<timestamp>.csv` to go over before deciding. It warns separately
about the product ids the paint calculator adds to the cart by id (627, 628, 416), whose
absence empties the bundle it recommends — the calculator falls back to "שווה לשאול
בחנות" rather than breaking, but that is usually not what you want.

Products to keep anyway are excluded with `--keep 416,627,628` or
`--keep-file keep.txt` (one id per line, `#` starts a comment). `--apply` then sets
`active = false` for the rest after saving their ids to
`design-assets/hide-backup-<timestamp>.json`, and
`--revert <that file>` puts exactly those products back in the shop.

**6. Add what is new.**

A product photographed as `new-<anything>.jpg` is one that was not on the printed list,
so it is not in the catalogue yet. Those images land in `photos/processed/new/`, and the
details have to be typed somewhere:

```bash
npm run products:new-template
```

Writes `design-assets/new-products.xlsx` — one row per new image, with the image filename
already filled in and locked (it is what ties the row to the photo). Category and
subcategory are dropdowns fed from `categories.js` through a hidden third sheet, because
Excel caps an inline validation list at 255 characters and 87 Hebrew subcategory names go
well past that. A second sheet, `הוראות`, explains every column with an example. All
sheets are right-to-left.

Fill it in, save it in place, then:

```bash
npm run products:import-new
```

Another dry run: it reads every row, validates it, and prints what it found and what is
wrong with it, in Hebrew, without touching anything. Validation is in two layers — the
sheet's own rules (image file exists, category from the tree, subcategory belonging to
that category, a price above zero **or** at least one priced size) and then
`server/validators/product.validator.js`, the same code the admin form goes through,
called directly rather than reimplemented. Where the two disagree, the validator wins. A
row with an error is skipped and never guessed at; an untouched row is simply skipped.

`--apply` creates the valid ones through the product model, then copies each image into
`uploads/` under the same `product-<id>-<hash>.webp` convention as the rest of the
pipeline (the product is created first, because the filename needs its id) and attaches
it. Every created id is written to `design-assets/import-backup-<timestamp>.json` as it
goes, so a run interrupted halfway still leaves an accurate list.

`--revert <that file>` undoes it: products with no orders are deleted, and a product that
has already been ordered is hidden instead and reported as such — deleting it would cut
the order loose from the item it sold, which is the whole reason `active` exists.

**Background removal runs entirely on this machine.** It is
`@imgly/background-removal-node`, a devDependency that ships the ONNX model weights
inside the package (about 127 MB in `node_modules`), so there is no first-run download,
no API key, and no photo ever leaves the computer. It runs in a child process on
purpose: it pins `sharp` 0.32 while this project is on 0.35, and loading both copies of
libvips into one process segfaults Node. `scripts/lib/cutout.js` keeps that child alive
across the whole batch so the model is loaded once, not once per photo.

## יום הצילומים — לפי הסדר

<div dir="rtl">

**לפני**: באייפון — הגדרות ← מצלמה ← עיצובים ← **הכי תואם**. זה שומר JPG במקום HEIC,
שהמחשב לא יודע לפתוח. הצינור מדווח על HEIC ולא ינחש.

**1. להדפיס את רשימת הצילום.**

```bash
npm run products:list
```

פותחים את `design-assets/product-list.html` בדפדפן ומדפיסים (Ctrl+P). מוצר בלי תמונה
מופיע ראשון בכל קטגוריה — זה מה שבאים לצלם.

**2. לצלם.** שם הקובץ הוא המספר הגדול שברשימה: `247.jpg`. זווית נוספת לאותו מוצר:
`247-2.jpg`. מוצר שאינו ברשימה: `new-<תיאור>.jpg`. מסמנים ✓ בריבוע אחרי כל צילום.
מוצר שלא מצלמים הוא מוצר שיירד מהאתר — זו ספירת המלאי.

מעתיקים את כל הקבצים ל-`photos/raw/`.

**3. לעבד.**

```bash
npm run images:products
```

כ-6 שניות לתמונה. לא נוגע במסד ולא בתיקיית התמונות של האתר. בסוף פותחים את
`photos/preview.html` ועוברים על התוצאות — כל מה שמסומן **לבדיקה** באדום צריך מבט.
תמונה שיצאה לא טוב: מצלמים מחדש, מחליפים את הקובץ ב-`photos/raw/` ומריצים שוב
(רק היא תעובד מחדש).

**4. לחבר את התמונות למוצרים.**

```bash
npm run images:products -- --apply
```

מדפיס בסוף פקודת ביטול עם שם קובץ הגיבוי. כדאי לשמור אותה עד שבודקים באתר.

**5. להוריד מהאתר את מה שלא צולם.**

```bash
npm run products:hide-unphotographed
```

ריצה יבשה: מראה מה ייסגר ולא עושה כלום. עוברים על הרשימה (גם ב-CSV שהיא כותבת).
שימו לב לאזהרה על מוצרי מחשבון הצבע. מה שרוצים להשאיר למרות שלא צולם:

```bash
npm run products:hide-unphotographed -- --keep 416,627,628 --apply
```

שום דבר לא נמחק — המוצרים רק יורדים מהאתר, וההזמנות הישנות שלהם נשארות שלמות.

**6. להוסיף את המוצרים החדשים.**

```bash
npm run products:new-template
```

פותחים את `design-assets/new-products.xlsx`, ממלאים שורה לכל מוצר חדש (יש גיליון
"הוראות" לצדו), ושומרים במקום. אז:

```bash
npm run products:import-new
```

ריצה יבשה שמראה מה תקין ומה חסר בכל שורה. מתקנים באקסל, מריצים שוב עד שהכול ירוק, ואז:

```bash
npm run products:import-new -- --apply
```

**7. לבנות ולהעלות.**

```bash
npm run build:client
npm start
```

**אם משהו יצא לא כמו שרצינו**, לכל שלב יש ביטול, והוא מודפס בסוף הריצה עם שם קובץ
הגיבוי שלו:

```bash
npm run images:products -- --revert design-assets/image-backup-....json
npm run products:hide-unphotographed -- --revert design-assets/hide-backup-....json
npm run products:import-new -- --revert design-assets/import-backup-....json
```

</div>
