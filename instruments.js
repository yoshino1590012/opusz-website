/* ============================================================================
   OPUS.Z — Shared instrument taxonomy (single source of truth)
   Loaded by musicians.html (public listing/filter) and
   musician-dashboard.html (the instrument picker dropdown).

   Each instrument has: slug (matches ?cat=… and nav.js menu links),
   en (canonical English label — this is what gets STORED on the musician),
   zh (Chinese label for display).

   Families group instruments so a musician who picks "Oboe" automatically
   shows up on the Oboe page, the Woodwinds (family) page, and All Musicians.
   Labels mirror nav.js so the dropdown lines up exactly with the category
   pages already in the site.
   ========================================================================== */
(function () {
  var FAMILIES = [
    { slug: 'strings', en: 'Strings', zh: '弦樂器', items: [
      { slug: 'violin',     en: 'Violin',      zh: '小提琴' },
      { slug: 'viola',      en: 'Viola',       zh: '中提琴' },
      { slug: 'cello',      en: 'Cello',       zh: '大提琴' },
      { slug: 'doublebass', en: 'Double Bass', zh: '低音大提琴' },
      { slug: 'harp',       en: 'Harp',        zh: '豎琴' }
    ]},
    { slug: 'woodwinds', en: 'Woodwinds', zh: '木管樂器', items: [
      { slug: 'flute',     en: 'Flute',     zh: '長笛' },
      { slug: 'piccolo',   en: 'Piccolo',   zh: '短笛' },
      { slug: 'oboe',      en: 'Oboe',      zh: '雙簧管' },
      { slug: 'clarinet',  en: 'Clarinet',  zh: '單簧管' },
      { slug: 'saxophone', en: 'Saxophone', zh: '薩克斯風' },
      { slug: 'bassoon',   en: 'Bassoon',   zh: '巴松管' }
    ]},
    { slug: 'brass', en: 'Brass', zh: '銅管樂器', items: [
      { slug: 'frenchhorn', en: 'French Horn', zh: '法國號' },
      { slug: 'trumpet',    en: 'Trumpet',     zh: '小號' },
      { slug: 'trombone',   en: 'Trombone',    zh: '長號' },
      { slug: 'euphonium',  en: 'Euphonium',   zh: '上低音號' },
      { slug: 'tuba',       en: 'Tuba',        zh: '大號' }
    ]},
    { slug: 'percussion', en: 'Percussion', zh: '打擊樂器', items: [
      { slug: 'drummers',        en: 'Drummers',                  zh: '鼓手' },
      { slug: 'orchpercussion',  en: 'Orchestral Percussion',     zh: '管弦打擊樂' },
      { slug: 'worldpercussion', en: 'World Percussion',          zh: '世界打擊樂' },
      { slug: 'marchingperc',    en: 'Marching Corps Percussion', zh: '行進打擊樂' }
    ]},
    { slug: 'keyboard', en: 'Keyboard', zh: '鍵盤樂器', items: [
      { slug: 'piano',       en: 'Piano',              zh: '鋼琴' },
      { slug: 'collabpiano', en: 'Collaborative Piano', zh: '合作鋼琴' },
      { slug: 'pipeorgan',   en: 'Pipe Organ',         zh: '管風琴' }
    ]},
    { slug: 'voice', en: 'Voice', zh: '聲樂', items: [
      { slug: 'soprano',      en: 'Soprano',       zh: '女高音' },
      { slug: 'mezzosoprano', en: 'Mezzo-soprano', zh: '次女高音' },
      { slug: 'tenor',        en: 'Tenor',         zh: '男高音' },
      { slug: 'baritone',     en: 'Baritone',      zh: '男中音' },
      { slug: 'choral',       en: 'Choral',        zh: '合唱' }
    ]},
    { slug: 'other', en: 'Other', zh: '其他', items: [
      { slug: 'conductor', en: 'Conductor', zh: '指揮' },
      { slug: 'tuner',     en: 'Tuner',     zh: '調音師' }
    ]}
  ];

  var FAMILY_OF = {};   // 'Violin' -> 'strings' ; 'violin' -> 'strings'
  var BY_SLUG   = {};   // 'violin' -> { slug, en, zh, family }
  var BY_LABEL  = {};   // 'violin' (en lowercased) -> { slug, en, zh, family }
  var FAMILY_LABEL = {}; // 'strings' -> { en:'Strings', zh:'弦樂器' }

  FAMILIES.forEach(function (f) {
    FAMILY_LABEL[f.slug] = { en: f.en, zh: f.zh };
    f.items.forEach(function (it) {
      var rec = { slug: it.slug, en: it.en, zh: it.zh, family: f.slug };
      FAMILY_OF[it.en]  = f.slug;
      FAMILY_OF[it.slug] = f.slug;
      BY_SLUG[it.slug]  = rec;
      BY_LABEL[it.en.toLowerCase()] = rec;
    });
  });

  window.OPUSZ_FAMILIES    = FAMILIES;
  window.OPUSZ_FAMILY_LABEL = FAMILY_LABEL;
  window.OPUSZ_INST = {
    FAMILY_OF: FAMILY_OF,
    BY_SLUG:   BY_SLUG,
    BY_LABEL:  BY_LABEL,
    // Resolve any user-entered label/slug to its canonical record (or null).
    resolve: function (v) {
      if (!v) return null;
      var s = String(v).trim();
      return BY_SLUG[s] || BY_LABEL[s.toLowerCase()] || null;
    }
  };
})();
