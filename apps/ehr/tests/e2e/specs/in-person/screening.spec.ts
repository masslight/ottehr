import { Page, test } from '@playwright/test';
import { DateTime } from 'luxon';
import {
  expectInPersonProgressNotePage,
  InPersonProgressNotePage,
} from 'tests/e2e/page/in-person/InPersonProgressNotePage';
import { expectScreeningPage, ScreeningPage } from 'tests/e2e/page/in-person/ScreeningPage';
import { InPersonHeader } from 'tests/e2e/page/InPersonHeader';
import { ResourceHandler } from 'tests/e2e-utils/resource-handler';
import { baseScreeningQuestionsConfig } from 'utils';

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

  test('Screening Hapy path', async ({ page }) => {
    let screeningPage = await test.step('Fill screening info', async () => {
      const progressNotePage = await expectInPersonProgressNotePage(page);
      const screeningPage = await progressNotePage.sideMenu().clickScreening();
      await enterScreeningInfo(SCREENING_A, screeningPage);
      return await expectScreeningPage(page);
    });

    const progressNotePage = await test.step('Verify screening info on progress note', async () => {
      const progressNotePage = await screeningPage.sideMenu().clickReviewAndSign();
      const progressNoteLines = createProgressNoteLines(SCREENING_A);
      progressNoteLines.push('ASQ - ' + SCREENING_A.asqAnswer);
      progressNoteLines.push(SCREENING_A.screeningNote);
      await progressNotePage.verifyScreening(progressNoteLines);
      return await expectInPersonProgressNotePage(page);
    });

    screeningPage = await test.step('Edit screening info', async () => {
      const screeningPage = await progressNotePage.sideMenu().clickScreening();
      await enterScreeningInfo(SCREENING_B, screeningPage);
      return await expectScreeningPage(page);
    });

    await test.step('Verify edited screening info on progress note', async () => {
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
  await page.goto(`in-person/${resourceHandler.appointment.id}/progress-note`);
  await inPersonHeader.verifyStatus('pending');
  await inPersonHeader.selectIntakePractitioner();
  await inPersonHeader.selectProviderPractitioner();
  await progressNotePage.expectLoaded();
}

async function enterScreeningInfo(screeningInfo: ScreeningInfo, screeningPage: ScreeningPage): Promise<void> {
  for (const field of baseScreeningQuestionsConfig.fields) {
    const answer = field.options?.[screeningInfo.screeningAnswersOption]?.label ?? '';
    if (field.type === 'radio') {
      await screeningPage.selectRadioAnswer(field.question, answer);
    }
    if (field.type === 'select') {
      await screeningPage.selectDropdownAnswer(field.question, answer);
    }
  }
  await screeningPage.enterVaccinationNote(screeningInfo.vaccinationNotes);
  await screeningPage.selectAsqAnswer(screeningInfo.asqAnswer);
  await screeningPage.enterScreeningNote(screeningInfo.screeningNote);
  await screeningPage.clickAddScreeningNoteButton();
}

function createProgressNoteLines(screeningInfo: ScreeningInfo): string[] {
  return baseScreeningQuestionsConfig.fields.map((field) => {
    const answer = field.options?.[screeningInfo.screeningAnswersOption]?.label ?? '';
    if (field.id === 'vaccinations') {
      return field.question + ' - ' + answer + ': ' + screeningInfo.vaccinationNotes;
    } else {
      return field.question + ' - ' + answer;
    }
  });
}
