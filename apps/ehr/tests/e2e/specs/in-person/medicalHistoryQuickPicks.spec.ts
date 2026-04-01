import { BrowserContext, expect, Page, test } from '@playwright/test';
import { DateTime } from 'luxon';
import { dataTestIds } from 'src/constants/data-test-ids';
import { InPersonHeader } from 'tests/e2e/page/InPersonHeader';
import { openOrderMedicationPage } from 'tests/e2e/page/OrderMedicationPage';
import { SideMenu } from 'tests/e2e/page/SideMenu';
import { MEDICAL_HISTORY_CONFIG } from 'utils';
import { ResourceHandler } from '../../../e2e-utils/resource-handler';

const PROCESS_ID = `medicalHistoryQuickPicks.spec.ts-${DateTime.now().toMillis()}`;
const resourceHandler = new ResourceHandler(PROCESS_ID, 'in-person');

const ALLERGY_QUICK_PICK = MEDICAL_HISTORY_CONFIG.allergies.quickPicks[0];
const MEDICAL_CONDITION_QUICK_PICK =
  MEDICAL_HISTORY_CONFIG.medicalConditions.quickPicks.find(
    (quickPick): quickPick is { display: string; code: string } => 'code' in quickPick
  ) ?? MEDICAL_HISTORY_CONFIG.medicalConditions.quickPicks[0];

const getMedicalConditionQuickPickMenuLabel = (): string => {
  if ('code' in MEDICAL_CONDITION_QUICK_PICK) {
    return `${MEDICAL_CONDITION_QUICK_PICK.code} ${MEDICAL_CONDITION_QUICK_PICK.display}`;
  }
  return MEDICAL_CONDITION_QUICK_PICK.display;
};

const MEDICATION_QUICK_PICK = MEDICAL_HISTORY_CONFIG.medications.quickPicks[0];

const getMedicalConditionLabel = (
  quickPick: (typeof MEDICAL_HISTORY_CONFIG.medicalConditions.quickPicks)[number]
): string => {
  if ('code' in quickPick) {
    return `${quickPick.code} ${quickPick.display}`;
  }
  return quickPick.display;
};

const getMedicationQuickPickLabel = (
  quickPick: (typeof MEDICAL_HISTORY_CONFIG.medications.quickPicks)[number]
): string => {
  return `${quickPick.name}${quickPick.strength ? ` (${quickPick.strength})` : ''}`;
};

test.describe('Medical history quick picks from config', () => {
  test.describe.configure({ mode: 'serial' });

  let context: BrowserContext;
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    await resourceHandler.setResources();
    await resourceHandler.waitTillAppointmentPreprocessed(resourceHandler.appointment.id!);

    context = await browser.newContext();
    page = await context.newPage();

    await openVisit(page);
  });

  test.afterAll(async () => {
    await page.close();
    await context.close();
    await resourceHandler.cleanupResources();
  });

  test('allergies quick pick from config appears and can be applied', async () => {
    const sideMenu = new SideMenu(page);
    await sideMenu.clickAllergies();

    const quickPicksButton = page.getByRole('button', { name: 'Quick Picks' });
    if (MEDICAL_HISTORY_CONFIG.allergies.quickPicks.length === 0) {
      await expect(quickPicksButton).not.toBeVisible();
      return;
    }

    await expect(quickPicksButton).toBeVisible();
    await quickPicksButton.click();
    for (const quickPick of MEDICAL_HISTORY_CONFIG.allergies.quickPicks) {
      await expect(page.getByRole('menuitem', { name: quickPick.name, exact: true })).toBeVisible();
    }
    await expect(page.getByRole('menuitem', { name: ALLERGY_QUICK_PICK.name, exact: true })).toBeVisible();

    await page.getByRole('menuitem', { name: ALLERGY_QUICK_PICK.name, exact: true }).click();

    const allergiesList = page.getByTestId(dataTestIds.allergies.knownAllergiesList);
    await expect(allergiesList).toBeVisible();
    await expect(allergiesList).toContainText(ALLERGY_QUICK_PICK.name);
  });

  test('medical condition quick pick from config appears and can be applied', async () => {
    const sideMenu = new SideMenu(page);
    await sideMenu.clickMedicalConditions();

    const quickPicksButton = page.getByRole('button', { name: 'Quick Picks' });
    if (MEDICAL_HISTORY_CONFIG.medicalConditions.quickPicks.length === 0) {
      await expect(quickPicksButton).not.toBeVisible();
      return;
    }

    await expect(quickPicksButton).toBeVisible();
    const expectedQuickPickMenuLabel = getMedicalConditionQuickPickMenuLabel();

    await quickPicksButton.click();
    for (const quickPick of MEDICAL_HISTORY_CONFIG.medicalConditions.quickPicks) {
      await expect(
        page.getByRole('menuitem', { name: getMedicalConditionLabel(quickPick), exact: true })
      ).toBeVisible();
    }
    await expect(page.getByRole('menuitem', { name: expectedQuickPickMenuLabel, exact: true })).toBeVisible();

    await page.getByRole('menuitem', { name: expectedQuickPickMenuLabel, exact: true }).click();

    const conditionsList = page.getByTestId(dataTestIds.medicalConditions.medicalConditionsList);
    await expect(conditionsList).toBeVisible();
    await expect(conditionsList).toContainText(MEDICAL_CONDITION_QUICK_PICK.display);
  });

  test('medications quick pick visibility follows config and selected value is shown in the form', async () => {
    const sideMenu = new SideMenu(page);
    await sideMenu.clickMedications();

    const quickPicksButton = page.getByRole('button', { name: 'Quick Picks' });
    if (MEDICAL_HISTORY_CONFIG.medications.quickPicks.length === 0) {
      await expect(quickPicksButton).not.toBeVisible();
      return;
    }

    await expect(quickPicksButton).toBeVisible();
    await quickPicksButton.click();

    for (const quickPick of MEDICAL_HISTORY_CONFIG.medications.quickPicks) {
      await expect(
        page.getByRole('menuitem', { name: getMedicationQuickPickLabel(quickPick), exact: true })
      ).toBeVisible();
    }

    const medicationQuickPickLabel = getMedicationQuickPickLabel(MEDICATION_QUICK_PICK);
    const medicationQuickPickOption = page.getByRole('menuitem', { name: medicationQuickPickLabel, exact: true });
    await expect(medicationQuickPickOption).toBeVisible();
    await medicationQuickPickOption.click();

    await expect(page.getByTestId(dataTestIds.telemedEhrFlow.hpiCurrentMedicationsInput).locator('input')).toHaveValue(
      medicationQuickPickLabel
    );
  });

  test('in-house medication quick pick visibility and selected values are shown in order form', async () => {
    const orderMedicationPage = await openOrderMedicationPage(resourceHandler.appointment.id!, page);
    await orderMedicationPage.editMedicationCard.waitForLoadAssociatedDx();
    await orderMedicationPage.editMedicationCard.waitForLoadOrderedBy();

    const quickPicksButton = page.getByRole('button', { name: 'Quick Picks' });
    if (MEDICAL_HISTORY_CONFIG.inHouseMedications.quickPicks.length === 0) {
      await expect(quickPicksButton).not.toBeVisible();
      return;
    }

    await expect(quickPicksButton).toBeVisible();
    await quickPicksButton.click();

    for (const quickPick of MEDICAL_HISTORY_CONFIG.inHouseMedications.quickPicks) {
      const baseLabel =
        quickPick.dose != null && quickPick.units != null
          ? `${quickPick.name}, ${quickPick.dose} ${quickPick.units}`
          : quickPick.name;
      await expect(
        page.getByRole('menuitem', { name: new RegExp(`^${escapeRegExp(baseLabel)}(?:, .+)?$`) })
      ).toBeVisible();
    }

    const firstQuickPickOption = page.getByRole('menuitem').first();
    await expect(firstQuickPickOption).toBeVisible();

    const selectedQuickPickLabel = (await firstQuickPickOption.textContent())?.trim() ?? '';
    await firstQuickPickOption.click();

    await expect(
      page.getByTestId(dataTestIds.orderMedicationPage.inputField('medicationId')).locator('input')
    ).not.toHaveValue('');

    const selectedFromConfig = MEDICAL_HISTORY_CONFIG.inHouseMedications.quickPicks.find(
      (quickPick) =>
        selectedQuickPickLabel.includes(quickPick.name) &&
        (quickPick.dose == null || selectedQuickPickLabel.includes(String(quickPick.dose)))
    );

    if (selectedFromConfig?.dose != null) {
      await expect(page.getByTestId(dataTestIds.orderMedicationPage.inputField('dose')).locator('input')).toHaveValue(
        String(selectedFromConfig.dose)
      );
    }

    if (selectedFromConfig?.units != null) {
      await expect(page.getByTestId(dataTestIds.orderMedicationPage.inputField('units'))).toContainText(
        selectedFromConfig.units
      );
    }

    if (selectedFromConfig?.instructions != null) {
      await expect(
        page.getByTestId(dataTestIds.orderMedicationPage.inputField('instructions')).locator('textarea:visible')
      ).toHaveValue(selectedFromConfig.instructions);
    }
  });
});

async function openVisit(page: Page): Promise<void> {
  await page.goto(`in-person/${resourceHandler.appointment.id}`);
  const inPersonHeader = new InPersonHeader(page);
  await inPersonHeader.selectIntakePractitioner();
  await inPersonHeader.selectProviderPractitioner();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
