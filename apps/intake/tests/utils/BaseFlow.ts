import { expect, Page } from '@playwright/test';
import { Patient } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { TEST_PATIENT_EMAIL, TEST_PATIENT_FIRST_NAME, TEST_PATIENT_LAST_NAME } from 'test-utils';
import { genderMap, VALUE_SETS } from 'utils';
import { BaseFillingInfo } from './BaseFillingInfo';
import { Locators } from './locators';
import { ResourceHandler } from './resource-handler';

export interface PatientBasicInfo {
  firstName: string;
  lastName: string;
  birthSex: string;
  email: string;
  reasonForVisit: string;
  dob: { m: string; d: string; y: string };
  thisEmailBelongsTo?: string;
  isNewPatient: boolean;
}

export abstract class BaseFlow {
  protected page: Page;
  protected locator: Locators;
  protected fillingInfo: BaseFillingInfo;

  constructor(page: Page, fillingInfo: BaseFillingInfo) {
    this.page = page;
    this.locator = new Locators(page);
    this.fillingInfo = fillingInfo;
  }

  async findTestPatient(): Promise<PatientBasicInfo> {
    try {
      await expect(this.page.getByRole('radio').first()).toBeVisible();
      const testPatient = this.page
        .getByRole('heading', {
          name: new RegExp(`.*${TEST_PATIENT_FIRST_NAME} ${TEST_PATIENT_LAST_NAME}.*`, 'i'),
        })
        .first();
      const patientID = await testPatient
        .locator('xpath=ancestor::label')
        .getByRole('radio')
        .inputValue({ timeout: 100 });
      console.log(patientID);
      const oystehr = await new ResourceHandler().initApi();
      const patientSearch = await oystehr.fhir.search<Patient>({
        resourceType: 'Patient',
        params: [{ name: '_id', value: patientID }],
      });
      const patient = patientSearch.unbundle()[0];
      console.log(
        `Found test patient: ${patient.id} - ${patient.name?.[0]?.given?.[0]} ${patient.name?.[0]?.family} ${patient.birthDate}`
      );
      const dobDateTime = patient.birthDate
        ? DateTime.fromFormat(patient.birthDate, 'yyyy-MM-dd')
        : DateTime.fromFormat('1990-01-15', 'yyyy-MM-dd');
      console.log(dobDateTime);
      return {
        firstName: patient.name?.[0]?.given?.[0] || TEST_PATIENT_FIRST_NAME,
        lastName: patient.name?.[0]?.family || TEST_PATIENT_LAST_NAME,
        birthSex: patient.gender || genderMap.female,
        email: patient?.telecom?.find((t) => t.system === 'email')?.value || TEST_PATIENT_EMAIL,
        thisEmailBelongsTo: 'Patient',
        reasonForVisit: VALUE_SETS.reasonForVisitOptions[0].value,
        dob: {
          m: dobDateTime.toFormat('MMM'),
          d: dobDateTime.toFormat('d'),
          y: dobDateTime.toFormat('yyyy'),
        },
        isNewPatient: false,
      };
    } catch (error) {
      throw new Error(`Test patient not found: ${error}`);
    }
  }

  async findAndSelectExistingPatient(patient: PatientBasicInfo): Promise<void> {
    await expect(this.page.getByRole('radio').first()).toBeVisible();
    // find and select existing patient
    const dobString = DateTime.fromFormat(
      patient.dob.y + '-' + patient.dob.m + '-' + patient.dob.d || '',
      'yyyy-MMM-d'
    ).toFormat('MMMM dd, yyyy');

    // Find all patient headings with matching name
    const patientHeadings = this.page.getByRole('heading', {
      name: new RegExp(`.*${patient.firstName} ${patient.lastName}.*`, 'i'),
    });

    // Find the one with matching DOB
    const count = await patientHeadings.count();
    let patientName = null;
    for (let i = 0; i < count; i++) {
      const heading = patientHeadings.nth(i);
      const dobLabel = heading.locator('xpath=ancestor::label').getByText(dobString);
      if (await dobLabel.isVisible().catch(() => false)) {
        patientName = heading;
        break;
      }
    }

    if (!patientName) {
      throw new Error(`Patient with name ${patient.firstName} ${patient.lastName} and DOB ${dobString} not found`);
    }
    await patientName.scrollIntoViewIfNeeded();
    await patientName.click({ timeout: 40_000, noWaitAfter: true, force: true });
    await this.locator.clickContinueButton();

    // confirm dob
    await this.fillingInfo.fillCorrectDOB(patient.dob.m, patient.dob.d, patient.dob.y);
    await this.locator.clickContinueButton();

    // select reason for visit
    await expect(this.locator.flowHeading).toBeVisible({ timeout: 5000 });
    await expect(this.locator.flowHeading).toHaveText('About the patient');
    await this.fillingInfo.fillVisitReason();
    await this.locator.continueButton.click();
  }

  async continue(): Promise<void> {
    await this.locator.clickContinueButton();
  }
}
