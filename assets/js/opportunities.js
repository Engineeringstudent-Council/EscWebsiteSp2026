// Opportunities board (opportunities.html).
//
// A toolbar (search + "my major") filters everything at once. Below it:
// shelves, one column per category with its first few cards, and "See all"
// turns one category into a wall of cards. Everything that came from the data
// is set with textContent, never innerHTML (see docs/DATA.md).
(function () {
  'use strict';

  var DATA_URL = 'data/opportunities.json';
  var PREVIEW_URL = 'data/opportunities.example.json';
  var SYNCED_URL = 'data/opportunities.synced.json';
  var WALL_PAGE = 24;
  var SHELF_SIZE = 4;
  var NEW_DAYS = 14;

  // Small line icons (24x24, stroke only). They are drawn from this fixed
  // table, never from listing data, and every use is decorative: the text
  // beside it carries the meaning.
  var ICONS = {
    briefcase: ['M3 8h18v12H3z', 'M9 8V5h6v3', 'M3 13h18'],
    sprout: ['M12 21v-9', 'M12 12c0-4 3-6 7-6 0 4-3 6-7 6z', 'M12 15c0-3-2-5-6-5 0 3 2 5 6 5z'],
    flask: ['M9 3h6', 'M10 3v6l-5 9a2 2 0 0 0 2 3h10a2 2 0 0 0 2-3l-5-9V3', 'M8 14h8'],
    cap: ['M2 9l10-5 10 5-10 5z', 'M6 11.5V16c0 1.5 3 3 6 3s6-1.5 6-3v-4.5', 'M22 9v6'],
    coin: ['M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z', 'M14.5 9.5c-.5-1-1.4-1.5-2.5-1.5-1.4 0-2.5.8-2.5 2s1 1.7 2.5 2 2.5.8 2.5 2-1.1 2-2.5 2c-1.1 0-2-.5-2.5-1.5', 'M12 6.5V8', 'M12 16v1.5'],
    award: ['M12 2a6 6 0 1 0 0 12 6 6 0 0 0 0-12z', 'M8.5 13.5L7 22l5-3 5 3-1.5-8.5'],
    layers: ['M12 2l9 5-9 5-9-5z', 'M3 12l9 5 9-5', 'M3 17l9 5 9-5'],
    shield: ['M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z', 'M8.5 12l2.5 2.5 4.5-5'],
    trophy: ['M8 4h8v5a4 4 0 0 1-8 0z', 'M8 6H4v2a3 3 0 0 0 4 3', 'M16 6h4v2a3 3 0 0 1-4 3', 'M12 13v4', 'M8 21h8', 'M9 17h6'],
    calendar: ['M4 5h16v16H4z', 'M4 10h16', 'M8 3v4', 'M16 3v4'],
    grid: ['M4 4h6v6H4z', 'M14 4h6v6h-6z', 'M4 14h6v6H4z', 'M14 14h6v6h-6z'],
    rocket: ['M12 2c3 2 5 6 5 10l-2 3H9l-2-3c0-4 2-8 5-10z', 'M9 15l-3 4 4-1', 'M15 15l3 4-4-1', 'M12 8.5a1.5 1.5 0 1 0 .01 0'],
    dna: ['M7 3c0 5 10 5 10 9s-10 4-10 9', 'M17 3c0 5-10 5-10 9s10 4 10 9', 'M9 6h6', 'M9 18h6'],
    bridge: ['M2 19h20', 'M4 19v-6', 'M20 19v-6', 'M4 13c4-8 12-8 16 0', 'M8 19v-7', 'M12 19v-8', 'M16 19v-7'],
    chip: ['M7 7h10v10H7z', 'M10 10h4v4h-4z', 'M9 3v4', 'M15 3v4', 'M9 17v4', 'M15 17v4', 'M3 9h4', 'M3 15h4', 'M17 9h4', 'M17 15h4'],
    code: ['M8 7l-5 5 5 5', 'M16 7l5 5-5 5', 'M14 5l-4 14'],
    compass: ['M12 3.5a1.5 1.5 0 1 0 .01 0', 'M11.4 5L5 21', 'M12.6 5L19 21', 'M8 15h8'],
    bolt: ['M13 2L4 14h7l-1 8 9-12h-7z'],
    chart: ['M4 4v16h16', 'M8 16v-4', 'M12 16V8', 'M16 16v-6'],
    wave: ['M2 12c1.5-7 3-7 4.5 0s3 7 4.5 0 3-7 4.5 0 3 7 4.5 0'],
    globe: ['M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z', 'M3 12h18', 'M12 3c3 3 3 15 0 18', 'M12 3c-3 3-3 15 0 18'],
    leaf: ['M20 4C10 4 4 9 4 16c0 1.5.5 3 1 4 1-1 3-2 5-2 7 0 10-7 10-14z', 'M5 20c3-6 7-10 12-13'],
    flow: ['M4 4h6v5H4z', 'M14 4h6v5h-6z', 'M9 15h6v5H9z', 'M7 9v2h10V9', 'M12 11v4'],
    cube: ['M12 2l8 4.5v9L12 20l-8-4.5v-9z', 'M4 6.5l8 4.5 8-4.5', 'M12 11v9'],
    gear: ['M12 7a5 5 0 1 0 .01 0', 'M12 10a2 2 0 1 0 .01 0', 'M12 2v3', 'M12 19v3', 'M2 12h3', 'M19 12h3', 'M5 5l2 2', 'M17 17l2 2', 'M19 5l-2 2', 'M7 17l-2 2'],
    radiation: ['M12 12L8 5.07A8 8 0 0 1 16 5.07z', 'M12 12L20 12A8 8 0 0 1 16 18.93z', 'M12 12L8 18.93A8 8 0 0 1 4 12z'],
    sliders: ['M4 7h8', 'M16 7h4', 'M14 5v4', 'M4 17h4', 'M12 17h8', 'M10 15v4'],
    help: ['M12 3a9 9 0 1 0 .01 0', 'M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.4-1 1-1 1.7', 'M12 17v.01'],
  };

  function icon(name) {
    var NS = 'http://www.w3.org/2000/svg';
    var svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('class', 'opp-icon');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    (ICONS[name] || ICONS.grid).forEach(function (d) {
      var path = document.createElementNS(NS, 'path');
      path.setAttribute('d', d);
      svg.appendChild(path);
    });
    return svg;
  }

  // One table drives the labels and the order. A type that is not listed here
  // still gets a shelf (see categoryFor), so new schema values show up on
  // their own.
  var CATEGORIES = [
    { key: 'internship', icon: 'sprout', label: 'Internships', blurb: 'Summer and term-time internships.' },
    { key: 'job', icon: 'briefcase', label: 'Jobs', blurb: 'Full-time and new-grad roles.' },
    { key: 'research', icon: 'flask', label: 'Research', blurb: 'Labs, programs and research for credit.' },
    { key: 'grad-school', icon: 'cap', label: 'Grad school', blurb: 'Applying to masters and PhD programs.' },
    { key: 'scholarship', icon: 'coin', label: 'Scholarships', blurb: 'Awards and money for school.' },
    { key: 'fellowship', icon: 'award', label: 'Fellowships', blurb: 'Funded fellowships and training.' },
    { key: 'minor', icon: 'layers', label: 'Minors', blurb: 'Minors and certificates to add to your degree.' },
    { key: 'blue-and-gold', icon: 'shield', label: 'Blue & Gold', blurb: 'Certification for student organizations.' },
    { key: 'event', icon: 'calendar', label: 'Events & competitions', blurb: 'Fairs, workshops, talks, hackathons and contests.' },
  ];

  // Keep in step with the "majors" enum in schemas/opportunities.schema.json.
  // "label" is the full program name, shown on the pills. "words" lets a listing with no majors field be
  // matched from its title, tags and description (the synced internship feed
  // has no majors at all).
  var MAJORS = [
    { key: 'aerospace-engineering', icon: 'rocket', label: 'Aerospace Engineering', words: 'aerospace|aircraft|avionics|propulsion|satellite|\\bspace\\b' },
    { key: 'bioengineering', icon: 'dna', label: 'Bioengineering', words: '\\bbio|biomedical|medical|pharma|therapeutic|clinical' },
    { key: 'civil-engineering', icon: 'bridge', label: 'Civil Engineering', words: 'civil|structural|construction|geotechnical|transportation' },
    { key: 'electrical-computer-engineering', icon: 'chip', label: 'Electrical & Computer Engineering', words: 'electrical|embedded|hardware|circuit|semiconductor|firmware|\\bvlsi|\\bfpga|signal processing|\\bpcb' },
    { key: 'eecs', icon: 'code', label: 'Electrical Engineering & Computer Sciences', words: 'software|computer|\\bswe\\b|\\bml\\b|machine learning|\\bai\\b|web dev|backend|frontend|full.?stack|cyber|\\bdata\\b|cloud|\\bdevops|embedded|hardware|circuit|semiconductor|firmware' },
    { key: 'engineering-science', icon: 'compass', label: 'Engineering Science', words: '' },
    { key: 'energy-engineering', icon: 'bolt', label: 'Energy Engineering', words: 'energy|solar|battery|batteries|power grid|renewable' },
    { key: 'engineering-math-statistics', icon: 'chart', label: 'Engineering Mathematics & Statistics', words: 'statistic|quantitative|\\bdata\\b|analytics|applied math' },
    { key: 'engineering-physics', icon: 'wave', label: 'Engineering Physics', words: 'physics|optics|photonic|\\blaser|quantum' },
    { key: 'environmental-engineering-science', icon: 'globe', label: 'Environmental Engineering Science', words: 'environment|sustainab|climate|water resource|wastewater' },
    { key: 'environmental-engineering', icon: 'leaf', label: 'Environmental Engineering', words: 'environment|sustainab|climate|water resource|wastewater' },
    { key: 'ieor', icon: 'flow', label: 'Industrial Engineering & Operations Research', words: 'industrial|operations research|supply chain|logistics|\\bdata\\b|analytics|consulting' },
    { key: 'materials-science', icon: 'cube', label: 'Materials Science & Engineering', words: 'materials|metallurg|ceramic|nanotech|thin film' },
    { key: 'mechanical-engineering', icon: 'gear', label: 'Mechanical Engineering', words: 'mechanical|manufacturing|robotic|mechatronic|thermal|\\bcad\\b|product design' },
    { key: 'nuclear-engineering', icon: 'radiation', label: 'Nuclear Engineering', words: 'nuclear|reactor|radiation|fusion' },
    { key: 'engineering-undeclared', icon: 'help', label: 'Engineering – Undeclared', words: '' },
  ];
  MAJORS.forEach(function (m) {
    m.re = m.words ? new RegExp(m.words, 'i') : null;
  });

  var board = document.getElementById('opp-board');
  if (!board) return;

  var state = { items: [], view: 'shelves', query: '', major: '', year: '', showPast: false };
  var ui = {};

  // ------------------------------------------------------------ helpers

  function num(n) {
    return Number(n).toLocaleString('en-US');
  }

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  // Old or catch-all types are shown on the Events shelf, so nothing in the
  // data goes missing just because it has no shelf of its own.
  var SHELF_FOR = { competition: 'event', other: 'event' };

  function categoryFor(type) {
    type = SHELF_FOR[type] || type;
    for (var i = 0; i < CATEGORIES.length; i++) {
      if (CATEGORIES[i].key === type) return CATEGORIES[i];
    }
    var label = String(type || 'other').replace(/-/g, ' ');
    return { key: String(type || 'other'), icon: 'grid', label: label.charAt(0).toUpperCase() + label.slice(1), blurb: '' };
  }

  function majorIcon(key) {
    for (var i = 0; i < MAJORS.length; i++) if (MAJORS[i].key === key) return MAJORS[i].icon;
    return 'grid';
  }

  function majorLabel(key) {
    for (var i = 0; i < MAJORS.length; i++) if (MAJORS[i].key === key) return MAJORS[i].label;
    return key;
  }

  // The majors a listing is for. Empty means "open to every major". Written
  // majors win; otherwise they are guessed from the text.
  function majorsFor(item) {
    if (item.majors && item.majors.length) return item.majors;
    if (item._guessed) return item._guessed;
    var text = [item.title, (item.tags || []).join(' '), item.description].join(' ');
    item._guessed = MAJORS.filter(function (m) {
      return m.re && m.re.test(text);
    }).map(function (m) {
      return m.key;
    });
    return item._guessed;
  }

  function forMajor(item, major) {
    if (!major) return true;
    var list = majorsFor(item);
    return list.length === 0 || list.indexOf(major) !== -1;
  }

  // The graduating classes still on campus: four of them, starting with this
  // spring's seniors (after May the seniors are next year's class).
  function classYears() {
    var now = new Date();
    var first = now.getMonth() >= 5 ? now.getFullYear() + 1 : now.getFullYear();
    return [first, first + 1, first + 2, first + 3];
  }

  // A listing with no gradYears is open to every class.
  function forYear(item, year) {
    if (!year) return true;
    var list = item.gradYears;
    return !list || list.length === 0 || list.indexOf(Number(year)) !== -1;
  }

  // "2027-01-20" as a local date, so it never slips a day in other time zones.
  function parseDate(iso) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
    return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
  }

  function formatDate(iso) {
    var d = parseDate(iso);
    return d ? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '';
  }

  function startOfToday() {
    var now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }

  function isPast(item) {
    var d = parseDate(item.deadline);
    return !!d && d < startOfToday();
  }

  function isNew(item) {
    var d = parseDate(item.postedDate);
    return !!d && (startOfToday() - d) / 86400000 <= NEW_DAYS;
  }

  function domainOf(url) {
    try {
      return new URL(url).hostname.replace(/^www\./, '');
    } catch (e) {
      return '';
    }
  }

  function matchesQuery(item, query) {
    if (!query) return true;
    var hay = [
      item.title,
      item.organization,
      item.description,
      item.location,
      (item.tags || []).join(' '),
      majorsFor(item).map(majorLabel).join(' '),
    ]
      .join(' ')
      .toLowerCase();
    return query
      .toLowerCase()
      .split(/\s+/)
      .every(function (word) {
        return hay.indexOf(word) !== -1;
      });
  }

  // Soonest deadline first; listings with no deadline follow, newest first.
  function byUrgency(a, b) {
    var da = parseDate(a.deadline);
    var db = parseDate(b.deadline);
    if (da && db) return da - db;
    if (da) return -1;
    if (db) return 1;
    return (b.postedDate || '').localeCompare(a.postedDate || '');
  }

  function open() {
    return state.items.filter(function (item) {
      return state.showPast || !isPast(item);
    });
  }

  function filtered() {
    return open().filter(function (item) {
      return forMajor(item, state.major) && forYear(item, state.year) && matchesQuery(item, state.query);
    });
  }

  function groups() {
    var byKey = {};
    filtered().forEach(function (item) {
      var cat = categoryFor(item.type);
      (byKey[cat.key] = byKey[cat.key] || { cat: cat, items: [] }).items.push(item);
    });
    var known = CATEGORIES.map(function (c) {
      return c.key;
    });
    var order = known.concat(
      Object.keys(byKey)
        .filter(function (k) {
          return known.indexOf(k) === -1;
        })
        .sort(),
    );
    return order
      .filter(function (k) {
        return byKey[k];
      })
      .map(function (k) {
        byKey[k].items.sort(byUrgency);
        return byKey[k];
      });
  }

  // ------------------------------------------------------------ cards

  function card(item, cat) {
    var li = el('li', 'opp-item');
    var article = el('article', 'opp-card');
    article.setAttribute('data-cat', cat.key);

    // A link-preview style tile, like a Padlet link card: category colour,
    // a big category icon, the category chip, and the site the link goes to.
    var tile = el('div', 'opp-preview');
    var mark = el('span', 'opp-watermark');
    mark.appendChild(icon(cat.icon));
    tile.appendChild(mark);
    var chips = el('div', 'opp-chips');
    chips.appendChild(el('span', 'opp-chip', cat.label));
    if (isNew(item)) chips.appendChild(el('span', 'opp-new', 'New'));
    tile.appendChild(chips);
    var domain = domainOf(item.url);
    if (domain) tile.appendChild(el('span', 'opp-domain', domain));
    article.appendChild(tile);

    var body = el('div', 'opp-body');
    var title = el('h3', 'opp-title');
    var link = el('a', 'opp-link', item.title);
    link.href = item.url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.appendChild(el('span', 'opp-sr', ' (opens in a new tab)'));
    title.appendChild(link);
    body.appendChild(title);

    body.appendChild(el('p', 'opp-org', item.organization));
    if (item.description) body.appendChild(el('p', 'opp-desc', item.description));

    var facts = [];
    if (item.deadline) facts.push('Apply by ' + formatDate(item.deadline));
    else if (item.eventDate) facts.push(formatDate(item.eventDate));
    else facts.push('Rolling');
    if (item.location) facts.push(item.location);
    if (item.paid === true) facts.push('Paid');
    if (item.paid === false) facts.push('Unpaid');
    var meta = el('ul', 'opp-meta');
    facts.forEach(function (text) {
      meta.appendChild(el('li', '', text));
    });
    body.appendChild(meta);

    var majors = majorsFor(item);
    var shortList = majors.slice(0, 2).map(majorLabel);
    var line = majors.length ? 'For: ' + shortList.join(', ') + (majors.length > 2 ? ' +' + (majors.length - 2) : '') : 'Open to all majors';
    var majorLine = el('p', 'opp-majors');
    if (majors.length) {
      var badges = el('span', 'opp-major-icons');
      majors.slice(0, 3).forEach(function (key) {
        var b = el('span', 'opp-major-icon');
        b.appendChild(icon(majorIcon(key)));
        badges.appendChild(b);
      });
      majorLine.appendChild(badges);
    }
    majorLine.appendChild(el('span', 'opp-majors-text', line));
    body.appendChild(majorLine);

    if (item.eligibility) body.appendChild(el('p', 'opp-elig', item.eligibility));

    article.appendChild(body);
    li.appendChild(article);
    return li;
  }

  // ------------------------------------------------------------ views

  function headCard(cat, count, level, wide) {
    var head = el('div', 'opp-head' + (wide ? ' opp-head--wide' : ''));
    head.setAttribute('data-cat', cat.key);
    var row = el('div', 'opp-head-row');
    var badge = el('span', 'opp-dot');
    badge.appendChild(icon(cat.icon));
    row.appendChild(badge);
    var title = el(level, 'opp-head-title', cat.label);
    title.tabIndex = -1;
    row.appendChild(title);
    row.appendChild(el('span', 'opp-head-count', num(count)));
    row.lastChild.setAttribute('aria-label', count + (count === 1 ? ' listing' : ' listings'));
    head.appendChild(row);
    if (cat.blurb) head.appendChild(el('p', 'opp-head-blurb', cat.blurb));
    return { node: head, title: title };
  }

  function seeAllButton(cat, count) {
    var button = el('button', 'opp-btn opp-btn--block');
    button.type = 'button';
    button.textContent = 'See all ' + num(count);
    button.setAttribute('aria-label', 'See all ' + num(count) + ' ' + cat.label.toLowerCase());
    button.addEventListener('click', function () {
      go(cat.key);
    });
    return button;
  }

  function emptyState() {
    var box = el('div', 'opp-empty');
    box.appendChild(el('p', '', 'Nothing matches. Try fewer words, another major or year, or turn on past deadlines.'));
    var clear = el('button', 'opp-btn', 'Clear search and filters');
    clear.type = 'button';
    clear.addEventListener('click', function () {
      ui.search.value = '';
      clearFilters(true);
    });
    box.appendChild(clear);
    return box;
  }

  function renderShelves() {
    var all = groups();
    if (!all.length) {
      board.appendChild(emptyState());
      return null;
    }
    var wrap = el('div', 'opp-shelves');
    all.forEach(function (g) {
      var shelf = el('section', 'opp-shelf');
      shelf.setAttribute('aria-label', g.cat.label);
      var head = headCard(g.cat, g.items.length, 'h2');
      shelf.appendChild(head.node);
      var list = el('ul', 'opp-list');
      g.items.slice(0, SHELF_SIZE).forEach(function (item) {
        list.appendChild(card(item, g.cat));
      });
      shelf.appendChild(list);
      if (g.items.length > SHELF_SIZE) shelf.appendChild(seeAllButton(g.cat, g.items.length));
      wrap.appendChild(shelf);
    });
    board.appendChild(wrap);
    return null;
  }

  function renderWall(key) {
    var cat = categoryFor(key);
    var group = groups().filter(function (g) {
      return g.cat.key === key;
    })[0];
    var items = group ? group.items : [];

    var back = el('button', 'opp-btn opp-btn--ghost', '← All categories');
    back.type = 'button';
    back.addEventListener('click', function () {
      go('shelves');
    });
    board.appendChild(back);

    var head = headCard(cat, items.length, 'h2', true);
    board.appendChild(head.node);

    if (!items.length) {
      board.appendChild(emptyState());
      return head.title;
    }
    // Thousands of listings would make the page crawl, so the wall fills in
    // a page at a time.
    var list = el('ul', 'opp-wall');
    var shown = 0;
    var more = el('button', 'opp-btn opp-btn--block');
    more.type = 'button';
    function showMore() {
      var next = Math.min(items.length, shown + WALL_PAGE);
      for (var i = shown; i < next; i++) list.appendChild(card(items[i], cat));
      var firstNew = list.children[shown];
      shown = next;
      if (shown >= items.length) {
        more.hidden = true;
      } else {
        more.textContent = 'Show more (' + num(shown) + ' of ' + num(items.length) + ')';
      }
      return firstNew;
    }
    more.addEventListener('click', function () {
      var firstNew = showMore();
      var link = firstNew && firstNew.querySelector('a');
      if (link) link.focus();
    });
    showMore();
    board.appendChild(list);
    board.appendChild(more);
    return head.title;
  }

  function updateStatus() {
    var total = open().length;
    var shown = filtered().length;
    var filtering = state.query || state.major || state.year;
    var text = filtering ? 'Showing ' + num(shown) + ' of ' + num(total) + ' listings' : num(total) + ' listings';
    var parts = [];
    if (state.major) parts.push(majorLabel(state.major));
    if (state.year) parts.push('class of ' + state.year);
    if (parts.length) text += ' for ' + parts.join(', ');
    ui.status.textContent = text;
    var active = (state.major ? 1 : 0) + (state.year ? 1 : 0);
    ui.toggleText.textContent = active ? 'Filters (' + active + ')' : 'Filters';
  }

  // Resets major and year (and the search too when asked). The radios are
  // put back by hand because they only change when a person clicks them.
  function clearFilters(andRender) {
    state.major = '';
    state.year = '';
    state.query = andRender ? '' : state.query;
    [ui.pills, ui.yearPills].forEach(function (row) {
      row.querySelector('input[value=""]').checked = true;
    });
    if (andRender) render(false);
    else updateStatus();
  }

  function render(moveFocus) {
    board.textContent = '';
    var target = state.view === 'shelves' ? renderShelves() : renderWall(state.view);
    updateStatus();
    if (moveFocus && target) target.focus();
    if (moveFocus && !target) window.scrollTo(0, 0);
  }

  // ------------------------------------------------------------ toolbar

  // One radio-pill group. The radio stays in the page for keyboard and screen
  // reader use; the pill beside it is what people see.
  function pillGroup(legend, name, options, onPick) {
    var set = el('fieldset', 'opp-majors-set opp-filter-group');
    set.appendChild(el('legend', 'opp-field-label', legend));
    var row = el('div', 'opp-pills');
    options.forEach(function (o, i) {
      var label = el('label', 'opp-pill');
      var radio = el('input');
      radio.type = 'radio';
      radio.name = name;
      radio.value = o.value;
      radio.checked = i === 0;
      radio.addEventListener('change', function () {
        onPick(o.value);
        render(false);
      });
      label.appendChild(radio);
      var face = el('span', 'opp-pill-text');
      if (o.icon) face.appendChild(icon(o.icon));
      face.appendChild(document.createTextNode(o.text));
      label.appendChild(face);
      row.appendChild(label);
    });
    set.appendChild(row);
    return { set: set, row: row };
  }

  function buildToolbar() {
    var bar = el('div', 'opp-toolbar');
    bar.setAttribute('role', 'search');

    var searchLabel = el('label', 'opp-field opp-field--grow');
    searchLabel.appendChild(el('span', 'opp-field-label', 'Search opportunities'));
    var search = el('input');
    search.type = 'search';
    search.placeholder = 'Company, role, keyword, location…';
    search.autocomplete = 'off';
    searchLabel.appendChild(search);
    bar.appendChild(searchLabel);

    // Filters button + "show past deadlines" sit on one row.
    var actions = el('div', 'opp-actions');
    var toggle = el('button', 'opp-btn opp-filter-toggle');
    toggle.type = 'button';
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-controls', 'opp-filters');
    toggle.appendChild(icon('sliders'));
    var toggleText = el('span', '', 'Filters');
    toggle.appendChild(toggleText);
    actions.appendChild(toggle);

    var past = el('label', 'opp-check');
    var box = el('input');
    box.type = 'checkbox';
    past.appendChild(box);
    past.appendChild(el('span', '', 'Show past deadlines'));
    actions.appendChild(past);
    bar.appendChild(actions);

    // The panel: hidden until the button is pressed.
    var panel = el('div', 'opp-filters');
    panel.id = 'opp-filters';
    panel.hidden = true;

    var majorOptions = [{ value: '', text: 'All majors' }].concat(
      MAJORS.map(function (m) {
        return { value: m.key, text: m.label, icon: m.icon };
      }),
    );
    var majorGroup = pillGroup('My major', 'opp-major', majorOptions, function (v) {
      state.major = v;
    });
    panel.appendChild(majorGroup.set);

    var yearOptions = [{ value: '', text: 'Any year' }].concat(
      classYears().map(function (y) {
        return { value: String(y), text: 'Class of ' + y };
      }),
    );
    var yearGroup = pillGroup('Graduation year', 'opp-year', yearOptions, function (v) {
      state.year = v;
    });
    panel.appendChild(yearGroup.set);

    var reset = el('button', 'opp-btn opp-btn--ghost', 'Clear filters');
    reset.type = 'button';
    panel.appendChild(reset);
    bar.appendChild(panel);

    var status = el('p', 'opp-status');
    status.setAttribute('role', 'status');
    bar.appendChild(status);

    function setOpen(open) {
      panel.hidden = !open;
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    }
    toggle.addEventListener('click', function () {
      setOpen(panel.hidden);
    });
    panel.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        setOpen(false);
        toggle.focus();
      }
    });
    reset.addEventListener('click', function () {
      clearFilters(true);
    });
    search.addEventListener('input', function () {
      state.query = search.value.trim();
      render(false);
    });
    box.addEventListener('change', function () {
      state.showPast = box.checked;
      render(false);
    });

    board.parentNode.insertBefore(bar, board);
    ui = {
      bar: bar,
      search: search,
      pills: majorGroup.row,
      yearPills: yearGroup.row,
      past: box,
      status: status,
      toggleText: toggleText,
    };
  }

  // ------------------------------------------------------------ routing

  function viewFromHash() {
    var key = decodeURIComponent(location.hash.replace(/^#/, ''));
    return key || 'shelves';
  }

  function go(view) {
    state.view = view;
    var url = location.pathname + location.search + (view === 'shelves' ? '' : '#' + encodeURIComponent(view));
    history.pushState(null, '', url);
    render(true);
  }

  window.addEventListener('popstate', function () {
    state.view = viewFromHash();
    render(true);
  });

  // ------------------------------------------------------------ load

  function fetchJson(url) {
    return fetch(url).then(function (response) {
      if (!response.ok) throw new Error(url + ' ' + response.status);
      return response.json();
    });
  }

  function start(items) {
    state.items = items;
    state.view = viewFromHash();
    buildToolbar();
    render(false);
  }

  // A file that is missing or broken just counts as empty, so one bad file
  // never takes the whole board down.
  function optional(url) {
    return fetchJson(url).then(
      function (data) {
        return (data && data.opportunities) || [];
      },
      function () {
        return [];
      },
    );
  }

  // Hand-curated entries come first and win: a synced listing is dropped if
  // it shares an id or a link with one of them.
  function merge(curated, synced) {
    var seen = {};
    curated.forEach(function (item) {
      seen[item.id] = true;
      seen[item.url] = true;
    });
    return curated.concat(
      synced.filter(function (item) {
        return !seen[item.id] && !seen[item.url];
      }),
    );
  }

  Promise.all([optional(DATA_URL), optional(SYNCED_URL)]).then(function (results) {
    var curated = results[0];
    var synced = results[1];
    if (curated.length) return start(merge(curated, synced));
    // No curated file yet: show the example listings next to the synced ones.
    // The fake sample internships step aside once real ones are available.
    return optional(PREVIEW_URL).then(function (examples) {
      if (synced.length) {
        examples = examples.filter(function (item) {
          return !(item.type === 'internship' && /^sample-/.test(item.id));
        });
      }
      var all = merge(examples, synced);
      if (!all.length) {
        board.textContent = '';
        board.appendChild(el('p', 'opp-empty', 'Could not load the opportunities. Please try again later.'));
        return;
      }
      start(all);
    });
  });
})();
