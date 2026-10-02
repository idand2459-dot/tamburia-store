/**
 * הכותרת הכהה שפותחת כל עמוד תוכן.
 *
 * אודות, צור קשר ומדיניות החזרים נשאו כל אחד כותרת משלו (.about-hero,
 * .contact-hero, .returns-hero) שהייתה כמעט העתק של השתיים האחרות. זהו
 * רכיב אחד במקומן, והוא ממשיך את העולם של ה-Hero בדף הבית: משטח כהה,
 * זוהר סגול אחד רך, וקו שיער אדום-סגול על הקצה התחתון — הגבול שבין
 * המסגרת הכהה לתוכן הבהיר שמתחתיה.
 */

/** מציג כותרת עמוד כהה. `accent` הוא החלק האדום של הכותרת, אם יש. */
function PageHeader({ pill, title, accent, subtitle }) {
  return (
    <header className="page-header">
      <div className="page-header-inner">
        {pill && <span className="section-pill">{pill}</span>}
        <h1 className="page-header-title">
          {title}
          {accent && <> <span className="page-header-accent">{accent}</span></>}
        </h1>
        {subtitle && <p className="page-header-sub">{subtitle}</p>}
      </div>
    </header>
  );
}

export default PageHeader;
