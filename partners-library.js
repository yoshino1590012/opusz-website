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

  // Render any brand name as a uniform monochrome wordmark SVG.
  function wordmark(label) {
    var raw = String(label == null ? '' : label).trim();
    if (!raw) return '';
    var text = raw.toUpperCase();
    var w = Math.max(56, Math.round(text.length * (WM_SIZE * 0.7 + WM_LS)));
    return '<svg viewBox="0 0 ' + w + ' 28" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="' + esc(raw) + '">' +
      '<text x="50%" y="20" text-anchor="middle" font-family="' + WM_FONT + '" font-size="' + WM_SIZE +
      '" font-weight="' + WM_WEIGHT + '" letter-spacing="' + WM_LS + '" fill="currentColor">' + esc(text) + '</text></svg>';
  }

  global.partnerWordmark = wordmark;   // partnerWordmark('Sony') → uniform <svg> string
})(window);
