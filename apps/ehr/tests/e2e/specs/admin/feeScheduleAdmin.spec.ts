import Oystehr from '@oystehr/sdk';
import { expect, test } from '@playwright/test';
import { ChargeItemDefinition } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { CPT_CODE_SYSTEM, CPT_MODIFIER_EXTENSION_URL, RCM_TAG_SYSTEM } from 'utils';
import { getAccessTokenFromUserJson } from '../../../e2e-utils/resource-handler';
import { FeeSchedulePage } from '../../page/FeeSchedulePage';

const PROCESS_ID = `feeScheduleAdmin.spec.ts-${DateTime.now().toMillis()}`;

let oystehr: Oystehr;
let feeScheduleId: string;

test.beforeAll(async () => {
  const accessToken = getAccessTokenFromUserJson();
  oystehr = new Oystehr({ accessToken });

  // Create a test fee schedule with one procedure code
  const feeSchedule = await oystehr.fhir.create<ChargeItemDefinition>({
    resourceType: 'ChargeItemDefinition',
    status: 'active',
    url: `http://test.ottehr.com/fee-schedule/${PROCESS_ID}`,
    title: `E2E Test Fee Schedule ${PROCESS_ID}`,
    meta: {
      tag: [{ system: RCM_TAG_SYSTEM, code: 'fee-schedule' }],
    },
    propertyGroup: [
      {
        priceComponent: [
          {
            type: 'base',
            code: { coding: [{ system: CPT_CODE_SYSTEM, code: '99213', display: 'Office Visit Level 3' }] },
            amount: { value: 150, currency: 'USD' },
          },
        ],
      },
      {
        priceComponent: [
          {
            type: 'base',
            code: { coding: [{ system: CPT_CODE_SYSTEM, code: '99214', display: 'Office Visit Level 4' }] },
            amount: { value: 250, currency: 'USD' },
            extension: [{ url: CPT_MODIFIER_EXTENSION_URL, valueCode: '25' }],
          },
        ],
      },
    ],
  });

  feeScheduleId = feeSchedule.id!;
});

test.afterAll(async () => {
  if (feeScheduleId) {
    await oystehr.fhir.delete({ resourceType: 'ChargeItemDefinition', id: feeScheduleId });
  }
});

test.describe('Fee Schedule Admin - Procedure Codes', () => {
  test('prevents adding a duplicate procedure code', async ({ page }) => {
    const feeSchedulePage = new FeeSchedulePage(page);
    await feeSchedulePage.goto(feeScheduleId);
    await feeSchedulePage.waitForProcedureCodesLoaded();

    // Try to add 99213 which already exists
    await feeSchedulePage.clickAddProcedureCode();
    await feeSchedulePage.fillProcedureCodeForm('99213', '300');
    await feeSchedulePage.clickSave();

    // Should show duplicate error
    await feeSchedulePage.expectSnackbar(/already exists/);
  });

  test('prevents adding duplicate code+modifier', async ({ page }) => {
    const feeSchedulePage = new FeeSchedulePage(page);
    await feeSchedulePage.goto(feeScheduleId);
    await feeSchedulePage.waitForProcedureCodesLoaded();

    // Try to add 99214 with modifier 25 which already exists
    await feeSchedulePage.clickAddProcedureCode();
    await feeSchedulePage.fillProcedureCodeForm('99214', '400', '25');
    await feeSchedulePage.clickSave();

    await feeSchedulePage.expectSnackbar(/already exists/);
  });

  test('allows adding same code with different modifier', async ({ page }) => {
    const feeSchedulePage = new FeeSchedulePage(page);
    await feeSchedulePage.goto(feeScheduleId);
    await feeSchedulePage.waitForProcedureCodesLoaded();

    // Add 99213 with modifier 26 (original has no modifier)
    await feeSchedulePage.clickAddProcedureCode();
    await feeSchedulePage.fillProcedureCodeForm('99213', '175', '26');
    await feeSchedulePage.clickSave();

    await feeSchedulePage.expectSnackbar(/added/i);
  });

  test('upload CSV shows preview with delta stats', async ({ page }) => {
    const feeSchedulePage = new FeeSchedulePage(page);
    await feeSchedulePage.goto(feeScheduleId);
    await feeSchedulePage.waitForProcedureCodesLoaded();

    const csvContent = [
      'Procedure Code,Modifier,Amount',
      '99213,,200.00', // changed (was 150)
      '99215,,400.00', // added
    ].join('\n');

    await feeSchedulePage.uploadCsv(csvContent);
    await feeSchedulePage.expectUploadPreviewOpen();

    // Verify delta stats are shown
    await expect(page.getByText(/added/i)).toBeVisible();
    await expect(page.getByText(/changed/i)).toBeVisible();
  });

  test('upload CSV deduplicates rows', async ({ page }) => {
    const feeSchedulePage = new FeeSchedulePage(page);
    await feeSchedulePage.goto(feeScheduleId);
    await feeSchedulePage.waitForProcedureCodesLoaded();

    const csvContent = [
      'Procedure Code,Modifier,Amount',
      '99216,,100.00',
      '99216,,200.00', // duplicate
      '99217,,300.00',
    ].join('\n');

    await feeSchedulePage.uploadCsv(csvContent);

    // Should show warning about removed duplicates
    await feeSchedulePage.expectSnackbar(/duplicate/i);

    // Preview should show 2 codes, not 3
    await feeSchedulePage.expectUploadPreviewOpen();
    await expect(page.getByText(/2/)).toBeVisible();
  });

  test('search filters procedure codes', async ({ page }) => {
    const feeSchedulePage = new FeeSchedulePage(page);
    await feeSchedulePage.goto(feeScheduleId);
    await feeSchedulePage.waitForProcedureCodesLoaded();

    await feeSchedulePage.searchProcedureCodes('99213');

    // Should show filtered count text
    await expect(page.getByText(/showing \d+ of \d+ codes/i)).toBeVisible({ timeout: 5000 });
  });
});
