/**
 * ההקשר המשותף לכל המסכים: העגלה, המועדפים ופרטי ההזמנה.
 *
 * לפני המעבר ל-react-router כל המצב הזה ישב ב-App והועבר בפרופס לכל
 * מסך. עכשיו המסכים הם יעדי ניתוב, ו-Outlet לא מעביר פרופס, ולכן
 * המצב עובר בהקשר. ה-state עצמו ממשיך לשבת ב-App אחד, כדי שהעגלה
 * תשרוד מעבר בין כתובות.
 */
import { createContext, useContext } from 'react';

export const StoreContext = createContext(null);

/** מחזיר את ההקשר המשותף, ונכשל ברור אם נשכח ה-Provider. */
export function useStore() {
  const value = useContext(StoreContext);
  if (!value) {
    throw new Error('useStore נקרא מחוץ ל-StoreContext.Provider');
  }
  return value;
}
