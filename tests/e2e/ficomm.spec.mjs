// ficomm.html: the FiComm guide for Blue & Gold club treasurers. These check
// the interactive pieces in a real browser and that the page still says
// everything with JavaScript turned off.
import { test, expect } from './fixtures.mjs';

const PAGE = 'ficomm.html';
const ACCOUNT = '3-40-201032-00000-ASUCFunds-ESC';

test.describe('FiComm page', () => {
  test('is reachable from the Organizations menu', async ({ page }) => {
    await page.goto('students.html');
    const link = page.locator('#nav a[href="ficomm.html"]');
    await expect(link).toHaveCount(1);
    await expect(link).toHaveText('FiComm & Club Funding');
  });

  test('has one h1 and every section the rail links to', async ({ page }) => {
    await page.goto(PAGE);
    await expect(page.locator('h1')).toHaveCount(1);
    const targets = await page
      .locator('[data-fc-rail] a')
      .evaluateAll((links) => links.map((a) => a.getAttribute('href')));
    expect(targets.length).toBeGreaterThanOrEqual(8);
    for (const href of targets) await expect(page.locator(href)).toHaveCount(1);
  });

  test('the prep checklist remembers ticks across reloads and can be reset', async ({ page }) => {
    await page.goto(PAGE);
    const boxes = page.locator('[data-fc-checklist] input[type="checkbox"]');
    const status = page.locator('[data-fc-progress]');
    const reset = page.locator('[data-fc-reset]');
    await expect(boxes).toHaveCount(4);
    await expect(status).toHaveText('0 of 4 ready');
    await expect(reset).toBeHidden();

    await page.getByLabel(/Slides\./).check();
    await page.getByLabel(/Budget\./).check();
    await expect(status).toHaveText('2 of 4 ready');
    await expect(page.locator('[data-fc-progress-live]')).toHaveText('2 of 4 ready');
    await expect(page.locator('[data-fc-meter]')).toHaveJSProperty('value', 2);

    await page.reload();
    await expect(page.getByLabel(/Slides\./)).toBeChecked();
    await expect(page.getByLabel(/Budget\./)).toBeChecked();
    await expect(page.getByLabel(/Attendance\./)).not.toBeChecked();
    await expect(status).toHaveText('2 of 4 ready');

    await page.getByLabel(/Attendance\./).check();
    await page.getByLabel(/Questions\./).check();
    await expect(status).toHaveText(/All 4 ready/);
    await expect(page.locator('[data-fc-prep]')).toHaveClass(/is-complete/);

    await reset.click();
    await expect(status).toHaveText('0 of 4 ready');
    await expect(boxes.first()).toBeFocused();
    await page.reload();
    await expect(page.getByLabel(/Slides\./)).not.toBeChecked();
  });

  test('a checklist row toggles from anywhere on its label', async ({ page }) => {
    await page.goto(PAGE);
    await page.getByText('A spreadsheet with a cost breakdown').click();
    await expect(page.getByLabel(/Budget\./)).toBeChecked();
  });

  test('the purchase checker flags banned, conditional, and clear purchases', async ({ page }) => {
    await page.goto(PAGE);
    const input = page.getByRole('searchbox', { name: 'What do you want to buy?' });
    const result = page.locator('[data-fc-result]');
    await expect(result).toBeHidden();

    await page.locator('[data-fc-try="Boba for general meeting"]').click();
    await expect(result).toHaveAttribute('data-status', 'restricted');
    await expect(result).toContainText('Food and drinks');
    await expect(result).toContainText('ESS funds');
    await expect(input).toHaveValue('Boba for general meeting');

    await input.fill('Posters for our hackathon');
    await expect(result).toHaveAttribute('data-status', 'conditional');
    await expect(result).toContainText('Sponsored by the ASUC');

    await input.fill('Aluminum stock for the chassis');
    await input.press('Enter');
    await expect(result).toHaveAttribute('data-status', 'clear');
    await expect(result).toContainText('not an approval');
    // Submitting must not navigate away.
    await expect(page).toHaveURL(/ficomm\.html/);

    await input.fill('');
    await input.press('Enter');
    await expect(result).toBeHidden();
  });

  test('the official ASUC list opens and has all 14 rules', async ({ page }) => {
    await page.goto(PAGE);
    const details = page.locator('#official-rules');
    await expect(details.locator('li[data-rule]').first()).toBeHidden();
    await details.locator('summary').click();
    await expect(details.locator('li[data-rule]')).toHaveCount(14);
    await expect(details.locator('li[data-rule="1"]')).toBeVisible();
  });

  test('the account name copies to the clipboard', async ({ page, context, browserName }) => {
    test.skip(browserName !== 'chromium', 'clipboard permissions are Chromium-only in Playwright');
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.goto(PAGE);
    const copy = page.locator(`[data-fc-copy="${ACCOUNT}"]`);
    await expect(copy).toBeVisible();
    await copy.click();
    await expect(copy).toHaveText('Copied');
    await expect(page.locator('[data-fc-copy-status]')).toHaveText(`Copied ${ACCOUNT}`);
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(ACCOUNT);
    await expect(copy).toHaveText('Copy', { timeout: 4000 });
  });

  test('the section rail follows the reader', async ({ page }) => {
    await page.goto(PAGE);
    await page.locator('#rules').scrollIntoViewIfNeeded();
    await page.evaluate(() => {
      const top = document.getElementById('rules').getBoundingClientRect().top;
      window.scrollBy(0, top - window.innerHeight * 0.25);
    });
    await expect(page.locator('[data-fc-rail] a[href="#rules"]')).toHaveAttribute(
      'aria-current',
      'location',
    );
    await expect(page.locator('[data-fc-rail] a[aria-current]')).toHaveCount(1);
  });

  test('the sign-up button always leads somewhere real', async ({ page }) => {
    await page.goto(PAGE);
    const href = await page.locator('#fc-signup-link').getAttribute('href');
    expect(href).toMatch(/^(https:\/\/|mailto:treasurer@esc\.studentorg\.berkeley\.edu)/);
  });
});

test.describe('FiComm page without JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  test('still shows every step, rule, and contact', async ({ page }) => {
    await page.goto(PAGE);
    await expect(page.locator('h1')).toContainText('FiComm');
    await expect(page.locator('.fc-steps > li')).toHaveCount(5);
    await expect(page.locator('.fc-walk > li')).toHaveCount(6);
    await expect(page.locator('#official-rules li[data-rule]')).toHaveCount(14);
    await expect(page.locator('.fc-contacts > li')).toHaveCount(4);
    await expect(page.getByText(ACCOUNT)).toBeVisible();
    // Copy buttons need JavaScript, so they stay hidden instead of doing nothing.
    await expect(page.locator('[data-fc-copy]')).toBeHidden();
  });
});

test('Apply for Funding sends people to the FiComm guide, not a closed form', async ({ page }) => {
  await page.goto('applyfunding.html');
  await expect(page.locator('iframe[src*="docs.google.com/forms"]')).toHaveCount(0);
  await page.getByRole('link', { name: 'How to sign up and present' }).click();
  await expect(page).toHaveURL(/ficomm\.html#sign-up$/);
});
