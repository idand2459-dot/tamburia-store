/**
 * תהליך העזר שמריץ את הסרת הרקע. לא מריצים אותו ביד — cutout.js מרים
 * אותו ומדבר איתו.
 *
 * למה בכלל תהליך נפרד: @imgly/background-removal-node נועל את sharp
 * 0.32, והפרויקט עובד עם 0.35. npm משאיר את שתיהן זו לצד זו, ושתיהן
 * טוענות libvips משלהן — שני עותקים של אותה ספרייה מקורית באותו
 * תהליך, שמפילים את Node ב-segfault. כאן נטענת רק החבילה של imgly,
 * ובתהליך הראשי רק ה-sharp של הפרויקט. אף אחת לא פוגשת את השנייה.
 *
 * הפרוטוקול: שורת JSON לכל בקשה ב-stdin, שורת JSON לכל תשובה ב-stdout.
 * התהליך חי לאורך כל הריצה, כי טעינת המודל היא החלק היקר (כשש שניות)
 * ואסור שתחזור על עצמה לכל תמונה.
 */
const fs = require('fs');
const readline = require('readline');

let removeBackground = null;

/** מסיר רקע מקובץ אחד וכותב PNG עם ערוץ שקיפות. */
async function handle(message) {
  if (!removeBackground) {
    ({ removeBackground } = require('@imgly/background-removal-node'));
  }

  const input = fs.readFileSync(message.in);

  // ה-MIME של ה-Blob הוא מה שהמפענח של imgly מסתכל עליו. בלעדיו
  // הוא נופל על "Unsupported format".
  const blob = await removeBackground(new Blob([input], { type: 'image/png' }), {
    model: message.model,
    output: { format: 'image/png' },
  });

  fs.writeFileSync(message.out, Buffer.from(await blob.arrayBuffer()));
}

const rl = readline.createInterface({ input: process.stdin });

// הבקשות מטופלות אחת אחרי השנייה: המודל אינו בטוח לריצה מקבילה,
// והתהליך הראשי ממילא שולח אחת בכל פעם.
let queue = Promise.resolve();

rl.on('line', (line) => {
  if (!line.trim()) return;

  let message;
  try {
    message = JSON.parse(line);
  } catch (err) {
    process.stdout.write(`${JSON.stringify({ id: null, ok: false, error: err.message })}\n`);
    return;
  }

  queue = queue.then(async () => {
    try {
      await handle(message);
      process.stdout.write(`${JSON.stringify({ id: message.id, ok: true })}\n`);
    } catch (err) {
      process.stdout.write(`${JSON.stringify({ id: message.id, ok: false, error: err.message })}\n`);
    }
  });
});

rl.on('close', () => { process.exit(0); });
