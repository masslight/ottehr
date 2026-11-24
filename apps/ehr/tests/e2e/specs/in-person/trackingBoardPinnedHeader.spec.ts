import { expect, Page, test } from '@playwright/test';
import { dataTestIds } from '../../../../src/constants/data-test-ids';
import { openVisitsPage } from '../../page/VisitsPage';

const emulateLongVisitLists = (page: Page): Promise<unknown> =>
  page.addStyleTag({ content: '[role="tabpanel"] { min-height: 4000px; }' });

test.describe('Tracking board pinned filters and tabs', () => {
  test.use({ viewport: { width: 1280, height: 720 } });

  test('keep the filters and tabs below the navbar while scrolling, and open the next tab at the start of its list', async ({
    page,
  }) => {
    await openVisitsPage(page);
    await emulateLongVisitLists(page);

    const stickyHeader = page.getByTestId(dataTestIds.dashboard.stickyHeader);
    const tabList = page.getByRole('tablist', { name: 'appointment tabs' });
    await expect(tabList).toBeVisible();

    const navbarBottom = await page
      .locator('header')
      .first()
      .evaluate((navbar) => navbar.getBoundingClientRect().bottom);
    const stickyHeaderTopAfterScrollingTo = async (scrollY: number): Promise<number> => {
      await page.evaluate((y) => window.scrollTo(0, y), scrollY);
      return stickyHeader.evaluate((header) => header.getBoundingClientRect().top);
    };

    const pinnedTop = await stickyHeaderTopAfterScrollingTo(1500);
    expect(await stickyHeaderTopAfterScrollingTo(2000)).toBe(pinnedTop);
    expect(pinnedTop).toBeGreaterThanOrEqual(navbarBottom - 2);
    await expect(page.getByTestId(dataTestIds.dashboard.locationSelect)).toBeInViewport();
    await expect(tabList).toBeInViewport();

    await page.getByTestId(dataTestIds.dashboard.dischargedTab).click();
    await expect(page.getByTestId(dataTestIds.dashboard.dischargedTab)).toHaveAttribute('aria-selected', 'true');
    await expect
      .poll(async () => {
        const headerBottom = await stickyHeader.evaluate((header) => header.getBoundingClientRect().bottom);
        const listTop = await page.getByRole('tabpanel').evaluate((panel) => panel.getBoundingClientRect().top);
        return Math.abs(listTop - headerBottom);
      })
      .toBeLessThanOrEqual(1);
  });
});
