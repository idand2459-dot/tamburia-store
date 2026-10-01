/**
 * מסך הניהול: הכותרת, הניווט, ומתחתיהם הלשונית הפעילה.
 *
 * הלשונית הפעילה נשלטת מבחוץ, לפי הכתובת (/admin/:tab), כדי שלכל
 * לשונית תהיה כתובת אמיתית. setActiveTab למטה מנווט במקום לעדכן
 * state מקומי, ולכן כל הקריאות הקיימות לו ממשיכות לעבוד.
 *
 * הנתונים עצמם יושבים בשלושה הוקים (מוצרים, הזמנות, חוות דעת), וכולם
 * מקבלים את אותו עוטף fetch שמחזיר למסך ההתחברות כשההתחברות פגה.
 * כאן נשאר רק מה ששייך למסך כולו: הכותרת, הניווט, ההתראה על הזמנה
 * חדשה, ו-editingProduct — המוצר הנערך, שלשונית המוצרים מסמנת ולשונית
 * הטופס קוראת.
 *
 * ההתראה על הזמנה חדשה היא קונפטי וצליל. הקונפטי מגיע מ-useAdminOrders,
 * שיודע מתי נכנסה הזמנה; הצליל מורכב כאן ונמסר לו כ-onNewOrder, מפני
 * שהמתג שמכבה אותו יושב בכותרת הזו.
 */
import { useState, useRef, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { Volume2, VolumeX } from 'lucide-react';
import Confetti from '../../components/Confetti';
import { useAdminProducts } from '../../hooks/useAdminProducts';
import { useAdminOrders } from '../../hooks/useAdminOrders';
import { useAdminReviews } from '../../hooks/useAdminReviews';
import { useNewOrderChime } from '../../hooks/useNewOrderChime';
import AdminTabs from './AdminTabs';
import StatsTab from './StatsTab';
import OrdersTab from './OrdersTab';
import ProductsTab from './ProductsTab';
import ProductFormTab from './ProductFormTab';
import ImportTab from './ImportTab';
import ReviewsTab from './ReviewsTab';

/** מציג את מסך הניהול על כל לשוניותיו. */
function Admin({ onBack, onExpired, tab = 'orders', onTabChange }) {
  const expiredRef = useRef(onExpired);
  expiredRef.current = onExpired;

  /** קורא ל-API ומחזיר למסך הסיסמה אם ההתחברות פגה. */
  const api = useCallback(async (url, options) => {
    const res = await fetch(url, options);
    if (res.status === 401) expiredRef.current?.();
    return res;
  }, []);

  const activeTab = tab;
  const setActiveTab = onTabChange;

  /* הסינון של רשימת המוצרים יושב בכתובת שלה (?category=…&q=…), והטופס
     נמצא בכתובת אחרת. כדי שחזרה לרשימה — משמירה, מביטול או מהלשונית —
     תחזיר את אותו סינון, זוכרים כאן את ה-query האחרון שהרשימה הוצגה בו. */
  const location = useLocation();
  const listSearchRef = useRef('');
  if (activeTab === 'products') listSearchRef.current = location.search;

  /* המוצר שהטופס נסגר עליו, כדי שהרשימה תגלול אליו ולא תיפתח בראשה. */
  const [scrollToId, setScrollToId] = useState(null);
  const clearScrollTo = useCallback(() => setScrollToId(null), []);

  const {
    products, productsLoaded, createProduct, updateProduct, deleteProduct, toggleStock, toggleActive, updatePrice,
    uploadingImages, productsError,
    csvPreview, csvErrors, importing, importResult,
    downloadTemplate, handleCsvFile, handleImport, resetCsv, clearImportResult,
  } = useAdminProducts(api);

  const { soundOn, toggleSound, playChime } = useNewOrderChime();

  const {
    orders, handleStatusChange, handleDeleteOrder, exportOrdersToExcel, getStats, ordersError,
    showConfetti, dismissConfetti,
  } = useAdminOrders(api, { onNewOrder: playChime });

  const { reviews, approveReview, deleteReview, reviewsError } = useAdminReviews(api);

  const [editingId, setEditingId] = useState(null);

  /* המוצר הנערך נגזר מהרשימה ואינו עותק שנשמר בלחיצה על "ערוך".
     כך "הסתר מהחנות" שבטופס, ששולח מיד ומרענן את הרשימה, מחליף גם
     את התווית של הכפתור עצמו — עותק היה נשאר על הערך הישן. */
  const editingProduct = editingId === null
    ? null
    : products.find((p) => p.id === editingId) || null;

  const newOrdersCount = orders.filter(o => o.status === 'new').length;
  const pendingReviewsCount = reviews.filter(r => !r.approved).length;

  /** פותח את הטופס לעריכת מוצר קיים. */
  function startEdit(product) {
    setEditingId(product.id);
    setActiveTab('add');
  }

  /** חוזר לרשימת המוצרים, באותו סינון ועל המוצר שנערך, ומסיים את מצב העריכה. */
  function finishForm() {
    setScrollToId(editingId);
    setEditingId(null);
    setActiveTab('products', listSearchRef.current);
  }

  /**
   * מעבר לשונית. שני האיפוסים נעשים כאן ולא ברכיב הניווט, שאינו מכיר
   * את הנתונים: חזרה לרשימת המוצרים מסיימת עריכה, וכניסה לייבוא מנקה
   * קובץ שנשאר מפעם קודמת.
   */
  function handleTabChange(next) {
    if (next === 'products') setEditingId(null);
    if (next === 'import') resetCsv();
    setActiveTab(next, next === 'products' ? listSearchRef.current : '');
  }

  return (
    <div className="admin">
      {showConfetti && <Confetti onDone={dismissConfetti} />}

      <header className="admin-header">
        <h1 className="admin-title">ניהול טכניק טמבור</h1>
        <span className="admin-count">{products.length} מוצרים</span>

        <button
          type="button"
          className={`admin-sound-btn ${soundOn ? 'is-on' : ''}`}
          onClick={toggleSound}
          aria-pressed={soundOn}
          title={soundOn ? 'צליל הזמנה חדשה מופעל — לחץ להשתקה' : 'צליל הזמנה חדשה מושתק — לחץ להפעלה'}>
          {soundOn
            ? <Volume2 size={22} aria-hidden="true" />
            : <VolumeX size={22} aria-hidden="true" />}
          <span className="admin-sound-label">{soundOn ? 'צליל פועל' : 'מושתק'}</span>
        </button>

        <button type="button" className="admin-back-link" onClick={onBack}>חזור לחנות</button>
      </header>

      <AdminTabs
        activeTab={activeTab}
        onSelect={handleTabChange}
        badges={{ orders: newOrdersCount, reviews: pendingReviewsCount }}
        editing={Boolean(editingProduct)}
        onBack={onBack}
      />

      {activeTab === 'stats' && (
        <StatsTab
          api={api}
          products={products}
          getStats={getStats}
          onToggleStock={toggleStock}
          productsError={productsError}
        />
      )}

      {activeTab === 'orders' && (
        <OrdersTab
          orders={orders}
          onStatusChange={handleStatusChange}
          onDeleteOrder={handleDeleteOrder}
          onExport={exportOrdersToExcel}
          ordersError={ordersError}
        />
      )}

      {activeTab === 'products' && (
        <ProductsTab
          products={products}
          productsLoaded={productsLoaded}
          onEdit={startEdit}
          onDelete={deleteProduct}
          onToggleStock={toggleStock}
          onToggleActive={toggleActive}
          onUpdatePrice={updatePrice}
          productsError={productsError}
          scrollToId={scrollToId}
          onScrolled={clearScrollTo}
        />
      )}

      {activeTab === 'add' && (
        <ProductFormTab
          editingProduct={editingProduct}
          onCreate={createProduct}
          onUpdate={updateProduct}
          onToggleActive={toggleActive}
          uploadingImages={uploadingImages}
          onDone={finishForm}
          productsError={productsError}
        />
      )}

      {activeTab === 'import' && (
        <ImportTab
          csvPreview={csvPreview}
          csvErrors={csvErrors}
          importing={importing}
          importResult={importResult}
          onDownloadTemplate={downloadTemplate}
          onCsvFile={handleCsvFile}
          onImport={handleImport}
          onViewProducts={() => { handleTabChange('products'); clearImportResult(); }}
        />
      )}

      {activeTab === 'reviews' && (
        <ReviewsTab
          reviews={reviews}
          onApprove={approveReview}
          onDelete={deleteReview}
          reviewsError={reviewsError}
        />
      )}
    </div>
  );
}

export default Admin;
