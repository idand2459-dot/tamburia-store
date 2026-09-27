# תמונות באנר לקטגוריות

מקור ה-PNG של הבאנר בעמוד `/category/:slug`. שם הקובץ הוא `cat-<id>.png`,
כש-`<id>` הוא מזהה הקטגוריה מ-`client/src/js/features/catalog/categories.js`:

```
cat-painting.png   cat-kitchen.png   cat-bathroom.png   cat-tools.png
cat-cleaning.png   cat-garden.png    cat-plumbing.png   cat-adhesives.png
cat-locks.png      cat-faucets.png   cat-electrical.png cat-home.png
```

הקומפוזיציה: הנושא בצד **שמאל** של הפריים, ובצד ימין שטח רגוע — שם יושבת
הכותרת, ומשם מגיע הכיסוי הכהה שמבטיח שהיא תיקרא. יחס רחב (בסביבות 3:1).

המרה ל-WebP בשני רוחבים:

```
npm run images:categories
```

הפלט נכנס ל-`client/src/assets/images/categories/` ונכנס ל-git. אין תמונה
לקטגוריה — הבאנר מציג גרסה חלופית באותו גובה, ואין צורך בשינוי קוד כשתמונה
נוספת: `CategoryBanner` מגלה אותה לבד בבנייה הבאה.
