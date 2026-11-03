// Interactive bits of ficomm.html. Everything here is an enhancement: with
// JavaScript off the page still shows every rule, step, and contact.
//
//   - "Ready to present?" checklist that remembers ticks on this device
//   - "Can we buy this?" box backed by ./ficomm-rules.js
//   - Copy buttons for the Callink account name and email addresses
//   - Section rail that highlights where you are on the page

import { checkPurchase } from './ficomm-rules.js';

const STORAGE_KEY = 'esc-ficomm-prep';

function readSaved() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    return new Set(Array.isArray(saved) ? saved : []);
  } catch {
    return new Set();
  }
}

function save(ids) {
  try {
    if (ids.size) localStorage.setItem(STORAGE_KEY, JSON.stringify([...ids]));
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Private mode or storage full: the checklist still works for this visit.
  }
}

export function setupChecklist(root = document) {
  const list = root.querySelector('[data-fc-checklist]');
  if (!list) return;
  const boxes = [...list.querySelectorAll('input[type="checkbox"][data-id]')];
  const status = root.querySelector('[data-fc-progress]');
  const meter = root.querySelector('[data-fc-meter]');
  const reset = root.querySelector('[data-fc-reset]');
  const live = root.querySelector('[data-fc-progress-live]');
  const saved = readSaved();

  for (const box of boxes) box.checked = saved.has(box.dataset.id);

  const render = (announce) => {
    const done = boxes.filter((b) => b.checked).length;
    const total = boxes.length;
    if (meter) {
      meter.value = done;
      meter.max = total;
    }
    const text =
      done === total ? `All ${total} ready. You’re set to present.` : `${done} of ${total} ready`;
    if (status) status.textContent = text;
    // Only speak changes the user made, not the restore on page load.
    if (announce && live) live.textContent = text;
    list.closest('[data-fc-prep]')?.classList.toggle('is-complete', done === total);
    if (reset) reset.hidden = done === 0;
  };

  list.addEventListener('change', (event) => {
    const box = event.target;
    if (!(box instanceof HTMLInputElement) || !box.dataset.id) return;
    const ids = new Set(boxes.filter((b) => b.checked).map((b) => b.dataset.id));
    save(ids);
    render(true);
  });

  reset?.addEventListener('click', () => {
    for (const box of boxes) box.checked = false;
    save(new Set());
    render(true);
    boxes[0]?.focus();
  });

  render(false);
}

function el(tag, attrs = {}, text) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
  if (text != null) node.textContent = text;
  return node;
}

export function setupChecker(root = document) {
  const form = root.querySelector('[data-fc-checker]');
  if (!form) return;
  const input = form.querySelector('input');
  const out = form.querySelector('[data-fc-result]');
  if (!input || !out) return;

  const render = () => {
    const query = input.value.trim();
    const { status, matches } = checkPurchase(query);
    out.replaceChildren();
    out.dataset.status = status;
    if (status === 'empty') return;

    if (status === 'clear') {
      out.append(
        el('p', { class: 'fc-result-head' }, `Nothing on the ASUC list matches “${query}”.`),
        el(
          'p',
          {},
          'That’s a good sign, not an approval. Treasurers and ASUC Finance still review every purchase request, so ask them if you’re unsure.',
        ),
      );
      return;
    }

    const head =
      status === 'restricted' ? 'ASUC funds can’t pay for this.' : 'Allowed, with a condition.';
    out.append(el('p', { class: 'fc-result-head' }, head));
    const list = el('ul', { class: 'fc-result-list' });
    for (const rule of matches) {
      const item = el('li', { 'data-kind': rule.kind });
      const official = rule.official.map((n) => `#${n}`).join(', ');
      item.append(
        el('strong', {}, rule.title),
        el('span', { class: 'fc-result-ref' }, ` (official list ${official})`),
        el('br'),
        document.createTextNode(rule.fix),
      );
      list.append(item);
    }
    out.append(list);
  };

  let timer;
  input.addEventListener('input', () => {
    clearTimeout(timer);
    timer = setTimeout(render, 180);
  });
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    clearTimeout(timer);
    render();
  });
  for (const chip of root.querySelectorAll('[data-fc-try]')) {
    chip.addEventListener('click', () => {
      input.value = chip.dataset.fcTry;
      render();
      input.focus();
    });
  }
}

async function copyText(text) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const area = el('textarea', { readonly: '', 'aria-hidden': 'true' });
  area.value = text;
  area.style.position = 'fixed';
  area.style.opacity = '0';
  document.body.append(area);
  area.select();
  const ok = document.execCommand('copy');
  area.remove();
  if (!ok) throw new Error('copy failed');
}

export function setupCopyButtons(root = document) {
  for (const button of root.querySelectorAll('[data-fc-copy]')) {
    button.hidden = false;
    const label = button.querySelector('[data-fc-copy-label]') ?? button;
    const original = label.textContent;
    const live = root.querySelector('[data-fc-copy-status]');
    let timer;
    button.addEventListener('click', async () => {
      let message;
      try {
        await copyText(button.dataset.fcCopy);
        message = 'Copied';
        if (live) live.textContent = `Copied ${button.dataset.fcCopy}`;
      } catch {
        message = 'Press Ctrl+C';
      }
      label.textContent = message;
      button.classList.add('is-copied');
      clearTimeout(timer);
      timer = setTimeout(() => {
        label.textContent = original;
        button.classList.remove('is-copied');
      }, 1800);
    });
  }
}

export function setupRail(root = document) {
  const links = [...root.querySelectorAll('[data-fc-rail] a[href^="#"]')];
  if (!links.length) return;
  const pairs = links
    .map((link) => [document.getElementById(link.getAttribute('href').slice(1)), link])
    .filter(([section]) => section);
  let current = null;
  let queued = false;

  // The current section is the last one whose top has passed a reading line
  // 30% down the viewport. Cheap enough to run once per frame on scroll.
  const update = () => {
    queued = false;
    const line = window.innerHeight * 0.3;
    let active = null;
    for (const [section, link] of pairs) {
      if (section.getBoundingClientRect().top <= line) active = link;
      else break;
    }
    if (active === current) return;
    current?.removeAttribute('aria-current');
    active?.setAttribute('aria-current', 'location');
    current = active;
  };
  const queue = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(update);
  };
  window.addEventListener('scroll', queue, { passive: true });
  window.addEventListener('resize', queue, { passive: true });
  update();
}

export function init(root = document) {
  setupChecklist(root);
  setupChecker(root);
  setupCopyButtons(root);
  setupRail(root);
}

if (typeof document !== 'undefined' && document.querySelector('[data-fc-page]')) init();
