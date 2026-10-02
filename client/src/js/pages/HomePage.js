/**
 * עמוד הבית: כרזה ורצועת היתרונות מתחתיה, בחירת קטגוריה, למה אנחנו,
 * שני המחשבונים, חוות הדעת ושאלות נפוצות.
 */
import { useState, useEffect, useRef, Fragment } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Crown, Star, ArrowDown, PaintRoller } from 'lucide-react';
import CategoryPage from './CategoryPage';
import WhyUs from '../components/WhyUs';
import PaintCalculator from '../features/calculator/PaintCalculator';
import ProjectCalculator from '../features/calculator/ProjectCalculator';
import FeaturesBanner from '../components/FeaturesBanner';
import ReviewsCarousel from '../features/catalog/ReviewsCarousel';
import FAQ from './FAQ';
import Reveal from '../components/Reveal';
import { useStore } from '../context/storeContext';
import { usePageTitle } from '../hooks/usePageTitle';
import { formatRating } from '../utils/rating';
import scrollToSection from '../utils/scrollToSection';
import { CATEGORIES_SELECTOR, PAINT_CALC_SELECTOR } from '../utils/sections';
import { getReviewStats } from '../services/reviewService';
import heroWide from '../../assets/images/sections/hero-tools-1916.webp';
import heroMid from '../../assets/images/sections/hero-tools-1600.webp';
import heroMobile from '../../assets/images/sections/hero-tools-mobile-900.webp';

/**
 * גולל אל מקטע בעמוד כשההגעה אליו ביקשה את זה ב-state של הניווט.
 * כרגע יש צרכן אחד: כפתור "לקטגוריות" במסך ה-404, שאין לו נתיב משלו
 * לנווט אליו כי רשת הקטגוריות היא מקטע בעמוד הזה.
 *
 * ה-requestAnimationFrame אינו קישוט. StoreLayout מאפס את הגלילה
 * לראש העמוד בכל מעבר כתובת, ואפקט של רכיב אב רץ *אחרי* האפקטים של
 * ילדיו — כלומר אחרי זה. דחייה של פריים אחד מציבה את הגלילה אחרי
 * האיפוס, וזה גם נראה טוב יותר: העמוד נפתח בראשו וגולל משם.
 */
function useScrollToSection(state) {
  useEffect(() => {
    const selector = state?.scrollTo;
    if (!selector) return undefined;

    const frame = requestAnimationFrame(() => scrollToSection(selector));
    return () => cancelAnimationFrame(frame);
  }, [state]);
}

/** מציג את עמוד הבית. */
function HomePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { addBundleToCart } = useStore();
  // null: כותרת הבית מ-index.html. המגירות שנפתחות מעל העמוד הזה
  // קובעות את שלהן ומחזירות את זו בסגירה.
  usePageTitle(null);

  useScrollToSection(location.state);

  // הדירוג מגיע מחוות הדעת המאושרות בפועל. אם אין אף אחת, הפריט
  // נעלם — עדיף בלי מספר מאשר מספר שאינו מבוסס על כלום.
  const [rating, setRating] = useState(null);

  // אנימציית הכניסה של תמונת הכרזה מתחילה בטעינה שלה ולא ביצירת האלמנט,
  // כדי שבחיבור איטי היא לא תופיע בבת אחת אחרי שהאנימציה כבר נגמרה.
  const [heroLoaded, setHeroLoaded] = useState(false);
  const heroImgRef = useRef(null);

  useEffect(() => {
    // תמונה שכבר ב-cache מסיימת להיטען לפני שה-onLoad מחובר, ואז האירוע
    // לא יירה לעולם. complete מכסה גם את המקרה הזה.
    if (heroImgRef.current?.complete) setHeroLoaded(true);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    getReviewStats({ signal: controller.signal })
      .then((data) => {
        if (typeof data?.total === 'number' && data.total > 0) {
          setRating({ average: data.average, total: data.total });
        }
      })
      .catch(() => { /* בלי דירוג פשוט לא מציגים את הפריט */ });
    return () => controller.abort();
  }, []);

  // שלושת הראשונים קבועים ונכונים: 406 מוצרים, 12 קטגוריות, ומאז 1991.
  const stats = [
    { value: '400+', label: 'מוצרים' },
    { value: '12', label: 'קטגוריות' },
    { value: '30+', label: 'שנות ניסיון' },
  ];

  if (rating) {
    stats.push({
      value: <><Star size={16} fill="currentColor" aria-hidden="true" /> {formatRating(rating.average)}</>,
      label: rating.total === 1 ? 'ביקורת אחת' : `${rating.total} ביקורות`,
    });
  }

  return (
    <>
      <div className="hero">
        {/* <picture> ולא רקע ב-CSS: כך הדפדפן מוריד רק את הגרסה שהוא צריך,
            והתמונה — שהיא ה-paint הגדול של העמוד — מקבלת עדיפות. דקורטיבית,
            ולכן alt ריק ו-aria-hidden.
            שים לב: ה-1916w הוא הרוחב המקורי של הקובץ ולא 2400 — המקור צר
            מזה, ו-upscale היה עולה בבתים בלי להוסיף פרט.
            בלי aria-hidden על ה-picture: הוא אינו אלמנט מרונדר ואינו תומך
            ב-ARIA (eslint מתלונן בצדק). alt="" על ה-img הוא מה שמוציא תמונה
            דקורטיבית מעץ הנגישות. */}
        <picture className={`hero-media ${heroLoaded ? 'is-loaded' : ''}`}>
          <source media="(max-width: 768px)" srcSet={heroMobile} />
          <img
            ref={heroImgRef}
            onLoad={() => setHeroLoaded(true)}
            src={heroMid}
            srcSet={`${heroMid} 1600w, ${heroWide} 1916w`}
            sizes="100vw"
            alt=""
            fetchPriority="high"
            decoding="async"
          />
        </picture>
        <div className="hero-inner">
          <div className="hero-badge"><Crown size={14} aria-hidden="true" /> מאז 1991 · פתח תקווה</div>
          <h1 className="hero-title">כל מה שצריך לבית<br/><span className="hero-accent">במקום אחד</span></h1>
          <p className="hero-sub">מוצרי צביעה · אינסטלציה · כלי עבודה · ממנעולים ועד גינה</p>
          {/* שני הכפתורים בשורה משל עצמם. קודם הם היו אלמנטים inline-flex
              ישר מתחת לתת-הכותרת, ולכן חלקו שורה עם סרגל הסטטיסטיקות
              שגם הוא inline — במסך רחב שניהם נכנסו ל-820px של .hero-inner
              והכפתור נראה תקוע לצד הסרגל. עוטף block פותר את זה בלי
              לגעת בסרגל.
              המשני מוצג רק במסך רחב (features/home/_hero.css): בטלפון
              יש כבר כפתור צף למחשבון הצבע, ושני כפתורים שם רק דוחקים
              את הסטטיסטיקות על הכלים שבתמונה. */}
          <div className="hero-actions">
            <button
              type="button"
              className="hero-cta"
              onClick={() => scrollToSection(CATEGORIES_SELECTOR)}>
              לכל הקטגוריות
              <ArrowDown size={20} aria-hidden="true" />
            </button>
            <button
              type="button"
              className="hero-cta hero-cta--ghost"
              onClick={() => scrollToSection(PAINT_CALC_SELECTOR)}>
              מחשבון צבע
              <PaintRoller size={20} aria-hidden="true" />
            </button>
          </div>
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

      {/* רצועת היתרונות צמודה לכרזה ועל אותו רקע כהה, ולכן היא נקראת כבסיס
          שלה: אזור החלוקה, איסוף באותו יום, 30 שנה וייעוץ מקצועי הם מה
          שמבקר רוצה לדעת בשניות הראשונות. */}
      <Reveal variant="up"><FeaturesBanner /></Reveal>
      <CategoryPage onSelectCategory={(category) => navigate(`/category/${category.id}`)} />
      <WhyUs />
      <Reveal variant="up"><PaintCalculator addBundleToCart={addBundleToCart} /></Reveal>
      {/* ProjectCalculator מחשיף את עצמו ב-IntersectionObserver משלו — עטיפה
          שנייה כאן הייתה מריצה שתי אנימציות על אותו תוכן. */}
      <ProjectCalculator addBundleToCart={addBundleToCart} />
      <Reveal variant="up"><ReviewsCarousel /></Reveal>
      <Reveal variant="up"><FAQ /></Reveal>
    </>
  );
}

export default HomePage;
