<div dir="rtl">

# 🕌 Api الإسلاميه — إضافة المتصفح

هذا المشروع هو تطبيق (إضافة متصفح Chrome) يهدف إلى توفير مواقيت الصلاة والمصادر الإسلامية المتعلقة في مكان واحد. يمكنك الحصول على مواقيت الصلاة الدقيقة لمدينة القاهرة في مصر وقراءة القرآن الكريم والتفسير والاستماع إلى الأحاديث النبوية واستعراض الأذكار المهمة. يتم استخدام واجهات برمجة التطبيقات المشار إليها في هذا الملف لجلب المعلومات اللازمة.

</div>

---

# 🕌 Islamic API — Browser Extension

This project is a **Chrome extension** that brings prayer timings and related Islamic resources into one place. You can get accurate prayer timings for Cairo, Egypt, read the Holy Quran, access its interpretation (Tafsir), listen to Hadiths, and browse important Adhkar (supplications). The APIs catalogued at the bottom of this document supply all the data.

---

## 📁 Project Structure

```
Islamic-api/
├── manifest.json            # Extension metadata, permissions, entry points (mandatory)
├── background.js            # Service worker — alarms, notifications, offscreen lifecycle
├── popup/
│   ├── popup.html           # Popup UI shown on toolbar-icon click
│   ├── popup.js             # Popup logic (fetch + render prayer times, etc.)
│   ├── popup.css            # Popup styling
│   └── styles.css
├── content/
│   ├── content.js           # Content scripts injected into web pages
│   └── content.css          # Content-script styling
├── options/
│   ├── options.html         # Settings page UI
│   ├── options.js           # Settings logic
│   └── options.css          # Settings styling
├── images/                  # Toolbar / store / notification icons
│   ├── icon-16.png
│   ├── icon-48.png
│   └── icon-128.png
├── styles/
│   └── style.css            # Shared styles (design tokens)
├── scripts/
│   └── utility.js           # Shared JavaScript helpers
├── API_README.md            # (merged into this README)
└── README.md                # Project documentation (this file)
```

### Key Files and Their Roles

1. **`manifest.json`** *(mandatory)* — Defines the extension's metadata, permissions, and behavior.
2. **`background.js`** *(optional but recommended)* — Background service worker that handles persistent tasks: scheduling prayer-time alarms, firing notifications, and updating the toolbar badge. Required for any persistent functionality, since the popup's JS context is destroyed every time it closes.
3. **`popup/`** *(optional)* — UI shown when the user clicks the extension icon.
   - `popup.html` defines the structure.
   - `popup.js` adds interactivity.
   - `popup.css` styles the popup.
4. **`content/`** *(optional)* — Scripts that run on web pages matched by `manifest.json` and can interact with the page's DOM.
5. **`options/`** *(optional)* — A settings page where users configure their city, calculation method, reciter, language, etc.

### Icons

Include icons in the required sizes (16×16, 48×48, 128×128 px) under `images/`. They are used for the toolbar icon, the extensions page, and notifications.

### Additional Considerations

- **Bundling / minification:** for larger builds, use Webpack, Vite, or Rollup to organize and optimize files.
- **Testing & debugging:** load the unpacked folder via *Developer Mode* in Chrome (`chrome://extensions`).

This file structure keeps the extension well-organized, modular, and ready for development or publishing.

---

<div dir="rtl">

# 🌐 واجهات برمجة التطبيقات (APIs)

## مواقيت الصلاة

يمكنك الحصول على مواقيت الصلاة باستخدام [API مواقيت الصلاة](https://api.aladhan.com/v1/timingsByCity?city=cairo&country=egypt&method=8).

## القرآن الكريم

يمكنك الوصول إلى القرآن الكريم من خلال [API القرآن الكريم](http://api.alquran.cloud/v1/surah/114).

## القرآن الكريم صوت

يمكنك الوصول إلى القرآن الكريم صوت من خلال [API القرآن الكريم صوت](https://api.quran.com/api/v4/chapter_recitations/1).

( يمكنك تغيير القارئ عن طريق تبديل ال id برقم مثل : `https://api.quran.com/api/v4/chapter_recitations/$id` )

## التفسير

يمكنك الحصول على التفسير من خلال [API التفسير](https://quranenc.com/api/v1/translation/sura/arabic_moyassar/114).

## الأحاديث

يمكنك الوصول إلى الأحاديث من خلال [API الأحاديث](https://hadis-api-id.vercel.app/hadith/abu-dawud?page=2&limit=300).
<br/>

يمكنك الوصول إلى احاديث اخري من خلال [API 2 الأحاديث](https://cdn.jsdelivr.net/gh/fawazahmed0/hadith-api@1/editions.json).

## الأذكار

يمكنك الحصول على الأذكار من خلال [API الأذكار](https://raw.githubusercontent.com/nawafalqari/azkar-api/56df51279ab6eb86dc2f6202c7de26c8948331c1/azkar.json).

## مصدر آخر

يمكنك الاطلاع على مصدر آخر للأذكار من خلال [هذا الرابط](https://www.hisnmuslim.com/api/ar/27.json).

## راديو ل 18 قارئ واذاعات القرأن الكريم

يمكنك الحصول على الراديو من خلال [API الراديو](https://data-rosy.vercel.app/radio.json).

</div>

---

<div dir="ltr">

# 🌐 APIs

## Prayer Timings

You can retrieve the prayer timings using the [Prayer Times API](https://api.aladhan.com/v1/timingsByCity?city=cairo&country=egypt&method=8).

## Holy Quran

You can access the Holy Quran through the [Quran API](http://api.alquran.cloud/v1/surah/114).

## Holy Quran Audio

You can access the Holy Quran Audio through the [Holy Quran Audio API](https://api.quran.com/api/v4/chapter_recitations/1).

(You can change the reader by swapping the ID with a number, e.g.: `https://api.quran.com/api/v4/chapter_recitations/$id`)

## Tafsir

You can obtain the Tafsir using the [Tafsir API](https://quranenc.com/api/v1/translation/sura/arabic_moyassar/114).

## Hadiths

You can access the Hadiths through the [Hadith API](https://hadis-api-id.vercel.app/hadith/abu-dawud?page=2&limit=300).
<br/>

You can access other hadiths through the [Hadith API 2](https://cdn.jsdelivr.net/gh/fawazahmed0/hadith-api@1/editions.json).

## Azkar

You can retrieve Adhkar through the [Azkar API](https://raw.githubusercontent.com/nawafalqari/azkar-api/56df51279ab6eb86dc2f6202c7de26c8948331c1/azkar.json).

## Another Source

You can refer to another source of Azkar through [this link](https://www.hisnmuslim.com/api/ar/27.json).

## Radio — 18 reciters and broadcasts of the Holy Quran

You can get the radio through the [Radio API](https://data-rosy.vercel.app/radio.json).

</div>

---

## 🗺️ Roadmap

For the full enhancement plan that maps every API above to concrete extension features (next-prayer countdown, Hijri date, Qibla, Qur'an reader + audio + tafsir, Hadith of the day, Azkar with tasbih counter, Qur'an radio, options page, i18n), see [`ENHANCEMENT_PLAN.md`](./ENHANCEMENT_PLAN.md).
