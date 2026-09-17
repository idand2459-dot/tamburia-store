/**
 * עמוד הבית: כרזה, בחירת קטגוריה, שני המחשבונים וחוות הדעת.
 */
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

  return (
    <>
      <div className="hero">
        <div className="hero-inner">
          <div className="hero-badge">✦ מאז 1991 · פתח תקווה</div>
          <h1 className="hero-title">כל מה שצריך לבית<br/><span className="hero-accent">במקום אחד</span></h1>
          <p className="hero-sub">מוצרי צביעה · אינסטלציה · כלי עבודה · ממנעולים ועד גינה</p>
          <div className="hero-stats">
            <div className="hero-stat"><b>400+</b><span>מוצרים</span></div>
            <div className="hero-stat-div"></div>
            <div className="hero-stat"><b>12</b><span>קטגוריות</span></div>
            <div className="hero-stat-div"></div>
            <div className="hero-stat"><b>30+</b><span>שנות ניסיון</span></div>
            <div className="hero-stat-div"></div>
            <div className="hero-stat"><b>★ 4.9</b><span>לקוחות מרוצים</span></div>
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
