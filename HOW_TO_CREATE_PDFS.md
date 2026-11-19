# איך מייצרים את מבחני התרגול וה-PDF

המדריך מתאר את התהליך שבו נוצרו 5 המבחנים, כך שאפשר לייצר עוד מבחנים באותה שיטה.

## 1. מחקר וניתוח (נעשה פעם אחת)
1. **מקורות רשמיים** (משרד החינוך / ראמ"ה – לא נכללים ב-repo בגלל זכויות יוצרים, להוריד ישירות):
   - המבחן האמיתי של תשפ"ה: https://meyda.education.gov.il/files/Rama/gifted-students-heb-2025.pdf
   - מחוון: https://meyda.education.gov.il/files/Rama/mechvan-gifted-students-heb-2025.pdf
   - שאלות לדוגמה: https://meyda.education.gov.il/files/gifted/sinun_b-c_example_heb.pdf
2. **מקורות הכנה חינמיים**: מכון נועם, גאונצ'יק, ילד גאון, הפרופסור (קישורים ב-`docs/coverage.md`).
3. מהניתוח נבנו:
   - `docs/topics.md` – נושאים, תתי-נושאים וטריקים.
   - `docs/coverage.md` – כל סוגי השאלות שנמצאו ב-6 המקורות.

## 2. קבצי הקונטקסט למחולל
| קובץ | תפקיד |
|---|---|
| `docs/generator_context.md` | המפרט: מבנה המבחן, כללי איכות, פורמט HTML, לקחים מסבבים קודמים |
| `docs/assignments.md` | **מחייב**: לכל מבחן – נושאי קטעים, סוגי שאלות, שמות ומספרים מדויקים |
| `docs/topics.md` | נושאים וטריקים (גם למפתח התשובות) |
| `template/reference_test.html` | מבחן תקין מלא לחיקוי מבנה ה-HTML (לא התוכן) |
| `template/style.css` | עיצוב משותף – RTL, ניקוד, תרגילים LTR, טבלאות חידות |

**למה `assignments.md`?** סוכנים שרצים במקביל מתכנסים לאותם מספרים ושמות (בסבב הראשון `3∆+3∆=76` הופיע בכל 5 המבחנים). לכן המתאם קובע מראש לכל מבחן את כל המספרים, השמות והסוגים, והסוכן כותב רק טקסט, מסיחים והסברים.

## 3. ייצור מבחן (סוכן לכל מבחן)
לכל מבחן הורץ סוכן נפרד (Claude, מודל Fable) עם ההנחיה:
> קרא את `docs/assignments.md` (חלק "מבנה משותף" + "מבחן N"), `docs/generator_context.md`, `docs/topics.md`, `docs/coverage.md`, `template/reference_test.html`, `template/style.css`. כתוב את `tests/test_N.html` בעברית מנוקדת, תשובה נכונה אחת לכל שאלה, פיזור אותיות מאוזן, הפניות לשורות מדויקות, שורות קטע ≤13 מילים, מפתח עם הסבר וטריק לכל פריט. רנדר, בדוק כל עמוד, ופתור מחדש מתוך ה-PDF.

כללי HTML עיקריים (מפורט ב-`generator_context.md`):
- שורות קטע: `<ol class="lines"><li>…</li></ol>` – המספור אוטומטי; שורה = `li` אחד.
- שאלה: `<div class="q"><div class="stem">…</div><ol class="opts"><li><span class="l">א.</span>…</li></ol></div>`.
- תרגיל: `<span class="ex">47 + <span class="blank"></span> = 62</span>` (כיוון LTR).
- חידות ציורים: `<table class="puzzle">`; אחרי ☀ ☂ ✈ להוסיף `U+FE0E` (אחרת יוצאים כאמוג'י צבעוני).
- סימן חילוק: `:`. מעבר עמוד: `<div class="page-break"></div>`.

## 4. בדיקת איכות (לכל מבחן)
0. **פתרון עיוור**: `python3 scripts/dump.py tests/test_N.html | sed '/פתרונות/,$d' > blind.txt`, ולתת לסוכן נפרד (לא המחולל) רק את הקובץ הזה: לפתור הכול בלי מפתח, ולסמן עמימות, טעויות עובדתיות, פערים לוגיים וניסוח. אחר כך להשוות את התשובות שלו למפתח. בסבב 3 זה מצא פער לוגי בהוראות, עובדה לא מדויקת וניסוח מבלבל – שלושתם עברו את הבדיקה הרגילה.
1. `python3 scripts/dump.py tests/test_N.html` – מוציא את הטקסט בלי ניקוד, עם מספרי שורות, לבדיקה מהירה.
2. לפתור כל פריט באופן עצמאי ולהשוות למפתח; לבדוק כל הפניה לשורה; לוודא שכל סוג מ-`assignments.md` קיים.
3. `python3 scripts/dupcheck.py tests/test_*.html` – מאתר תרגילים ושמות שחוזרים בין מבחנים.
4. תיעוד ב-`docs/review_notes.md`.

## 5. יצירת ה-PDF
דרישות: macOS + Google Chrome (headless), חיבור לאינטרנט (גופן Noto Sans Hebrew נטען מ-Google Fonts), `poppler` לבדיקות (`brew install poppler`).

```bash
scripts/render.sh tests/test_1.html pdf/test_1.pdf
```

לכל המבחנים:
```bash
for i in 1 2 3 4 5; do scripts/render.sh tests/test_$i.html pdf/test_$i.pdf; done
```

בלינוקס – לשנות את נתיב `CH` ב-`scripts/render.sh` ל-`google-chrome` או `chromium`.

### בדיקת ה-PDF
```bash
pdffonts pdf/test_1.pdf
```
צריך להופיע `NotoSansHebrew` (עברית ומנוקדת) ו-`NotoSansSymbols2` (סמלי החידות).

```bash
pdftoppm -r 60 -png pdf/test_1.pdf /tmp/check
```
לעבור על התמונות: אין שורת קטע שנשברה לשתיים, תרגילים נקראים משמאל לימין, הסמלים בגודל אחיד.

## בעיות שנתקלנו בהן
| בעיה | פתרון |
|---|---|
| ✈ ♠ ♥ יוצאים קטנים | גופן `PuzzleSym` מקומי (`template/fonts`) עם `unicode-range` לסמלים בלבד |
| גופן הסמלים הפריד ספרות ("1 4") | הוגבל ב-`unicode-range` כך שלא יחול על ספרות |
| ☀ ☂ ✈ כאמוג'י צבעוני | `U+FE0E` אחרי הסמל |
| קטע ארוך גולש לעמוד נוסף | `ol.lines.long` לקטע ≥20 שורות, `div.tight` לעמוד של 7 שאלות |
| כפילויות בין מבחנים | הקצאה מראש ב-`assignments.md` + `dupcheck.py` |

## 6. הבוחן המקוון
הבוחן (`quiz.html`) קורא את אותו HTML של המבחנים – אין קובץ נפרד לתחזק.
- **תשובות**: לשאלה עם א–ד, ולשאלה שתשובתה מספר אחד, הבוחן קורא את התשובה מעמודת "תשובה" במפתח. לכל השאר (טווח, אי-שוויון, מילה) מוסיפים ל-`.q` מאפיין `data-accept` – הפורמט ב-`docs/assignments.md`.
- **סדר**: שורה אחת במפתח לכל `.q`, באותו סדר.
- **בנייה** (אחרי כל שינוי במבחן):
```bash
python3 scripts/build_quiz_data.py
```
- **בדיקות**:
```bash
node --test test/
```
בודק את פונקציות הבדיקה, וגם שכל מבחן ב-`tests/` ניתן לבדיקה (מספר שאלות = שורות מפתח, ולכל שאלה פתוחה יש תשובה מוגדרת).
- **ידנית**: לפתוח את `quiz.html`, לפתור מבחן, ולוודא ציון מלא כשעונים לפי המפתח.
