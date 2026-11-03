// What ASUC Program Funds (the money ESC hands out, including FiComm awards)
// can't buy, and a small matcher behind the "Can we buy this?" box on
// ficomm.html. Source: the ASUC restrictions in the 2026-27 Blue & Gold
// Treasurer Webinar. The official wording lives in ficomm.html (the
// "full list" section); every rule here points at one of those items by
// number, and tests/unit/ficomm-rules.test.mjs keeps the two in sync.
//
// This is a nudge, not an approval: no match means "nothing on the list",
// never "allowed". Treasurers and ASUC Finance still review every request.

/**
 * @typedef {object} Rule
 * @property {string} id         Stable key.
 * @property {number[]} official Item numbers in the official list on ficomm.html.
 * @property {'banned'|'conditional'} kind
 *   banned: ASUC funds can't pay for it at all.
 *   conditional: allowed only if the condition in `fix` is met.
 * @property {string} title      Short label shown in the result.
 * @property {string} fix        What to do instead.
 * @property {string[]} words    Lower-case words or phrases that trigger it.
 */

/** @type {Rule[]} */
export const RULES = [
  {
    id: 'food',
    official: [1],
    kind: 'banned',
    title: 'Food and drinks',
    fix: 'ASUC funds never cover food or drinks, not even bottled water. Use your ESS funds, which have no ASUC restrictions.',
    words: [
      'food',
      'foods',
      'drink',
      'beverage',

      'bottled water',
      'water bottle',
      'snack',
      'pizza',
      'boba',
      'coffee',
      'tea',
      'soda',
      'juice',
      'catering',
      'caterer',
      'meal',
      'lunch',
      'dinner',
      'breakfast',
      'brunch',
      'donut',
      'doughnut',
      'cookie',
      'bagel',
      'candy',

      'burrito',
      'sandwich',
      'taco',
      'sushi',
      'ice cream',
      'dessert',
      'cake',
      'fruit',
      'restaurant',
      'doordash',
      'grubhub',
      'ubereats',
      'uber eats',

      'refreshment',
    ],
  },
  {
    id: 'intramurals',
    official: [2],
    kind: 'banned',
    title: 'Intramural sports registration',
    fix: 'IM team registration fees can’t come from ASUC funds. ESS funds or member dues can cover them.',
    words: [
      'intramural',
      'intramurals',
      'im sports',
      'im team',
      'rec sports',
      'imleagues',
      'im league',
    ],
  },
  {
    id: 'flyers',
    official: [3, 4],
    kind: 'conditional',
    title: 'Flyers and advertising',
    fix: 'Allowed only if every flyer says “Sponsored by the ASUC” (or “ASUC”) and states how wheelchair accessible the event is.',
    words: [
      'flyer',
      'flier',
      'poster',
      'advertising',
      'advertisement',

      'ads',
      'banner',

      'handout',
      'brochure',
      'postcard',
      'sticker',
      'instagram ad',
      'promotion',
    ],
  },
  {
    id: 'stationery',
    official: [5],
    kind: 'conditional',
    title: 'Stationery',
    fix: 'Allowed only if the stationery shows the ASUC logo.',
    words: ['stationery', 'letterhead', 'business card', 'envelope', 'notepad', 'notecard'],
  },
  {
    id: 'travel',
    official: [6],
    kind: 'banned',
    title: 'Travel outside the Bay Area',
    fix: 'Travel is only covered inside the nine Bay Area counties (Alameda, Contra Costa, Marin, Napa, San Francisco, San Mateo, Santa Clara, Solano, Sonoma). Trips to the ASUC Cal Lodge are the one exception.',
    words: [
      'travel',
      'flight',
      'airfare',
      'plane ticket',
      'airline',
      'hotel',
      'motel',
      'airbnb',
      'lodging',
      'road trip',
      'out of state',
      'conference trip',
      'competition trip',
      'rental car',
      'car rental',
      'bus charter',
      'charter bus',

      'mileage',
      'los angeles',
      'san diego',
      'sacramento',
      'tahoe',
      'las vegas',
      'nationals',
    ],
  },
  {
    id: 'retreats',
    official: [6],
    kind: 'banned',
    title: 'Retreats',
    fix: 'Retreat costs aren’t covered by ASUC funds. ESS funds are the recommended way to pay for retreats and socials.',
    words: ['retreat', 'cabin', 'camping', 'campsite', 'getaway'],
  },
  {
    id: 'off-campus',
    official: [7],
    kind: 'banned',
    title: 'Events outside the campus boundary',
    fix: 'Local events must stay within Ashby Ave (south), MLK Jr Way (west), Cedar St (north), and the hills (east).',
    words: [
      'off campus',
      'off-campus',
      'oakland',
      'emeryville',
      'san francisco',
      'sf',
      'venue rental',
      'bowling',
      'escape room',
      'six flags',
    ],
  },
  {
    id: 'prizes',
    official: [8],
    kind: 'banned',
    title: 'Prizes and gifts for individuals',
    fix: 'Prizes, gift cards, and gifts to individuals can’t come from ASUC funds. ESS funds can cover them.',
    words: [
      'prize',
      'gift',
      'gift card',
      'giftcard',
      'raffle',
      'giveaway',
      'award',
      'trophy',
      'medal',
      'reward',
      'thank you gift',
      'amazon card',
    ],
  },
  {
    id: 'alcohol',
    official: [9],
    kind: 'banned',
    title: 'Alcohol and drugs',
    fix: 'Never covered, by any ESC or ASUC funds.',
    words: [
      'alcohol',
      'beer',
      'wine',
      'liquor',
      'vodka',
      'tequila',
      'champagne',
      'cocktail',
      'drug',
      'weed',
      'cannabis',
      'marijuana',
      'vape',
      'nicotine',
      'tobacco',
    ],
  },
  {
    id: 'politics',
    official: [10],
    kind: 'banned',
    title: 'Off-campus political activity',
    fix: 'ASUC funds can’t support political campaigns, candidates, or ballot measures.',
    words: [
      'campaign',
      'candidate',
      'ballot',
      'ballot measure',
      'proposition',
      'election',
      'political',
      'lobbying',
    ],
  },
  {
    id: 'insurance',
    official: [12],
    kind: 'banned',
    title: 'Insurance for hazard level 2 and 3 events',
    fix: 'Insurance premiums for hazard level 2 or 3 events on campus aren’t covered.',
    words: ['insurance', 'insurance premium', 'event insurance', 'liability insurance'],
  },
  {
    id: 'latex',
    official: [13],
    kind: 'banned',
    title: 'Non-essential latex',
    fix: 'Balloons and rubber bands aren’t covered. Protective equipment and contraceptives are fine.',
    words: ['balloon', 'rubber band', 'latex'],
  },
  {
    id: 'styrofoam',
    official: [14],
    kind: 'banned',
    title: 'Single-use styrofoam',
    fix: 'Single-use styrofoam and polystyrene products aren’t covered. Pick compostable or reusable instead.',
    words: ['styrofoam', 'polystyrene', 'foam cup', 'foam plate', 'foam container'],
  },
];

/** The official list has 14 items; this matcher covers every item-shaped one. */
export const OFFICIAL_COUNT = 14;

/** Lower-case, strip punctuation (keeping in-word hyphens), collapse spaces. */
export function normalize(text) {
  return String(text ?? '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[’']/g, '')
    .replace(/[^a-z0-9-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Naive singular: pizzas → pizza, boxes → box, parties → party. */
function singular(word) {
  if (word.length > 4 && word.endsWith('ies')) return `${word.slice(0, -3)}y`;
  if (word.length > 4 && /(ches|shes|xes|sses)$/.test(word)) return word.slice(0, -2);
  if (word.length > 3 && word.endsWith('s') && !word.endsWith('ss')) return word.slice(0, -1);
  return word;
}

/** True when `phrase` appears in `words` on word boundaries, plural-tolerant. */
function contains(words, phrase) {
  const target = phrase.split(' ').map(singular);
  outer: for (let i = 0; i + target.length <= words.length; i++) {
    for (let j = 0; j < target.length; j++) {
      if (singular(words[i + j]) !== target[j]) continue outer;
    }
    return true;
  }
  return false;
}

/**
 * Check a planned purchase against the ASUC restrictions.
 *
 * @param {string} query What the club wants to buy, in plain words.
 * @returns {{status: 'empty'|'clear'|'restricted'|'conditional', matches: Rule[]}}
 *   restricted: at least one banned rule matched.
 *   conditional: only conditional rules matched.
 *   clear: nothing on the list matched (still not an approval).
 */
export function checkPurchase(query) {
  const text = normalize(query);
  if (text.length < 2) return { status: 'empty', matches: [] };
  const words = text.split(' ');
  const matches = RULES.filter((rule) => rule.words.some((w) => contains(words, normalize(w))));
  if (!matches.length) return { status: 'clear', matches };
  const banned = matches.some((rule) => rule.kind === 'banned');
  return { status: banned ? 'restricted' : 'conditional', matches };
}
