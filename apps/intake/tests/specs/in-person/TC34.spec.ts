import { expect, test } from '@playwright/test';
import { FillingInfo } from '../../utils/in-person/FillingInfo';
import { BookPrebookVisit } from '../../utils/in-person/BookPrebookVisit';

test.describe.serial('Cancel screens', () => {
  let bookingURL: string;
  test.skip('TC34 prereq', async ({ page }) => {
    const BookVisit = new BookPrebookVisit(page);
    const fillingInfo = new FillingInfo(page);
    await page.goto(`/location/${process.env.STATE_ONE}/${process.env.SLUG_ONE}/prebook`);
    await expect(page.getByRole('tab', { name: 'Today' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Logout' })).toBeVisible();
    await fillingInfo.selectSlot();
    const continueButton = page.getByRole('button', { name: 'Continue' });
    await continueButton.click();
    const bookingData = await BookVisit.bookNewPatientLess18();
    bookingURL = bookingData.bookingURL;
    await expect(page.getByRole('heading', { name: 'Thank you for choosing Ottehr In Person!' })).toBeVisible();
  });

  test.skip('TC34 Check options on Cancel screen', async ({ page }) => {
    await page.goto(`${bookingURL}`);
    await expect(page.getByRole('heading', { name: 'Thank you for choosing Ottehr In Person!' })).toBeVisible({
      timeout: 10000,
    });
    await page.getByRole('button', { name: 'Cancel' }).click();
    await expect(page.getByRole('heading', { name: 'Why are you canceling?' })).toBeVisible();
    await expect(page.getByText('Cancelation reason *')).toBeVisible();
    await page.getByRole('button', { name: 'Cancel visit' }).click();
    await expect(page.getByRole('heading', { name: 'Why are you canceling?' })).toBeVisible();
    await page.locator('#cancellationReason').click();
    await expect(page.getByRole('option').nth(0)).toHaveText('Patient improved');
    await expect(page.getByRole('option').nth(1)).toHaveText('Wait time too long');
    await expect(page.getByRole('option').nth(2)).toHaveText('Prefer another provider');
    await expect(page.getByRole('option').nth(3)).toHaveText('Changing location');
    await expect(page.getByRole('option').nth(4)).toHaveText('Changing to telemedicine');
    await expect(page.getByRole('option').nth(5)).toHaveText('Financial responsibility concern');
    await expect(page.getByRole('option').nth(6)).toHaveText('Insurance issue');
    await expect(page.getByRole('option')).toHaveCount(7);
  });
});
