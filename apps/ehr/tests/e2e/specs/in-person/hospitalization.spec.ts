import { Page, test } from '@playwright/test';
import { DateTime } from 'luxon';
import { HospitalizationOptions } from 'src/features/visits/in-person/components/hospitalization/hospitalizationOptions';
import { expectHospitalizationPage } from 'tests/e2e/page/HospitalizationPage';
import {
  expectInPersonProgressNotePage,
  InPersonProgressNotePage,
} from 'tests/e2e/page/in-person/InPersonProgressNotePage';
import { InPersonHeader } from 'tests/e2e/page/InPersonHeader';
import { ResourceHandler } from 'tests/e2e-utils/resource-handler';

const resourceHandler = new ResourceHandler(`screening-mutating-${DateTime.now().toMillis()}`);

const HOSPITALIZATION_REASON_1 = HospitalizationOptions[0].display;
const HOSPITALIZATION_REASON_2 = HospitalizationOptions[1].display;
const HOSPITALIZATION_NOTE = 'Test hospitalization note';
const HOSPITALIZATION_NOTE_EDITED = 'Test medication note edited';

test.describe('Hospitalization Page mutating tests', () => {
  test.beforeEach(async ({ page }) => {
    await resourceHandler.setResources();
    await resourceHandler.waitTillAppointmentPreprocessed(resourceHandler.appointment.id!);
    await setupPractitioners(page);
  });

  test.afterEach(async () => {
    await resourceHandler.cleanupResources();
  });

  test('HSP-1 Hospitalization happy path', async ({ page }) => {
    let hospitalizationPage =
      await test.step('HSP-1.1 Add few hospitalizations, verify hospitalizations are present in Hospitalization container', async () => {
        const progressNotePage = await expectInPersonProgressNotePage(page);
        const hospitalizationPage = await progressNotePage.sideMenu().clickHospitalization();
        await hospitalizationPage.selectHospitalization(HOSPITALIZATION_REASON_1);
        await hospitalizationPage.verifyHospitalization(HOSPITALIZATION_REASON_1);
        await hospitalizationPage.selectHospitalization(HOSPITALIZATION_REASON_2);
        await hospitalizationPage.verifyHospitalization(HOSPITALIZATION_REASON_1);
        await hospitalizationPage.verifyHospitalization(HOSPITALIZATION_REASON_2);
        return await expectHospitalizationPage(page);
      });

    let progressNotePage = await test.step('HSP-1.2 Verify hospitalizations info on Progress note', async () => {
      const progressNotePage = await hospitalizationPage.sideMenu().clickReviewAndSign();
      await progressNotePage.verifyHospitalization(HOSPITALIZATION_REASON_1);
      await progressNotePage.verifyHospitalization(HOSPITALIZATION_REASON_2);

      return await expectInPersonProgressNotePage(page);
    });

    await test.step('HSP-1.3 Delete hospitalizations and check they are removed from  Hospitalizations container', async () => {
      hospitalizationPage = await progressNotePage.sideMenu().clickHospitalization();
      await hospitalizationPage.clickDeleteButton(HOSPITALIZATION_REASON_1);
      await hospitalizationPage.verifyHospitalization(HOSPITALIZATION_REASON_2);
      await hospitalizationPage.verifyRemovedHospitalizationIsNotVisible(HOSPITALIZATION_REASON_1);
      await hospitalizationPage.clickDeleteButton(HOSPITALIZATION_REASON_2);
      await hospitalizationPage.verifyRemovedHospitalizationIsNotVisible(HOSPITALIZATION_REASON_1);
      await hospitalizationPage.verifyRemovedHospitalizationIsNotVisible(HOSPITALIZATION_REASON_2);
    });

    await test.step('HSP-1.4 Check deleted hospitalizations are not present on Progress note', async () => {
      progressNotePage = await hospitalizationPage.sideMenu().clickReviewAndSign();
      await progressNotePage.verifyRemovedHospitalizationIsNotShown(HOSPITALIZATION_REASON_1);
      await progressNotePage.verifyRemovedHospitalizationIsNotShown(HOSPITALIZATION_REASON_2);
    });

    await test.step('HSP-1.5 Add hospitalization note, check it is present on Hospitalizations page and on Progress note', async () => {
      hospitalizationPage = await progressNotePage.sideMenu().clickHospitalization();
      await hospitalizationPage.enterHospitalizationNote(HOSPITALIZATION_NOTE);
      await hospitalizationPage.clickAddHospitalizationNoteButton();
      await hospitalizationPage.verifyHospitalizationNote(HOSPITALIZATION_NOTE);
      progressNotePage = await hospitalizationPage.sideMenu().clickReviewAndSign();
      await progressNotePage.verifyHospitalizationNote(HOSPITALIZATION_NOTE);
    });

    await test.step('HSP-1.6 Edit hospitalization note, check edited note is present on Hospitalizations page and on Progress note', async () => {
      hospitalizationPage = await progressNotePage.sideMenu().clickHospitalization();
      const editDialog = await hospitalizationPage.clickEditNoteButton(HOSPITALIZATION_NOTE);
      await editDialog.verifyTitle('Edit Hospitalization Note');
      await editDialog.clearNote();
      await editDialog.enterNote(HOSPITALIZATION_NOTE_EDITED);
      await editDialog.clickProceedButton();
      await hospitalizationPage.verifyHospitalizationNote(HOSPITALIZATION_NOTE_EDITED);
      progressNotePage = await hospitalizationPage.sideMenu().clickReviewAndSign();
      await progressNotePage.verifyHospitalizationNote(HOSPITALIZATION_NOTE_EDITED);
    });

    await test.step('HSP-1.7 Remove hospitalization note, check note is removed from Hospitalizations page and from Progress note', async () => {
      hospitalizationPage = await progressNotePage.sideMenu().clickHospitalization();
      const deleteDialog = await hospitalizationPage.clickDeleteNoteButton(HOSPITALIZATION_NOTE_EDITED);
      await deleteDialog.verifyTitle('Delete hospitalization note');
      await deleteDialog.verifyModalContent('Are you sure you want to permanently delete this hospitalization note?');
      await deleteDialog.verifyModalContent(HOSPITALIZATION_NOTE_EDITED);
      await deleteDialog.clickProceedButton();

      await hospitalizationPage.verifyRemovedHospitalizationNoteIsNotVisible(HOSPITALIZATION_NOTE_EDITED);
      progressNotePage = await hospitalizationPage.sideMenu().clickReviewAndSign();
      await progressNotePage.verifyRemovedHospitalizationNoteIsNotShown(HOSPITALIZATION_NOTE_EDITED);
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
