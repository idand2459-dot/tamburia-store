/**
 * פרטי החנות — כתובת, טלפונים ושעות פעילות — במקום אחד.
 *
 * עד עכשיו כל אחד מהם היה כתוב כמחרוזת בתוך עשרה קבצים שונים, וכל
 * שינוי בשעות או במספר טלפון חייב לעבור על כולם. כאן זה נתון אחד,
 * והפורמטים השונים שהאתר מציג בהם את אותו נתון הם פונקציות עליו.
 *
 * שים לב: תבניות המייל שבצד השרת (server/services/email/templates/)
 * לא צורכות את הקובץ הזה — הן CommonJS ורצות מחוץ ל-client/src.
 */

/* ---- כתובת ---- */

const STREET = 'בר כוכבא 52';
const CITY = 'פתח תקווה';

/* מה שנשלח לגוגל. שני הקישורים למטה נגזרים ממנו, כדי שכתובת שמשתנה
   תשנה גם את הכפתור וגם את המפה המוטמעת. */
const MAPS_QUERY = `${STREET} ${CITY}`;

export const ADDRESS = {
  street: STREET,
  city: CITY,
  /** הצורה שרוב העמודים מציגים: "בר כוכבא 52, פתח תקווה" */
  full: `${STREET}, ${CITY}`,
  /** הקישור שנפתח בלשונית חדשה מכפתור "פתח במפות". */
  mapsUrl: `https://maps.google.com/?q=${MAPS_QUERY.replace(/ /g, '+')}`,
  /** המפה המוטמעת בעמוד צור קשר. output=embed הוא מה שמחזיר מפה
      נקייה בלי הממשק המלא של גוגל מפות. */
  mapsEmbedUrl: `https://www.google.com/maps?q=${encodeURIComponent(MAPS_QUERY)}&output=embed`,
};

/* ---- טלפונים ---- */

/* לכל מספר שתי צורות: display — איך הוא נראה על המסך, tel — מה שנכנס
   ל-href="tel:". הן לא זהות (המקף אינו חוקי בכל הלקוחות), ולכן שתיהן
   נתון ולא נגזרת. */
export const PHONES = {
  store: {
    label: 'טלפון חנות',
    display: '03-9315750',
    tel: '039315750',
  },
  mobile: {
    label: 'פלאפון אישי',
    display: '050-6735040',
    tel: '0506735040',
  },
};

/* ---- וואטסאפ ---- */

export const WHATSAPP = {
  number: '972506735040',
  url: 'https://wa.me/972506735040',
  defaultMessage: 'שלום, אני מעוניין במוצר מהאתר שלכם',
};

/**
 * מרכיב קישור וואטסאפ עם הודעה מוכנה. הטקסט נכנס כמו שהוא — מי שצריך
 * אותו מקודד (WhatsAppButton) מעביר טקסט מקודד.
 */
export function whatsappUrl(text) {
  return text ? `${WHATSAPP.url}?text=${text}` : WHATSAPP.url;
}

/* ---- שעות פעילות ---- */

const CLOSED_LABEL = 'סגור';

/**
 * שורה אחת בטבלת השעות. `days` הם מספרי הימים כפי ש-Date#getDay מחזיר
 * (0 = ראשון), וזה מה שמאפשר לסמן את היום הנוכחי. שלוש צורות לשם היום,
 * כי שלושה מקומות באתר מציגים אותו אחרת ושינוי הצורה הוא שינוי עיצובי,
 * לא שינוי נתון.
 */
export const HOURS = [
  {
    id: 'weekdays',
    days: [0, 1, 2, 3, 4],
    short: 'א׳-ה׳',
    spaced: 'א׳ – ה׳',
    long: 'ראשון – חמישי',
    open: '7:00',
    close: '20:00',
  },
  {
    id: 'friday',
    days: [5],
    short: 'ו׳',
    spaced: 'ו׳',
    long: 'שישי',
    open: '7:00',
    close: '15:00',
  },
  {
    id: 'saturday',
    days: [6],
    short: 'שבת',
    spaced: 'שבת',
    long: 'שבת',
    closed: true,
  },
];

/** רק הימים שבהם החנות פתוחה — מה שהרצועות והבאנרים מונים. */
export const OPEN_HOURS = HOURS.filter((row) => !row.closed);

/** "7:00-20:00" — מקף רגיל, הצורה הקצרה. */
export function hoursRange(row) {
  return row.closed ? CLOSED_LABEL : `${row.open}-${row.close}`;
}

/** "7:00–20:00" — מקף en, הצורה שהפוטר מציג. */
export function hoursRangeDash(row) {
  return row.closed ? CLOSED_LABEL : `${row.open}–${row.close}`;
}

/** "07:00 – 20:00" — שעה בשתי ספרות ורווחים, הצורה של טבלאות השעות. */
export function hoursRangePadded(row) {
  if (row.closed) return CLOSED_LABEL;
  return `${padHour(row.open)} – ${padHour(row.close)}`;
}

function padHour(time) {
  return time.length < 5 ? `0${time}` : time;
}

/** "א׳-ה׳ 7:00-20:00 • ו׳ 7:00-15:00" — שורת השעות של הבאנרים. */
export function hoursSummary(separator = ' • ') {
  return OPEN_HOURS.map((row) => `${row.short} ${hoursRange(row)}`).join(separator);
}

/**
 * השורה שמתאימה להיום, או undefined אם אין כזו. משמשת את עמודי צור
 * קשר ואודות כדי להדגיש את השורה הרלוונטית.
 */
export function todayRow(date = new Date()) {
  const day = date.getDay();
  return HOURS.find((row) => row.days.includes(day));
}
