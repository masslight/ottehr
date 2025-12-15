import { Page, test } from '@playwright/test';
import { DateTime } from 'luxon';
import { dataTestIds } from 'src/constants/data-test-ids';
import {
  expectInPersonProgressNotePage,
  InPersonProgressNotePage,
} from 'tests/e2e/page/in-person/InPersonProgressNotePage';
import { expectScreeningPage, ScreeningPage } from 'tests/e2e/page/in-person/ScreeningPage';
import { InPersonHeader } from 'tests/e2e/page/InPersonHeader';
import { ResourceHandler } from 'tests/e2e-utils/resource-handler';
import { patientScreeningQuestionsConfig } from 'utils';

const resourceHandler = new ResourceHandler(`screening-mutating-${DateTime.now().toMillis()}`);

interface ScreeningInfo {
  screeningAnswersOption: number;
  vaccinationNotes: string;
  asqAnswer: string;
  screeningNote: string;
}

const SCREENING_A: ScreeningInfo = {
  screeningAnswersOption: 0,
  vaccinationNotes: 'Test vaccine notes',
  asqAnswer: 'Negative',
  screeningNote: 'Test screening note',
};

const SCREENING_B: ScreeningInfo = {
  screeningAnswersOption: 1,
  vaccinationNotes: 'Test vaccine notes edited',
  asqAnswer: 'Not offered',
  screeningNote: 'Test screening note edited',
};

test.describe('Screening Page mutating tests', () => {
  test.beforeEach(async ({ page }) => {
    await resourceHandler.setResources();
    await resourceHandler.waitTillAppointmentPreprocessed(resourceHandler.appointment.id!);
    await setupPractitioners(page);
  });

  test.afterEach(async () => {
    await resourceHandler.cleanupResources();
  });

  test('SCR-1 Screening Happy path', async ({ page }) => {
    let screeningPage = await test.step('Fill screening info', async () => {
      const progressNotePage = await expectInPersonProgressNotePage(page);
      const screeningPage = await progressNotePage.sideMenu().clickScreening();

      await enterScreeningInfo(SCREENING_A, screeningPage);
      return await expectScreeningPage(page);
    });

    const progressNotePage = await test.step('SCR-1.1 Verify screening info on progress note', async () => {
      const progressNotePage = await screeningPage.sideMenu().clickReviewAndSign();
      const progressNoteLines = createProgressNoteLines(SCREENING_A);
      progressNoteLines.push('ASQ - ' + SCREENING_A.asqAnswer);
      progressNoteLines.push(SCREENING_A.screeningNote);
      await progressNotePage.verifyScreening(progressNoteLines);
      return await expectInPersonProgressNotePage(page);
    });

    screeningPage = await test.step('SCR-1.2 Edit screening info', async () => {
      const screeningPage = await progressNotePage.sideMenu().clickScreening();
      await enterScreeningInfo(SCREENING_B, screeningPage);
      return await expectScreeningPage(page);
    });

    await test.step('SCR-1.3 Verify edited screening info on progress note', async () => {
      const progressNotePage = await screeningPage.sideMenu().clickReviewAndSign();
      const editedProgressNoteLines = createProgressNoteLines(SCREENING_B);
      editedProgressNoteLines.push('ASQ - ' + SCREENING_B.asqAnswer);
      editedProgressNoteLines.push(SCREENING_B.screeningNote);
      await progressNotePage.verifyScreening(editedProgressNoteLines);
    });
  });
});

async function setupPractitioners(page: Page): Promise<void> {
  const progressNotePage = new InPersonProgressNotePage(page);
  const inPersonHeader = new InPersonHeader(page);
  await page.goto(`in-person/${resourceHandler.appointment.id}/review-and-sign`);
  await inPersonHeader.verifyStatus('pending');
  await inPersonHeader.selectIntakePractitioner();
  await inPersonHeader.selectProviderPractitioner();
  await progressNotePage.expectLoaded();
}

async function enterScreeningInfo(screeningInfo: ScreeningInfo, screeningPage: ScreeningPage): Promise<void> {
  // Only fill questions that are NOT in the questionnaire (shown in "ASK THE PATIENT" section)
  // Questions with existsInQuestionnaire: true are shown in "CONFIRMED BY STAFF" section
  const askPatientFields = patientScreeningQuestionsConfig.fields.filter((field) => !field.existsInQuestionnaire);

  for (const field of askPatientFields) {
    const answer = field.options?.[screeningInfo.screeningAnswersOption]?.label ?? '';

    // Check if the question exists on the page before filling
    const questionLocator = screeningPage
      .page()
      .getByTestId(dataTestIds.screeningPage.askPatientQuestion)
      .filter({ hasText: field.question });

    const questionExists = await questionLocator.isVisible({ timeout: 2000 }).catch(() => false);

    if (questionExists) {
      if (field.type === 'radio') {
        await screeningPage.selectRadioAnswer(field.question, answer);
      }
      if (field.type === 'select') {
        await screeningPage.selectDropdownAnswer(field.question, answer);
      }
    } else {
      console.log(`Question "${field.question}" not found, skipping as it's optional`);
    }
  }

  // Only enter vaccination note if the vaccinations field exists and is not in questionnaire
  const vaccinationsField = patientScreeningQuestionsConfig.fields.find((f) => f.id === 'vaccinations');
  if (vaccinationsField && !vaccinationsField.existsInQuestionnaire) {
    const vaccinationNoteExists = await screeningPage
      .page()
      .getByTestId(dataTestIds.screeningPage.vaccinationNoteField)
      .isVisible({ timeout: 2000 })
      .catch(() => false);

    if (vaccinationNoteExists) {
      await screeningPage.enterVaccinationNote(screeningInfo.vaccinationNotes);
    }
  }

  await screeningPage.selectAsqAnswer(screeningInfo.asqAnswer);
  await screeningPage.enterScreeningNote(screeningInfo.screeningNote);
  await screeningPage.clickAddScreeningNoteButton();
}

function createProgressNoteLines(screeningInfo: ScreeningInfo): string[] {
  // Only include questions from "ASK THE PATIENT" section (without existsInQuestionnaire)
  return patientScreeningQuestionsConfig.fields
    .filter((field) => !field.existsInQuestionnaire)
    .map((field) => {
      const answer = field.options?.[screeningInfo.screeningAnswersOption]?.label ?? '';
      if (field.id === 'vaccinations') {
        return field.question + ' - ' + answer + ': ' + screeningInfo.vaccinationNotes;
      } else {
        return field.question + ' - ' + answer;
      }
    });
}
