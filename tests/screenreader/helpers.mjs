// Shared steps for the VoiceOver and NVDA suites. Screen readers word things
// slightly differently between versions, so assertions match the parts that
// matter (names, roles, states) rather than exact sentences.

export const PAGE = 'students.html';

/** Open a page and wait until the nav enhancements are ready. */
export async function openPage(page, path = PAGE) {
  await page.goto(path, { waitUntil: 'load' });
  await page.waitForFunction(() => document.documentElement.dataset.escNavA11y === 'ready');
}

/**
 * Move with `step` until the screen reader says something matching
 * `pattern`, and return that phrase. Fails with everything that was said.
 */
export async function moveUntil(reader, step, pattern, max = 60) {
  // The reader may already be on it (entering a page announces its first item).
  const current = await reader.lastSpokenPhrase();
  if (pattern.test(current)) return current;
  for (let i = 0; i < max; i++) {
    await step();
    const phrase = await reader.lastSpokenPhrase();
    if (pattern.test(phrase)) return phrase;
  }
  const log = (await reader.spokenPhraseLog()).slice(-25).join(' | ');
  throw new Error(`Never heard ${pattern} in ${max} steps. Last phrases: ${log}`);
}

/** Everything said since `mark` (an index into the spoken phrase log). */
export async function spokenSince(reader, mark) {
  return (await reader.spokenPhraseLog()).slice(mark).join(' | ');
}

/** The disclosure state a phrase announces: 'expanded', 'collapsed', or null. */
export function stateOf(phrase) {
  const match = /\b(expanded|collapsed)\b/i.exec(phrase);
  return match ? match[1].toLowerCase() : null;
}
