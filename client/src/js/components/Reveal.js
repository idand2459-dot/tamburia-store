/**
 * עוטף אלמנט בחשיפה בגלילה.
 *
 * ה-prop `as` קיים כדי שהחשיפה תוכל להיות האלמנט עצמו ולא div סביבו: בתוך
 * רשת, wrapper הוא זה שהופך לפריט הרשת ושובר את המידות של הכרטיס. לכן
 * בכרטיסים כותבים <Reveal as="div" className="category-card"> ולא
 * <Reveal><div className="category-card">.
 */
import useReveal from '../hooks/useReveal';

/**
 * השהיה מדורגת לפי מקום הפריט ברשימה.
 *
 * חסום ב-max כדי שהכרטיס ה-12 לא יחכה כמעט שנייה — עם 12 קטגוריות ו-80ms
 * לפריט, בלי החסימה הכרטיס האחרון היה מתחיל רק ב-880ms.
 */
export const stagger = (index, step = 80, max = 480) => Math.min(index * step, max);

/** מציג את הילדים, ומחשיף אותם כשהאלמנט נכנס למסך. */
function Reveal({
  as: Tag = 'div',
  variant = 'up',
  delay = 0,
  className = '',
  style,
  children,
  ...rest
}) {
  const { ref, isVisible } = useReveal();

  const classes = ['reveal', `reveal--${variant}`, isVisible ? 'is-visible' : '', className]
    .filter(Boolean)
    .join(' ');

  return (
    <Tag
      ref={ref}
      className={classes}
      style={{ ...style, '--reveal-delay': `${delay}ms` }}
      {...rest}
    >
      {children}
    </Tag>
  );
}

export default Reveal;
