import { expect, Page } from '@playwright/test';
import { dataTestIds } from '../../../../src/constants/data-test-ids';

export abstract class BaseProgressNotePage {
  #page: Page;

  constructor(page: Page) {
    this.#page = page;
  }

  async clickDischargeButton(): Promise<void> {
    const dischargeButton = this.#page.getByTestId(dataTestIds.progressNotePage.dischargeButton);
    await expect(dischargeButton).toBeVisible();
    await expect(dischargeButton).toBeEnabled();
    await dischargeButton.click();
    await expect(dischargeButton).toHaveText('Discharged');
    await expect(dischargeButton).toBeDisabled();
  }

  async clickReviewAndSignButton(): Promise<void> {
    const reviewAndSignButton = this.#page.getByTestId(dataTestIds.progressNotePage.reviewAndSignButton);
    await reviewAndSignButton.waitFor({ state: 'visible' });
    await expect(reviewAndSignButton).toBeEnabled();
    await reviewAndSignButton.click();
  }

  async verifyReviewAndSignButtonDisabled(): Promise<void> {
    await expect(this.#page.getByTestId(dataTestIds.progressNotePage.reviewAndSignButton)).toBeDisabled();
  }

  async clickSignButton(): Promise<void> {
    await this.#page.getByTestId(dataTestIds.dialog.proceedButton).click();
  }

  async verifyProcedure(procedureType: string, procedureDetails: string[]): Promise<void> {
    const matcher = expect(
      this.#page.getByTestId(dataTestIds.progressNotePage.procedureItem).filter({ hasText: procedureType })
    );
    for (const procedureDetail of procedureDetails) {
      if (procedureDetail.startsWith('CPT:')) {
        // sometimes it's not in order and that flakes the test
        const [cptPrefix, cptCode1, cptCode2] = procedureDetail.split(':');
        let regex: string;
        if (cptCode2 != null) {
          regex = `${cptPrefix}: (${cptCode1 + '; ' + cptCode2}|${cptCode2 + '; ' + cptCode1})`;
        } else {
          regex = `${cptPrefix}: ${cptCode1}`;
        }
        await matcher.toContainText(new RegExp(regex));
      } else {
        await matcher.toContainText(procedureDetail);
      }
    }
  }

  async verifyVaccine(vaccine: {
    vaccine: string;
    dose: string;
    units: string;
    route: string;
    location: string;
  }): Promise<void> {
    await expect(
      this.#page.getByTestId(dataTestIds.progressNotePage.vaccineItem).filter({
        hasText:
          vaccine.vaccine +
          ' - ' +
          vaccine.dose +
          ' ' +
          vaccine.units +
          ' / ' +
          vaccine.route +
          ' - ' +
          vaccine.location,
      })
    ).toBeVisible();
  }

  async verifyInHouseLabs(sectionTitle: string, testName: string): Promise<void> {
    await expect(this.#page.getByTestId(dataTestIds.progressNotePage.labsTitle(sectionTitle))).toBeVisible();
    await expect(this.#page.getByTestId(dataTestIds.progressNotePage.labsTitle(sectionTitle))).toContainText(testName);
  }
  async verifyAddedAllergyIsShown(allergy: string): Promise<void> {
    await expect(this.#page.getByTestId(dataTestIds.progressNotePage.knownAllergiesContainer)).toBeVisible();
    await expect(this.#page.getByTestId(dataTestIds.progressNotePage.knownAllergiesContainer)).toContainText(allergy);
  }
  async verifyRemovedAllergyIsNotShown(allergy: string): Promise<void> {
    await expect(this.#page.getByTestId(dataTestIds.progressNotePage.knownAllergiesContainer)).toBeVisible();
    await expect(this.#page.getByTestId(dataTestIds.progressNotePage.knownAllergiesContainer)).not.toContainText(
      allergy
    );
  }
  async verifyAddedMedicalConditionIsShown(medicalCondition: string): Promise<void> {
    await expect(this.#page.getByTestId(dataTestIds.progressNotePage.medicalConditionsContainer)).toBeVisible();
    await expect(this.#page.getByTestId(dataTestIds.progressNotePage.medicalConditionsContainer)).toContainText(
      medicalCondition
    );
  }
  async verifyRemovedMedicalConditionIsNotShown(medicalCondition: string): Promise<void> {
    await expect(this.#page.getByTestId(dataTestIds.progressNotePage.medicalConditionsContainer)).toBeVisible();
    await expect(this.#page.getByTestId(dataTestIds.progressNotePage.medicalConditionsContainer)).not.toContainText(
      medicalCondition
    );
  }
  async verifyAddedSurgeryIsShown(surgery: string): Promise<void> {
    await expect(this.#page.getByTestId(dataTestIds.progressNotePage.surgicalHistoryContainer)).toBeVisible();
    await expect(this.#page.getByTestId(dataTestIds.progressNotePage.surgicalHistoryContainer)).toContainText(surgery);
  }
  async verifyRemovedSurgeryIsNotShown(surgery: string): Promise<void> {
    await expect(this.#page.getByTestId(dataTestIds.progressNotePage.surgicalHistoryContainer)).toBeVisible();
    await expect(this.#page.getByTestId(dataTestIds.progressNotePage.surgicalHistoryContainer)).not.toContainText(
      surgery
    );
  }

  async verifyInHouseMedication(medication: {
    medication: string;
    dose: string;
    units: string;
    route: string;
    givenBy?: string;
    instructions: string;
    status: string;
  }): Promise<void> {
    await expect(
      this.#page.getByTestId(dataTestIds.progressNotePage.inHouseMedicationItem).filter({
        hasText:
          medication.medication +
          ', ' +
          medication.dose +
          ' ' +
          medication.units +
          ', ' +
          medication.route +
          ', ' +
          (medication.givenBy ? 'given by ' + medication.givenBy + ', ' : '') +
          'instructions: ' +
          medication.instructions +
          ', ' +
          medication.status,
      })
    ).toBeVisible();
  }

  async verifyScreening(lines: string[]): Promise<void> {
    for (const line of lines) {
      await expect(
        this.#page.getByTestId(dataTestIds.progressNotePage.additionalQuestions).filter({
          hasText: line,
        })
      ).toBeVisible();
    }
  }

  async verifyMedication(medication: string): Promise<void> {
    await expect(
      this.#page.getByTestId(dataTestIds.telemedEhrFlow.reviewTabMedicationsContainer).filter({
        hasText: medication,
      })
    ).toBeVisible();
  }

  async verifyMedicationNote(note: string): Promise<void> {
    await expect(
      this.#page.getByTestId(dataTestIds.telemedEhrFlow.reviewTabMedicationsContainer).filter({
        hasText: note,
      })
    ).toBeVisible();
  }

  async verifyMedicationNoteNotShown(note: string): Promise<void> {
    await expect(
      this.#page.getByTestId(dataTestIds.telemedEhrFlow.reviewTabMedicationsContainer).filter({
        hasText: note,
      })
    ).not.toBeVisible();
  }

  async verifyMedicationNotShown(medication: string): Promise<void> {
    await expect(
      this.#page.getByTestId(dataTestIds.telemedEhrFlow.reviewTabMedicationsContainer).filter({
        hasText: medication,
      })
    ).not.toBeVisible();
  }

  async verifyHospitalization(hospitalization: string): Promise<void> {
    await expect(
      this.#page.getByTestId(dataTestIds.progressNotePage.hospitalizationContainer).filter({
        hasText: hospitalization,
      })
    ).toBeVisible();
  }

  async verifyHospitalizationNotShown(hospitalization: string): Promise<void> {
    await expect(
      this.#page.getByTestId(dataTestIds.progressNotePage.hospitalizationContainer).filter({
        hasText: hospitalization,
      })
    ).not.toBeVisible();
  }

  async verifyHospitalizationNote(note: string): Promise<void> {
    await expect(
      this.#page.getByTestId(dataTestIds.progressNotePage.hospitalizationContainer).filter({
        hasText: note,
      })
    ).toBeVisible();
  }

  async verifyHospitalizationNoteNotShown(note: string): Promise<void> {
    await expect(
      this.#page.getByTestId(dataTestIds.progressNotePage.hospitalizationContainer).filter({
        hasText: note,
      })
    ).not.toBeVisible();
  }
  async verifyVitalIsShown(vitals: string): Promise<void> {
    await expect(this.#page.getByTestId(dataTestIds.progressNotePage.vitalsContainer)).toBeVisible();
    await expect(this.#page.getByTestId(dataTestIds.progressNotePage.vitalsContainer)).toContainText(vitals);
  }

  async verifyVitalNotShown(vitals: string): Promise<void> {
    await expect(
      this.#page.getByTestId(dataTestIds.progressNotePage.vitalsContainer).filter({
        hasText: vitals,
      })
    ).not.toBeVisible();
  }

  abstract expectLoaded(): Promise<void>;
}
