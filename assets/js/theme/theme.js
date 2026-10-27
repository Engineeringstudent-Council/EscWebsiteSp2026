// ESC light/dark theme: a bear-shaped toggle in the nav (Oski awake for light,
// asleep for dark). The site stays light unless someone flips the switch;
// their choice is remembered on this device and synced across open tabs.
//
// Include once per page as a classic, render-blocking script in <head>, right
// after the stylesheets, so the saved theme is applied before first paint:
//   <link rel="stylesheet" href="assets/css/theme.css" />
//   <script src="assets/js/theme/theme.js"></script>
//
// Styles live in assets/css/theme.css (tokens + dark overrides for the legacy
// template) and in assets/css/search.css (the search palette's dark variant).
(function () {
  'use strict';

  var KEY = 'esc-theme';
  var root = document.documentElement;
  var here = document.currentScript;
  var SITE = here ? new URL('../../../', here.src) : new URL('./', location.href);

  // Navy logos disappear on a dark page, so each has a recoloured twin in
  // images/dark/ (regenerate with `npm run build:logos`).
  var LOGOS =
    /\/images\/(main_nobckgnd|MAIN_long_nobackground|MAIN_long_white|MAIN_nobackground|esc_newton)\.png$/;
  var DARK_LOGO = { MAIN_long_white: 'MAIN_long_nobackground' };

  function read() {
    try {
      return localStorage.getItem(KEY) === 'dark' ? 'dark' : 'light';
    } catch {
      return 'light';
    }
  }

  function save(theme) {
    try {
      if (theme === 'dark') localStorage.setItem(KEY, 'dark');
      else localStorage.removeItem(KEY);
    } catch {
      /* Private mode: the toggle still works for this page view. */
    }
  }

  function swapLogos(theme) {
    var imgs = document.images;
    for (var i = 0; i < imgs.length; i++) {
      var img = imgs[i];
      var light = img.getAttribute('data-esc-light-src');
      if (theme === 'dark') {
        var match = !light && LOGOS.exec(img.src);
        if (!match) continue;
        img.setAttribute('data-esc-light-src', img.getAttribute('src'));
        img.src = new URL('images/dark/' + (DARK_LOGO[match[1]] || match[1]) + '.png', SITE).href;
      } else if (light) {
        img.src = light;
        img.removeAttribute('data-esc-light-src');
      }
    }
  }

  function apply(theme) {
    root.setAttribute('data-theme', theme);
    root.style.colorScheme = theme;
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', theme === 'dark' ? '#0c1124' : '#ffffff');
    var buttons = document.querySelectorAll('.esc-theme-toggle');
    for (var i = 0; i < buttons.length; i++) syncButton(buttons[i], theme);
    if (document.readyState !== 'loading') swapLogos(theme);
  }

  function current() {
    return root.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
  }

  function set(theme, origin) {
    theme = theme === 'dark' ? 'dark' : 'light';
    if (theme === current()) return;
    save(theme);
    var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!document.startViewTransition || reduce || !origin) {
      apply(theme);
      return;
    }
    // Reveal the new theme as a circle growing out of the bear.
    var box = origin.getBoundingClientRect();
    var x = box.left + box.width / 2;
    var y = box.top + box.height / 2;
    var r = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
    root.style.setProperty('--esc-theme-x', x + 'px');
    root.style.setProperty('--esc-theme-y', y + 'px');
    root.style.setProperty('--esc-theme-r', r + 'px');
    root.classList.add('esc-theme-switching');
    var transition = document.startViewTransition(function () {
      apply(theme);
    });
    transition.finished.then(
      function () {
        root.classList.remove('esc-theme-switching');
      },
      function () {
        root.classList.remove('esc-theme-switching');
      },
    );
  }

  // ------------------------------------------------------------ the bear

  var SVG =
    '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" class="esc-bear">' +
    '<g class="esc-bear-head">' +
    '<circle class="esc-bear-ear" cx="6" cy="6.6" r="2.7"/>' +
    '<circle class="esc-bear-ear" cx="18" cy="6.6" r="2.7"/>' +
    '<circle class="esc-bear-face" cx="12" cy="13.2" r="7.6"/>' +
    '<ellipse class="esc-bear-muzzle" cx="12" cy="16" rx="3.3" ry="2.5"/>' +
    '<ellipse class="esc-bear-nose" cx="12" cy="15" rx="1.15" ry=".8"/>' +
    '<g class="esc-bear-eyes-open"><circle cx="9.1" cy="11.6" r="1.05"/><circle cx="14.9" cy="11.6" r="1.05"/></g>' +
    '<path class="esc-bear-eyes-shut" d="M7.9 11.7q1.2 1.1 2.4 0M13.7 11.7q1.2 1.1 2.4 0"/>' +
    '</g>' +
    '<path class="esc-bear-z" d="M18.6 1.2h3.2l-3.2 3.3h3.2"/>' +
    '</svg>';

  function syncButton(button, theme) {
    var dark = theme === 'dark';
    button.setAttribute('aria-pressed', dark ? 'true' : 'false');
    button.title = dark
      ? 'Wake Oski up (switch to light mode)'
      : 'Lights out (switch to dark mode)';
  }

  function makeButton(variant) {
    var button = document.createElement('button');
    button.type = 'button';
    button.className = 'esc-theme-toggle' + (variant ? ' esc-theme-toggle--' + variant : '');
    button.setAttribute('aria-label', 'Dark mode');
    button.innerHTML = SVG;
    syncButton(button, current());
    button.addEventListener('click', function () {
      set(current() === 'dark' ? 'light' : 'dark', button);
    });
    return button;
  }

  function mount() {
    // Desktop nav: sits after the search button (search inserts itself before us).
    var navList = document.querySelector('#header nav > ul, #nav > ul');
    if (navList && !navList.querySelector('.esc-theme-nav')) {
      var li = document.createElement('li');
      li.className = 'esc-theme-nav';
      li.appendChild(makeButton());
      navList.appendChild(li);
    }
    // Phones: main.js builds #titleBar from the header after load.
    var bar = document.getElementById('titleBar');
    if (bar && !bar.querySelector('.esc-theme-toggle')) bar.appendChild(makeButton('bar'));
    // Pages whose header has no nav at all (the homepage). Lives on <body>
    // because phones hide that header.
    if (!navList && !bar && !document.querySelector('.esc-theme-toggle--corner')) {
      document.body.appendChild(makeButton('corner'));
    }
    swapLogos(current());
  }

  // Apply the saved choice now, before the body is parsed or painted.
  apply(read());

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount);
  else mount();
  window.addEventListener('load', mount);

  // Keep every open tab in step.
  window.addEventListener('storage', function (event) {
    if (event.key === KEY || event.key === null) apply(read());
  });

  window.escTheme = {
    get: current,
    set: function (theme) {
      set(theme, null);
    },
    toggle: function () {
      set(current() === 'dark' ? 'light' : 'dark', null);
    },
  };
})();
