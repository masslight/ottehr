import { Locator, Page } from '@playwright/test';

/**
 * Locator for an admin sidebar nav item, addressed by its route path.
 *
 * Pass `selected` to target the *active* item — MUI adds the `.Mui-selected` class to the
 * currently-selected sidebar button, so this is how we assert which page is active.
 *
 * @example
 * // Click the Fee Schedules item
 * await adminSidebarItem(page, '/admin/billing/fee-schedules').click();
 *
 * @example
 * // Assert the Invoicing item is the active one
 * await expect(adminSidebarItem(page, '/admin/billing/invoicing', true)).toBeVisible();
 */
export const adminSidebarItem = (page: Page, path: string, selected = false): Locator =>
  page.locator(`a[href="${path}"]${selected ? ' .Mui-selected' : ''}`);
