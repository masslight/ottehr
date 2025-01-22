import { expect, test } from '@playwright/test';
import { BookPrebookVisit } from '../../utils/in-person/BookPrebookVisit';
import { FillingInfo } from '../../utils/in-person/FillingInfo';
import { Paperwork } from '../../utils/in-person/Paperwork';

test.describe.serial('Thank you screens', () => {
  let bookingURL: string;
  let buttonName: string;
  test.skip('TC31 1st Thank you screen for prebook', async ({ page, context }) => {
    const BookVisit = new BookPrebookVisit(page);
    const fillingInfo = new FillingInfo(page);
    await page.goto(`/location/${process.env.STATE_ONE}/${process.env.SLUG_ONE}/prebook`);
    await expect(page.getByRole('tab', { name: 'Today' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Logout' })).toBeVisible();
    buttonName = await fillingInfo.selectSlot();
    const continueButton = page.getByRole('button', { name: 'Continue' });
    await continueButton.click();
    const bookingData = await BookVisit.bookNewPatientLess18();
    bookingURL = bookingData.bookingURL;
    await expect(page.getByRole('heading', { name: 'Thank you for choosing Ottehr In Person!' })).toBeVisible();
    await expect(page.getByText('We look forward to helping you soon!')).toBeVisible();
    await expect(page.getByText('Your check-in time is booked for:')).toBeVisible();
    await expect(
      page.getByText(
        'Proceed below for paperwork. Completing prior to arrival will save time and ensure the best check-in experience.'
      )
    ).toBeVisible();
    await expect(
      page.getByText(
        'You will receive a confirmation email and SMS for your upcoming check-in time shortly. If you need to make any changes, please follow the instructions in that message.'
      )
    ).toBeVisible();
    await expect(
      page.getByText(
        'You will receive a confirmation email and SMS for your upcoming check-in time shortly. If you need to make any changes, please follow the instructions in that message.'
      )
    ).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Complete your paperwork now!' })).toBeVisible();
    await expect(
      page.getByText(
        'Please click the "Proceed to paperwork" button above to complete your paperwork prior to your visit. If this is not completed in advance, your care may be delayed.'
      )
    ).toBeVisible();
    await expect(
      page.getByText('If you have any questions or concerns, please call our team at: (631) 696-5437')
    ).toBeVisible();
    await expect(page.getByText(buttonName)).toBeVisible();
    await expect(page.getByText(`${process.env.SLUG_ONE}`)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Cancel' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Modify' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Register another patient' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Proceed to Paperwork' })).toBeVisible();
    const pagePromise = context.waitForEvent('page');
    await page.getByText('here').click();
    const newPage = await pagePromise;
    await newPage.waitForLoadState();
    await expect(newPage).toHaveURL(new RegExp('^https://ottehr.com/financial-policy/'));
    //await expect(newPage).toHaveURL('/^https://ottehr.com/financial-policy/\//');
  });

  test.skip('TC32 2nd Thank you screen for prebook', async ({ page }) => {
    const FillPaperwork = new Paperwork(page);
    await page.goto(`${bookingURL}`);
    await expect(page.getByRole('button', { name: 'Proceed to paperwork' })).toBeVisible();
    await page.getByRole('button', { name: 'Proceed to paperwork' }).click();
    await expect(page.getByRole('heading', { name: 'Contact information' })).toBeVisible({ timeout: 25000 });
    await FillPaperwork.FillPaperworkNewPatientAsParentWOid();
    await expect(page.getByRole('heading', { name: 'Review and submit' })).toBeVisible();
    await page.getByRole('button', { name: 'Continue' }).click();
    await expect(page.getByRole('heading', { name: 'Thank you for choosing Ottehr In Person!' })).toBeVisible({
      timeout: 25000,
    });
    await expect(page.getByText('We look forward to helping you soon!')).toBeVisible();
    await expect(page.getByText('Your check-in time is booked for:')).toBeVisible();
    await expect(page.getByText(`${process.env.SLUG_ONE}`)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Cancel' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Modify' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Edit paperwork' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Register another patient' })).toBeVisible();
    await expect(page.getByRole('button', { name: '1-minute survey' })).toBeVisible();
    await expect(
      page.getByText(
        'You will receive a confirmation email and SMS for your upcoming check-in time shortly. If you need to make any changes, please follow the instructions in that message.'
      )
    ).toBeVisible();
    await expect(
      page.getByText('If you have any questions or concerns, please call our team at: (631) 696-5437')
    ).toBeVisible();
    await expect(page.getByText(`${buttonName}`)).toBeVisible();
    await page.getByRole('button', { name: '1-minute survey' }).click();
    await page.waitForLoadState();
    await expect(page).toHaveURL('https://www.example.com/survey');
  });

  test.skip('TC33 Check buttons on 2nd Thank you screen for prebook', async ({ page }) => {
    await page.goto(`${bookingURL}`);
    await expect(page.getByRole('heading', { name: 'Thank you for choosing Ottehr In Person!' })).toBeVisible({
      timeout: 10000,
    });
    await page.getByRole('button', { name: 'Cancel' }).click();
    await expect(page.getByRole('heading', { name: 'Why are you canceling?' })).toBeVisible();
    await page.getByRole('button', { name: 'Back' }).click();
    await expect(page.getByRole('heading', { name: 'Thank you for choosing Ottehr In Person!' })).toBeVisible({
      timeout: 10000,
    });
    await page.getByRole('button', { name: 'Modify' }).click();
    await expect(page.getByRole('heading', { name: 'Modify check-in time' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Today' })).toBeVisible();
    await page.getByRole('button', { name: 'Back' }).click();
    await expect(page.getByRole('heading', { name: 'Thank you for choosing Ottehr In Person!' })).toBeVisible({
      timeout: 10000,
    });
    await expect(page.getByText(`${buttonName}`)).toBeVisible();
    await page.getByRole('button', { name: 'Modify' }).click();
    await expect(page.getByRole('heading', { name: 'Modify check-in time' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Today' })).toBeVisible();
    const buttons = page.locator('role=button[name=/\\d{1,2}:\\d{2} (AM|PM)/]');
    const buttonCount = await buttons.count();
    const randomIndex = Math.floor(Math.random() * (buttonCount - 1)) + 1;
    const selectedButton = buttons.nth(randomIndex);
    const updatedButtonName = await selectedButton.textContent();
    await selectedButton.click();
    await page.getByRole('button', { name: 'Modify', exact: false }).click();
    await expect(page.getByRole('heading', { name: 'Thank you for choosing Ottehr In Person!' })).toBeVisible({
      timeout: 10000,
    });
    await expect(page.getByText(`${updatedButtonName}`)).toBeVisible();
    await page.getByRole('button', { name: 'Edit paperwork' }).click();
    await expect(page.getByRole('heading', { name: 'Contact information' })).toBeVisible({ timeout: 25000 });
    await expect(page.getByRole('button', { name: 'Back' })).toBeHidden();
  });
});
