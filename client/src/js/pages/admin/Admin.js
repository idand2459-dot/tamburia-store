/**
 * מסך הניהול: סרגל הלשוניות, ומעליו הלשונית הפעילה.
 *
 * הלשונית הפעילה נשלטת מבחוץ, לפי הכתובת (/admin/:tab), כדי שלכל
 * לשונית תהיה כתובת אמיתית. setActiveTab למטה מנווט במקום לעדכן
 * state מקומי, ולכן כל הקריאות הקיימות לו ממשיכות לעבוד.
 *
 * הנתונים עצמם יושבים בשלושה הוקים (מוצרים, הזמנות, חוות דעת), וכולם
 * מקבלים את אותו עוטף fetch שמחזיר למסך ההתחברות כשההתחברות פגה.
 * כאן נשאר רק מה ששייך למסך כולו: הסרגל, הקונפטי, ו-editingProduct —
 * המוצר הנערך, שלשונית המוצרים מסמנת ולשונית הטופס קוראת.
 */
import { useState, useRef, useCallback } from 'react';
import { BarChart3, ClipboardList, Package, Pencil, Plus, Download, Star } from 'lucide-react';
import Confetti from '../../components/Confetti';
import { useAdminProducts } from '../../hooks/useAdminProducts';
import { useAdminOrders } from '../../hooks/useAdminOrders';
import { useAdminReviews } from '../../hooks/useAdminReviews';
import StatsTab from './StatsTab';
import OrdersTab from './OrdersTab';
import ProductsTab from './ProductsTab';
import ProductFormTab from './ProductFormTab';
import ImportTab from './ImportTab';
import ReviewsTab from './ReviewsTab';

/** מציג את מסך הניהול על כל לשוניותיו. */
function Admin({ onBack, onExpired, tab = 'stats', onTabChange }) {
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
    products, createProduct, updateProduct, deleteProduct, toggleStock, uploadingImages, productsError,
    csvPreview, csvErrors, importing, importResult,
    downloadTemplate, handleCsvFile, handleImport, resetCsv, clearImportResult,
  } = useAdminProducts(api);

  const {
    orders, handleStatusChange, handleDeleteOrder, exportOrdersToExcel, getStats, ordersError,
    showConfetti, dismissConfetti,
  } = useAdminOrders(api);

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

  return (
    <div className="admin">
      {showConfetti && <Confetti onDone={dismissConfetti} />}
      <div className="admin-header">
        <button className="back-btn" onClick={onBack}>← חזור לחנות</button>
        <h1>ניהול טכניק טמבור</h1>
        <span className="admin-count">{products.length} מוצרים</span>
      </div>

      <div className="admin-tabs">
        <button className={`admin-tab ${activeTab === 'stats' ? 'active' : ''}`} onClick={() => setActiveTab('stats')}><BarChart3 size={18} aria-hidden="true" /> סטטיסטיקות</button>
        <button className={`admin-tab ${activeTab === 'orders' ? 'active' : ''}`} onClick={() => setActiveTab('orders')}>
          <ClipboardList size={18} aria-hidden="true" /> הזמנות {newOrdersCount > 0 && <span className="orders-new-badge">{newOrdersCount}</span>}
        </button>
        <button className={`admin-tab ${activeTab === 'products' ? 'active' : ''}`} onClick={() => { setActiveTab('products'); setEditingProduct(null); }}><Package size={18} aria-hidden="true" /> מוצרים</button>
        <button className={`admin-tab ${activeTab === 'add' ? 'active' : ''}`} onClick={() => setActiveTab('add')}>
          {editingProduct ? <><Pencil size={18} aria-hidden="true" /> עריכה</> : <><Plus size={18} aria-hidden="true" /> הוסף מוצר</>}
        </button>
        <button className={`admin-tab ${activeTab === 'import' ? 'active' : ''}`} onClick={() => { setActiveTab('import'); resetCsv(); }}><Download size={18} aria-hidden="true" /> ייבוא CSV</button>
        <button className={`admin-tab ${activeTab === 'reviews' ? 'active' : ''}`} onClick={() => setActiveTab('reviews')}>
          <Star size={18} aria-hidden="true" /> ביקורות {pendingReviewsCount > 0 && <span className="orders-new-badge">{pendingReviewsCount}</span>}
        </button>
      </div>

      {activeTab === 'stats' && (
        <StatsTab
          orders={orders}
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
          onViewProducts={() => { setActiveTab('products'); clearImportResult(); }}
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
