import { expect, Page } from '@playwright/test';
import { dataTestIds } from 'src/constants/data-test-ids';
import { waitForSnackbar } from '../../e2e-utils/helpers/tests-utils';

const DEFAULT_TIMEOUT = { timeout: 30_000 };

export class LabelPrintingConfigAdminPage {
  #page: Page;

  constructor(page: Page) {
    this.#page = page;
  }

  async goto(): Promise<void> {
    await this.#page.goto('admin/label-printing-config');
  }

  async waitForFormLoaded(): Promise<void> {
    await expect(this.#page.getByTestId(dataTestIds.adminLabelPrintingConfig.submitButton)).toBeVisible(
      DEFAULT_TIMEOUT
    );
  }

  async expectModeIs(mode: 'manual' | 'integrated'): Promise<void> {
    const label = mode === 'manual' ? 'Manual' : 'Integrated';
    await expect(this.#page.getByTestId(dataTestIds.adminLabelPrintingConfig.modeSelect)).toContainText(
      label,
      DEFAULT_TIMEOUT
    );
  }

  async selectMode(mode: 'manual' | 'integrated'): Promise<void> {
    const label = mode === 'manual' ? 'Manual' : 'Integrated';
    await this.#page.getByTestId(dataTestIds.adminLabelPrintingConfig.modeSelect).click();
    await this.#page.getByRole('option', { name: label }).click();
  }

  async selectManufacturer(manufacturer: string): Promise<void> {
    await this.#page.getByTestId(dataTestIds.adminLabelPrintingConfig.manufacturerSelect).click();
    await this.#page.getByRole('option', { name: manufacturer }).click();
  }

  async selectLabelType(labelType: string): Promise<void> {
    await this.#page.getByTestId(dataTestIds.adminLabelPrintingConfig.labelTypeSelect).click();
    await this.#page.getByRole('option', { name: labelType }).click();
  }

  async selectOrientation(orientation: 'portrait' | 'landscape'): Promise<void> {
    const label = orientation === 'portrait' ? 'Portrait' : 'Landscape';
    await this.#page.getByTestId(dataTestIds.adminLabelPrintingConfig.orientationSelect).click();
    await this.#page.getByRole('option', { name: label }).click();
  }

  async expectManufacturerIs(manufacturer: string): Promise<void> {
    await expect(this.#page.getByTestId(dataTestIds.adminLabelPrintingConfig.manufacturerSelect)).toContainText(
      manufacturer,
      DEFAULT_TIMEOUT
    );
  }

  async expectLabelTypeIs(labelType: string): Promise<void> {
    await expect(this.#page.getByTestId(dataTestIds.adminLabelPrintingConfig.labelTypeSelect)).toContainText(
      labelType,
      DEFAULT_TIMEOUT
    );
  }

  async expectOrientationIs(orientation: 'portrait' | 'landscape'): Promise<void> {
    const label = orientation === 'portrait' ? 'Portrait' : 'Landscape';
    await expect(this.#page.getByTestId(dataTestIds.adminLabelPrintingConfig.orientationSelect)).toContainText(
      label,
      DEFAULT_TIMEOUT
    );
  }

  async expectIntegratedFieldsVisible(): Promise<void> {
    await expect(this.#page.getByTestId(dataTestIds.adminLabelPrintingConfig.manufacturerSelect)).toBeVisible(
      DEFAULT_TIMEOUT
    );
    await expect(this.#page.getByTestId(dataTestIds.adminLabelPrintingConfig.labelTypeSelect)).toBeVisible(
      DEFAULT_TIMEOUT
    );
    await expect(this.#page.getByTestId(dataTestIds.adminLabelPrintingConfig.orientationSelect)).toBeVisible(
      DEFAULT_TIMEOUT
    );
  }

  async expectIntegratedFieldsNotVisible(): Promise<void> {
    await expect(this.#page.getByTestId(dataTestIds.adminLabelPrintingConfig.manufacturerSelect)).not.toBeVisible(
      DEFAULT_TIMEOUT
    );
  }

  async submitAndWaitForSuccess(): Promise<void> {
    await this.#page.getByTestId(dataTestIds.adminLabelPrintingConfig.submitButton).click();
    await waitForSnackbar(this.#page);
  }

  async reload(): Promise<void> {
    await this.#page.reload();
    await this.waitForFormLoaded();
  }
}
