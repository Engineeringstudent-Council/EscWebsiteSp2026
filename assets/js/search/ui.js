// ESC site search UI: a ⌘K / Ctrl+K command palette available on every page.
//
// Include once per page:
//   <script type="module" src="assets/js/search/ui.js"></script>
// (assets/js/top-bar.js adds it automatically on pages that use the shared nav.)
//
// Nothing heavy loads up front. Fuse.js and the search index are fetched the
// first time someone shows intent (hovers or focuses a search button, presses
// the shortcut, or opens the palette).
//
// Accessibility follows the WAI-ARIA APG combobox pattern: focus stays in the
// input, arrow keys move aria-activedescendant through a listbox, and result
// counts are announced through a polite live region. The native <dialog>
// element provides the modal focus trap, Escape handling, and inert page.

import { createSearcher, normalizeQuery, resolveUrl } from './core.js';

const ROOT = new URL('../../../', import.meta.url);
const INDEX_URL = new URL('assets/search/index.json', ROOT);
const FUSE_URL = new URL('assets/js/vendor/fuse.esm.min.js', ROOT);
const CSS_URL = new URL('assets/css/search.css', ROOT);
const OPENSEARCH_URL = new URL('opensearch.xml', ROOT);
const RECENT_KEY = 'esc-search:recent';
const MAX_RECENT = 5;
const CONTACT = 'president@esc.studentorg.berkeley.edu';

const SUGGESTIONS = [
  'Funding for my club',
  'Blue & Gold',
  'Free food',
  'Makerspaces',
  'Mental health',
  'E-Week',
  'Join ESC',
];

const isMac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
const SHORTCUT = isMac ? '⌘K' : 'Ctrl K';

// ---------------------------------------------------------------- icons

const SVG_NS = 'http://www.w3.org/2000/svg';
const ICONS = {
  search:
    'M10.5 3a7.5 7.5 0 0 1 5.92 12.1l4.24 4.24-1.42 1.42-4.24-4.24A7.5 7.5 0 1 1 10.5 3Zm0 2a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11Z',
  page: 'M6 2h8l5 5v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Zm7 1.5V8h4.5M8 12h8M8 16h6',
  section: 'M4 6h16M4 12h10M4 18h7',
  link: 'M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5',
  mail: 'M4 6h16v12H4zM4 7l8 6 8-6',
  recent: 'M12 7v5l3 2M12 3a9 9 0 1 1-9 9',
  close: 'M6 6l12 12M18 6 6 18',
};

function icon(name, filled = name === 'search') {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  const path = document.createElementNS(SVG_NS, 'path');
  path.setAttribute('d', ICONS[name]);
  if (filled) {
    path.setAttribute('fill', 'currentColor');
  } else {
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', 'currentColor');
    path.setAttribute('stroke-width', '1.8');
    path.setAttribute('stroke-linecap', 'round');
    path.setAttribute('stroke-linejoin', 'round');
  }
  svg.append(path);
  return svg;
}

/** Tiny element helper. Children are strings (as text) or nodes; never HTML. */
function h(tag, props = {}, ...children) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (value === undefined || value === null || value === false) continue;
    if (key === 'class') el.className = value;
    else if (key === 'text') el.textContent = value;
    else if (key.startsWith('on')) el.addEventListener(key.slice(2), value);
    else el.setAttribute(key, value === true ? '' : value);
  }
  for (const child of children.flat()) {
    if (child === null || child === undefined || child === false) continue;
    el.append(typeof child === 'string' ? document.createTextNode(child) : child);
  }
  return el;
}

/** Render highlight segments as text + <mark>, without ever parsing HTML. */
function renderParts(parts) {
  return parts.map((part) =>
    part.mark ? h('mark', { text: part.text }) : document.createTextNode(part.text),
  );
}

// ---------------------------------------------------------------- data

let loading = null;

/** Load Fuse + the index once; a failed load can be retried. */
function loadSearcher() {
  if (!loading) {
    loading = Promise.all([
      import(FUSE_URL.href),
      fetch(INDEX_URL, { cache: 'no-cache' }).then((res) => {
        if (!res.ok) throw new Error(`index ${res.status}`);
        return res.json();
      }),
    ])
      .then(([mod, index]) => createSearcher(mod.default, index.records))
      .catch((error) => {
        loading = null;
        throw error;
      });
  }
  return loading;
}

const storage = {
  read() {
    try {
      const list = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]');
      return Array.isArray(list)
        ? list.filter((r) => r && r.title && r.url).slice(0, MAX_RECENT)
        : [];
    } catch {
      return [];
    }
  },
  remember(result) {
    try {
      const entry = {
        title: result.title,
        url: result.url,
        kind: result.kind,
        trail: result.trail,
      };
      const list = [entry, ...storage.read().filter((r) => r.url !== entry.url)].slice(
        0,
        MAX_RECENT,
      );
      localStorage.setItem(RECENT_KEY, JSON.stringify(list));
    } catch {
      // private mode or storage disabled: recents are a nicety, not a feature
    }
  },
  clear() {
    try {
      localStorage.removeItem(RECENT_KEY);
    } catch {
      // ignore
    }
  },
};

/** Optional, privacy-friendly logging of searches that found nothing. */
const telemetry = (() => {
  const endpoint = document.querySelector('meta[name="esc-search-telemetry"]')?.content;
  const sent = new Set();
  let timer = 0;
  return {
    zeroResults(query) {
      if (!endpoint || !navigator.sendBeacon) return;
      clearTimeout(timer);
      // Only log a query once the visitor has paused typing.
      timer = setTimeout(() => {
        const key = query.toLowerCase();
        if (sent.has(key)) return;
        sent.add(key);
        const body = JSON.stringify({ q: query, page: location.pathname });
        navigator.sendBeacon(endpoint, new Blob([body], { type: 'application/json' }));
      }, 1500);
    },
    cancel() {
      clearTimeout(timer);
    },
  };
})();

// ---------------------------------------------------------------- copy

function greeting(date = new Date()) {
  const hour = date.getHours();
  if (hour >= 5 && hour < 12) return ['Good morning.', 'What can we help you find today?'];
  if (hour >= 12 && hour < 17)
    return ['Good afternoon.', 'Funding, clubs, resources: it’s all in here.'];
  if (hour >= 17 && hour < 22) return ['Good evening.', 'What are you looking for?'];
  return ['Burning the midnight oil?', 'Free food and the HEAR tool are one search away.'];
}

// ---------------------------------------------------------------- palette

class Palette {
  constructor() {
    this.results = [];
    this.active = -1;
    this.query = '';
    this.renderToken = 0;
    this.lastFocus = null;
    this.build();
  }

  build() {
    this.input = h('input', {
      class: 'esc-search-input',
      type: 'search',
      id: 'esc-search-input',
      role: 'combobox',
      'aria-expanded': 'true',
      'aria-controls': 'esc-search-listbox',
      'aria-autocomplete': 'list',
      'aria-label': 'Search the ESC website',
      placeholder: 'Search funding, clubs, resources…',
      autocomplete: 'off',
      autocapitalize: 'off',
      spellcheck: 'false',
      enterkeyhint: 'go',
      maxlength: '96',
    });
    // Focusable so keyboard users can scroll long result lists.
    this.body = h('div', {
      class: 'esc-search-body',
      tabindex: '0',
      role: 'region',
      'aria-label': 'Search results',
    });
    this.live = h('div', { class: 'esc-search-sr', role: 'status', 'aria-live': 'polite' });

    const close = h(
      'button',
      {
        class: 'esc-search-close',
        type: 'button',
        'aria-label': 'Close search',
        onclick: () => this.close(),
      },
      h('kbd', { text: 'esc' }),
    );

    this.dialog = h(
      'dialog',
      { class: 'esc-search', id: 'esc-search', 'aria-label': 'Search the ESC website' },
      h('div', { class: 'esc-search-head' }, icon('search'), this.input, close),
      this.body,
      h(
        'div',
        { class: 'esc-search-foot', 'aria-hidden': 'true' },
        h(
          'span',
          { class: 'esc-search-keys' },
          h('kbd', { text: '↑' }),
          h('kbd', { text: '↓' }),
          'to navigate',
        ),
        h('span', { class: 'esc-search-keys' }, h('kbd', { text: '↵' }), 'to open'),
        h('span', { class: 'esc-search-credit', text: 'Made with care by ESC Tech' }),
      ),
      this.live,
    );

    this.input.addEventListener('input', () => this.onInput());
    this.input.addEventListener('keydown', (event) => this.onKeydown(event));
    this.dialog.addEventListener('close', () => this.onClose());
    // A click on the dialog element itself (not its contents) is a backdrop click.
    this.dialog.addEventListener('click', (event) => {
      if (event.target === this.dialog) this.close();
    });
    document.body.append(this.dialog);
  }

  get isOpen() {
    return this.dialog.open;
  }

  open(query = '') {
    if (!this.isOpen) {
      this.lastFocus = document.activeElement;
      document.documentElement.classList.add('esc-search-open');
      this.dialog.showModal();
    }
    this.input.value = query;
    this.input.focus();
    if (query) this.input.select();
    this.render();
  }

  close() {
    if (this.isOpen) this.dialog.close();
  }

  onClose() {
    document.documentElement.classList.remove('esc-search-open');
    telemetry.cancel();
    this.setActive(-1);
    if (this.lastFocus && document.contains(this.lastFocus))
      this.lastFocus.focus({ preventScroll: true });
  }

  onInput() {
    cancelAnimationFrame(this.frame);
    this.frame = requestAnimationFrame(() => this.render());
  }

  onKeydown(event) {
    const options = this.options();
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      if (!options.length) return;
      event.preventDefault();
      const step = event.key === 'ArrowDown' ? 1 : -1;
      const next =
        this.active === -1 && step === -1
          ? options.length - 1
          : (this.active + step + options.length) % options.length;
      this.setActive(next);
    } else if (event.key === 'Enter') {
      const typed = normalizeQuery(this.input.value);
      if (!typed && this.active === -1) return;
      event.preventDefault();
      const newTab = event.metaKey || event.ctrlKey;
      // If results haven't caught up with what was typed (fast typists),
      // finish rendering first so Enter never opens a stale result.
      const ready = this.query === typed && !this.rendering ? Promise.resolve() : this.render();
      ready.then(() => {
        const current = this.options();
        const option = current[this.active] ?? (typed ? current[0] : null);
        if (option) this.activate(option, newTab);
      });
    }
  }

  options() {
    return [...this.body.querySelectorAll('[role="option"]')];
  }

  setActive(index) {
    const options = this.options();
    options.forEach((option, i) => option.setAttribute('aria-selected', String(i === index)));
    this.active = index >= 0 && index < options.length ? index : -1;
    if (this.active === -1) {
      this.input.removeAttribute('aria-activedescendant');
    } else {
      const option = options[this.active];
      this.input.setAttribute('aria-activedescendant', option.id);
      option.scrollIntoView({ block: 'nearest' });
    }
  }

  activate(option, newTab = false) {
    const result = this.optionData.get(option);
    if (result) storage.remember(result);
    const href = option.getAttribute('href');
    if (!href) return;
    if (newTab || option.target === '_blank') {
      window.open(href, '_blank', 'noopener');
      if (!newTab) this.close();
    } else {
      this.close();
      window.location.assign(href);
    }
  }

  render() {
    cancelAnimationFrame(this.frame);
    const promise = this.doRender().finally(() => {
      if (this.rendering === promise) this.rendering = null;
    });
    this.rendering = promise;
    return promise;
  }

  async doRender() {
    const token = ++this.renderToken;
    const query = normalizeQuery(this.input.value);
    this.query = query;
    this.optionData = new Map();

    if (!query) {
      this.renderHome();
      return;
    }

    let searcher;
    try {
      searcher = await loadSearcher();
    } catch {
      if (token !== this.renderToken) return;
      this.renderError();
      return;
    }
    if (token !== this.renderToken) return;

    const results = searcher.search(query, 8);
    this.results = results;
    if (!results.length) {
      this.renderEmpty(query);
      this.announce(`No results for ${query}`);
      telemetry.zeroResults(query);
      return;
    }
    telemetry.cancel();
    const listbox = this.listbox('Results');
    results.forEach((result, i) => listbox.append(this.option(result, i)));
    this.body.replaceChildren(listbox);
    this.setActive(0);
    this.announce(`${results.length} result${results.length === 1 ? '' : 's'} for ${query}`);
  }

  listbox(label) {
    return h('div', {
      class: 'esc-search-list',
      id: 'esc-search-listbox',
      role: 'listbox',
      'aria-label': label,
    });
  }

  option(result, index) {
    const href = resolveUrl(result.url, ROOT);
    const kindIcon = result.mail
      ? 'mail'
      : result.external
        ? 'link'
        : result.kind === 'section'
          ? 'section'
          : 'page';
    const meta = h('span', { class: 'esc-search-meta' });
    if (result.trail?.length)
      meta.append(h('span', { class: 'esc-search-trail', text: result.trail.join(' › ') }));
    const excerpt = result.excerptParts ? renderParts(result.excerptParts) : [];
    if (excerpt.length) {
      if (result.trail?.length) meta.append(' · ');
      meta.append(...excerpt);
    }
    const option = h(
      'a',
      {
        class: 'esc-search-option',
        id: `esc-search-option-${index}`,
        role: 'option',
        'aria-selected': 'false',
        href,
        tabindex: '-1',
        target: result.external && !result.mail ? '_blank' : null,
        rel: result.external && !result.mail ? 'noopener' : null,
        onclick: () => storage.remember(result),
        onmousemove: () => {
          const i = this.options().indexOf(option);
          if (i !== this.active) this.setActive(i);
        },
      },
      h('span', { class: 'esc-search-icon' }, icon(kindIcon)),
      h(
        'span',
        { class: 'esc-search-title' },
        ...(result.titleParts ? renderParts(result.titleParts) : [result.title]),
      ),
      h('span', {
        class: 'esc-search-go',
        'aria-hidden': 'true',
        text: result.external ? 'Open ↗' : 'Jump to ↵',
      }),
      meta,
    );
    this.optionData.set(option, result);
    return option;
  }

  renderHome() {
    const [hello, sub] = greeting();
    const chips = h(
      'div',
      { class: 'esc-search-chips', role: 'group', 'aria-label': 'Try searching for' },
      SUGGESTIONS.map((text) =>
        h('button', {
          type: 'button',
          text,
          onclick: () => {
            this.input.value = text;
            this.input.focus();
            this.render();
          },
        }),
      ),
    );
    const parts = [
      h('p', { class: 'esc-search-greeting', text: hello }),
      h('p', { text: sub }),
      chips,
    ];

    const listbox = this.listbox('Suggestions');
    let index = 0;
    const recent = storage.read();
    if (recent.length) {
      parts.push(
        h(
          'div',
          { class: 'esc-search-group', id: 'esc-search-recent-label' },
          h('span', { text: 'Recently opened' }),
          h('button', {
            type: 'button',
            text: 'Clear',
            onclick: () => {
              storage.clear();
              this.input.focus();
              this.render();
            },
          }),
        ),
      );
      const group = h('div', { role: 'group', 'aria-labelledby': 'esc-search-recent-label' });
      for (const item of recent) {
        if (!resolveUrl(item.url, ROOT)) continue;
        group.append(
          this.option(
            {
              ...item,
              external: /^(https?:|mailto:)/i.test(item.url),
              mail: /^mailto:/i.test(item.url),
            },
            index++,
          ),
        );
      }
      listbox.append(group);
    }

    loadSearcher()
      .then((searcher) => {
        if (this.query || !this.isOpen) return;
        const popular = searcher.featured.slice(0, 6);
        if (!popular.length) return;
        const label = h(
          'div',
          { class: 'esc-search-group', id: 'esc-search-popular-label' },
          h('span', { text: 'Popular' }),
        );
        const group = h('div', { role: 'group', 'aria-labelledby': 'esc-search-popular-label' });
        for (const item of popular) {
          group.append(
            this.option(
              {
                ...item,
                trail: item.trail,
                external: /^(https?:|mailto:)/i.test(item.url),
                mail: /^mailto:/i.test(item.url),
              },
              index++,
            ),
          );
        }
        listbox.append(label, group);
      })
      .catch(() => {});

    this.body.replaceChildren(...parts, listbox);
    this.setActive(-1);
  }

  renderEmpty(query) {
    const subject = encodeURIComponent(`Website: couldn't find "${query}"`);
    this.body.replaceChildren(
      h(
        'div',
        { class: 'esc-search-empty' },
        h('div', { class: 'esc-search-oski', 'aria-hidden': 'true', text: '🐻' }),
        h('h2', {}, 'Nothing for “', query, '”'),
        h('p', { text: 'Even Oski is stumped. Try fewer or different words, or one of these:' }),
        h(
          'div',
          { class: 'esc-search-chips', role: 'group', 'aria-label': 'Try instead' },
          SUGGESTIONS.slice(0, 4).map((text) =>
            h('button', {
              type: 'button',
              text,
              onclick: () => {
                this.input.value = text;
                this.input.focus();
                this.render();
              },
            }),
          ),
        ),
        h(
          'p',
          { style: 'margin-top:1.2em' },
          'Still stuck? ',
          h('a', {
            href: `mailto:${CONTACT}?subject=${subject}`,
            text: 'Email the ESC presidents',
          }),
          ' and a real human will point you the right way.',
        ),
      ),
    );
    this.setActive(-1);
  }

  renderError() {
    this.body.replaceChildren(
      h(
        'div',
        { class: 'esc-search-status' },
        'Search is having a moment. Check your connection and ',
        h('button', {
          type: 'button',
          class: 'esc-search-retry',
          text: 'try again',
          onclick: () => this.render(),
        }),
        '.',
      ),
    );
  }

  announce(message) {
    clearTimeout(this.announceTimer);
    this.announceTimer = setTimeout(() => {
      this.live.textContent = message;
    }, 350);
  }
}

// ---------------------------------------------------------------- triggers

let palette = null;

export function openSearch(query = '') {
  palette ??= new Palette();
  palette.open(query);
  return palette;
}

function triggerButton(variant) {
  const button = h(
    'button',
    {
      type: 'button',
      class: `esc-search-trigger${variant ? ` esc-search-trigger--${variant}` : ''}`,
      'aria-label': 'Search the site',
      'aria-keyshortcuts': isMac ? 'Meta+K' : 'Control+K',
      'data-esc-search-open': '',
    },
    icon('search'),
    h('span', { class: 'esc-search-trigger-label', text: 'Search' }),
    h('kbd', { 'aria-hidden': 'true', text: SHORTCUT }),
  );
  return button;
}

function mountTriggers() {
  const navList = document.querySelector('#header nav > ul, #nav > ul');
  if (navList && !navList.querySelector('.esc-search-nav')) {
    navList.append(h('li', { class: 'esc-search-nav' }, triggerButton()));
  }
  const bar = document.getElementById('titleBar');
  if (bar && !bar.querySelector('.esc-search-trigger')) bar.append(triggerButton('bar'));
}

function isTyping(target) {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))
  );
}

function rotateHeroExamples() {
  const swap = document.querySelector('.esc-hero-search .esc-swap');
  if (!swap || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const examples = (swap.closest('[data-examples]')?.dataset.examples || '')
    .split('|')
    .map((s) => s.trim())
    .filter(Boolean);
  if (examples.length < 2) return;
  let i = 0;
  setInterval(() => {
    if (document.hidden) return;
    swap.classList.add('is-out');
    setTimeout(() => {
      i = (i + 1) % examples.length;
      swap.textContent = examples[i];
      swap.classList.remove('is-out');
    }, 350);
  }, 3200);
}

function init() {
  if (!document.querySelector(`link[href="${CSS_URL.href}"], link[data-esc-search]`)) {
    document.head.append(
      h('link', { rel: 'stylesheet', href: CSS_URL.href, 'data-esc-search': '' }),
    );
  }
  // Lets browsers add the site as an address-bar search engine. index.html
  // declares this statically (Chrome mostly discovers it there); adding it on
  // other pages is harmless and helps browsers that look wherever you are.
  if (!document.querySelector('link[rel="search"]')) {
    document.head.append(
      h('link', {
        rel: 'search',
        type: 'application/opensearchdescription+xml',
        title: 'ESC Berkeley',
        href: OPENSEARCH_URL.href,
      }),
    );
  }
  mountTriggers();
  // main.js builds the phone title bar; mount again in case it ran late.
  window.addEventListener('load', mountTriggers, { once: true });

  // Warm the cache as soon as someone shows intent.
  const warm = (event) => {
    if (event.target instanceof Element && event.target.closest('[data-esc-search-open]')) {
      loadSearcher().catch(() => {});
    }
  };
  document.addEventListener('pointerover', warm, { passive: true });
  document.addEventListener('focusin', warm);

  document.addEventListener('click', (event) => {
    const trigger =
      event.target instanceof Element && event.target.closest('[data-esc-search-open]');
    if (!trigger) return;
    event.preventDefault();
    openSearch(trigger.getAttribute('data-esc-search-query') || '');
  });

  document.addEventListener('keydown', (event) => {
    if ((event.metaKey || event.ctrlKey) && !event.altKey && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      if (palette?.isOpen) palette.close();
      else openSearch();
    } else if (
      event.key === '/' &&
      !event.metaKey &&
      !event.ctrlKey &&
      !isTyping(event.target) &&
      !palette?.isOpen
    ) {
      event.preventDefault();
      openSearch();
    }
  });

  rotateHeroExamples();

  // Shareable links: any page with ?search=funding opens the palette pre-filled.
  const shared = new URLSearchParams(location.search).get('search');
  if (shared !== null) openSearch(normalizeQuery(shared));
}

if (!window.__escSearch) {
  window.__escSearch = { open: openSearch };
  init();
}
