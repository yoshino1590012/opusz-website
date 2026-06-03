/**
 * analytics.js — Google Analytics 4 for all OPUS.Z pages.
 * Property: opusz-45280 · Measurement ID: G-KQXXFSQHNQ
 *
 * Loads gtag.js once, configures GA4, and exposes a helper for conversion
 * events:   opuszTrack('enquiry_sent', { musician: 'Martin' })
 */
(function () {
  var GA4_ID = 'G-KQXXFSQHNQ';

  // Avoid double-loading if the script is included twice
  if (window.__opuszGA4Loaded) return;
  window.__opuszGA4Loaded = true;

  // Load the gtag.js library
  var s = document.createElement('script');
  s.async = true;
  s.src = 'https://www.googletagmanager.com/gtag/js?id=' + GA4_ID;
  (document.head || document.documentElement).appendChild(s);

  window.dataLayer = window.dataLayer || [];
  function gtag() { dataLayer.push(arguments); }
  window.gtag = gtag;
  gtag('js', new Date());
  gtag('config', GA4_ID);

  // Conversion / custom-event helper used across the site.
  // e.g. opuszTrack('enquiry_sent'), opuszTrack('booking_completed', {amount: 8000})
  window.opuszTrack = function (name, params) {
    try { gtag('event', name, params || {}); } catch (e) {}
  };
})();
