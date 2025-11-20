import { Page, test } from '@playwright/test';
import { DateTime } from 'luxon';
import { ADDITIONAL_QUESTIONS } from 'src/constants';
import {
  expectInPersonProgressNotePage,
  InPersonProgressNotePage,
} from 'tests/e2e/page/in-person/InPersonProgressNotePage';
import { expectScreeningPage, ScreeningPage } from 'tests/e2e/page/in-person/ScreeningPage';
import { InPersonHeader } from 'tests/e2e/page/InPersonHeader';
import { ResourceHandler } from 'tests/e2e-utils/resource-handler';

const resourceHandler = new ResourceHandler(`screening-mutating-${DateTime.now().toMillis()}`);

interface ScreeningInfo {
  hasBeenSeenQuestion: string;
  hasBeenSeenAnswer: string;
  vaccinationQuestion: string;
  vaccinationAnswer: string;
  vaccinationNotes: string;
  historyQuestion: string;
  historyAnswer: string;
  asqAnswer: string;
  screeningNote: string;
  additionalQuestionsAnswer: string;
}

const SCREENING_A: ScreeningInfo = {
  hasBeenSeenQuestion: 'Has the patient been seen in one of our offices / telemed in last 3 years?',
  hasBeenSeenAnswer: 'Yes',
  vaccinationQuestion: 'Has the patient received vaccinations?',
  vaccinationAnswer: 'Yes, up to date',
  vaccinationNotes: 'Test vaccine notes',
  historyQuestion: 'History obtained from',
  historyAnswer: 'Aunt',
  asqAnswer: 'Negative',
  screeningNote: 'Test screening note',
  additionalQuestionsAnswer: 'Yes',
};

const SCREENING_B: ScreeningInfo = {
  hasBeenSeenQuestion: 'Has the patient been seen in one of our offices / telemed in last 3 years?',
  hasBeenSeenAnswer: 'No',
  vaccinationQuestion: 'Has the patient received vaccinations?',
  vaccinationAnswer: 'Partially vaccinated',
  vaccinationNotes: 'Test vaccine notes edited',
  historyQuestion: 'History obtained from',
  historyAnswer: 'Babysitter',
  asqAnswer: 'Not offered',
  screeningNote: 'Test screening note edited',
  additionalQuestionsAnswer: 'No',
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

  test('Screening Hapy path', async ({ page }) => {
    await test.step('Fill screening info', async () => {
      const progressNotePage = await expectInPersonProgressNotePage(page);
      const screeningPage = await progressNotePage.sideMenu().clickScreening();
      await enterScreeningInfo(SCREENING_A, screeningPage);
    });

    await test.step('Verify screening info on progress note', async () => {
      const screeningPage = await expectScreeningPage(page);
      const progressNotePage = await screeningPage.sideMenu().clickProgressNote();
      const progressNoteLines = ADDITIONAL_QUESTIONS.map((question) => question.label + ' - Yes');
      progressNoteLines.push(SCREENING_A.hasBeenSeenQuestion + ' - ' + SCREENING_A.hasBeenSeenAnswer);
      progressNoteLines.push(
        SCREENING_A.vaccinationQuestion + ' - ' + SCREENING_A.vaccinationAnswer + ': ' + SCREENING_A.vaccinationNotes
      );
      progressNoteLines.push(SCREENING_A.historyQuestion + ' - ' + SCREENING_A.historyAnswer);
      progressNoteLines.push('ASQ - ' + SCREENING_A.asqAnswer);
      progressNoteLines.push(SCREENING_A.screeningNote);
      await progressNotePage.verifyScreening(progressNoteLines);
    });

    await test.step('Edit screening info', async () => {
      const progressNotePage = await expectInPersonProgressNotePage(page);
      const screeningPage = await progressNotePage.sideMenu().clickScreening();
      await enterScreeningInfo(SCREENING_B, screeningPage);
    });

    await test.step('Verify edited screening info on progress note', async () => {
      const screeningPage = await expectScreeningPage(page);
      const progressNotePage = await screeningPage.sideMenu().clickProgressNote();
      const editedProgressNoteLines = ADDITIONAL_QUESTIONS.map((question) => question.label + ' - No');
      editedProgressNoteLines.push(SCREENING_B.hasBeenSeenQuestion + ' - ' + SCREENING_B.hasBeenSeenAnswer);
      editedProgressNoteLines.push(
        SCREENING_B.vaccinationQuestion + ' - ' + SCREENING_B.vaccinationAnswer + ': ' + SCREENING_B.vaccinationNotes
      );
      editedProgressNoteLines.push(SCREENING_B.historyQuestion + ' - ' + SCREENING_B.historyAnswer);
      editedProgressNoteLines.push('ASQ - ' + SCREENING_B.asqAnswer);
      editedProgressNoteLines.push(SCREENING_B.screeningNote);
      await progressNotePage.verifyScreening(editedProgressNoteLines);
    });
  });

  async function setupPractitioners(page: Page): Promise<void> {
    const progressNotePage = new InPersonProgressNotePage(page);
    const inPersonHeader = new InPersonHeader(page);
    await page.goto(`in-person/${resourceHandler.appointment.id}/progress-note`);
    await inPersonHeader.verifyStatus('pending');
    await inPersonHeader.selectIntakePractitioner();
    await inPersonHeader.selectProviderPractitioner();
    await inPersonHeader.clickSwitchModeButton('provider');
    await progressNotePage.expectLoaded();
  }

  async function enterScreeningInfo(screeningInfo: ScreeningInfo, screeningPage: ScreeningPage): Promise<void> {
    await screeningPage.answerAllAdditionalQuestions(screeningInfo.additionalQuestionsAnswer);
    await screeningPage.selectRadioAnswer(screeningInfo.hasBeenSeenQuestion, screeningInfo.hasBeenSeenAnswer);
    await screeningPage.selectRadioAnswer(screeningInfo.vaccinationQuestion, screeningInfo.vaccinationAnswer);
    await screeningPage.enterVaccinationNote(screeningInfo.vaccinationNotes);
    await screeningPage.selectDropdownAnswer(screeningInfo.historyQuestion, screeningInfo.historyAnswer);
    await screeningPage.selectAsqAnswer(screeningInfo.asqAnswer);
    await screeningPage.enterScreeningNote(screeningInfo.screeningNote);
    await screeningPage.clickAddScreeningNoteButton();
  }
});
