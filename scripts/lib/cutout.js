/**
 * הסרת רקע מקומית, דרך תהליך עזר יחיד שחי לאורך כל הריצה.
 *
 * המנוע הוא @imgly/background-removal-node: ONNX Runtime עם משקלי
 * המודל ארוזים בתוך החבילה עצמה (כ-127MB ב-node_modules). כלומר אין
 * הורדה בהרצה הראשונה, אין מפתח API, ואף תמונה לא עוזבת את המחשב.
 *
 * למה תהליך נפרד ולא require רגיל — ראה cutout-worker.js.
 */
const path = require('path');
const readline = require('readline');
const { spawn } = require('child_process');

const WORKER = path.join(__dirname, 'cutout-worker.js');

let child = null;
let nextId = 1;
const pending = new Map();
let stderrTail = '';

/** מפיל את כל הבקשות שבאוויר כשהתהליך מת. */
function failAll(reason) {
  for (const { reject } of pending.values()) reject(new Error(reason));
  pending.clear();
}

/** מרים את תהליך העזר, פעם אחת. */
function start() {
  if (child) return child;

  child = spawn(process.execPath, [WORKER], {
    cwd: path.join(__dirname, '..', '..'),
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  readline.createInterface({ input: child.stdout }).on('line', (line) => {
    let message;
    try {
      message = JSON.parse(line);
    } catch {
      return; // שורה שאינה תשובה — מתעלמים במקום להפיל את הריצה
    }

    const entry = pending.get(message.id);
    if (!entry) return;
    pending.delete(message.id);

    if (message.ok) entry.resolve();
    else entry.reject(new Error(message.error || 'הסרת הרקע נכשלה'));
  });

  // libvips ו-ONNX מדפיסים אזהרות ל-stderr גם כשהכול תקין. שומרים
  // את הזנב ומצרפים אותו רק אם התהליך באמת נפל.
  child.stderr.on('data', (chunk) => {
    stderrTail = (stderrTail + chunk.toString()).slice(-2000);
  });

  child.on('exit', (code, signal) => {
    child = null;
    failAll(
      `תהליך הסרת הרקע נסגר (${signal || `קוד ${code}`})` +
      (stderrTail.trim() ? `:\n${stderrTail.trim()}` : '')
    );
  });

  child.on('error', (err) => {
    child = null;
    failAll(`לא הצלחתי להריץ את תהליך הסרת הרקע: ${err.message}`);
  });

  return child;
}

/**
 * מסיר את הרקע מקובץ התמונה שב-inPath וכותב PNG עם שקיפות ל-outPath.
 */
function cutout(inPath, outPath, model) {
  const worker = start();
  const id = nextId;
  nextId += 1;

  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    worker.stdin.write(`${JSON.stringify({ id, in: inPath, out: outPath, model })}\n`);
  });
}

/** סוגר את תהליך העזר, כדי שהריצה תוכל להסתיים. */
function stop() {
  if (!child) return;
  child.stdin.end();
}

module.exports = { cutout, stop };
