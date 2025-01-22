import { expect, test } from '@playwright/test';
import { FillingInfo } from '../../utils/in-person/FillingInfo';
import { Paperwork } from '../../utils/in-person/Paperwork';

test.describe.skip('Prebook and cancel', () => {
  let bookingURL: string | undefined;

  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();

    const fillingInfo = new FillingInfo(page);
    const continueButton = page.getByRole('button', { name: 'Continue' });
    const reserveButton = page.getByRole('button', { name: 'Reserve this check-in time' });
    const newPatient = page.getByText('Different family member');
    await page.goto(`/location/${process.env.STATE_ONE}/${process.env.SLUG_ONE}/prebook`);
    await expect(page.getByRole('tab', { name: 'Today' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Logout' })).toBeVisible();
    const firstAvailableTime = await fillingInfo.selectSlot();
    await page.waitForTimeout(3000);
    await continueButton.click();
    await continueButton.click();
    await newPatient.click();
    await continueButton.click();
    await fillingInfo.fillNewPatientInfo();
    await fillingInfo.fillDOBgreater18();
    await continueButton.click();
    await reserveButton.click();
    await page.waitForURL(/\/visit/);
    await page.waitForTimeout(6000);
    await expect(page.getByText(firstAvailableTime)).toBeTruthy;
    bookingURL = page.url();
  });
  // test('TC2 Book a prebook visit', async ({ page }) => {
  //   const fillingInfo = new FillingInfo(page);
  //   const continueButton = page.getByRole('button', { name: 'Continue' });
  //   const reserveButton = page.getByRole('button', { name: 'Reserve this check-in time' });
  //   const newPatient = page.getByText('Different family member');
  //   await page.goto(`/location/${process.env.STATE_ONE}/${process.env.SLUG_ONE}/prebook`);
  //   await expect(page.getByRole('tab', { name: 'Today' })).toBeVisible();
  //   await expect(page.getByRole('button', { name: 'Logout' })).toBeVisible();
  //   const firstAvailableTime = await fillingInfo.selectSlot();
  //   await page.waitForTimeout(3000);
  //   await continueButton.click();
  //   await continueButton.click();
  //   await newPatient.click();
  //   await continueButton.click();
  //   await fillingInfo.fillNewPatientInfo();
  //   await fillingInfo.fillDOBgreater18();
  //   await continueButton.click();
  //   await reserveButton.click();
  //   await page.waitForURL(/\/visit/);
  //   await page.waitForTimeout(6000);
  //   await expect(page.getByText(firstAvailableTime)).toBeTruthy;
  //   bookingURL = page.url();
  // });
  test('TC4 Reschedule prebook visit', async ({ page }) => {
    await page.goto(bookingURL || '/');
    await page.getByRole('button', { name: 'Modify' }).click();
    await page.waitForURL(/\/reschedule/);
    await expect(page.getByRole('tab', { name: 'Today' })).toBeVisible();
    const buttons = page.locator('role=button[name=/\\d{1,2}:\\d{2} (AM|PM)/]');
    const buttonCount = await buttons.count();
    const randomIndex = Math.floor(Math.random() * (buttonCount - 1)) + 1;
    const selectedButton = buttons.nth(randomIndex);
    const buttonName = await selectedButton.textContent();
    await selectedButton.click();
    await page.getByRole('button', { name: 'Modify', exact: false }).click();
    await expect(page.getByRole('heading', { name: 'Thank you for choosing Ottehr' })).toBeVisible({ timeout: 15000 });
    await expect(page.getByText(buttonName || '')).toBeVisible();
  });
  test('TC10and11 Cancel prebook visit', async ({ page }) => {
    const fillingInfo = new FillingInfo(page);
    await page.goto(bookingURL || '/');
    await fillingInfo.cancelPrebookVisit();
    await page.waitForURL(/\/cancellation-confirmation/);
    await expect(page.getByText('Your visit has been canceled')).toBeVisible();
    await expect(
      page.getByText('If you have any questions or concerns, please call our team at: (631) 696-5437.')
    ).toBeVisible();
    await page.getByRole('button', { name: 'Book again' }).click();
    await page.waitForURL(/\/prebook/);
    await expect(page.getByText('Select check-in time')).toBeVisible();
  });
  test('TC35 Modify and Cancel buttons are not displayed for cancelled visit', async ({ page }) => {
    const FillPaperwork = new Paperwork(page);
    await page.goto(bookingURL || '/');
    await expect(page.getByRole('heading', { name: 'Thank you for choosing Ottehr In Person!' })).toBeVisible({
      timeout: 10000,
    });
    await expect(page.getByText('Your check-in time is booked for:')).toBeVisible();
    await page.waitForLoadState();
    await expect(page.getByRole('button', { name: 'Modify' })).toBeHidden();
    await expect(page.getByRole('button', { name: 'Cancel' })).toBeHidden();
    await expect(page.getByRole('button', { name: 'Proceed to paperwork' })).toBeVisible();
    await page.getByRole('button', { name: 'Proceed to paperwork' }).click();
    await expect(page.getByRole('heading', { name: 'Contact information' })).toBeVisible({ timeout: 25000 });
    await FillPaperwork.FillPaperworkNewPatientAsParentWOid();
    await expect(page.getByRole('heading', { name: 'Review and submit' })).toBeVisible();
    await page.getByRole('button', { name: 'Continue' }).click();
    await expect(page.getByRole('heading', { name: 'Thank you for choosing Ottehr In Person!' })).toBeVisible({
      timeout: 25000,
    });
    await expect(page.getByText('Your check-in time is booked for:')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Modify' })).toBeHidden();
    await expect(page.getByRole('button', { name: 'Cancel' })).toBeHidden();
  });
  test('TC36 User cannot modify cancelled visit', async ({ page }) => {
    await page.goto(`${bookingURL}/reschedule?slug=${process.env.SLUG_ONE}&state=${process.env.STATE_ONE}`);
    await page.waitForLoadState();
    await expect(page.getByRole('heading', { name: 'Modify check-in time' })).toBeVisible({ timeout: 20000 });
    await expect(page.getByRole('tab', { name: 'Today' })).toBeVisible();
    const buttons = page.locator('role=button[name=/\\d{1,2}:\\d{2} (AM|PM)/]');
    const buttonCount = await buttons.count();
    const randomIndex = Math.floor(Math.random() * (buttonCount - 1)) + 1;
    const selectedButton = buttons.nth(randomIndex);
    await selectedButton.click();
    await page.getByRole('button', { name: 'Modify', exact: false }).click();
    await expect(page.getByText('This appointment is already canceled')).toBeVisible();
  });
});
