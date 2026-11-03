// Accessibility helpers for page content, the companion to nav-a11y.js:
//
//   - Links that open a new tab say so. Sighted visitors see the tab
//     appear; screen reader users otherwise lose their place without
//     warning (WCAG 3.2.5). A visually hidden " (opens in a new tab)" is
//     added to every target="_blank" link, including links that scripts
//     add later, such as the exec roster.
//   - Those links also get rel="noopener", so the new page can't navigate
//     this one.
//   - An embed (Google Calendar, Docs, Drive) holding keyboard focus gets
//     the site's focus ring. Browsers stop matching :focus on a cross-origin
//     <iframe> once focus moves inside it, so a class marks it instead
//     (WCAG 2.4.7).
//
// Nothing here changes what the page looks like.

export const NEW_TAB_TEXT = ' (opens in a new tab)';
const MARK = 'escNewTab';

/** True if the link's accessible name will already mention the new tab. */
function alreadyAnnounced(link) {
  if (link.dataset[MARK]) return true;
  const label = link.getAttribute('aria-label');
  return /new (tab|window)/i.test(label ?? link.textContent ?? '');
}

/** Announce one target="_blank" link. Returns true if it was changed. */
export function announceNewTab(link) {
  if (link.target !== '_blank' || alreadyAnnounced(link)) return false;
  link.dataset[MARK] = '1';
  const rel = new Set((link.getAttribute('rel') ?? '').split(/\s+/).filter(Boolean));
  rel.add('noopener');
  link.setAttribute('rel', [...rel].join(' '));

  const label = link.getAttribute('aria-label');
  if (label !== null) {
    link.setAttribute('aria-label', label.trimEnd() + NEW_TAB_TEXT);
    return true;
  }
  const hint = link.ownerDocument.createElement('span');
  hint.className = 'visually-hidden';
  hint.textContent = NEW_TAB_TEXT;
  link.append(hint);
  return true;
}

/** Announce every new-tab link under `root`. Returns how many changed. */
export function announceNewTabs(root) {
  let changed = 0;
  for (const link of root.querySelectorAll('a[target="_blank"]')) {
    if (announceNewTab(link)) changed += 1;
  }
  return changed;
}

export const FRAME_FOCUS_CLASS = 'esc-frame-focus';

/**
 * Keep FRAME_FOCUS_CLASS on whichever <iframe> holds focus. The page gets
 * no event when focus moves from one frame straight into the next, so
 * while a frame has focus it is re-checked every 100ms.
 */
export function trackFrameFocus(doc = document) {
  const win = doc.defaultView;
  if (!win) return () => {};
  let current = null;
  let timer = null;
  const mark = () => {
    const el = doc.activeElement;
    const frame = el && el.tagName === 'IFRAME' ? el : null;
    if (frame === current) return;
    current?.classList.remove(FRAME_FOCUS_CLASS);
    current = frame;
    frame?.classList.add(FRAME_FOCUS_CLASS);
  };
  const onBlur = () => {
    mark();
    win.clearInterval(timer);
    timer = win.setInterval(() => {
      mark();
      if (!current) win.clearInterval(timer);
    }, 100);
  };
  const onFocus = () => {
    win.clearInterval(timer);
    mark();
  };
  win.addEventListener('blur', onBlur);
  win.addEventListener('focus', onFocus);
  doc.addEventListener('focusin', mark);
  return () => {
    win.removeEventListener('blur', onBlur);
    win.removeEventListener('focus', onFocus);
    doc.removeEventListener('focusin', mark);
    win.clearInterval(timer);
  };
}

/**
 * Install the helpers on a document, and keep them applied to content that
 * scripts add later. Returns the observer so tests can disconnect it.
 */
export function installA11y(doc = document) {
  announceNewTabs(doc);
  trackFrameFocus(doc);
  const View = doc.defaultView;
  if (!View?.MutationObserver) return null;
  const observer = new View.MutationObserver((records) => {
    for (const record of records) {
      for (const node of record.addedNodes) {
        if (node.nodeType !== 1) continue;
        if (node.matches('a[target="_blank"]')) announceNewTab(node);
        announceNewTabs(node);
      }
    }
  });
  observer.observe(doc.body, { childList: true, subtree: true });
  doc.documentElement.dataset.escA11y = 'ready';
  return observer;
}
