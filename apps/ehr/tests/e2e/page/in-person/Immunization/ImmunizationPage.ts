import { expect, Page } from '@playwright/test';
import { dataTestIds } from 'src/constants/data-test-ids';
import { Dialog, expectDialog } from '../../patient-information/Dialog';
import { EditVaccineOrderPage, expectEditVaccineOrderPage } from './EditVaccineOrderPage';
import { expectVaccineDetailsPage, VaccineDetailsPage } from './VaccineDetailsPage';

export class ImmunizationPage {
  #page: Page;

  constructor(page: Page) {
    this.#page = page;
  }

  async verifyVaccinePresent(input: {
    vaccine: string;
    dose: string;
    units: string;
    route: string;
    instructions: string;
    orderedDate?: string;
    orderedPerson?: string;
    givenDate?: string;
    givenPerson?: string;
    status: string;
    reason?: string;
  }): Promise<void> {
    await expect(
      this.#page
        .getByTestId(dataTestIds.immunizationPage.marTableRow)
        .filter({
          has: this.#page
            .getByTestId(dataTestIds.immunizationPage.marTableVaccineCell)
            .filter({ hasText: input.vaccine }),
        })
        .filter({
          has: this.#page
            .getByTestId(dataTestIds.immunizationPage.marTableDoseRouteCell)
            .filter({ hasText: input.dose + ' ' + input.units + ' / ' + input.route }),
        })
        .filter({
          has: this.#page
            .getByTestId(dataTestIds.immunizationPage.marTableInstructionsCell)
            .filter({ hasText: input.instructions }),
        })
        .filter({
          has: this.#page
            .getByTestId(dataTestIds.immunizationPage.marTableOrderedDateCell)
            .filter({ hasText: input.orderedDate }),
        })
        .filter({
          has: this.#page
            .getByTestId(dataTestIds.immunizationPage.marTableOrderedPersonCell)
            .filter({ hasText: input.orderedPerson }),
        })
        .filter({
          has: this.#page
            .getByTestId(dataTestIds.immunizationPage.marTableGivenDateCell)
            .filter({ hasText: input.givenDate }),
        })
        .filter({
          has: this.#page
            .getByTestId(dataTestIds.immunizationPage.marTableGivenPersonCell)
            .filter({ hasText: input.givenPerson }),
        })
        .filter({
          has: this.#page
            .getByTestId(dataTestIds.immunizationPage.marTableStatusCell)
            .filter({ hasText: input.status }),
        })
        .filter({
          has: this.#page
            .getByTestId(dataTestIds.immunizationPage.marTableReasonCell)
            .filter({ hasText: input.reason }),
        })
    ).toBeVisible();
  }

  async clickEditOrderButton(vaccineName: string): Promise<EditVaccineOrderPage> {
    await this.#page
      .getByTestId(dataTestIds.immunizationPage.marTableRow)
      .filter({
        hasText: vaccineName,
      })
      .getByTestId(dataTestIds.immunizationPage.pencilIconButton)
      .click();
    return expectEditVaccineOrderPage(this.#page);
  }

  async clickDeleteButton(vaccineName: string): Promise<Dialog> {
    await this.#page
      .getByTestId(dataTestIds.immunizationPage.marTableRow)
      .filter({
        hasText: vaccineName,
      })
      .getByTestId(dataTestIds.immunizationPage.deleteButton)
      .click();
    return expectDialog(this.#page);
  }

  async clickVaccineDetailsTab(): Promise<VaccineDetailsPage> {
    await this.#page.getByTestId(dataTestIds.immunizationPage.vaccineDetailsTab).click();
    return expectVaccineDetailsPage(this.#page);
  }

  async clickMarTab(): Promise<void> {
    await this.#page.getByTestId(dataTestIds.immunizationPage.marTab).click();
  }
}

export async function expectImmunizationPage(page: Page): Promise<ImmunizationPage> {
  await page.waitForURL(new RegExp('/in-person/.*/immunization/mar'));
  await expect(page.getByTestId(dataTestIds.immunizationPage.title)).toBeVisible();
  return new ImmunizationPage(page);
}

export async function openImmunizationPage(appointmentId: string, page: Page): Promise<ImmunizationPage> {
  await page.goto(`/in-person/${appointmentId}/immunization/mar`);
  return expectImmunizationPage(page);
}
