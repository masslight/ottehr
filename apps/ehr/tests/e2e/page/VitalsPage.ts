import { expect, Page } from '@playwright/test';
import { dataTestIds } from 'src/constants/data-test-ids';

export class VitalsPage {
  #page: Page;

  constructor(page: Page) {
    this.#page = page;
  }

  async addTemperatureObservation(temperature: string): Promise<void> {
    const input = this.#page.getByTestId(dataTestIds.vitalsPage.temperatureInput).locator('input');
    await input.fill(temperature);
    const addButton = this.#page.getByTestId(dataTestIds.vitalsPage.temperatureAddButton);
    await addButton.click();
  }

  async checkAddedTemperatureObservationInHistory(temperature: string): Promise<void> {
    await expect(this.#page.getByTestId(dataTestIds.vitalsPage.temperatureItem)).toContainText(temperature);
  }

  async checkAddedTemperatureIsShownInHeader(temperature: string): Promise<void> {
    await expect(this.#page.getByTestId(dataTestIds.vitalsPage.temperatureHeader)).toContainText(temperature);
  }

  async removeTemperatureObservationFromHistory(temperature: string): Promise<void> {
    await this.#page
      .getByTestId(dataTestIds.vitalsPage.temperatureItem)
      .filter({ hasText: temperature })
      .getByTestId(dataTestIds.deleteOutlinedIcon)
      .click();
    await this.#page
      .getByTestId(dataTestIds.vitalsPage.deleteVitalModal)
      .getByTestId(dataTestIds.dialog.proceedButton)
      .click();
  }

  async addHeartbeatObservation(heartbeat: string): Promise<void> {
    const input = this.#page.getByTestId(dataTestIds.vitalsPage.heartbeatInput).locator('input');
    await input.fill(heartbeat);
    const addButton = this.#page.getByTestId(dataTestIds.vitalsPage.heartbeatAddButton);
    await addButton.click();
  }

  async checkAddedHeartbeatObservationInHistory(heartbeat: string): Promise<void> {
    await expect(this.#page.getByTestId(dataTestIds.vitalsPage.heartbeatItem).first()).toContainText(heartbeat);
  }

  async checkAddedHeartbeatIsShownInHeader(heartbeat: string): Promise<void> {
    await expect(this.#page.getByTestId(dataTestIds.vitalsPage.heartbeatHeader)).toContainText(heartbeat);
  }

  async removeHeartbeatObservationFromHistory(heartbeat: string): Promise<void> {
    await this.#page
      .getByTestId(dataTestIds.vitalsPage.heartbeatItem)
      .filter({ hasText: heartbeat })
      .getByTestId(dataTestIds.deleteOutlinedIcon)
      .click();
    await this.#page
      .getByTestId(dataTestIds.vitalsPage.deleteVitalModal)
      .getByTestId(dataTestIds.dialog.proceedButton)
      .click();
  }

  async addRespirationRateObservation(respirationRate: string): Promise<void> {
    const input = this.#page.getByTestId(dataTestIds.vitalsPage.respirationRateInput).locator('input');
    await input.fill(respirationRate);
    const addButton = this.#page.getByTestId(dataTestIds.vitalsPage.respirationRateAddButton);
    await addButton.click();
  }

  async checkAddedRespirationRateObservationInHistory(respirationRate: string): Promise<void> {
    await expect(this.#page.getByTestId(dataTestIds.vitalsPage.respirationRateItem).first()).toContainText(
      respirationRate
    );
  }

  async checkAddedRespirationRateIsShownInHeader(respirationRate: string): Promise<void> {
    await expect(this.#page.getByTestId(dataTestIds.vitalsPage.respirationRateHeader)).toContainText(respirationRate);
  }

  async removeRespirationRateObservationFromHistory(respirationRate: string): Promise<void> {
    await this.#page
      .getByTestId(dataTestIds.vitalsPage.respirationRateItem)
      .filter({ hasText: respirationRate })
      .getByTestId(dataTestIds.deleteOutlinedIcon)
      .click();
    await this.#page
      .getByTestId(dataTestIds.vitalsPage.deleteVitalModal)
      .getByTestId(dataTestIds.dialog.proceedButton)
      .click();
  }

  async addBloodPressureObservation(systolic: string, diastolic: string): Promise<void> {
    const systolicInput = this.#page.getByTestId(dataTestIds.vitalsPage.bloodPressureSystolicInput).locator('input');
    await systolicInput.fill(systolic);

    const diastolicInput = this.#page.getByTestId(dataTestIds.vitalsPage.bloodPressureDiastolicInput).locator('input');
    await diastolicInput.fill(diastolic);

    const addButton = this.#page.getByTestId(dataTestIds.vitalsPage.bloodPressureAddButton);
    await addButton.click();
  }

  async checkAddedBloodPressureObservationInHistory(systolic: string, diastolic: string): Promise<void> {
    const item = this.#page.getByTestId(dataTestIds.vitalsPage.bloodPressureItem).first();
    await expect(item).toContainText(systolic);
    await expect(item).toContainText(diastolic);
  }

  async checkAddedBloodPressureIsShownInHeader(systolic: string, diastolic: string): Promise<void> {
    const header = this.#page.getByTestId(dataTestIds.vitalsPage.bloodPressureHeader);
    await expect(header).toContainText(systolic);
    await expect(header).toContainText(diastolic);
  }

  async removeBloodPressureObservationFromHistory(systolic: string, diastolic: string): Promise<void> {
    await this.#page
      .getByTestId(dataTestIds.vitalsPage.bloodPressureItem)
      .filter({ hasText: `${systolic}/${diastolic}` })
      .getByTestId(dataTestIds.deleteOutlinedIcon)
      .click();
    await this.#page
      .getByTestId(dataTestIds.vitalsPage.deleteVitalModal)
      .getByTestId(dataTestIds.dialog.proceedButton)
      .click();
  }

  async addOxygenSaturationObservation(oxygenSat: string): Promise<void> {
    const input = this.#page.getByTestId(dataTestIds.vitalsPage.oxygenSaturationInput).locator('input');
    await input.fill(oxygenSat);
    const addButton = this.#page.getByTestId(dataTestIds.vitalsPage.oxygenSaturationAddButton);
    await addButton.click();
  }

  async checkAddedOxygenSaturationObservationInHistory(oxygenSat: string): Promise<void> {
    await expect(this.#page.getByTestId(dataTestIds.vitalsPage.oxygenSaturationItem).first()).toContainText(oxygenSat);
  }

  async checkAddedOxygenSaturationIsShownInHeader(oxygenSaturation: string): Promise<void> {
    await expect(this.#page.getByTestId(dataTestIds.vitalsPage.oxygenSaturationHeader)).toContainText(oxygenSaturation);
  }

  async removeOxygenSaturationObservationFromHistory(oxygenSaturation: string): Promise<void> {
    await this.#page
      .getByTestId(dataTestIds.vitalsPage.oxygenSaturationItem)
      .filter({ hasText: oxygenSaturation })
      .getByTestId(dataTestIds.deleteOutlinedIcon)
      .click();
    await this.#page
      .getByTestId(dataTestIds.vitalsPage.deleteVitalModal)
      .getByTestId(dataTestIds.dialog.proceedButton)
      .click();
  }

  async addWeightObservation(weight: string): Promise<void> {
    const input = this.#page.getByTestId(dataTestIds.vitalsPage.weightInput).locator('input');
    await input.fill(weight);
    const addButton = this.#page.getByTestId(dataTestIds.vitalsPage.weightAddButton);
    await addButton.click();
  }

  async checkAddedWeightObservationInHistory(weight: string): Promise<void> {
    await expect(this.#page.getByTestId(dataTestIds.vitalsPage.weightItem).first()).toContainText(weight);
  }

  async checkAddedWeightIsShownInHeader(weight: string): Promise<void> {
    await expect(this.#page.getByTestId(dataTestIds.vitalsPage.weightHeader)).toContainText(weight);
  }

  async removeWeightObservationFromHistory(weight: string): Promise<void> {
    await this.#page
      .getByTestId(dataTestIds.vitalsPage.weightItem)
      .filter({ hasText: weight })
      .getByTestId(dataTestIds.deleteOutlinedIcon)
      .click();
    await this.#page
      .getByTestId(dataTestIds.vitalsPage.deleteVitalModal)
      .getByTestId(dataTestIds.dialog.proceedButton)
      .click();
  }

  async addWeightObservationPatientRefused(): Promise<void> {
    const patientRefusedCheckbox = this.#page.getByTestId(dataTestIds.vitalsPage.weightPatientRefusedCheckbox);
    await patientRefusedCheckbox.check();

    const addButton = this.#page.getByTestId(dataTestIds.vitalsPage.weightAddButton);
    await addButton.click();
  }

  async checkPatientRefusedInHistory(): Promise<void> {
    await expect(this.#page.getByTestId(dataTestIds.vitalsPage.weightItem).first()).toContainText('Patient Refused');
  }

  async addHeightObservation(height: string): Promise<void> {
    const input = this.#page.getByTestId(dataTestIds.vitalsPage.heightInput).locator('input');
    await input.fill(height);
    const addButton = this.#page.getByTestId(dataTestIds.vitalsPage.heightAddButton);
    await addButton.click();
  }

  async checkAddedHeightObservationInHistory(height: string): Promise<void> {
    await expect(this.#page.getByTestId(dataTestIds.vitalsPage.heightItem).first()).toContainText(height);
  }

  async checkAddedHeightIsShownInHeader(height: string): Promise<void> {
    await expect(this.#page.getByTestId(dataTestIds.vitalsPage.heightHeader)).toContainText(height);
  }

  async removeHeightObservationFromHistory(height: string): Promise<void> {
    await this.#page
      .getByTestId(dataTestIds.vitalsPage.heightItem)
      .filter({ hasText: height })
      .getByTestId(dataTestIds.deleteOutlinedIcon)
      .click();
    await this.#page
      .getByTestId(dataTestIds.vitalsPage.deleteVitalModal)
      .getByTestId(dataTestIds.dialog.proceedButton)
      .click();
  }

  async addVisionObservation(leftEye: string, rightEye: string): Promise<void> {
    const leftInput = this.#page.getByTestId(dataTestIds.vitalsPage.visionLeftInput).locator('input');
    await leftInput.fill(leftEye);

    const rightInput = this.#page.getByTestId(dataTestIds.vitalsPage.visionRightInput).locator('input');
    await rightInput.fill(rightEye);

    const addButton = this.#page.getByTestId(dataTestIds.vitalsPage.visionAddButton);
    await addButton.click();
  }

  async checkAddedVisionObservationInHistory(leftEye: string, rightEye: string): Promise<void> {
    const item = this.#page.getByTestId(dataTestIds.vitalsPage.visionItem).first();
    await expect(item).toContainText(leftEye);
    await expect(item).toContainText(rightEye);
  }

  async checkAddedVisionIsShownInHeader(leftEye: string, rightEye: string): Promise<void> {
    const header = this.#page.getByTestId(dataTestIds.vitalsPage.visionHeader);
    await expect(header).toContainText(leftEye);
    await expect(header).toContainText(rightEye);
  }

  async removeVisionObservationFromHistory(leftEye: string, rightEye: string): Promise<void> {
    await this.#page
      .getByTestId(dataTestIds.vitalsPage.visionItem)
      .filter({ hasText: leftEye })
      .filter({ hasText: rightEye })
      .getByTestId(dataTestIds.deleteOutlinedIcon)
      .click();
    await this.#page
      .getByTestId(dataTestIds.vitalsPage.deleteVitalModal)
      .getByTestId(dataTestIds.dialog.proceedButton)
      .click();
  }

  async addLastMenstrualPeriodObservation(date: string): Promise<void> {
    const dateInput = this.#page.getByTestId(dataTestIds.vitalsPage.lastMenstrualPeriodDateInput).locator('input');
    await dateInput.click();
    await dateInput.pressSequentially(date);
    const addButton = this.#page.getByTestId(dataTestIds.vitalsPage.lastMenstrualPeriodAddButton);
    await addButton.click();
  }

  async checkAddedLastMenstrualPeriodObservationInHistory(date: string): Promise<void> {
    await expect(this.#page.getByTestId(dataTestIds.vitalsPage.lastMenstrualPeriodItem).first()).toContainText(date);
  }

  async checkAddedLastMenstrualPeriodIsShownInHeader(date: string): Promise<void> {
    await expect(this.#page.getByTestId(dataTestIds.vitalsPage.lastMenstrualPeriodHeader)).toContainText(date);
  }

  async addLastMenstrualPeriodObservationUnsure(): Promise<void> {
    const unsureCheckbox = this.#page.getByTestId(dataTestIds.vitalsPage.lastMenstrualPeriodUnsureCheckbox);
    await unsureCheckbox.check();

    const addButton = this.#page.getByTestId(dataTestIds.vitalsPage.lastMenstrualPeriodAddButton);
    await addButton.click();
  }

  async checkUnsureInHistory(): Promise<void> {
    await expect(this.#page.getByTestId(dataTestIds.vitalsPage.lastMenstrualPeriodItem).first()).toContainText(
      'Unsure'
    );
  }

  async checkAddedLastMenstrualPeriodUnsureIsShownInHeader(): Promise<void> {
    await expect(this.#page.getByTestId(dataTestIds.vitalsPage.lastMenstrualPeriodHeader)).toContainText('Unsure');
  }

  async removeLastMenstrualPeriodObservationFromHistory(text: string): Promise<void> {
    await this.#page
      .getByTestId(dataTestIds.vitalsPage.lastMenstrualPeriodItem)
      .filter({ hasText: text })
      .getByTestId(dataTestIds.deleteOutlinedIcon)
      .click();
    await this.#page
      .getByTestId(dataTestIds.vitalsPage.deleteVitalModal)
      .getByTestId(dataTestIds.dialog.proceedButton)
      .click();
  }
}

export async function expectVitalsPage(page: Page): Promise<VitalsPage> {
  await page.waitForURL(new RegExp('/in-person/.*/vitals$'));
  await expect(page.getByTestId(dataTestIds.vitalsPage.title)).toBeVisible();
  return new VitalsPage(page);
}

export async function openVitalsPage(appointmentId: string, page: Page): Promise<VitalsPage> {
  await page.goto(`/in-person/${appointmentId}/vitals`);
  return expectVitalsPage(page);
}
