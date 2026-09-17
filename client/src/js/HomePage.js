/**
 * עמוד הבית: כרזה, בחירת קטגוריה, שני המחשבונים וחוות הדעת.
 */
import { useState, useEffect, Fragment } from 'react';
import { useNavigate } from 'react-router-dom';
import CategoryPage from './CategoryPage';
import WhyUs from './WhyUs';
import PaintCalculator from './PaintCalculator';
import ProjectCalculator from './ProjectCalculator';
import FeaturesBanner from './FeaturesBanner';
import ReviewsCarousel from './ReviewsCarousel';
import FAQ from './FAQ';
import { useStore } from './storeContext';

/** מציג את עמוד הבית. */
function HomePage() {
  const navigate = useNavigate();
  const { addBundleToCart } = useStore();

  // הדירוג מגיע מחוות הדעת המאושרות בפועל. אם אין אף אחת, הפריט
  // נעלם — עדיף בלי מספר מאשר מספר שאינו מבוסס על כלום.
  const [rating, setRating] = useState(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/reviews/stats')
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        if (typeof data?.total === 'number' && data.total > 0) {
          setRating({ average: data.average, total: data.total });
        }
      })
      .catch(() => { /* בלי דירוג פשוט לא מציגים את הפריט */ });
    return () => { cancelled = true; };
  }, []);

  // שלושת הראשונים קבועים ונכונים: 406 מוצרים, 12 קטגוריות, ומאז 1991.
  const stats = [
    { value: '400+', label: 'מוצרים' },
    { value: '12', label: 'קטגוריות' },
    { value: '30+', label: 'שנות ניסיון' },
  ];

  if (rating) {
    stats.push({
      value: `★ ${rating.average}`,
      label: rating.total === 1 ? 'ביקורת אחת' : `${rating.total} ביקורות`,
    });
  }

  return (
    <>
      <div className="hero">
        <div className="hero-inner">
          <div className="hero-badge">✦ מאז 1991 · פתח תקווה</div>
          <h1 className="hero-title">כל מה שצריך לבית<br/><span className="hero-accent">במקום אחד</span></h1>
          <p className="hero-sub">מוצרי צביעה · אינסטלציה · כלי עבודה · ממנעולים ועד גינה</p>
          {/* המפרידים נבנים מתוך המערך, כדי שלא יישאר קו תלוי
              כשפריט הדירוג מוסתר */}
          <div className="hero-stats">
            {stats.map((stat, i) => (
              <Fragment key={stat.label}>
                {i > 0 && <div className="hero-stat-div"></div>}
                <div className="hero-stat"><b>{stat.value}</b><span>{stat.label}</span></div>
              </Fragment>
            ))}
          </div>
        </div>
      </div>

      <CategoryPage onSelectCategory={(category) => navigate(`/category/${category.id}`)} />
      <WhyUs />
      <PaintCalculator addBundleToCart={addBundleToCart} />
      <ProjectCalculator addBundleToCart={addBundleToCart} />
      <FeaturesBanner />
      <ReviewsCarousel />
      <FAQ />
    </>
  );
}

export default HomePage;
