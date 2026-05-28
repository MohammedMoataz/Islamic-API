// Lightweight bilingual i18n. Switching language is user-driven via
// chrome.storage.sync["settings"].language — chrome.i18n only follows the
// browser UI locale, so we maintain our own catalogue.

const STRINGS = {
    en: {
        // Popup ----------------------------------------------------------
        "popup.cityFallback":   "Prayer Times",
        "popup.openQuran":      "Read Qur'an",
        "popup.openHadith":     "Browse Hadith",
        "popup.openAzkar":      "Open Azkar",
        "popup.openRadio":      "Open Radio",
        "popup.settings":       "Settings",
        "popup.error":          "Failed to load prayer times. Check your connection or settings.",
        "popup.in":             "in",
        "popup.headerPrayer":   "Prayer",
        "popup.headerTime":     "Time",
        "popup.hadithOfDay":    "Hadith of the Day",
        // Notifications -------------------------------------------------
        "notif.prayer.title":   "Prayer time: {name}",
        "notif.prayer.body":    "{name} is now.",
        "notif.pre.title":      "Upcoming prayer: {name}",
        "notif.pre.body":       "{name} is in {mins} minute{plural}.",
        "notif.iqama.title":    "Iqama: {name}",
        "notif.iqama.body":     "Time to line up for {name}.",
        "notif.test.title":     "Test notification",
        "notif.test.body":      "If you can see this, notifications are working.",
        "notif.azkar.morning":  "Morning Azkar",
        "notif.azkar.evening":  "Evening Azkar",
        "notif.azkar.repeat":   "Repeat × {count}",
        // Prayer names ---------------------------------------------------
        "prayer.Fajr":          "Fajr",
        "prayer.Dhuhr":         "Dhuhr",
        "prayer.Asr":           "Asr",
        "prayer.Maghrib":       "Maghrib",
        "prayer.Isha":          "Isha",
        // Qibla ----------------------------------------------------------
        "qibla.label":          "Qibla",
        "qibla.dragHint":       "Drag to align",
        "qibla.calibrating":    "Calibrating…",
        "qibla.live":           "Live",
        "qibla.tapEnable":      "Tap to enable live compass",
        "qibla.enableBtn":      "Enable live compass",
        "qibla.permDenied":     "Permission denied — drag to align",
        "qibla.noSensor":       "Drag to align (no sensor)",
        "qibla.manual":         "Manual — drag to align",
        // Options page ---------------------------------------------------
        "options.title":            "Prayer Times — Settings",
        "options.location.title":   "Location",
        "options.location.country": "Country",
        "options.location.city":    "City",
        "options.location.method":  "Calculation method",
        "options.notifications.title":   "Notifications",
        "options.notifications.enabled": "Enable prayer notifications",
        "options.notifications.pre":     "Remind me this many minutes before each prayer",
        "options.notifications.test":    "Send test notification",
        "options.hadith.title":          "Hadith",
        "options.hadith.defaultBook":    "Default collection (Hadith of the Day)",
        "options.hadith.dailyEnabled":   "Send Hadith of the Day notification",
        "options.hadith.dailyTime":      "Notification time",
        "options.quran.title":           "Qur'an",
        "options.quran.tafsir":          "Tafsir edition",
        "options.quran.showTafsir":      "Show tafsir by default when opening a surah",
        "options.quran.reciter":         "Reciter (audio)",
        "options.azkar.title":           "Azkar reminders",
        "options.azkar.enabled":         "Send azkar reminder notifications",
        "options.azkar.interval":        "Average minutes between reminders (random within ±50%)",
        "options.azkar.note":            "Windows follow your configured prayer times: morning azkar from Fajr to Maghrib, evening azkar from Maghrib to the next Fajr.",
        "options.azkar.interval.15":     "~ 15 minutes",
        "options.azkar.interval.30":     "~ 30 minutes",
        "options.azkar.interval.60":     "~ 1 hour",
        "options.azkar.interval.90":     "~ 1.5 hours",
        "options.azkar.interval.120":    "~ 2 hours",
        "options.azkar.interval.180":    "~ 3 hours",
        "options.azkar.interval.240":    "~ 4 hours",
        "options.azkar.interval.360":    "~ 6 hours",
        "options.method.0":              "Shia Ithna-Ashari, Leva Institute, Qum",
        "options.method.1":              "University of Islamic Sciences, Karachi",
        "options.method.2":              "Islamic Society of North America",
        "options.method.3":              "Muslim World League",
        "options.method.4":              "Umm Al-Qura University, Makkah",
        "options.method.5":              "Egyptian General Authority of Survey",
        "options.method.7":              "Institute of Geophysics, University of Tehran",
        "options.method.8":              "Gulf Region",
        "options.method.9":              "Kuwait",
        "options.method.10":             "Qatar",
        "options.method.11":             "Majlis Ugama Islam Singapura, Singapore",
        "options.method.12":             "Union Organization Islamic de France",
        "options.method.13":             "Diyanet İşleri Başkanlığı, Turkey",
        "options.method.14":             "Spiritual Administration of Muslims of Russia",
        "options.method.15":             "Moonsighting Committee Worldwide",
        "options.iqama.title":           "Iqama reminders",
        "options.iqama.enabled":         "Notify me at iqama time (configurable minutes after each adhan)",
        "options.iqama.offset.Fajr":     "Fajr — minutes after adhan",
        "options.iqama.offset.Dhuhr":    "Dhuhr — minutes after adhan",
        "options.iqama.offset.Asr":      "Asr — minutes after adhan",
        "options.iqama.offset.Maghrib":  "Maghrib — minutes after adhan",
        "options.iqama.offset.Isha":     "Isha — minutes after adhan",
        "reciter.style.Mujawwad":        "Mujawwad",
        "reciter.style.Murattal":        "Murattal",
        "options.display.title":         "Display",
        "options.display.language":      "Language",
        "options.display.languageEn":    "English",
        "options.display.languageAr":    "العربية",
        "options.display.theme":         "Theme",
        "options.display.themeAuto":     "Match system",
        "options.display.themeLight":    "Light",
        "options.display.themeDark":     "Dark",
        "options.save":                  "Save",
        "options.unsaved":               "Unsaved changes",
        "options.saved":                 "Saved ✓",
        "options.testSent":              "Test notification sent.",
        "options.before":                "before",
        // Reader ---------------------------------------------------------
        "reader.title":             "Qur'an",
        "reader.bookmarks":         "Bookmarks",
        "reader.searchSurah":       "Search surah…",
        "reader.bookmarksEmpty":    "No bookmarks yet — tap 🔖 on any ayah.",
        "reader.resumePrefix":      "Resumed at",
        "reader.resumeGo":          "Go",
        "reader.loading":           "Loading…",
        "reader.btnTafsir":         "📖 Tafsir",
        "reader.btnBookmark":       "🔖 Bookmark",
        "reader.btnBookmarked":     "🔖 Bookmarked",
        "reader.tafsirLoading":     "Loading tafsir…",
        "reader.tafsirUnavailable": "Tafsir not available for this ayah.",
        "reader.tafsirFailed":      "Failed to load tafsir. Check your connection.",
        "reader.btnListen":         "▶ Listen",
        "reader.btnPause":          "⏸ Pause",
        "reader.btnLoading":        "Loading…",
        "reader.errorLoad":         "Failed to load surah {n}. Check your connection.",
        "reader.ayat":              "ayat",
        "reader.surah":             "Surah",
        "reader.revelation.Meccan": "Meccan",
        "reader.revelation.Medinan":"Medinan",
        // Hadith ---------------------------------------------------------
        "hadith.title":             "Hadith",
        "hadith.bookmarksEmpty":    "No bookmarks yet — tap 🔖 on any hadith.",
        "hadith.pagePrev":          "‹ Prev",
        "hadith.pageNext":          "Next ›",
        "hadith.errorLoad":         "Failed to load. Check your connection.",
        "hadith.book.bukhari":      "Sahih al-Bukhari",
        "hadith.book.muslim":       "Sahih Muslim",
        "hadith.book.abu-dawud":    "Sunan Abu Dawud",
        "hadith.book.tirmidzi":     "Jami' at-Tirmidhi",
        "hadith.book.nasai":        "Sunan an-Nasa'i",
        "hadith.book.ibnu-majah":   "Sunan Ibn Majah",
        "hadith.book.malik":        "Muwatta Malik",
        "hadith.book.ahmad":        "Musnad Ahmad",
        "hadith.book.darimi":       "Sunan ad-Darimi",
        "hadith.hadithsTotal":      "hadiths",
        "hadith.showing":           "showing",
        "hadith.pageOf":            "Page",
        "hadith.of":                "of",
        // Azkar ----------------------------------------------------------
        "azkar.title":              "Azkar",
        "azkar.resetAll":           "↻ Reset all",
        "azkar.tapHint":            "Tap to count",
        "azkar.completed":          "Completed",
        "azkar.target":             "Target",
        "azkar.supplications":      "supplications",
        "azkar.errorLoad":          "Failed to load azkar. Check your connection.",
        "azkar.reset":              "Reset",
        "azkar.empty":              "—",
        // Radio ----------------------------------------------------------
        "radio.title":              "Qur'an Radio",
        "radio.searchPlaceholder":  "Search stations…",
        "radio.lastPlayed":         "Last played",
        "radio.statusIdle":         "Idle",
        "radio.statusPlaying":      "Playing",
        "radio.statusPaused":       "Paused",
        "radio.statusLoading":      "Loading…",
        "radio.errorLoad":          "Failed to load station list. Check your connection."
    },
    ar: {
        // Popup ----------------------------------------------------------
        "popup.cityFallback":   "مواقيت الصلاة",
        "popup.openQuran":      "قراءة القرآن",
        "popup.openHadith":     "تصفح الحديث",
        "popup.openAzkar":      "فتح الأذكار",
        "popup.openRadio":      "فتح الراديو",
        "popup.settings":       "الإعدادات",
        "popup.error":          "تعذر تحميل مواقيت الصلاة. تحقق من الاتصال والإعدادات.",
        "popup.in":             "خلال",
        "popup.headerPrayer":   "الصلاة",
        "popup.headerTime":     "الوقت",
        "popup.hadithOfDay":    "حديث اليوم",
        // Notifications -------------------------------------------------
        "notif.prayer.title":   "حان وقت {name}",
        "notif.prayer.body":    "حان وقت صلاة {name} الآن.",
        "notif.pre.title":      "صلاة قادمة: {name}",
        "notif.pre.body":       "صلاة {name} بعد {mins} دقيقة.",
        "notif.iqama.title":    "إقامة صلاة {name}",
        "notif.iqama.body":     "حان وقت إقامة صلاة {name}.",
        "notif.test.title":     "إشعار تجريبي",
        "notif.test.body":      "إذا كنت ترى هذا، فإن الإشعارات تعمل.",
        "notif.azkar.morning":  "أذكار الصباح",
        "notif.azkar.evening":  "أذكار المساء",
        "notif.azkar.repeat":   "كرر × {count}",
        // Prayer names ---------------------------------------------------
        "prayer.Fajr":          "الفجر",
        "prayer.Dhuhr":         "الظهر",
        "prayer.Asr":           "العصر",
        "prayer.Maghrib":       "المغرب",
        "prayer.Isha":          "العشاء",
        // Qibla ----------------------------------------------------------
        "qibla.label":          "القبلة",
        "qibla.dragHint":       "اسحب للمحاذاة",
        "qibla.calibrating":    "جارٍ المعايرة…",
        "qibla.live":           "مباشر",
        "qibla.tapEnable":      "اضغط لتفعيل البوصلة المباشرة",
        "qibla.enableBtn":      "تفعيل البوصلة المباشرة",
        "qibla.permDenied":     "تم رفض الإذن — اسحب للمحاذاة",
        "qibla.noSensor":       "اسحب للمحاذاة (لا يوجد مستشعر)",
        "qibla.manual":         "يدوي — اسحب للمحاذاة",
        // Options page ---------------------------------------------------
        "options.title":            "مواقيت الصلاة — الإعدادات",
        "options.location.title":   "الموقع",
        "options.location.country": "الدولة",
        "options.location.city":    "المدينة",
        "options.location.method":  "طريقة الحساب",
        "options.notifications.title":   "الإشعارات",
        "options.notifications.enabled": "تفعيل إشعارات الصلاة",
        "options.notifications.pre":     "ذكرني بهذا العدد من الدقائق قبل كل صلاة",
        "options.notifications.test":    "إرسال إشعار تجريبي",
        "options.hadith.title":          "الحديث",
        "options.hadith.defaultBook":    "المجموعة الافتراضية (حديث اليوم)",
        "options.hadith.dailyEnabled":   "إرسال إشعار حديث اليوم",
        "options.hadith.dailyTime":      "وقت الإشعار",
        "options.quran.title":           "القرآن",
        "options.quran.tafsir":          "التفسير",
        "options.quran.showTafsir":      "عرض التفسير افتراضيًا عند فتح السورة",
        "options.quran.reciter":         "القارئ (الصوت)",
        "options.azkar.title":           "تذكير الأذكار",
        "options.azkar.enabled":         "إرسال إشعارات تذكير الأذكار",
        "options.azkar.interval":        "متوسط الدقائق بين التذكيرات (عشوائي ضمن ±٥٠٪)",
        "options.azkar.note":            "تتبع الفترات أوقات الصلاة: أذكار الصباح من الفجر إلى المغرب، أذكار المساء من المغرب إلى الفجر التالي.",
        "options.azkar.interval.15":     "~ ١٥ دقيقة",
        "options.azkar.interval.30":     "~ ٣٠ دقيقة",
        "options.azkar.interval.60":     "~ ساعة واحدة",
        "options.azkar.interval.90":     "~ ساعة ونصف",
        "options.azkar.interval.120":    "~ ساعتان",
        "options.azkar.interval.180":    "~ ٣ ساعات",
        "options.azkar.interval.240":    "~ ٤ ساعات",
        "options.azkar.interval.360":    "~ ٦ ساعات",
        "options.method.0":              "الشيعة الإثنا عشرية، معهد ليفا، قُم",
        "options.method.1":              "جامعة العلوم الإسلامية، كراتشي",
        "options.method.2":              "الجمعية الإسلامية لأمريكا الشمالية",
        "options.method.3":              "رابطة العالم الإسلامي",
        "options.method.4":              "جامعة أم القرى، مكة المكرمة",
        "options.method.5":              "الهيئة المصرية العامة للمساحة",
        "options.method.7":              "معهد الجيوفيزياء، جامعة طهران",
        "options.method.8":              "منطقة الخليج",
        "options.method.9":              "الكويت",
        "options.method.10":             "قطر",
        "options.method.11":             "مجلس أوغاما الإسلامي، سنغافورة",
        "options.method.12":             "اتحاد المنظمات الإسلامية في فرنسا",
        "options.method.13":             "ديانة، تركيا",
        "options.method.14":             "الإدارة الدينية لمسلمي روسيا",
        "options.method.15":             "لجنة رؤية الهلال العالمية",
        "options.iqama.title":           "تذكير الإقامة",
        "options.iqama.enabled":         "ذكرني بوقت الإقامة (دقائق قابلة للتعديل بعد كل أذان)",
        "options.iqama.offset.Fajr":     "الفجر — دقائق بعد الأذان",
        "options.iqama.offset.Dhuhr":    "الظهر — دقائق بعد الأذان",
        "options.iqama.offset.Asr":      "العصر — دقائق بعد الأذان",
        "options.iqama.offset.Maghrib":  "المغرب — دقائق بعد الأذان",
        "options.iqama.offset.Isha":     "العشاء — دقائق بعد الأذان",
        "reciter.style.Mujawwad":        "مجوّد",
        "reciter.style.Murattal":        "مرتّل",
        "options.display.title":         "العرض",
        "options.display.language":      "اللغة",
        "options.display.languageEn":    "English",
        "options.display.languageAr":    "العربية",
        "options.display.theme":         "المظهر",
        "options.display.themeAuto":     "تلقائي حسب النظام",
        "options.display.themeLight":    "فاتح",
        "options.display.themeDark":     "داكن",
        "options.save":                  "حفظ",
        "options.unsaved":               "تغييرات غير محفوظة",
        "options.saved":                 "تم الحفظ ✓",
        "options.testSent":              "تم إرسال الإشعار التجريبي.",
        "options.before":                "قبل",
        // Reader ---------------------------------------------------------
        "reader.title":             "القرآن الكريم",
        "reader.bookmarks":         "الإشارات المرجعية",
        "reader.searchSurah":       "ابحث في السور…",
        "reader.bookmarksEmpty":    "لا توجد إشارات بعد — اضغط 🔖 على أي آية.",
        "reader.resumePrefix":      "متابعة من",
        "reader.resumeGo":          "اذهب",
        "reader.loading":           "جارٍ التحميل…",
        "reader.btnTafsir":         "📖 التفسير",
        "reader.btnBookmark":       "🔖 إشارة",
        "reader.btnBookmarked":     "🔖 محفوظة",
        "reader.tafsirLoading":     "جارٍ تحميل التفسير…",
        "reader.tafsirUnavailable": "التفسير غير متاح لهذه الآية.",
        "reader.tafsirFailed":      "تعذر تحميل التفسير. تحقق من الاتصال.",
        "reader.btnListen":         "▶ استمع",
        "reader.btnPause":          "⏸ إيقاف مؤقت",
        "reader.btnLoading":        "جارٍ التحميل…",
        "reader.errorLoad":         "تعذر تحميل السورة {n}. تحقق من الاتصال.",
        "reader.ayat":              "آيات",
        "reader.surah":             "سورة",
        "reader.revelation.Meccan": "مكية",
        "reader.revelation.Medinan":"مدنية",
        // Hadith ---------------------------------------------------------
        "hadith.title":             "الحديث",
        "hadith.bookmarksEmpty":    "لا توجد إشارات بعد — اضغط 🔖 على أي حديث.",
        "hadith.pagePrev":          "‹ السابق",
        "hadith.pageNext":          "التالي ›",
        "hadith.errorLoad":         "تعذر التحميل. تحقق من الاتصال.",
        "hadith.book.bukhari":      "صحيح البخاري",
        "hadith.book.muslim":       "صحيح مسلم",
        "hadith.book.abu-dawud":    "سنن أبي داود",
        "hadith.book.tirmidzi":     "جامع الترمذي",
        "hadith.book.nasai":        "سنن النسائي",
        "hadith.book.ibnu-majah":   "سنن ابن ماجه",
        "hadith.book.malik":        "موطأ مالك",
        "hadith.book.ahmad":        "مسند أحمد",
        "hadith.book.darimi":       "سنن الدارمي",
        "hadith.hadithsTotal":      "حديثًا",
        "hadith.showing":           "يعرض",
        "hadith.pageOf":            "الصفحة",
        "hadith.of":                "من",
        // Azkar ----------------------------------------------------------
        "azkar.title":              "الأذكار",
        "azkar.resetAll":           "↻ إعادة تعيين الكل",
        "azkar.tapHint":            "اضغط للعد",
        "azkar.completed":          "اكتمل",
        "azkar.target":             "الهدف",
        "azkar.supplications":      "ذكرًا",
        "azkar.errorLoad":          "تعذر تحميل الأذكار. تحقق من الاتصال.",
        "azkar.reset":              "إعادة تعيين",
        "azkar.empty":              "—",
        // Radio ----------------------------------------------------------
        "radio.title":              "إذاعة القرآن",
        "radio.searchPlaceholder":  "ابحث في المحطات…",
        "radio.lastPlayed":         "آخر تشغيل",
        "radio.statusIdle":         "خامل",
        "radio.statusPlaying":      "يعمل",
        "radio.statusPaused":       "متوقف مؤقتًا",
        "radio.statusLoading":      "جارٍ التحميل…",
        "radio.errorLoad":          "تعذر تحميل قائمة المحطات. تحقق من الاتصال."
    }
};

const LANG_KEY = "language";
let currentLocale = "en";
let loaded = false;

export async function loadLocale() {
    const obj = await chrome.storage.sync.get("settings");
    const settings = obj.settings || {};
    currentLocale = settings.language === "ar" ? "ar" : "en";
    loaded = true;
    return currentLocale;
}

export function getLocale() {
    return currentLocale;
}

export function t(key, fallback) {
    return STRINGS[currentLocale]?.[key]
        ?? STRINGS.en[key]
        ?? (fallback ?? key);
}

// Replace {placeholder} tokens in a template string with values from `vars`.
// Used for notification messages that interpolate prayer names, counts, etc.
export function format(template, vars) {
    if (!vars) return String(template);
    return String(template).replace(/\{(\w+)\}/g, (_, k) =>
        Object.prototype.hasOwnProperty.call(vars, k) ? String(vars[k]) : `{${k}}`
    );
}

// Convenience: lookup + interpolate in one call.
export function tf(key, vars, fallback) {
    return format(t(key, fallback), vars);
}

export function applyI18n(root = document) {
    document.documentElement.dir = currentLocale === "ar" ? "rtl" : "ltr";
    document.documentElement.lang = currentLocale;

    for (const el of root.querySelectorAll("[data-i18n]")) {
        const key = el.dataset.i18n;
        const text = t(key);
        if (el.tagName === "INPUT") {
            const type = (el.type || "").toLowerCase();
            if (type === "search" || type === "text" || type === "number") {
                el.placeholder = text;
                continue;
            }
        }
        if (el.hasAttribute("data-i18n-attr")) {
            el.setAttribute(el.dataset.i18nAttr, text);
        } else {
            el.textContent = text;
        }
    }
}

// Top-level bootstrap — call once near the top of every page module.
// Returns a promise that resolves once the locale is loaded so callers can
// optionally await before rendering dynamic content.
export async function bootstrapI18n() {
    await loadLocale();
    applyI18n();
    chrome.storage.onChanged.addListener((changes, area) => {
        if (area !== "sync" || !changes.settings) return;
        const next = changes.settings.newValue?.language === "ar" ? "ar" : "en";
        if (next !== currentLocale) {
            currentLocale = next;
            applyI18n();
        }
    });
}
