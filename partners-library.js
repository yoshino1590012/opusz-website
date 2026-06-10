/* ============================================================================
 * partners-library.js — uniform wordmark renderer for the
 * "Trusted & worked with" strip.
 *
 * No logo artwork is used (that would raise trademark issues). Every partner the
 * musician types is rendered as a neutral, uniform monochrome WORDMARK — the
 * brand name set in one consistent typeface — so the whole strip looks cohesive
 * while staying legally safe (a factual name in plain type is not a trademark
 * reproduction). config.partners stays a plain string array.
 * ========================================================================== */
(function (global) {
  var WM_FONT   = "'Inter', 'Helvetica Neue', Arial, sans-serif";
  var WM_SIZE   = 14;
  var WM_WEIGHT = 600;
  var WM_LS     = 2.2;   // letter-spacing

  function esc(s){ return String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

  // Approx advance width of one glyph at WM_SIZE. CJK / kana / hangul / full-width
  // forms are FULL-WIDTH (~1em); the old code treated every char as ~0.7em, so a
  // name with CJK overflowed the viewBox and the centred text got its first/last
  // glyph sliced off (the "第一個字被切掉" bug). Measure per-char instead.
  function isWide(c) {
    return (c >= 0x1100 && c <= 0x115F) ||   // Hangul Jamo
           (c >= 0x2E80 && c <= 0xA4CF) ||   // CJK radicals … Yi
           (c >= 0xAC00 && c <= 0xD7A3) ||   // Hangul syllables
           (c >= 0xF900 && c <= 0xFAFF) ||   // CJK compat ideographs
           (c >= 0xFE30 && c <= 0xFE4F) ||   // CJK compat forms
           (c >= 0xFF00 && c <= 0xFF60) ||   // full-width forms
           (c >= 0xFFE0 && c <= 0xFFE6);
  }
  // Render any brand name as a uniform monochrome wordmark SVG.
  function wordmark(label) {
    var raw = String(label == null ? '' : label).trim();
    if (!raw) return '';
    var text = raw.toUpperCase();
    var sum = 0;
    for (var i = 0; i < text.length; i++) {
      sum += (isWide(text.charCodeAt(i)) ? WM_SIZE * 1.05 : WM_SIZE * 0.66) + WM_LS;
    }
    // +28px horizontal breathing room so the centred text never touches the edges.
    var w = Math.max(56, Math.round(sum + 28));
    return '<svg viewBox="0 0 ' + w + ' 28" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="' + esc(raw) + '">' +
      '<text x="50%" y="20" text-anchor="middle" font-family="' + WM_FONT + '" font-size="' + WM_SIZE +
      '" font-weight="' + WM_WEIGHT + '" letter-spacing="' + WM_LS + '" fill="currentColor">' + esc(text) + '</text></svg>';
  }

  global.partnerWordmark = wordmark;   // partnerWordmark('Sony') → uniform <svg> string
})(window);
