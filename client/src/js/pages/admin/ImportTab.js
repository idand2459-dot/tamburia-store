/**
 * לשונית ייבוא ה-CSV: הוראות, בחירת קובץ, תצוגה מקדימה ותוצאת הייבוא.
 *
 * הפירוק והשליחה יושבים ב-useAdminProducts, כי הם מייצרים מוצרים
 * ומרעננים את הרשימה. כאן נשארת רק התצוגה.
 */
import { CATEGORIES } from './adminConstants';

/** מציג את לשונית הייבוא. */
function ImportTab({
  csvPreview, csvErrors, importing, importResult,
  onDownloadTemplate, onCsvFile, onImport, onViewProducts,
}) {
  return (
    <div className="import-section">
      <div className="import-instructions">
        <h2>ייבוא מוצרים מ-CSV</h2>
        <p>עמודות: name, price, in_stock (true/false), sku, category, colors, description</p>
        <div className="import-categories-list">
          <strong>קטגוריות:</strong>
          <div className="import-cat-tags">
            {CATEGORIES.map(cat => <span key={cat.id} className="import-cat-tag">{cat.icon} <code>{cat.id}</code> = {cat.label}</span>)}
          </div>
        </div>
        <button className="download-template-btn" onClick={onDownloadTemplate}>📄 הורד תבנית CSV</button>
      </div>
      <div className="import-upload-area" onClick={() => document.getElementById('csv-input').click()}>
        <span className="import-upload-icon">📥</span><p>לחץ לבחירת קובץ CSV</p>
        <input id="csv-input" type="file" accept=".csv" style={{ display: 'none' }} onChange={onCsvFile} />
      </div>
      {csvErrors.length > 0 && <div className="import-errors"><h4>⚠️ שגיאות ({csvErrors.length})</h4><ul>{csvErrors.map((e,i) => <li key={i}>{e}</li>)}</ul></div>}
      {csvPreview?.length > 0 && (
        <div className="import-preview">
          <h4>{csvPreview.length} מוצרים מוכנים</h4>
          <div className="import-preview-table-wrap">
            <table className="import-preview-table">
              <thead><tr><th>שם</th><th>מחיר</th><th>מלאי</th><th>מק"ט</th><th>קטגוריה</th></tr></thead>
              <tbody>{csvPreview.slice(0,10).map((r,i) => <tr key={i}><td>{r.name}</td><td>₪{r.price}</td><td>{r.in_stock ? '✓ יש' : '✗ אזל'}</td><td>{r.sku||'—'}</td><td>{CATEGORIES.find(c=>c.id===r.category)?.label}</td></tr>)}</tbody>
            </table>
            {csvPreview.length > 10 && <p className="import-preview-more">...ועוד {csvPreview.length - 10}</p>}
          </div>
          <button className="import-confirm-btn" onClick={onImport} disabled={importing}>{importing ? '⏳ מייבא...' : `✅ ייבא ${csvPreview.length} מוצרים`}</button>
        </div>
      )}
      {importResult && (
        <div className="import-result">
          <span className="import-result-icon">🎉</span><h4>הושלם!</h4>
          <p>✅ {importResult.success} נוספו</p>
          {importResult.failed > 0 && <p>❌ {importResult.failed} נכשלו</p>}
          <button className="admin-submit-btn" onClick={onViewProducts}>צפה במוצרים</button>
        </div>
      )}
    </div>
  );
}

export default ImportTab;
