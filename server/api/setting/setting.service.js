/**
 * הגדרות מסך הניהול: ערך בודד לכל מפתח.
 *
 * הכלל היחיד כאן: null אינו ערך אלא "בטל". הוא מוחק את השורה ולא שומר
 * את המחרוזת "null", כדי שקריאה תחזיר שוב את ברירת המחדל — כך מתבטל
 * איפוס הסטטיסטיקות.
 */
const settingRepository = require('./setting.repository');

/** מחזיר את ערך ההגדרה, או null כשלא נקבעה. */
function getSetting(key) {
  return settingRepository.get(key);
}

/** קובע את ההגדרה, או מוחק אותה כשהערך null. מחזיר את מה שנשמר. */
function saveSetting(key, value) {
  return value === null ? settingRepository.remove(key) : settingRepository.set(key, value);
}

module.exports = { getSetting, saveSetting };
