import { expect, test } from '@playwright/test';

/**
 * Walkthrough happy-path smoke regression.
 *
 * Targets the categories of bug we've actually shipped + caught:
 *   - Spotlight CSS broke pill positioning (banner intercepted clicks → click
 *     to edit became click to create-new-event)
 *   - Default-view race: returning visitors landed on Schedule view, where
 *     the seeded mission has no row to render in
 *   - data-wc-event-id was the load-bearing handle for the spotlight pulse;
 *     a future refactor that drops it would silently break the tour
 *
 * Deliberately scoped to mount + first-step assertions rather than driving a
 * full step-by-step automation. Step matchers + reducer behaviour are
 * already covered by the unit suite (demo/walkthrough/reducer.test.ts);
 * what's only catchable in a real browser is "the banner mounted, the
 * spotlight rendered against the right pill, and a click on that pill
 * actually reaches the pill".
 */

test.describe('demo walkthrough', () => {
  test.beforeEach(async ({ page }) => {
    // Returning visitors who previously dismissed the tour have
    // wc-walkthrough-mode-<calendarId>=free-play in localStorage. Clearing
    // before page load gives us a deterministic guided-mode mount.
    await page.addInitScript(() => {
      try {
        window.localStorage.clear();
      } catch {
        // private mode / quota — ignore
      }
    });
    await page.setViewportSize({ width: 1440, height: 900 });
    // Note: NOT using ?embed=1 — embed mode suppresses the walkthrough chrome.
    await page.goto('/');
    await expect(page.getByTestId('works-calendar')).toBeVisible();
  });

  test('banner mounts in guided mode with Step 1 copy', async ({ page }) => {
    const banner = page.getByRole('dialog', { name: /guided walkthrough/i });
    await expect(banner).toBeVisible();
    // Step 1 banner title.
    await expect(banner.getByText(/move the mission request/i)).toBeVisible();
    // Both control buttons present and labelled distinctly (W6 regression
    // guard — these used to read "Skip tour" / "Skip step").
    await expect(banner.getByRole('button', { name: /^exit tour$/i })).toBeVisible();
    await expect(banner.getByRole('button', { name: /^skip this step$/i })).toBeVisible();
  });

  test('opens in Week view (auto-nav defeats stored Schedule default)', async ({ page }) => {
    // Returning visitors with display.defaultView=schedule used to land on
    // the wrong view because WorksCalendar's defaultViewApplied effect ran
    // after our snap. The current parent-useEffect approach should win the
    // last-write race regardless of stored preference.
    const weekButton = page.getByRole('button', { name: /^week$/i }).first();
    await expect(weekButton).toHaveAttribute('aria-pressed', 'true');
  });

  test('Mission Alpha pill is rendered with the spotlight data attribute', async ({ page }) => {
    // Single load-bearing DOM hook for the spotlight CSS injection. If a
    // future refactor drops this attribute the tour's pulse silently fails
    // even though everything else still works.
    const missionPill = page.locator('[data-wc-event-id="wt-mission"]').first();
    await expect(missionPill).toBeVisible();
    // Title contains the seed copy so we know the right event got the hook.
    await expect(missionPill).toContainText(/mission alpha/i);
  });

  test('banner panel does not intercept hit-testing for clicks behind it', async ({ page }) => {
    // Regression guard for the pointer-events bug. The walkthrough
    // banner is fixed-position over the center of the demo; with
    // `pointer-events: none` on the panel, a click on the banner's
    // body text should pass through to whatever's behind. Without that
    // (the original screenshot bug), the banner intercepts clicks on
    // calendar pills underneath and confused-user.spec.ts crashes on
    // the first safeClick.
    const banner = page.getByRole('dialog', { name: /guided walkthrough/i });
    const titleHeading = banner.getByRole('heading', { name: /move the mission request/i });
    await expect(titleHeading).toBeVisible();
    const box = await titleHeading.boundingBox();
    if (!box) throw new Error('Banner heading not measurable');

    // document.elementFromPoint at the heading's center should resolve
    // to an element OUTSIDE the banner. With pointer-events: none on
    // the .banner panel, hit-testing skips it. Without the fix, this
    // would land on a banner descendant (the heading itself or a
    // banner-internal div).
    const piercedThrough = await page.evaluate(([x, y]: [number, number]) => {
      const el = document.elementFromPoint(x, y);
      if (!el) return false;
      // Walk up; if we never hit a [role="dialog"][aria-label="Guided
      // walkthrough"] ancestor, the click pierced through.
      let cursor: Element | null = el;
      while (cursor) {
        if (cursor.getAttribute?.('aria-label') === 'Guided walkthrough') return false;
        cursor = cursor.parentElement;
      }
      return true;
    }, [box.x + box.width / 2, box.y + box.height / 2]);

    expect(piercedThrough).toBe(true);
  });
});
