// Keyboard and screen-reader access to the desktop nav (assets/js/site/nav-a11y.js):
// skip link, APG disclosure dropdowns driven through dropotron, and
// aria-current. Mouse behaviour must stay exactly as it was.
import { test, expect, pressTab } from './fixtures.mjs';
import AxeBuilder from '@axe-core/playwright';
import { readFileSync } from 'node:fs';

const BASELINE = JSON.parse(readFileSync('tests/e2e/baselines/a11y.json', 'utf8'));

async function open(page, path) {
  await page.goto(path, { waitUntil: 'load' });
  await expect(page.locator('html')).toHaveAttribute('data-esc-nav-a11y', 'ready');
}

const focused = (page) => page.locator(':focus');
const menuFor = async (page, control) =>
  page.locator(`[id="${await control.getAttribute('aria-controls')}"]`);
const aboutToggle = (page) => page.getByRole('button', { name: 'About Us submenu' });

test.describe('skip link', () => {
  for (const [path, target] of [
    ['about.html', '#main'],
    ['index.html', '#main'],
    // students.html has no #main: falls back to the first section after the header.
    ['students.html', '#banner'],
  ]) {
    test(`is the first Tab stop on ${path} and moves focus to the main content`, async ({
      page,
    }) => {
      await open(page, path);
      const skip = page.locator('.esc-skip-link');
      await pressTab(page);
      await expect(skip).toBeFocused();
      await expect(skip).toHaveText('Skip to main content');
      await expect(skip).toBeInViewport();
      await page.keyboard.press('Enter');
      await expect(page.locator(target)).toBeFocused();
      await expect(page.locator(target)).toHaveAttribute('tabindex', '-1');
    });
  }

  test('stays out of sight until focused', async ({ page }) => {
    await open(page, 'about.html');
    await expect(page.locator('.esc-skip-link')).not.toBeInViewport();
  });
});

test.describe('desktop dropdowns from the keyboard', () => {
  test('Tab reaches a disclosure button after each top-level link', async ({ page }) => {
    await open(page, 'students.html');
    await pressTab(page); // skip link
    await pressTab(page); // logo
    await pressTab(page);
    await expect(focused(page)).toHaveText('About Us');
    await pressTab(page);
    const toggle = aboutToggle(page);
    await expect(toggle).toBeFocused();
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    // Visible once focused, even though mouse users never see it.
    const box = await toggle.boundingBox();
    expect(box.width).toBeGreaterThan(10);
  });

  test('Enter opens, arrows move, nested menus open with ArrowRight, Escape backs out', async ({
    page,
  }) => {
    await open(page, 'students.html');
    const toggle = aboutToggle(page);
    await toggle.focus();
    const menu = await menuFor(page, toggle);
    await expect(menu).toBeHidden();

    await page.keyboard.press('Enter');
    await expect(menu).toBeVisible();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    const ourTeam = menu.getByRole('button', { name: 'Our Team' });
    await expect(ourTeam).toBeFocused();
    await expect(ourTeam).toHaveAttribute('aria-expanded', 'false');

    await page.keyboard.press('ArrowDown');
    await expect(focused(page)).toHaveText('Our Finances');
    await page.keyboard.press('ArrowDown');
    await expect(focused(page)).toHaveText('ESC Internal');
    await page.keyboard.press('ArrowDown'); // wraps
    await expect(ourTeam).toBeFocused();
    await page.keyboard.press('ArrowUp'); // wraps back
    await expect(focused(page)).toHaveText('ESC Internal');
    await page.keyboard.press('Home');
    await expect(ourTeam).toBeFocused();

    await page.keyboard.press('ArrowRight');
    const nested = await menuFor(page, ourTeam);
    await expect(nested).toBeVisible();
    await expect(ourTeam).toHaveAttribute('aria-expanded', 'true');
    await expect(focused(page)).toHaveText('Executive Board');
    await page.keyboard.press('ArrowDown');
    await expect(focused(page)).toHaveText('Our Committees');

    await page.keyboard.press('Escape');
    await expect(nested).toBeHidden();
    await expect(ourTeam).toBeFocused();
    await expect(ourTeam).toHaveAttribute('aria-expanded', 'false');

    // Enter on a nested parent opens it too; ArrowLeft closes it.
    await page.keyboard.press('Enter');
    await expect(focused(page)).toHaveText('Executive Board');
    await page.keyboard.press('ArrowLeft');
    await expect(ourTeam).toBeFocused();
    await expect(nested).toBeHidden();

    await page.keyboard.press('Escape');
    await expect(menu).toBeHidden();
    await expect(toggle).toBeFocused();
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  });

  test('Space toggles, and ArrowDown on a top-level link opens its menu', async ({ page }) => {
    await open(page, 'students.html');
    const toggle = aboutToggle(page);
    const menu = await menuFor(page, toggle);
    await toggle.focus();
    await page.keyboard.press(' ');
    await expect(menu).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(menu).toBeHidden();

    const students = page.locator('#nav > ul > li > a', { hasText: 'Students' });
    await students.focus();
    await page.keyboard.press('ArrowDown');
    const studentsMenu = await menuFor(
      page,
      page.getByRole('button', { name: 'Students submenu' }),
    );
    await expect(studentsMenu).toBeVisible();
    await expect(focused(page)).toHaveText('Health');
    await page.keyboard.press('Escape');
    await expect(students).toBeFocused();
    await expect(studentsMenu).toBeHidden();
  });

  test('ArrowLeft/ArrowRight move along the top-level bar', async ({ page }) => {
    await open(page, 'students.html');
    await page.locator('#nav > ul > li > a', { hasText: 'About Us' }).focus();
    await page.keyboard.press('ArrowRight');
    await expect(aboutToggle(page)).toBeFocused();
    await page.keyboard.press('ArrowRight');
    await expect(focused(page)).toHaveText('Students');
    await page.keyboard.press('ArrowLeft');
    await expect(aboutToggle(page)).toBeFocused();
  });

  test('Tab flows through an open menu and closes it when focus moves on', async ({ page }) => {
    await open(page, 'students.html');
    const toggle = aboutToggle(page);
    const menu = await menuFor(page, toggle);
    await toggle.focus();
    await page.keyboard.press('Enter');
    await expect(focused(page)).toHaveText('Our Team');

    // Shift+Tab from the first item goes back to the button, menu still open.
    await pressTab(page, { shift: true });
    await expect(toggle).toBeFocused();
    await expect(menu).toBeVisible();
    // Tab from the expanded button goes into the menu, as if it were in place.
    await pressTab(page);
    await expect(focused(page)).toHaveText('Our Team');
    await pressTab(page);
    await expect(focused(page)).toHaveText('Our Finances');
    await pressTab(page);
    await expect(focused(page)).toHaveText('ESC Internal');
    // Past the last item: on to the next top-level link, menu closed.
    await pressTab(page);
    await expect(focused(page)).toHaveText('Students');
    await expect(menu).toBeHidden();
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  });

  test('Enter on a submenu link navigates', async ({ page }) => {
    await open(page, 'students.html');
    await aboutToggle(page).focus();
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowRight');
    await expect(focused(page)).toHaveText('Executive Board');
    await page.keyboard.press('Enter');
    await page.waitForURL(/execs\.html$/);
  });

  test('pages with their own inline nav get the same behaviour', async ({ page }) => {
    await open(page, 'applyfunding.html');
    // There, "About Us" is a dead "#" link: it becomes the disclosure button.
    const about = page.locator('#nav > ul > li > a', { hasText: 'About Us' });
    await expect(about).toHaveAttribute('role', 'button');
    await expect(about).toHaveAttribute('aria-expanded', 'false');
    const menu = await menuFor(page, about);
    await about.focus();
    await page.keyboard.press(' ');
    await expect(menu).toBeVisible();
    await expect(about).toHaveAttribute('aria-expanded', 'true');
    await expect(focused(page)).toHaveText('Our Mission');
    await page.keyboard.press('Escape');
    await expect(menu).toBeHidden();
    await expect(about).toBeFocused();
    expect(page.url()).not.toContain('#');
  });

  test('every dropdown control points at a real menu', async ({ page }) => {
    for (const path of ['students.html', 'mission.html', 'policies.html']) {
      await open(page, path);
      const controls = page.locator('[data-esc-menu][aria-controls][aria-expanded]');
      const count = await controls.count();
      expect(count, path).toBeGreaterThanOrEqual(5);
      for (let i = 0; i < count; i++) {
        const id = await controls.nth(i).getAttribute('aria-controls');
        await expect(page.locator(`ul[id="${id}"]`), `${path} ${id}`).toHaveCount(1);
      }
      // Moved menus are re-attached to their item for assistive tech.
      const owners = page.locator('#nav > ul > li[aria-owns]');
      expect(await owners.count(), path).toBeGreaterThanOrEqual(4);
    }
  });
});

test.describe('mouse behaviour is unchanged', () => {
  test('hover still opens dropotron menus, and state stays in sync', async ({ page }) => {
    await open(page, 'students.html');
    const toggle = aboutToggle(page);
    const menu = await menuFor(page, toggle);
    await page.hover('#nav > ul > li:nth-child(1) > a');
    await expect(menu).toBeVisible();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    // The disclosure button stays invisible to mouse users.
    const box = await toggle.boundingBox();
    expect(box.width).toBeLessThanOrEqual(1);
    // dropotron ignores hovers while a menu is still fading in (its own
    // long-standing behaviour), so let the fade finish like a person would.
    await expect(menu).toHaveCSS('opacity', '1');
    await page.hover('body > ul.dropotron >> text=Our Team');
    await expect(menu.locator('ul').first()).toBeVisible();
    await page.mouse.move(10, 600);
    await expect(menu).toBeHidden();
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  });

  test('clicking a top-level link still navigates', async ({ page }) => {
    await open(page, 'students.html');
    await page.click('#nav > ul > li > a:text-is("About Us")');
    await page.waitForURL(/about\.html$/);
  });
});

test.describe('current page', () => {
  test('students.html marks the Students section', async ({ page }) => {
    await open(page, 'students.html');
    const top = page.locator('#nav > ul > li > a', { hasText: 'Students' });
    await expect(top).toHaveAttribute('aria-current', 'page');
    await expect(top.locator('..')).toHaveClass(/esc-nav-current/);
    await expect(page.locator('#nav > ul > li.esc-nav-current')).toHaveCount(1);
    const underline = await top.evaluate((a) => getComputedStyle(a).textDecorationLine);
    expect(underline).toContain('underline');
    await expect(page.locator('#navPanel a[aria-current="page"]')).toHaveText('Students');
  });

  test('execs.html marks the Executive Board link inside About Us', async ({ page }) => {
    await open(page, 'execs.html');
    await expect(
      page.locator('body > ul.dropotron a[aria-current="page"]', { hasText: 'Executive Board' }),
    ).toHaveCount(1);
    await expect(page.locator('#nav > ul > li.esc-nav-current > a')).toHaveText('About Us');
    // Parents are highlighted visually, but only the page link is aria-current.
    await expect(
      page.locator('#nav > ul > li > a[aria-current]', { hasText: 'About Us' }),
    ).toHaveCount(0);
    await expect(page.locator('#navPanel a[aria-current="page"]')).toHaveText('Executive Board');
  });

  test('events.html marks both links to it and nothing else', async ({ page }) => {
    await open(page, 'events.html');
    const marked = page.locator(
      '#nav > ul > li > a[aria-current="page"], body > ul.dropotron a[aria-current="page"]',
    );
    await expect(marked).toHaveText(['Events', 'Upcoming Events']);
    await expect(page.locator('#nav > ul > li.esc-nav-current > a')).toHaveText('Events');
  });

  test('a page outside the nav marks nothing', async ({ page }) => {
    await open(page, 'index.html');
    await expect(page.locator('[aria-current]')).toHaveCount(0);
  });
});

test.describe('axe with menus open', () => {
  const tags = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];
  const counts = (entries = []) =>
    Object.fromEntries(entries.map((e) => [e.split(':')[0], Number(e.split(':')[1])]));

  for (const path of ['students.html', 'applyfunding.html']) {
    test(`${path}: an open nested dropdown adds no violations`, async ({ page }) => {
      await open(page, path);
      const navIssues = async () => {
        const { violations: found } = await new AxeBuilder({ page })
          .withTags(tags)
          .include('#nav')
          .include('body > ul.dropotron')
          .analyze();
        const out = [];
        for (const v of found) {
          for (const node of v.nodes) out.push(`${v.id} ${node.target.join(' ')}`);
        }
        return out;
      };
      const closedIssues = await navIssues();
      const top = page.locator('#nav [aria-controls]').first();
      await top.focus();
      await page.keyboard.press('ArrowDown');
      const menu = await menuFor(page, top);
      await expect(menu).toBeVisible();
      // Open the first nested submenu inside it as well.
      const nestedParent = menu.locator('[aria-expanded]').first();
      await nestedParent.focus();
      await page.keyboard.press('ArrowRight');
      await expect(await menuFor(page, nestedParent)).toBeVisible();

      const { violations } = await new AxeBuilder({ page })
        .withTags(tags)
        .exclude('iframe')
        .analyze();
      const known = counts(BASELINE[path]);
      const worse = violations
        .filter((v) => v.nodes.length > (known[v.id] ?? 0))
        .map((v) => `${v.id}:${v.nodes.length} ${v.nodes[0]?.target}`);
      expect(worse).toEqual([]);

      // The nav itself, menus included, gains nothing, colour contrast included.
      const openIssues = await navIssues();
      expect(openIssues.filter((issue) => !closedIssues.includes(issue))).toEqual([]);
    });
  }
});
