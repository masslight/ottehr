import { expect, Page } from '@playwright/test';
import { dataTestIds } from 'src/constants/data-test-ids';
import { LAB_PAYMENT_METHOD_DISPLAY, LabPaymentMethod, nameLabTest } from 'utils';
import { MOCK_LAB_RESULTS } from './mock-data';

const createPgTestIds = dataTestIds.externalLabs.createPg;

export class CreateExternalLabPage {
  #page: Page;

  constructor(page: Page) {
    this.#page = page;
  }

  static async isOpen(page: Page): Promise<CreateExternalLabPage> {
    await page.waitForURL(new RegExp('/in-person/.*/external-lab-orders/create'));
    await expect(
      page.getByTestId(createPgTestIds.createExternalLabForm),
      'confirming create external lab page is open'
    ).toBeVisible();
    return new CreateExternalLabPage(page);
  }

  async officeIsSelected(officeName: string): Promise<void> {
    const officeSelect = this.#page.getByTestId(createPgTestIds.orderingOffice);

    const selectedValue = officeSelect.locator('.MuiSelect-select');

    await expect(selectedValue, `Confirming ${officeName} is selected`).toHaveText(officeName);
  }

  async diagnosisIsSelected(expectedDx: string): Promise<void> {
    const container = this.#page.getByTestId(createPgTestIds.selectedDxContainer);

    await expect(container, `Confirming ${expectedDx} is prefilled for the dx`).toContainText(expectedDx);
  }

  async selectAdditionalDx(dxSearchTerm: string): Promise<string> {
    const input = this.#page.getByTestId(createPgTestIds.additionalDxSelect);

    await input.click();
    await input.fill(dxSearchTerm);

    const listbox = this.#page.getByRole('listbox');
    await listbox.waitFor({ state: 'visible' });

    const option = this.#page.getByRole('option').first();
    await option.waitFor({ state: 'visible' });

    const selectedDx = (await option.textContent())?.trim() || '';

    await option.click();

    return selectedDx;
  }

  async paymentMethodIsSelected(method: LabPaymentMethod): Promise<void> {
    const paymentMethodSelect = this.#page.getByTestId(createPgTestIds.paymentMethod);

    const selectedValue = paymentMethodSelect.locator('.MuiSelect-select');

    const methodDisplay = LAB_PAYMENT_METHOD_DISPLAY[method];

    await expect(selectedValue, `Confirming ${methodDisplay} is selected`).toHaveText(methodDisplay);
  }

  async searchAndSelectLab(input: { withAoe: boolean }): Promise<{ fillerLabName: string; testName: string }> {
    const { withAoe } = input;
    const routePattern = '**/zambda/get-create-lab-order-resources/execute';

    const mockedLabSearch = withAoe ? MOCK_LAB_RESULTS.withAoe : MOCK_LAB_RESULTS.noAoe;
    const mockedLabSearchResult = mockedLabSearch.labsData;
    const searchTerm = mockedLabSearch.searchTerm;

    await this.#page.route(routePattern, async (route) => {
      const body = route.request().postDataJSON();
      if (body?.search) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            output: {
              labs: [mockedLabSearchResult],
              orderingLocations: [],
              orderingLocationIds: [],
              appointmentIsWorkersComp: false,
              labSets: undefined,
            },
          }),
        });
      } else {
        await route.continue();
      }
    });

    const labInput = this.#page.getByTestId(createPgTestIds.labsSearchAutoComplete);
    await labInput.fill(searchTerm);

    const fillerLabName = mockedLabSearchResult.lab.labName;
    const testName = mockedLabSearchResult.item.itemName;

    const displayName = nameLabTest(testName, fillerLabName, false);

    await this.#page.getByRole('option', { name: displayName }).click();

    await this.#page.unroute(routePattern);

    return { fillerLabName, testName };
  }

  async labIsSelected(input: { fillerLabName: string; testName: string }): Promise<void> {
    const labDisplayName = nameLabTest(input.testName, input.fillerLabName, false);
    const container = this.#page.getByTestId(createPgTestIds.selectedLabContainer);

    await expect(container, `Confirming ${labDisplayName} is selected`).toContainText(labDisplayName);
  }

  async addClinicalInfoNote(note: string): Promise<void> {
    await this.#page.getByTestId(createPgTestIds.addClinicalInfoNote).click();

    // Wait for the textarea to appear
    const noteInput = this.#page.getByTestId(createPgTestIds.clinicalInfoNote);
    await noteInput.waitFor({ state: 'visible' });

    // Fill the note
    await noteInput.fill(note);
  }

  async clickOrderButton(): Promise<void> {
    await this.#page.getByTestId(createPgTestIds.createExternalLabOrderBtn).click();
  }
}
