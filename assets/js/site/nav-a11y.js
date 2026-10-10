// Accessible site navigation.
//
// The nav comes from the HTML5 UP "Landed" template: jQuery dropotron turns
// the nested lists in #nav into hover menus, and main.js builds a phone
// title bar plus an off-canvas #navPanel. Both were mouse-only. This module
// layers the WAI-ARIA APG "Disclosure Navigation Menu" pattern on top
// without changing what mouse users see:
//
//   - a "Skip to main content" link, the first thing Tab reaches;
//   - a disclosure button per dropdown (aria-expanded/aria-controls),
//     arrow keys inside menus, Escape to back out, Tab that flows naturally
//     even though dropotron moves its menus to the end of <body>;
//   - aria-current="page" plus a quiet gold underline for the current section;
//   - a phone menu toggle with a name and state, focus moved into the panel,
//     Escape to close, and the rest of the page inert while it is open.
//
// Menus are opened and closed through dropotron's own doExpand/doCollapse
// events, so positioning, hover timers, and "only one menu open" all keep
// working exactly as they do for the mouse. Styles live in main.css under
// "Accessible navigation".

const MENU_ID_PREFIX = 'esc-nav-menu-';
const READY_ATTR = 'escNavA11y';

/* ---------------------------------------------------------------------- */
/* Pure helpers (unit tested)                                              */
/* ---------------------------------------------------------------------- */

/**
 * Canonical form of a URL path for "is this the same page" checks:
 * index.html and a trailing slash both mean the directory, and ".html" is
 * optional, so "/", "/index.html", "/about", and "/about.html" compare sanely.
 */
export function normalizePath(pathname = '/') {
  let path = pathname || '/';
  try {
    path = decodeURI(path);
  } catch {
    // Leave malformed escapes as they are.
  }
  if (!path.startsWith('/')) path = '/' + path;
  path = path.replace(/\/{2,}/g, '/');
  path = path.replace(/\/index(\.html?)?$/i, '/');
  path = path.replace(/\.html?$/i, '');
  if (path.length > 1) path = path.replace(/\/+$/, '');
  return path || '/';
}

/**
 * Whether `href` points at the page described by `location` (an object
 * with href, or a Location). Query strings and fragments are ignored;
 * fragment-only links ("#", "#top"), other origins, and non-http schemes
 * never count as the current page.
 */
export function isCurrentPage(href, location = globalThis.location) {
  if (typeof href !== 'string') return false;
  const raw = href.trim();
  if (!raw || raw.startsWith('#') || !location || !location.href) return false;
  let target;
  let here;
  try {
    here = new URL(location.href);
    target = new URL(raw, here);
  } catch {
    return false;
  }
  if (!/^https?:$/.test(target.protocol) || target.origin !== here.origin) return false;
  return normalizePath(target.pathname) === normalizePath(here.pathname);
}

/**
 * Index of the item to move to for a navigation key in a list of `count`
 * items, wrapping at both ends. Returns -1 for keys that don't move.
 */
export function nextIndex(key, current, count) {
  if (count <= 0) return -1;
  switch (key) {
    case 'ArrowDown':
      return current < 0 ? 0 : (current + 1) % count;
    case 'ArrowUp':
      return current < 0 ? count - 1 : (current - 1 + count) % count;
    case 'Home':
      return 0;
    case 'End':
      return count - 1;
    default:
      return -1;
  }
}

/* ---------------------------------------------------------------------- */
/* DOM helpers                                                             */
/* ---------------------------------------------------------------------- */

const isShown = (el) =>
  Boolean(el) && el.isConnected && el.getClientRects().length > 0 && !el.closest('[inert]');

const focusEl = (el) => {
  if (el && typeof el.focus === 'function') el.focus({ preventScroll: true });
};

/** The anchor that labels a list item (its direct child link). */
const ownLink = (li) => li && li.querySelector(':scope > a');

/** Focusable elements in document order that a Tab press could reach. */
function tabbables(doc) {
  const selector =
    'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]';
  return [...doc.querySelectorAll(selector)].filter(
    (el) => el.tabIndex >= 0 && el.getAttribute('tabindex') !== '-1' && isShown(el),
  );
}

/** The element Tab would reach after `from`, skipping anything inside `skip`. */
function tabbableAfter(doc, from, skip = []) {
  return tabbables(doc).find(
    (el) =>
      from.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING &&
      !from.contains(el) &&
      !skip.some((s) => s && s.contains(el)),
  );
}

/* ---------------------------------------------------------------------- */
/* Skip link                                                               */
/* ---------------------------------------------------------------------- */

/** The page's main content: #main, <main>, or the first section after the header. */
export function findMainTarget(doc = document) {
  const direct = doc.querySelector('#main, main, [role="main"]');
  if (direct) return direct;
  const wrapper = doc.getElementById('page-wrapper');
  if (wrapper) {
    const first = [...wrapper.children].find(
      (el) => !/^(HEADER|NAV|SCRIPT|STYLE|NOSCRIPT)$/.test(el.tagName) && el.id !== 'header',
    );
    return first || wrapper;
  }
  return null;
}

export function installSkipLink(doc = document) {
  if (doc.querySelector('.esc-skip-link')) return true;
  const target = findMainTarget(doc);
  if (!target) return false;
  if (!target.id) target.id = 'main-content';

  const link = doc.createElement('a');
  link.className = 'esc-skip-link';
  link.href = '#' + target.id;
  link.textContent = 'Skip to main content';
  link.addEventListener('click', (event) => {
    event.preventDefault();
    if (!target.hasAttribute('tabindex')) {
      target.setAttribute('tabindex', '-1');
      target.classList.add('esc-skip-target');
    }
    target.focus({ preventScroll: true });
    target.scrollIntoView({
      block: 'start',
      behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
    });
  });
  doc.body.prepend(link);
  return true;
}

/* ---------------------------------------------------------------------- */
/* Current page                                                            */
/* ---------------------------------------------------------------------- */

export function markCurrentPage(doc = document, location = globalThis.location) {
  const links = doc.querySelectorAll('#nav a[href], ul.dropotron a[href], #navPanel a[href]');
  for (const link of links) {
    if (isCurrentPage(link.getAttribute('href'), location)) {
      link.setAttribute('aria-current', 'page');
    }
  }
  // Highlight the top-level section that contains the current page. Each
  // top-level item keeps a hidden copy of its submenu (dropotron clones it
  // before moving the real one to <body>), so a plain contains() check works.
  const topList = doc.querySelector('#nav > ul');
  if (!topList) return;
  for (const li of topList.children) {
    if (li.querySelector('a[aria-current="page"]')) li.classList.add('esc-nav-current');
  }
}

/* ---------------------------------------------------------------------- */
/* Desktop dropdowns                                                       */
/* ---------------------------------------------------------------------- */

const CHEVRON =
  '<svg viewBox="0 0 12 12" aria-hidden="true" focusable="false"><path d="M2.5 4.25 6 7.75l3.5-3.5" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/></svg>';

/** Make an `<a href="#">` behave and announce as a button. */
function asButton(anchor) {
  anchor.setAttribute('role', 'button');
}

export function enhanceDropdowns(doc = document, $ = globalThis.jQuery) {
  const topList = doc.querySelector('#nav > ul');
  if (!topList || !$) return false;
  const detached = [...doc.querySelectorAll('body > ul.dropotron.level-0')];
  if (!detached.length) return false;

  // Pair each top-level item with the menu dropotron moved to <body>. The
  // item still holds an untouched hidden clone of that menu, so match on
  // text content rather than trusting order alone.
  const unused = new Set(detached);
  const squash = (el) => el.textContent.replace(/\s+/g, ' ').trim();
  const menus = []; // { li, ul, control, link }
  let counter = 0;
  const ensureId = (ul) => {
    if (!ul.id) ul.id = MENU_ID_PREFIX + ++counter;
    return ul.id;
  };

  for (const li of topList.children) {
    const clone = li.querySelector(':scope > ul');
    if (!clone) continue;
    const text = squash(clone);
    const ul = [...unused].find((candidate) => squash(candidate) === text);
    if (!ul) continue;
    unused.delete(ul);
    const id = ensureId(ul);
    // Put the menu back under its item in the accessibility tree, so screen
    // readers find it inside the nav instead of at the end of the page.
    li.setAttribute('aria-owns', id);

    const link = ownLink(li);
    let control;
    const href = link ? (link.getAttribute('href') || '').trim() : '';
    if (link && (href === '' || href === '#')) {
      // A dead "#" link that only opens the menu: announce it as a button.
      asButton(link);
      control = link;
    } else {
      // A real link (About Us -> about.html) stays a link; a separate,
      // visually hidden disclosure button sits next to it (APG "disclosure
      // navigation menu with top-level links").
      control = doc.createElement('button');
      control.type = 'button';
      control.className = 'esc-nav-toggle';
      control.innerHTML = CHEVRON;
      control.setAttribute('aria-label', `${squash(link || li)} submenu`);
      (link || li.firstChild).after(control);
    }
    control.setAttribute('aria-expanded', 'false');
    control.setAttribute('aria-controls', id);
    control.dataset.escMenu = id;
    menus.push({ li, ul, control, link });
  }
  if (!menus.length) return false;

  // Nested parents inside the moved menus ("Our Team", "Health", ...).
  const nestedControls = [];
  for (const { ul } of menus) {
    for (const nested of ul.querySelectorAll('li > ul')) {
      const parentLink = ownLink(nested.parentElement);
      if (!parentLink) continue;
      const id = ensureId(nested);
      const href = (parentLink.getAttribute('href') || '').trim();
      if (href === '' || href === '#') asButton(parentLink);
      parentLink.setAttribute('aria-expanded', 'false');
      parentLink.setAttribute('aria-controls', id);
      parentLink.dataset.escMenu = id;
      nestedControls.push(parentLink);
    }
  }

  const allControls = [...menus.map((m) => m.control), ...nestedControls];
  const isOpen = (ul) => ul.style.display !== 'none' && getComputedStyle(ul).display !== 'none';
  const menuFor = (control) => doc.getElementById(control.dataset.escMenu);
  const sync = () => {
    for (const control of allControls) {
      control.setAttribute('aria-expanded', String(isOpen(menuFor(control))));
    }
  };

  // dropotron fades menus in. A key press can land mid-fade, and jQuery then
  // ignores a fresh fadeIn on an element its unfinished animation still
  // counts as "shown", so finish any running animation before acting.
  const settle = (ul) => $(ul).add($(ul).find('ul')).stop(true, true);
  const expand = (ul) => {
    settle(ul);
    $(ul).trigger('doExpand');
    sync();
  };
  const collapse = (ul) => {
    settle(ul);
    $(ul).trigger('doCollapse');
    sync();
  };

  /** Links at one level of a menu (not the nested ones). */
  const itemsOf = (ul) =>
    [...ul.children].map(ownLink).filter((a) => a && a.getAttribute('href') !== null);
  const visibleItems = (ul) => itemsOf(ul).filter(isShown);

  /** Every tabbable link currently visible in a menu tree, in DOM order. */
  const visibleTree = (ul) => [...ul.querySelectorAll('a[href]')].filter(isShown);

  const openAndFocus = (entry, which = 'first') => {
    entry.returnTo = doc.activeElement;
    expand(entry.ul);
    const items = visibleItems(entry.ul);
    focusEl(which === 'last' ? items[items.length - 1] : items[0]);
  };

  /** Where focus goes back to when a top-level menu closes. */
  const returnPoint = (entry) =>
    entry.returnTo && entry.li.contains(entry.returnTo) ? entry.returnTo : entry.control;

  // Keep aria-expanded truthful whatever opened or closed a menu (hover,
  // click, scroll), and never leave focus stranded inside a hidden menu.
  for (const entry of menus) {
    const uls = [entry.ul, ...entry.ul.querySelectorAll('ul')];
    $(uls).on('doExpand doCollapse', () => sync());
    $(entry.ul).on('doCollapse', () => {
      const active = doc.activeElement;
      if (active && entry.ul.contains(active)) focusEl(returnPoint(entry));
    });
  }

  /** Focusable controls in the top-level bar, in order. */
  const topFocusables = () =>
    [...topList.querySelectorAll(':scope > li > a, :scope > li > button')].filter(isShown);

  const moveAlongBar = (from, key) => {
    const items = topFocusables();
    const i = items.indexOf(from);
    if (i < 0) return false;
    const next = key === 'ArrowRight' ? items[i + 1] : items[i - 1];
    if (!next) return false;
    for (const m of menus) if (isOpen(m.ul) && !m.li.contains(next)) collapse(m.ul);
    focusEl(next);
    return true;
  };

  // Top-level bar: disclosure buttons and links.
  topList.addEventListener('keydown', (event) => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    const target = event.target;
    const li = target.closest('#nav > ul > li');
    const entry = menus.find((m) => m.li === li);
    const key = event.key;

    if (key === 'ArrowLeft' || key === 'ArrowRight') {
      if (moveAlongBar(target, key)) event.preventDefault();
      return;
    }
    if (!entry) return;
    const onControl = target === entry.control;
    const open = isOpen(entry.ul);

    if (key === 'ArrowDown' || (key === 'ArrowUp' && onControl)) {
      event.preventDefault();
      openAndFocus(entry, key === 'ArrowUp' ? 'last' : 'first');
    } else if (key === 'Escape' && open) {
      event.preventDefault();
      collapse(entry.ul);
      focusEl(target);
    } else if (onControl && entry.control.tagName === 'A' && (key === ' ' || key === 'Enter')) {
      // role="button" links: Space must work too, and the page must not jump.
      event.preventDefault();
      if (open) collapse(entry.ul);
      else openAndFocus(entry);
    } else if (key === 'Tab' && !event.shiftKey && open) {
      // The menu lives at the end of <body>; Tab from the last control of an
      // open item continues into it, as if it were still in place.
      const controls = [...li.querySelectorAll(':scope > a, :scope > button')].filter(isShown);
      if (target === controls[controls.length - 1]) {
        const first = visibleTree(entry.ul)[0];
        if (first) {
          event.preventDefault();
          entry.returnTo = target;
          focusEl(first);
        }
      }
    }
  });

  // The disclosure buttons themselves (Enter/Space arrive as a click).
  for (const entry of menus) {
    if (entry.control.tagName !== 'BUTTON') continue;
    entry.control.addEventListener('click', (event) => {
      // Don't let dropotron's item/body click handlers toggle it a second time.
      event.stopPropagation();
      event.preventDefault();
      if (isOpen(entry.ul)) collapse(entry.ul);
      else openAndFocus(entry);
    });
  }

  // Inside an open menu.
  for (const entry of menus) {
    entry.ul.addEventListener('keydown', (event) => {
      if (event.altKey || event.ctrlKey || event.metaKey) return;
      const link = event.target.closest('a');
      if (!link || !entry.ul.contains(link)) return;
      const level = link.closest('ul');
      const isRoot = level === entry.ul;
      const parentLi = isRoot ? null : level.parentElement;
      const nested = link.parentElement.querySelector(':scope > ul');
      const key = event.key;

      const index = nextIndex(key, visibleItems(level).indexOf(link), visibleItems(level).length);
      if (index >= 0) {
        event.preventDefault();
        focusEl(visibleItems(level)[index]);
        return;
      }

      if (nested && (key === 'ArrowRight' || key === 'Enter' || key === ' ')) {
        const href = (link.getAttribute('href') || '').trim();
        // A nested parent that is also a real page: Enter still navigates.
        if (key === 'Enter' && href && href !== '#') return;
        event.preventDefault();
        if (key !== 'ArrowRight' && isOpen(nested)) {
          collapse(nested);
          return;
        }
        expand(nested);
        focusEl(visibleItems(nested)[0]);
        return;
      }

      if ((key === 'ArrowLeft' || key === 'Escape') && !isRoot) {
        event.preventDefault();
        collapse(level);
        focusEl(ownLink(parentLi));
        return;
      }

      if (key === 'Escape') {
        event.preventDefault();
        const back = returnPoint(entry);
        collapse(entry.ul);
        focusEl(back);
        return;
      }

      if (key === 'Tab') {
        const tree = visibleTree(entry.ul);
        if (event.shiftKey && link === tree[0]) {
          event.preventDefault();
          focusEl(entry.control.isConnected ? entry.control : entry.link);
        } else if (!event.shiftKey && link === tree[tree.length - 1]) {
          event.preventDefault();
          const next = tabbableAfter(doc, entry.li, detached);
          collapse(entry.ul);
          if (next) focusEl(next);
        }
      }
    });
  }

  // Close a menu once keyboard focus has left both its item and its menu.
  const watchFocus = (entry) => {
    const onFocusOut = () => {
      setTimeout(() => {
        if (!doc.hasFocus() || !isOpen(entry.ul)) return;
        const active = doc.activeElement;
        if (active && (entry.li.contains(active) || entry.ul.contains(active))) return;
        // Only close menus that keyboard focus had been in; hover menus stay.
        if (entry.hadFocus) collapse(entry.ul);
        entry.hadFocus = false;
      }, 0);
    };
    const onFocusIn = () => {
      entry.hadFocus = true;
    };
    for (const el of [entry.li, entry.ul]) {
      el.addEventListener('focusout', onFocusOut);
      el.addEventListener('focusin', onFocusIn);
    }
  };
  menus.forEach(watchFocus);

  sync();
  return true;
}

/* ---------------------------------------------------------------------- */
/* Phone menu                                                              */
/* ---------------------------------------------------------------------- */

export function enhanceMobilePanel(doc = document) {
  const panel = doc.getElementById('navPanel');
  const toggle = doc.querySelector('#titleBar .toggle');
  if (!panel || !toggle) return false;
  const body = doc.body;
  const OPEN_CLASS = 'navPanel-visible';

  const nav = panel.querySelector('nav');
  if (nav) nav.setAttribute('aria-label', 'Site');

  toggle.setAttribute('role', 'button');
  toggle.setAttribute('aria-label', 'Menu');
  toggle.setAttribute('aria-controls', 'navPanel');
  toggle.setAttribute('aria-expanded', 'false');
  toggle.addEventListener('keydown', (event) => {
    if (event.key === ' ') {
      event.preventDefault();
      toggle.click();
    }
  });

  // "#" entries in the panel are group labels (Our Team, Health, ...), not
  // destinations. Without an href they read as plain text and drop out of
  // the Tab order, instead of announcing as links that go nowhere.
  for (const link of panel.querySelectorAll('a.link[href="#"]')) {
    link.removeAttribute('href');
    link.classList.add('esc-nav-group');
  }

  const titleBar = doc.getElementById('titleBar');
  const madeInert = new Set();
  const setBackgroundInert = (on) => {
    if (on) {
      // Everything except the panel and the toggle that closes it (the title
      // bar also holds the logo and, on some pages, the search button).
      const targets = [...body.children].filter(
        (el) => el !== panel && el !== titleBar && !/^(SCRIPT|STYLE)$/.test(el.tagName),
      );
      if (titleBar) targets.push(...[...titleBar.children].filter((el) => el !== toggle));
      for (const el of targets) {
        if (el.inert) continue;
        el.inert = true;
        madeInert.add(el);
      }
    } else {
      for (const el of madeInert) el.inert = false;
      madeInert.clear();
    }
  };

  let open = false;
  const apply = () => {
    const now = body.classList.contains(OPEN_CLASS);
    if (now === open) return;
    open = now;
    toggle.setAttribute('aria-expanded', String(open));
    panel.inert = !open;
    setBackgroundInert(open);
    if (open) {
      const first = [...panel.querySelectorAll('a[href]')][0];
      focusEl(first || panel);
    } else {
      const active = doc.activeElement;
      if (!active || active === body || panel.contains(active)) focusEl(toggle);
    }
  };

  panel.inert = !body.classList.contains(OPEN_CLASS);
  new MutationObserver(apply).observe(body, { attributes: true, attributeFilter: ['class'] });
  apply();

  doc.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && open) {
      event.preventDefault();
      // Go through the template's own toggle so its bookkeeping stays right.
      toggle.click();
    }
  });
  return true;
}

/* ---------------------------------------------------------------------- */
/* Entry point                                                             */
/* ---------------------------------------------------------------------- */

function run(doc) {
  const desktopNav = doc.getElementById('nav');
  if (desktopNav && !desktopNav.hasAttribute('aria-label')) {
    desktopNav.setAttribute('aria-label', 'Site');
  }
  installSkipLink(doc);
  enhanceDropdowns(doc);
  enhanceMobilePanel(doc);
  markCurrentPage(doc);
  doc.documentElement.dataset[READY_ATTR] = 'ready';
}

/**
 * Install everything once the page (and main.js, which builds the
 * dropdowns and phone panel synchronously during parsing) is ready.
 */
export function installNavA11y(doc = document) {
  if (doc.documentElement.dataset[READY_ATTR]) return;
  doc.documentElement.dataset[READY_ATTR] = 'pending';
  if (doc.readyState === 'loading') {
    doc.addEventListener('DOMContentLoaded', () => run(doc), { once: true });
  } else {
    run(doc);
  }
}
