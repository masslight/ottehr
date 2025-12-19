// cSpell:ignore IPPPS
import { BrowserContext, expect, Page, test } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { CommonLocatorsHelper } from '../../utils/CommonLocatorsHelper';
import { Locators } from '../../utils/locators';
import {
  CARD_NUMBER,
  Paperwork,
  PATIENT_ADDRESS,
  PATIENT_CITY,
  PATIENT_ZIP,
  RELATIONSHIP_RESPONSIBLE_PARTY_SELF,
} from '../../utils/Paperwork';
import { InPersonPatientSelfTestData } from '../0_paperworkSetup/types';

let page: Page;
let context: BrowserContext;
let paperwork: Paperwork;
let locator: Locators;
let commonLocatorsHelper: CommonLocatorsHelper;
let patient: InPersonPatientSelfTestData;

test.beforeAll(async ({ browser }) => {
  context = await browser.newContext();
  page = await context.newPage();
  paperwork = new Paperwork(page);
  locator = new Locators(page);
  commonLocatorsHelper = new CommonLocatorsHelper(page);

  const testDataPath = path.join('test-data', 'cardPaymentSelfPatient.json');
  patient = JSON.parse(fs.readFileSync(testDataPath, 'utf-8'));
});
test.afterAll(async () => {
  await page.close();
  await context.close();
});

test.describe.parallel('In-Person - Prefilled Paperwork, Responsible Party: Self, Payment: Card', () => {
  test('IPPPS-1. Responsible party', async () => {
    await test.step('IPPPS-1.1. Open Responsible party page directly', async () => {
      await page.goto(`paperwork/${patient.appointmentId}/responsible-party`);
      await paperwork.checkCorrectPageOpens('Responsible party information');
    });

    await test.step('IPPPS-1.2. Check all fields have prefilled values', async () => {
      const { y, m, d } = patient.dob;
      const dob = commonLocatorsHelper.getMonthDay(m, d);
      if (!dob) {
        throw new Error('DOB data is null');
      }
      await expect(locator.responsiblePartyFirstName).toHaveValue(patient.firstName);
      await expect(locator.responsiblePartyLastName).toHaveValue(patient.lastName);
      await expect(locator.responsiblePartyBirthSex).toHaveValue(patient.birthSex);
      await expect(locator.responsiblePartyDOBAnswer).toHaveValue(`${dob?.monthNumber}/${dob?.dayNumber}/${y}`);
      await expect(locator.responsiblePartyRelationship).toHaveValue(RELATIONSHIP_RESPONSIBLE_PARTY_SELF);
      await expect(locator.responsiblePartyCity).toHaveValue(PATIENT_CITY);
      await expect(locator.responsiblePartyState).toHaveValue(patient.state!);
      await expect(locator.responsiblePartyZip).toHaveValue(PATIENT_ZIP);
      await expect(locator.responsiblePartyAddress1).toHaveValue(PATIENT_ADDRESS);
      // fill only required fields and this isn't required
      // await expect(locator.responsiblePartyAddress2).toHaveValue(PATIENT_ADDRESS_LINE_2);
      await expect(locator.responsiblePartyNumber).toHaveValue(
        paperwork.formatPhoneNumber(process.env.PHONE_NUMBER || '')
      );
      await expect(locator.responsiblePartyEmail).toHaveValue(patient.email);
    });
  });

  test('IPPPS-2. Payment option', async () => {
    await test.step('IPPPS-2.1. Open Payment option page directly', async () => {
      await page.goto(`paperwork/${patient.appointmentId}/payment-option`);
      await paperwork.checkCorrectPageOpens('How would you like to pay for your visit?');
    });

    await test.step('IPPPS-2.2. Check screen does not have preselected card option', async () => {
      await expect(locator.selfPayOption).not.toBeChecked();
    });
  });

  test('IPPPS-3. Card payment', async () => {
    await test.step('IPPPS-3.1. Open Card payment page directly', async () => {
      await page.goto(`paperwork/${patient.appointmentId}/card-payment`);
      await paperwork.checkCorrectPageOpens('Credit card details');
    });

    await test.step('IPPPS-3.2. Check screen has prefilled and preselected card', async () => {
      const lastFour = CARD_NUMBER.slice(-4);
      const masked = `XXXX - XXXX - XXXX - ${lastFour}`;
      await expect(locator.selectedCard).toBeChecked();
      await expect(locator.cardNumberFilled).toHaveText(masked);
    });
  });
});
