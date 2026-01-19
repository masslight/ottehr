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
import { ASQKeys, asqLabels, patientScreeningQuestionsConfig } from 'utils';

const resourceHandler = new ResourceHandler(`screening-mutating-${DateTime.now().toMillis()}`);

test.describe('Screening Page mutating tests', () => {
  test.beforeEach(async ({ page }) => {
    await resourceHandler.setResources();
    await resourceHandler.waitTillAppointmentPreprocessed(resourceHandler.appointment.id!);
    await setupPractitioners(page);
  });

  test.afterEach(async () => {
    await resourceHandler.cleanupResources();
  });

  test('Screening Happy path', async ({ page }) => {
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
      // Screening notes are additive - both original and new note should be visible
      editedProgressNoteLines.push(SCREENING_A.screeningNote);
      editedProgressNoteLines.push(SCREENING_B.screeningNote);
      await progressNotePage.verifyScreening(editedProgressNoteLines);
    });
  });
});

interface ScreeningInfo {
  fieldValues: Record<string, any>; // field.id -> value (option index for radio/select, {startDate, endDate} for dateRange, string for text/textarea/noteField)
  asqAnswer: string;
  screeningNote: string;
}

// Helper function to generate test answers from screening questions config
function generateAnswersFromConfig(variant: 'first' | 'second'): Record<string, any> {
  const fieldValues: Record<string, any> = {};
  const askPatientFields = patientScreeningQuestionsConfig.fields.filter((field) => !field.existsInQuestionnaire);
  const suffix = variant === 'first' ? '' : ' edited';

  for (const field of askPatientFields) {
    if (field.type === 'radio' || field.type === 'select') {
      // Safely select option based on what's available
      const options = field.options || [];
      if (options.length === 0) continue;

      // For 'first' variant: select first option, for 'second': select second option or cycle back
      const optionIndex = variant === 'first' ? 0 : Math.min(1, options.length - 1);
      fieldValues[field.id] = optionIndex;

      // Add noteField value if it exists AND it should be visible for the selected option
      if (field.noteField) {
        const selectedOption = options[optionIndex];
        // Only add noteField if:
        // 1. No conditionalValue (always visible, like vaccination_notes)
        // 2. OR selected option's fhirValue matches conditionalValue
        if (!field.noteField.conditionalValue || field.noteField.conditionalValue === selectedOption?.fhirValue) {
          fieldValues[field.noteField.id] = `Test ${field.noteField.label.toLowerCase()}${suffix}`;
        }
      }
    } else if (field.type === 'dateRange') {
      // Use specific dates in the middle of current month - always visible in calendar
      // Different dates for each variant to test edit functionality
      const today = DateTime.now();
      if (variant === 'first') {
        fieldValues[field.id] = {
          startDate: today.set({ day: 20 }),
          endDate: today.set({ day: 23 }),
        };
      } else {
        fieldValues[field.id] = {
          startDate: today.set({ day: 27 }),
          endDate: today.set({ day: 30 }),
        };
      }
    } else if (field.type === 'text' || field.type === 'textarea') {
      // For text/textarea fields, use sample text based on variant
      const suffixNum = variant === 'first' ? '1' : '2';
      fieldValues[field.id] = `Test ${field.type} value ${suffixNum}`;
    }
  }
  return fieldValues;
}

// Helper function to generate complete screening info from config
function generateScreeningInfo(variant: 'first' | 'second'): ScreeningInfo {
  const suffix = variant === 'first' ? '' : ' edited';

  const asqLabel =
    variant === 'first'
      ? asqLabels[ASQKeys.Negative] // 'Negative'
      : asqLabels[ASQKeys.NotOffered]; // 'Not offered'

  return {
    fieldValues: generateAnswersFromConfig(variant),
    asqAnswer: asqLabel,
    screeningNote: `Test screening note${suffix}`,
  };
}

const SCREENING_A: ScreeningInfo = generateScreeningInfo('first');
const SCREENING_B: ScreeningInfo = generateScreeningInfo('second');

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
    // Check if the question exists on the page before filling
    const questionLocator = screeningPage
      .page()
      .getByTestId(dataTestIds.screeningPage.askPatientQuestion)
      .filter({ hasText: field.question });

    const questionExists = await questionLocator.isVisible({ timeout: 2000 }).catch(() => false);

    if (questionExists) {
      const fieldValue = screeningInfo.fieldValues[field.id];

      if (field.type === 'radio' || field.type === 'select') {
        // fieldValue is an option index
        const answer = field.options?.[fieldValue as number]?.label ?? '';
        if (field.type === 'radio') {
          await screeningPage.selectRadioAnswer(field.question, answer);
        } else if (field.type === 'select') {
          await screeningPage.selectDropdownAnswer(field.question, answer);
        }

        // Handle noteField if it exists for this radio/select field
        if (field.noteField) {
          const noteValue = screeningInfo.fieldValues[field.noteField.id];
          if (noteValue && typeof noteValue === 'string') {
            // If noteValue exists in fieldValues, it means noteField MUST be visible
            // (conditionalValue was already checked during data generation)
            // Wait for it to appear - if it doesn't, the test should fail
            const questionLocatorRefreshed = screeningPage
              .page()
              .getByTestId(dataTestIds.screeningPage.askPatientQuestion)
              .filter({ hasText: field.question });
            const noteFieldLocator = questionLocatorRefreshed.getByRole('textbox', { name: field.noteField.label });

            await noteFieldLocator.waitFor({ state: 'visible', timeout: 30_000 });
            await noteFieldLocator.fill(noteValue);
          }
        }
      } else if (field.type === 'dateRange') {
        // fieldValue is {startDate: DateTime, endDate: DateTime}
        const dateRangeValue = fieldValue as { startDate: DateTime; endDate: DateTime };
        if (dateRangeValue?.startDate && dateRangeValue?.endDate) {
          await screeningPage.selectDateRange(field.question, dateRangeValue.startDate, dateRangeValue.endDate);
        }
      } else if (field.type === 'text') {
        // fieldValue is a string
        if (fieldValue) {
          await screeningPage.enterTextAnswer(field.question, fieldValue as string);
        }
      } else if (field.type === 'textarea') {
        // fieldValue is a string
        if (fieldValue) {
          await screeningPage.enterTextareaAnswer(field.question, fieldValue as string);
        }
      }
    } else {
      console.log(`Question "${field.question}" not found, skipping as it's optional`);
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
      const fieldValue = screeningInfo.fieldValues[field.id];

      if (field.type === 'radio' || field.type === 'select') {
        const answer = field.options?.[fieldValue as number]?.label ?? '';
        // Check if there's a noteField with a value that should be visible
        if (field.noteField) {
          const noteValue = screeningInfo.fieldValues[field.noteField.id];
          if (noteValue && typeof noteValue === 'string') {
            const selectedOption = field.options?.[fieldValue as number];
            const shouldShowNoteField =
              !field.noteField.conditionalValue || field.noteField.conditionalValue === selectedOption?.fhirValue;
            if (shouldShowNoteField) {
              return field.question + ' - ' + answer + ': ' + noteValue;
            }
          }
        }
        return field.question + ' - ' + answer;
      } else if (field.type === 'dateRange') {
        const dateRangeValue = fieldValue as { startDate: DateTime; endDate: DateTime };
        if (dateRangeValue?.startDate && dateRangeValue?.endDate) {
          const startDateStr = dateRangeValue.startDate.toFormat('MM/dd/yyyy');
          const endDateStr = dateRangeValue.endDate.toFormat('MM/dd/yyyy');
          return field.question + ' - ' + startDateStr + ' - ' + endDateStr;
        } else {
          // If no dates provided, return empty or skip
          return field.question + ' - ';
        }
      } else if (field.type === 'text' || field.type === 'textarea') {
        // fieldValue is a string
        const textValue = fieldValue as string;
        if (textValue) {
          return field.question + ' - ' + textValue;
        } else {
          return field.question + ' - ';
        }
      } else {
        // For any future field types not yet supported
        console.warn(`Unsupported field type: ${field.type}`);
        return field.question + ' - ';
      }
    })
    .filter((line) => line); // Filter out any empty lines
}
