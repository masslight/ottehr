import Oystehr from '@oystehr/sdk';
import { randomUUID } from 'crypto';
import { HealthcareService } from 'fhir/r4b';
import { M2MClientMockType } from 'utils/lib/auth/user-me.helper';
import { INTEGRATION_TEST_TAG_SYSTEM } from 'utils/lib/utils/e2eCleanup';
import { afterAll, assert, beforeAll, describe, expect, it } from 'vitest';
import { setupIntegrationTest } from '../helpers/integration-test-seed-data-setup';

// toggle-group-active flips a Provider group's (HealthcareService) active flag —
// the soft-delete/archive control, separate from admin-update-group.
describe('toggle-group-active', () => {
  let oystehrAdmin: Oystehr;
  let oystehrZambdas: Oystehr;
  let cleanup: () => Promise<void>;
  let processId: string;
  const createdIds: string[] = [];

  beforeAll(async () => {
    const setup = await setupIntegrationTest('toggle-group-active.test.ts', M2MClientMockType.provider);
    oystehrAdmin = setup.oystehr;
    oystehrZambdas = setup.oystehrTestUserM2M;
    cleanup = setup.cleanup;
    processId = setup.processId;
  }, 60_000);

  afterAll(async () => {
    for (const id of createdIds) {
      try {
        await oystehrAdmin.fhir.delete({ resourceType: 'HealthcareService', id });
      } catch {
        // best-effort
      }
    }
    await cleanup();
  });

  const makeGroup = async (): Promise<HealthcareService> => {
    const hs = await oystehrAdmin.fhir.create<HealthcareService>({
      resourceType: 'HealthcareService',
      active: true,
      name: `TGA ${randomUUID().slice(0, 8)}`,
      meta: { tag: [{ system: INTEGRATION_TEST_TAG_SYSTEM, code: `DELETE_ME-${processId}` }] },
    });
    assert(hs.id);
    createdIds.push(hs.id);
    return hs;
  };

  const readActive = async (id: string): Promise<boolean | undefined> =>
    (await oystehrAdmin.fhir.get<HealthcareService>({ resourceType: 'HealthcareService', id })).active;

  it('deactivates then reactivates a group', async () => {
    const group = await makeGroup();

    await oystehrZambdas.zambda.execute({ id: 'toggle-group-active', groupId: group.id, active: false });
    expect(await readActive(group.id!)).toBe(false);

    await oystehrZambdas.zambda.execute({ id: 'toggle-group-active', groupId: group.id, active: true });
    expect(await readActive(group.id!)).toBe(true);
  });

  it('rejects a non-existent group', async () => {
    await expect(
      oystehrZambdas.zambda.execute({ id: 'toggle-group-active', groupId: randomUUID(), active: false })
    ).rejects.toThrow();
  });
});
