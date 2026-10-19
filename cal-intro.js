/* Cal.com inline booking for the Step 1 intro call with Nick.
   The page renders #my-cal-inline-prayerintro only once Part one (the video)
   is marked watched, and can remove and re-add it, so this watches the page
   and mounts the calendar whenever an empty container appears. A successful
   booking is announced to the page as a 'blmlss:intro-booked' event. */
(function (C, A, L) {
  let p = function (a, ar) { a.q.push(ar); };
  let d = C.document;
  C.Cal = C.Cal || function () {
    let cal = C.Cal; let ar = arguments;
    if (!cal.loaded) { cal.ns = {}; cal.q = cal.q || []; d.head.appendChild(d.createElement("script")).src = A; cal.loaded = true; }
    if (ar[0] === L) {
      const api = function () { p(api, arguments); };
      const namespace = ar[1];
      api.q = api.q || [];
      if (typeof namespace === "string") { cal.ns[namespace] = cal.ns[namespace] || api; p(cal.ns[namespace], ar); p(cal, ["initNamespace", namespace]); }
      else p(cal, ar);
      return;
    }
    p(cal, ar);
  };
})(window, "https://app.cal.com/embed/embed.js", "init");

(function () {
  var SELECTOR = '#my-cal-inline-prayerintro';
  var started = false;

  function start() {
    if (started) return;
    started = true;
    Cal("init", "prayerintro", { origin: "https://app.cal.com" });
    Cal.config = Cal.config || {};
    Cal.config.forwardQueryParams = true;
    Cal.ns.prayerintro("ui", { "cssVarsPerTheme": { "light": { "cal-brand": "#FFB88F" } }, "hideEventTypeDetails": false, "layout": "month_view" });
    Cal.ns.prayerintro("on", {
      action: "bookingSuccessful",
      callback: function () { window.dispatchEvent(new CustomEvent('blmlss:intro-booked')); }
    });
  }

  function mount() {
    var el = document.querySelector(SELECTOR);
    if (!el || el.getAttribute('data-cal-mounted') === 'true') return;
    start();
    el.setAttribute('data-cal-mounted', 'true');
    Cal.ns.prayerintro("inline", {
      elementOrSelector: SELECTOR,
      config: { "layout": "month_view", "useSlotsViewOnSmallScreen": "true" },
      calLink: "nick-gravino-blmlss/prayerintro"
    });
  }

  function watch() {
    mount();
    new MutationObserver(mount).observe(document.body, { childList: true, subtree: true });
  }
  if (document.body) watch();
  else document.addEventListener('DOMContentLoaded', watch);
})();
