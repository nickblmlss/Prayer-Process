/* BLMLSS scroll motion: fade-and-rise reveals + hero parallax.
   Reveals: [data-reveal]. If the element paints its own background, its
   children are revealed instead so the panel colour stays put.
   Parallax: img[data-parallax] drifts 20% slower than its section.
   Geometry is re-applied on a rAF loop because React rewrites style attrs. */
(function () {
  /* guard per DOCUMENT, not per realm: the preview keeps one JS realm alive
     across page switches, so a window-level flag would skip every later page. */
  /* versioned guard: the preview can keep one document alive across reloads,
     so a plain boolean would make every later revision of this file no-op */
  var VERSION = 4;
  if (document.__blmlssMotionV >= VERSION) return;
  document.__blmlssMotionV = VERSION;
  document.__blmlssMotion = true;
  window.__blmlssMotion = true;

  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  var EASE = 'cubic-bezier(.16,.84,.44,1)';
  var DUR = 700;
  var RISE = 16;
  var DEPTH = 0.12;

  var revealed = new WeakSet();
  var armed = new WeakSet();
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (!e.isIntersecting) return;
      var el = e.target;
      io.unobserve(el);
      revealed.add(el);
      if (el.__blmlssState) el.__blmlssState.shown = true;
      el.style.transition = 'opacity ' + DUR + 'ms ' + EASE + ', transform ' + DUR + 'ms ' + EASE;
      el.style.opacity = '1';
      el.style.transform = 'none';
    });
  }, { rootMargin: '0px 0px -12% 0px', threshold: 0.01 });

  /* An element counts as painting its own panel if it declares any background
     inline (var() colours resolve too late to read from computed style). */
  function opaque(el) {
    var inline = el.getAttribute('style') || '';
    if (/background(-color|-image)?\s*:/.test(inline)) return true;
    var bg = getComputedStyle(el).backgroundColor;
    var m = bg && bg.match(/rgba?\(([^)]+)\)/);
    if (!m) return false;
    var parts = m[1].split(',');
    return parts.length < 4 || parseFloat(parts[3]) > 0.02;
  }

  /* React rewrites style attributes on re-render, which wipes the inline
     pre-reveal state. The rAF loop below re-applies it until the element has
     been revealed, so nothing can end up stuck at its final state early. */
  var pending = [];

  function armState(el) {
    var st = el.__blmlssState;
    if (st.shown) {
      if (el.style.opacity !== '1') {
        el.style.opacity = '1';
        el.style.transform = 'none';
      }
      return;
    }
    if (el.style.opacity !== '0') {
      el.style.opacity = '0';
      el.style.transform = 'translate3d(0,' + RISE + 'px,0)';
      el.style.willChange = 'opacity, transform';
    }
  }

  function arm(el) {
    if (armed.has(el) || revealed.has(el) || isLayer.has(el) || el.hasAttribute('data-parallax')) return;
    armed.add(el);
    el.__blmlssState = { shown: false };
    armState(el);
    pending.push(el);
    io.observe(el);
    schedule();
  }

  var claimed = new WeakSet();
  function claim(el) {
    if (claimed.has(el)) return;
    claimed.add(el);
    if (opaque(el)) {
      var kids = el.children;
      for (var i = 0; i < kids.length; i++) arm(kids[i]);
    } else {
      arm(el);
    }
  }

  var layers = [];
  var claimedP = new WeakSet();
  var isLayer = new WeakSet();
  function claimParallax(img) {
    if (claimedP.has(img)) return;
    claimedP.add(img);
    isLayer.add(img);
    var host = img.parentElement;
    if (!host) return;
    var t = getComputedStyle(img).transform;
    var d = parseFloat(img.getAttribute('data-parallax'));
    if (!(d > 0)) d = DEPTH;
    /* the image must overhang by half the travel at each edge */
    var over = Math.max(14, Math.round(d * 100 / 2 + 2));
    layers.push({ img: img, host: host, base: t && t !== 'none' ? t : '', last: null, depth: d, h: (100 + over * 2) + '%', top: '-' + over + '%' });
  }

  function frame() {
    rafId = null;
    /* drop elements that have finished revealing so this list empties out */
    for (var k = pending.length - 1; k >= 0; k--) {
      var pe = pending[k];
      if (pe.__blmlssState && pe.__blmlssState.shown && pe.style.opacity === '1') pending.splice(k, 1);
      else armState(pe);
    }
    var vh = window.innerHeight;
    for (var i = 0; i < layers.length; i++) {
      var l = layers[i];
      var s = l.img.style;
      if (s.getPropertyValue('height') !== l.h) {
        s.setProperty('height', l.h, 'important');
        s.setProperty('top', l.top, 'important');
        s.setProperty('bottom', 'auto', 'important');
        s.setProperty('will-change', 'transform');
      }
      var r = l.host.getBoundingClientRect();
      var span = r.height + vh;
      if (span <= 0) continue;
      var p = (vh - r.top) / span;
      p = p < 0 ? 0 : p > 1 ? 1 : p;
      var v = 'translate3d(0,' + ((p - 0.5) * r.height * l.depth).toFixed(2) + 'px,0) ' + l.base;
      if (v !== l.last || s.transform !== v) {
        l.last = v;
        s.setProperty('transform', v, 'important');
      }
    }
    /* keep ticking only while pre-reveal state still needs re-applying */
    /* keep ticking whenever a parallax layer exists: the page's scroller is
       not always window/document, so scroll events alone are not reliable */
    if (pending.length || layers.length) schedule();
  }

  var rafId = null;
  function schedule() {
    if (rafId === null) rafId = requestAnimationFrame(frame);
  }

  function scan(root) {
    if (!root || root.nodeType !== 1) return;
    if (root.matches('img[data-parallax]')) claimParallax(root);
    root.querySelectorAll('img[data-parallax]').forEach(claimParallax);
    if (root.matches('[data-reveal]')) claim(root);
    root.querySelectorAll('[data-reveal]').forEach(claim);
  }

  function start() {
    scan(document.documentElement);
    /* observe the root, not body: the DC runtime can replace document.body,
       which would silently kill an observer bound to the old node */
    new MutationObserver(function (muts) {
      for (var i = 0; i < muts.length; i++) muts[i].addedNodes.forEach(scan);
      scan(document.documentElement);
    }).observe(document.documentElement, { childList: true, subtree: true });
    /* belt and braces: re-scan for a few seconds in case the mount races us */
    var tries = 0;
    var poll = setInterval(function () {
      scan(document.documentElement);
      if (++tries > 40) clearInterval(poll);
    }, 150);
    /* parallax follows scroll instead of a free-running loop; capture phase so
       it works regardless of which ancestor is the scroller */
    document.addEventListener('scroll', schedule, { capture: true, passive: true });
    window.addEventListener('resize', schedule, { passive: true });
    schedule();
  }

  if (document.body) start();
  else addEventListener('DOMContentLoaded', start);
})();

/* Header scroll state, as on blameless.church: the bar gains a soft shadow
   once the page scrolls, and the transparent header turns solid ink. */
(function () {
  function init() {
    var header = document.querySelector('header.blmlss-flat-header');
    if (!header) { setTimeout(init, 200); return; }
    if (header.__blmlssNavMotion) return;
    header.__blmlssNavMotion = true;
    header.style.transition = 'background-color 240ms ease, box-shadow 240ms ease, backdrop-filter 240ms ease';
    function update() { header.classList.toggle('blmlss-nav-scrolled', window.scrollY > 18); }
    window.addEventListener('scroll', update, { passive: true });
    update();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();

/* Hero "Explore more" cue, as on blameless.church: a small link at the
   bottom-left of the photo hero (aligned with the headline) that scrolls
   to the next section, plus a pulsing line drawn by responsive.css. */
(function () {
  function init() {
    var hero = document.querySelector('section[data-cue-label]');
    if (!hero) { setTimeout(init, 200); return; }
    if (hero.querySelector('.blmlss-hero-down-cue')) return;
    hero.classList.add('blmlss-page-hero');
    var next = hero.nextElementSibling || (hero.parentElement && hero.parentElement.nextElementSibling);
    while (next && next.tagName === 'SC-IF' && !next.firstElementChild) next = next.nextElementSibling;
    var target = next && (next.tagName === 'SC-IF' ? next.firstElementChild : next);
    if (!target) return;
    if (!target.id) target.id = 'content-start';
    var label = hero.getAttribute('data-cue-label') || 'Explore more';
    var cue = document.createElement('a');
    cue.className = 'blmlss-hero-down-cue';
    cue.href = '#' + target.id;
    cue.setAttribute('aria-label', 'Scroll to ' + label.toLowerCase());
    cue.innerHTML = '<span aria-hidden="true">' + label + '</span><span aria-hidden="true">↓</span>';
    hero.appendChild(cue);
    var title = hero.querySelector('h1, h2');
    function align() {
      if (!title) return;
      var l = title.getBoundingClientRect().left - hero.getBoundingClientRect().left;
      cue.style.left = Math.max(20, l) + 'px';
    }
    align();
    window.addEventListener('resize', align, { passive: true });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
