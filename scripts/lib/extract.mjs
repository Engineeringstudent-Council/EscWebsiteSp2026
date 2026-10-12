// Pulls searchable content out of one HTML page.
//
// A page becomes a title, a description, and a list of sections. Each section
// is a heading plus the text that follows it until the next heading, so a
// search can drop you at "Housing › Emergency Housing" rather than just the
// top of the page.

import * as cheerio from 'cheerio';
import { clean } from './text.mjs';

// Chrome that repeats on every page (or isn't content at all).
const STRIP = [
  'script',
  'style',
  'noscript',
  'template',
  'svg',
  'iframe',
  'object',
  'form',
  'select',
  'header#header',
  '#header',
  '#nav',
  '#titleBar',
  '#navPanel',
  'footer',
  '#footer',
  '.copyright',
  '[hidden]',
  '[aria-hidden="true"]',
  '[data-search-ignore]',
].join(',');

const HEADING = new Set(['h1', 'h2', 'h3', 'h4']);
const MAX_HEADING = 100;

/** FAQ pages use <button class="accordion">Question</button> as headings. */
function isHeading(el) {
  return (
    HEADING.has(el.tagName) ||
    (el.tagName === 'button' && /\baccordion\b/.test(el.attribs?.class ?? ''))
  );
}

const BLOCK = new Set([
  'p',
  'div',
  'li',
  'ul',
  'ol',
  'section',
  'article',
  'br',
  'tr',
  'td',
  'th',
  'table',
  'header',
  'blockquote',
  'dd',
  'dt',
  'center',
  'button',
  'hr',
]);

/**
 * @param {string} html
 * @returns {{
 *   htmlTitle: string, firstHeading: string, metaDescription: string, metaKeywords: string,
 *   robotsNoindex: boolean, intro: string,
 *   sections: {heading: string, id: string|null, text: string, href: string|null}[],
 *   links: {href: string, label: string}[]
 * }}
 */
export function extractPage(html) {
  const $ = cheerio.load(html);

  const htmlTitle = clean($('head > title').first().text());
  const metaDescription = clean($('meta[name="description"]').attr('content'));
  const metaKeywords = clean($('meta[name="keywords"]').attr('content'));
  const robotsNoindex = /noindex/i.test($('meta[name="robots"]').attr('content') ?? '');

  // Links are collected before stripping so the crawler can follow them.
  const links = $('body a[href]')
    .map((_, a) => ({ href: ($(a).attr('href') ?? '').trim(), label: clean($(a).text()) }))
    .get()
    .filter((link) => link.href);

  $(STRIP).remove();
  $('[style]').each((_, el) => {
    if (/display\s*:\s*none/i.test($(el).attr('style'))) $(el).remove();
  });

  const main = $('#main').length
    ? $('#main')
    : $('#page-wrapper').length
      ? $('#page-wrapper')
      : $('body');
  const preferred = main.find('header.major h1, header.major h2').first();
  const firstHeading = clean((preferred.length ? preferred : main.find('h1, h2').first()).text());

  const sections = [];
  let intro = '';
  let current = null;
  const append = (text) => {
    if (current) current.text += text;
    else intro += text;
  };

  const walk = (node) => {
    for (const child of node.children ?? []) {
      if (child.type === 'text') {
        append(child.data);
      } else if (child.type === 'tag') {
        // Some pages style whole paragraphs as <h3>; those are content, not headings.
        const heading = isHeading(child) ? clean($(child).text()) : '';
        if (heading && heading.length <= MAX_HEADING) {
          const onlyLink =
            $(child).children('a').length === 1 && clean($(child).children('a').text()) === heading;
          current = {
            heading,
            id: $(child).attr('id') ?? null,
            text: '',
            href: onlyLink ? ($(child).children('a').attr('href') ?? '').trim() || null : null,
          };
          sections.push(current);
          continue;
        }
        const block = BLOCK.has(child.tagName);
        if (block) append(' ');
        if (child.tagName === 'img') append(' ');
        walk(child);
        if (block) append(' ');
      }
    }
  };
  walk(main.get(0));

  return {
    htmlTitle,
    firstHeading,
    metaDescription,
    metaKeywords,
    robotsNoindex,
    intro: clean(intro),
    sections: sections.map((section) => ({ ...section, text: clean(section.text) })),
    links,
  };
}
