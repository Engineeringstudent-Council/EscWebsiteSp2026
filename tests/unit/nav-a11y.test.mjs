import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  isBrowserShortcut,
  isCurrentPage,
  nextIndex,
  normalizePath,
} from '../../assets/js/site/nav-a11y.js';

const at = (href) => ({ href });
const SITE = 'https://esc.studentorg.berkeley.edu';

test('normalizePath treats index.html, trailing slashes, and .html as the same page', () => {
  assert.equal(normalizePath('/'), '/');
  assert.equal(normalizePath(''), '/');
  assert.equal(normalizePath('/index.html'), '/');
  assert.equal(normalizePath('/index.htm'), '/');
  assert.equal(normalizePath('/about.html'), '/about');
  assert.equal(normalizePath('/about'), '/about');
  assert.equal(normalizePath('/about/'), '/about');
  assert.equal(normalizePath('/esc2026-2027/'), '/esc2026-2027');
  assert.equal(normalizePath('/esc2026-2027/index.html'), '/esc2026-2027');
  assert.equal(normalizePath('//double//slash.html'), '/double/slash');
  assert.equal(normalizePath('/caf%C3%A9.html'), '/café');
  // Malformed escapes don't throw.
  assert.equal(normalizePath('/bad%E0%A4%A.html'), '/bad%E0%A4%A');
});

test('index.html and the bare site root match each other', () => {
  assert.equal(isCurrentPage('index.html', at(`${SITE}/`)), true);
  assert.equal(isCurrentPage('/', at(`${SITE}/index.html`)), true);
  assert.equal(isCurrentPage('./', at(`${SITE}/index.html`)), true);
  assert.equal(isCurrentPage('about.html', at(`${SITE}/`)), false);
});

test('query strings and fragments are ignored on both sides', () => {
  assert.equal(isCurrentPage('events.html', at(`${SITE}/events.html?ref=nav`)), true);
  assert.equal(isCurrentPage('events.html#spring', at(`${SITE}/events.html`)), true);
  assert.equal(isCurrentPage('events.html?x=1', at(`${SITE}/events.html#top`)), true);
  assert.equal(isCurrentPage('past-events.html', at(`${SITE}/events.html`)), false);
});

test('trailing slashes and extensionless URLs match', () => {
  assert.equal(isCurrentPage('about.html', at(`${SITE}/about`)), true);
  assert.equal(isCurrentPage('/about/', at(`${SITE}/about.html`)), true);
  assert.equal(isCurrentPage('sub/../about.html', at(`${SITE}/about.html`)), true);
});

test('relative links resolve against the current directory', () => {
  assert.equal(isCurrentPage('page.html', at(`${SITE}/sub/page.html`)), true);
  assert.equal(isCurrentPage('page.html', at(`${SITE}/other/page.html`)), true);
  assert.equal(isCurrentPage('/page.html', at(`${SITE}/sub/page.html`)), false);
});

test('fragment-only, empty, external, and non-http links never match', () => {
  const here = at(`${SITE}/students.html`);
  assert.equal(isCurrentPage('#', here), false);
  assert.equal(isCurrentPage('#main', here), false);
  assert.equal(isCurrentPage('', here), false);
  assert.equal(isCurrentPage('   ', here), false);
  assert.equal(isCurrentPage(null, here), false);
  assert.equal(isCurrentPage(undefined, here), false);
  assert.equal(isCurrentPage('https://example.com/students.html', here), false);
  assert.equal(isCurrentPage('mailto:esc@berkeley.edu', here), false);
  assert.equal(isCurrentPage('javascript:void(0)', here), false);
  assert.equal(isCurrentPage('students.html', null), false);
  assert.equal(isCurrentPage('students.html', {}), false);
});

test('the same path on another origin or scheme is not the current page', () => {
  const here = at(`${SITE}/students.html`);
  assert.equal(isCurrentPage('http://esc.studentorg.berkeley.edu/students.html', here), false);
  assert.equal(isCurrentPage(`${SITE}/students.html`, here), true);
  assert.equal(isCurrentPage('//esc.studentorg.berkeley.edu/students.html', here), true);
});

test('nextIndex moves with arrows and wraps at both ends', () => {
  assert.equal(nextIndex('ArrowDown', 0, 3), 1);
  assert.equal(nextIndex('ArrowDown', 2, 3), 0);
  assert.equal(nextIndex('ArrowUp', 0, 3), 2);
  assert.equal(nextIndex('ArrowUp', 2, 3), 1);
  assert.equal(nextIndex('Home', 2, 3), 0);
  assert.equal(nextIndex('End', 0, 3), 2);
});

test('nextIndex starts from the ends when nothing is focused, and ignores other keys', () => {
  assert.equal(nextIndex('ArrowDown', -1, 4), 0);
  assert.equal(nextIndex('ArrowUp', -1, 4), 3);
  assert.equal(nextIndex('Enter', 1, 4), -1);
  assert.equal(nextIndex('ArrowRight', 1, 4), -1);
  assert.equal(nextIndex('ArrowDown', 0, 0), -1);
});

test('Option/Alt+Tab is handled like Tab (Safari), other modified keys are left alone', () => {
  const key = (k, mods = {}) => ({
    key: k,
    altKey: false,
    ctrlKey: false,
    metaKey: false,
    ...mods,
  });
  assert.equal(isBrowserShortcut(key('Tab')), false);
  assert.equal(isBrowserShortcut(key('Tab', { altKey: true })), false);
  assert.equal(isBrowserShortcut(key('ArrowDown', { altKey: true })), true);
  assert.equal(isBrowserShortcut(key('Tab', { ctrlKey: true })), true);
  assert.equal(isBrowserShortcut(key('Enter', { metaKey: true })), true);
});
