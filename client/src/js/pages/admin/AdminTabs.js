/**
 * הניווט של מסך הניהול, בשתי צורות שמוחלפות בברירת CSS.
 *
 * במסך רחב — שורת לשוניות מתחת לכותרת, קו אדום תחת הפעילה. בטלפון —
 * סרגל קבוע בתחתית המסך עם שלוש הלשוניות שבשימוש הכי תכוף וכפתור
 * "עוד" שפותח את השאר בגיליון. התחתית ולא העליונה מפני שהאגודל מגיע
 * לשם, והמסך הזה מופעל ביד אחת מול דלפק.
 *
 * שני הסרגלים נמצאים ב-DOM תמיד ואחד מהם מוסתר, ולא בתנאי על רוחב
 * החלון: כך אין רינדור מחדש בסיבוב המכשיר, ושינוי גודל חלון בדסקטופ
 * אינו מקפיץ את הממשק.
 *
 * הגיליון נסגר בבחירה, ב-Escape ובלחיצה על הרקע.
 */
import { useState, useEffect, useRef } from 'react';
import { MoreHorizontal, Pencil, X } from 'lucide-react';
import { ADMIN_TABS, PRIMARY_TAB_COUNT } from './adminConstants';

const PRIMARY = ADMIN_TABS.slice(0, PRIMARY_TAB_COUNT);
const SECONDARY = ADMIN_TABS.slice(PRIMARY_TAB_COUNT);

/** מחזיר את תג הסימון של לשונית, או null כשאין מה לסמן. */
function badgeFor(id, badges) {
  const count = badges[id];
  if (!count) return null;
  return <span className="admin-tab-badge">{count}</span>;
}

/** מציג את הניווט של מסך הניהול. */
function AdminTabs({ activeTab, onSelect, badges = {}, editing, onBack }) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const sheetRef = useRef(null);

  // Escape סוגר, כמו בכל שכבה צפה באתר.
  useEffect(() => {
    if (!sheetOpen) return;
    const onKey = (e) => { if (e.key === 'Escape') setSheetOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [sheetOpen]);

  // המיקוד עובר לגיליון בפתיחה, אחרת קורא מסך נשאר על הכפתור שמתחת.
  useEffect(() => {
    if (sheetOpen) sheetRef.current?.focus();
  }, [sheetOpen]);

  /** בוחר לשונית וסוגר את הגיליון אם היה פתוח. */
  function choose(id) {
    setSheetOpen(false);
    onSelect(id);
  }

  /* לשונית "הוסף מוצר" מחליפה תווית ואייקון כשעורכים מוצר קיים —
     אותו מסך, משמעות אחרת, ובלי זה נראה שלחיצה על "הוסף" תיצור מוצר
     חדש בזמן שהיא פותחת את מה שנערך. */
  const labelOf = (tab) => (tab.id === 'add' && editing ? 'עריכה' : tab.label);
  const IconOf = (tab) => (tab.id === 'add' && editing ? Pencil : tab.Icon);

  return (
    <>
      {/* מסך רחב */}
      <nav className="admin-tabs" aria-label="לשוניות הניהול">
        {ADMIN_TABS.map((tab) => {
          const Icon = IconOf(tab);
          return (
            <button
              key={tab.id}
              type="button"
              className={`admin-tab ${activeTab === tab.id ? 'is-active' : ''}`}
              aria-current={activeTab === tab.id ? 'page' : undefined}
              onClick={() => choose(tab.id)}>
              <Icon size={18} aria-hidden="true" />
              {labelOf(tab)}
              {badgeFor(tab.id, badges)}
            </button>
          );
        })}
      </nav>

      {/* טלפון */}
      <nav className="admin-bar" aria-label="לשוניות הניהול">
        {PRIMARY.map((tab) => {
          const Icon = IconOf(tab);
          return (
            <button
              key={tab.id}
              type="button"
              className={`admin-bar-btn ${activeTab === tab.id ? 'is-active' : ''}`}
              aria-current={activeTab === tab.id ? 'page' : undefined}
              onClick={() => choose(tab.id)}>
              <Icon size={24} aria-hidden="true" />
              <span className="admin-bar-label">{labelOf(tab)}</span>
              {badgeFor(tab.id, badges)}
            </button>
          );
        })}

        <button
          type="button"
          className={`admin-bar-btn ${SECONDARY.some((t) => t.id === activeTab) ? 'is-active' : ''}`}
          aria-expanded={sheetOpen}
          onClick={() => setSheetOpen((open) => !open)}>
          <MoreHorizontal size={24} aria-hidden="true" />
          <span className="admin-bar-label">עוד</span>
          {badgeFor('reviews', badges)}
        </button>
      </nav>

      {sheetOpen && (
        <>
          <div className="admin-sheet-backdrop" onClick={() => setSheetOpen(false)} />
          <div
            className="admin-sheet"
            role="dialog"
            aria-label="עוד לשוניות"
            tabIndex={-1}
            ref={sheetRef}>
            <div className="admin-sheet-head">
              <span>עוד</span>
              <button type="button" className="admin-sheet-close" onClick={() => setSheetOpen(false)} aria-label="סגור">
                <X size={22} aria-hidden="true" />
              </button>
            </div>

            {SECONDARY.map((tab) => (
              <button
                key={tab.id}
                type="button"
                className={`admin-sheet-btn ${activeTab === tab.id ? 'is-active' : ''}`}
                onClick={() => choose(tab.id)}>
                <tab.Icon size={22} aria-hidden="true" />
                {tab.label}
                {badgeFor(tab.id, badges)}
              </button>
            ))}

            {/* בדסקטופ זה קישור בכותרת; בטלפון הכותרת צרה מדי לשניהם,
                והיציאה מהניהול היא בדיוק פעולה שאינה תכופה. */}
            <button type="button" className="admin-sheet-btn admin-sheet-btn--back" onClick={onBack}>
              חזור לחנות
            </button>
          </div>
        </>
      )}
    </>
  );
}

export default AdminTabs;
