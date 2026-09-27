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

  const {
    products, createProduct, updateProduct, deleteProduct, toggleStock, updatePrice,
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

  const [editingProduct, setEditingProduct] = useState(null);

  const newOrdersCount = orders.filter(o => o.status === 'new').length;
  const pendingReviewsCount = reviews.filter(r => !r.approved).length;

  /** פותח את הטופס לעריכת מוצר קיים. */
  function startEdit(product) {
    setEditingProduct(product);
    setActiveTab('add');
  }

  /** חוזר לרשימת המוצרים ומסיים את מצב העריכה. */
  function finishForm() {
    setEditingProduct(null);
    setActiveTab('products');
  }

  /**
   * מעבר לשונית. שני האיפוסים נעשים כאן ולא ברכיב הניווט, שאינו מכיר
   * את הנתונים: חזרה לרשימת המוצרים מסיימת עריכה, וכניסה לייבוא מנקה
   * קובץ שנשאר מפעם קודמת.
   */
  function handleTabChange(next) {
    if (next === 'products') setEditingProduct(null);
    if (next === 'import') resetCsv();
    setActiveTab(next);
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
          onEdit={startEdit}
          onDelete={deleteProduct}
          onToggleStock={toggleStock}
          onUpdatePrice={updatePrice}
          productsError={productsError}
        />
      )}

      {activeTab === 'add' && (
        <ProductFormTab
          editingProduct={editingProduct}
          onCreate={createProduct}
          onUpdate={updateProduct}
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
