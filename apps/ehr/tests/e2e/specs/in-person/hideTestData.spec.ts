import { expect, test } from '@playwright/test';
import { DateTime } from 'luxon';
import { ENV_LOCATION_NAME } from '../../../e2e-utils/resource/constants';
import { ResourceHandler } from '../../../e2e-utils/resource-handler';
import { openVisitsPage } from '../../page/VisitsPage';

// Proves the production-safe smoke-test cleanup: instead of deleting test data, we reversibly hide
// it by tagging the appointment, and the EHR tracking board filters those tagged appointments out.
// This is the behavior that lets the full e2e suite run as a @smoke test against production.
test.describe('Hidden test data is removed from the tracking board', { tag: '@smoke' }, () => {
  const PROCESS_ID = `hideTestData.spec.ts-${DateTime.now().toMillis()}`;
  const resourceHandler = new ResourceHandler(PROCESS_ID, 'in-person');

  test.beforeAll(async () => {
    await resourceHandler.setResources({ skipPaperwork: true });
  });

  test.afterAll(async () => {
    // Hides the appointment everywhere; only hard-deletes when ALLOW_HARD_DELETE is set.
    await resourceHandler.cleanupResources();
  });

  test('a visit shows on the tracking board, then disappears once hidden', async ({ page }) => {
    expect(ENV_LOCATION_NAME, 'LOCATION env var must be set for this test').toBeTruthy();
    const appointmentId = resourceHandler.appointment.id!;

    // 1. The freshly-created visit is visible on the tracking board.
    const visitsPage = await openVisitsPage(page);
    await visitsPage.selectLocation(ENV_LOCATION_NAME!);
    await visitsPage.clickPrebookedTab();
    await visitsPage.verifyVisitPresent(appointmentId);

    // 2. Hide it the same way production smoke-test cleanup does (add the hidden tag, delete nothing).
    await resourceHandler.hideResources();

    // 3. After reloading the board, the hidden visit is gone — without having deleted anything.
    const reloadedVisitsPage = await openVisitsPage(page);
    await reloadedVisitsPage.selectLocation(ENV_LOCATION_NAME!);
    await reloadedVisitsPage.clickPrebookedTab();
    await reloadedVisitsPage.verifyVisitNotPresent(appointmentId);
  });
});
