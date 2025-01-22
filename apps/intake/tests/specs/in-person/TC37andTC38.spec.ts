import { expect, test } from '@playwright/test';
import { FillingInfo } from '../../utils/in-person/FillingInfo';
import { BookPrebookVisit } from '../../utils/in-person/BookPrebookVisit';
import { Paperwork } from '../../utils/in-person/Paperwork';

test.describe.serial('Review and submit', () => {
  let bookingURL: string;
  let firstName: string;
  let lastName: string;
  let middleName: string;
  let consentFormRelationship: string;
  let consentFormFirstName: string;
  let consentFormLastName: string;

  test.skip('TC37 prereq', async ({ page }) => {
    const BookVisit = new BookPrebookVisit(page);
    const fillingInfo = new FillingInfo(page);
    await page.goto(`/location/${process.env.STATE_ONE}/${process.env.SLUG_ONE}/prebook`);
    await expect(page.getByRole('tab', { name: 'Today' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Logout' })).toBeVisible();
    await fillingInfo.selectRandomSlot();
    const continueButton = page.getByRole('button', { name: 'Continue' });
    await continueButton.click();
    const bookingData = await BookVisit.bookNewPatientLess18();
    bookingURL = bookingData.bookingURL;
    firstName = bookingData.firstName;
    lastName = bookingData.lastName;
    middleName = bookingData.middleName;
    await expect(page.getByRole('heading', { name: 'Thank you for choosing Ottehr In Person!' })).toBeVisible();
  });

  test.skip('TC37 Edit buttons on the Review and Submit', async ({ page }) => {
    const FillPaperwork = new Paperwork(page);
    await page.goto(`${bookingURL}`);
    await expect(page.getByRole('button', { name: 'Proceed to paperwork' })).toBeVisible();
    await page.getByRole('button', { name: 'Proceed to paperwork' }).click();
    await expect(page.getByRole('heading', { name: 'Contact information' })).toBeVisible({ timeout: 25000 });
    const continueButton = page.getByRole('button', { name: 'Continue' });
    const paperwork = await FillPaperwork.FillPaperworkNewPatientAsParentWOid();
    consentFormRelationship = paperwork.consentFormsRelationship;
    consentFormFirstName = paperwork.consentFormsFirstName;
    consentFormLastName = paperwork.consentFormsLastName;
    await expect(page.getByRole('heading', { name: 'Review and submit' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Continue' })).toBeVisible();
    await page.locator('button[aria-label=edit]').nth(0).click();
    await expect(page.getByRole('heading', { name: 'Contact information' })).toBeVisible();
    await continueButton.click();
    await expect(page.getByRole('heading', { name: 'Patient details' })).toBeVisible();
    await continueButton.click();
    await expect(page.getByRole('heading', { name: 'How would you like to pay for your visit?' })).toBeVisible();
    await continueButton.click();
    await expect(page.getByRole('heading', { name: 'Responsible party information' })).toBeVisible();
    await continueButton.click();
    await expect(page.getByRole('heading', { name: 'Photo ID' })).toBeVisible();
    await continueButton.click();
    await expect(page.getByRole('heading', { name: 'Complete consent forms' })).toBeVisible();
    await continueButton.click();
    await expect(page.getByRole('heading', { name: 'Review and submit' })).toBeVisible();
    await page.locator('button[aria-label=edit]').nth(1).click();
    await expect(page.getByRole('heading', { name: 'Patient details' })).toBeVisible();
    await continueButton.click();
    await expect(page.getByRole('heading', { name: 'How would you like to pay for your visit?' })).toBeVisible();
    await continueButton.click();
    await expect(page.getByRole('heading', { name: 'Responsible party information' })).toBeVisible();
    await continueButton.click();
    await expect(page.getByRole('heading', { name: 'Photo ID' })).toBeVisible();
    await continueButton.click();
    await expect(page.getByRole('heading', { name: 'Complete consent forms' })).toBeVisible();
    await continueButton.click();
    await expect(page.getByRole('heading', { name: 'Review and submit' })).toBeVisible();
    await page.locator('button[aria-label=edit]').nth(2).click();
    await expect(page.getByRole('heading', { name: 'How would you like to pay for your visit?' })).toBeVisible();
    await continueButton.click();
    await expect(page.getByRole('heading', { name: 'Responsible party information' })).toBeVisible();
    await continueButton.click();
    await expect(page.getByRole('heading', { name: 'Photo ID' })).toBeVisible();
    await continueButton.click();
    await expect(page.getByRole('heading', { name: 'Complete consent forms' })).toBeVisible();
    await continueButton.click();
    await expect(page.getByRole('heading', { name: 'Review and submit' })).toBeVisible();
    await page.locator('button[aria-label=edit]').nth(3).click();
    await expect(page.getByRole('heading', { name: 'Responsible party information' })).toBeVisible();
    await continueButton.click();
    await expect(page.getByRole('heading', { name: 'Photo ID' })).toBeVisible();
    await continueButton.click();
    await expect(page.getByRole('heading', { name: 'Complete consent forms' })).toBeVisible();
    await continueButton.click();
    await expect(page.getByRole('heading', { name: 'Review and submit' })).toBeVisible();
    await page.locator('button[aria-label=edit]').nth(4).click();
    await expect(page.getByRole('heading', { name: 'Photo ID' })).toBeVisible();
    await continueButton.click();
    await expect(page.getByRole('heading', { name: 'Complete consent forms' })).toBeVisible();
    await continueButton.click();
    await expect(page.getByRole('heading', { name: 'Review and submit' })).toBeVisible();
    await page.locator('button[aria-label=edit]').nth(5).click();
    await expect(page.getByRole('heading', { name: 'Complete consent forms' })).toBeVisible();
    await continueButton.click();
    await expect(page.getByRole('heading', { name: 'Review and submit' })).toBeVisible();
    await page.getByRole('button', { name: 'Back' }).click();
    await expect(page.getByRole('heading', { name: 'Complete consent forms' })).toBeVisible();
    await continueButton.click();
    await expect(page.getByRole('heading', { name: 'Review and submit' })).toBeVisible({
      timeout: 25000,
    });
    await page.getByRole('button', { name: 'Continue' }).click();
    await expect(page.getByRole('heading', { name: 'Thank you for choosing Ottehr In Person!' })).toBeVisible({
      timeout: 50000,
    });
  });

  test.skip('TC38 Consent Forms screen', async ({ page }) => {
    await page.goto(`${bookingURL}`);
    await expect(page.getByRole('button', { name: 'Edit paperwork' })).toBeVisible();
    await page.getByRole('button', { name: 'Edit paperwork' }).click();
    await expect(page.getByRole('heading', { name: 'Contact information' })).toBeVisible({ timeout: 25000 });
    const continueButton = page.getByRole('button', { name: 'Continue' });
    await continueButton.click();
    await continueButton.click();
    await continueButton.click();
    await continueButton.click();
    await continueButton.click();
    await expect(page.getByRole('heading', { name: 'Complete consent forms' })).toBeVisible();
    await page.getByRole('button', { name: 'Back' }).click();
    await expect(page.getByRole('heading', { name: 'Photo ID' })).toBeVisible();
    await continueButton.click();
    await expect(page.getByRole('heading', { name: 'Complete consent forms' })).toBeVisible();
    await expect(page.getByText(`${firstName} ${middleName} ${lastName}`)).toBeVisible();
    await expect(page.getByText('I have reviewed and accept HIPAA Acknowledgement *')).toBeVisible();
    await expect(
      page.getByText('I have reviewed and accept Consent to Treat and Guarantee of Payment *')
    ).toBeVisible();
    expect(await page.getAttribute('a:has-text("HIPAA Acknowledgement")', 'href')).toBe('/HIPAA.Acknowledgement-S.pdf');
    expect(await page.getAttribute('a:has-text("Consent to Treat and Guarantee of Payment")', 'href')).toBe(
      '/CTT.and.Guarantee.of.Payment-S.pdf'
    );
    expect(await page.getAttribute('a:has-text("HIPAA Acknowledgement")', 'target')).toBe('_blank');
    expect(await page.getAttribute('a:has-text("Consent to Treat and Guarantee of Payment")', 'target')).toBe('_blank');
    await expect(page.getByLabel('I have reviewed and accept HIPAA Acknowledgement *')).toBeChecked();
    await expect(
      page.getByLabel('I have reviewed and accept Consent to Treat and Guarantee of Payment *')
    ).toBeChecked();
    await expect(page.locator('input[id*="signature"]')).toHaveValue(`${consentFormFirstName} ${consentFormLastName}`);
    await expect(page.locator('input[id*="full-name"]')).toHaveValue(`${consentFormFirstName} ${consentFormLastName}`);
    await expect(page.getByText(consentFormRelationship)).toBeVisible();
    await expect(page.getByText('Signature *', { exact: true })).toBeVisible();
    await expect(page.getByText('Full name *', { exact: true })).toBeVisible();
    await expect(page.getByText('Relationship to the patient *', { exact: true })).toBeVisible();
    await page.locator("[id='consent-form-signer-relationship']").click();
    await expect(page.getByRole('option').nth(0)).toHaveText('Parent');
    await expect(page.getByRole('option').nth(1)).toHaveText('Self');
    await expect(page.getByRole('option').nth(2)).toHaveText('Legal Guardian');
    await expect(page.getByRole('option').nth(3)).toHaveText('Other');
  });
});
