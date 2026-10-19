import Oystehr from '@oystehr/sdk';
import { randomUUID } from 'crypto';
import { ChargeItemDefinition } from 'fhir/r4b';
import { M2MClientMockType } from 'utils/lib/auth/user-me.helper';
import { APIErrorCode } from 'utils/lib/types/errors';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { setupIntegrationTest } from '../helpers/integration-test-seed-data-setup';

// Happy path for get-version-history: return the FHIR version history for a
// ChargeItemDefinition (fee schedule). A fresh fee schedule is created in setup
// and removed afterwards.
describe('get-version-history integration — happy path', () => {
  let oystehrAdmin: Oystehr;
  let oystehrZambdas: Oystehr;
  let cleanup: () => Promise<void>;
  let feeScheduleId: string;

  beforeAll(async () => {
    const setup = await setupIntegrationTest('get-version-history.test.ts', M2MClientMockType.provider);
    oystehrAdmin = setup.oystehr;
    oystehrZambdas = setup.oystehrTestUserM2M;
    cleanup = setup.cleanup;
    const created = await oystehrZambdas.zambda.execute({
      id: 'create-fee-schedule',
      name: `IT Fee Schedule ${randomUUID().slice(0, 8)}`,
      effectiveDate: '2026-01-01',
    });
    feeScheduleId = (created.output as { id: string }).id;
    for (const code of ['99213', '99214']) {
      await oystehrZambdas.zambda.execute({ id: 'add-procedure-code', feeScheduleId, code, amount: 100 });
    }
  }, 90_000);

  afterAll(async () => {
    try {
      await oystehrAdmin.fhir.delete({ resourceType: 'ChargeItemDefinition', id: feeScheduleId });
    } catch {
      // best-effort
    }
    await cleanup();
  });

  const listVersions = async (): Promise<{ versions: Array<{ versionId: string; timestamp: string }> }> => {
    let output: { versions: Array<{ versionId: string; timestamp: string }> } | undefined;
    await vi.waitFor(
      async () => {
        const response = await oystehrZambdas.zambda.execute({ id: 'get-version-history', resourceId: feeScheduleId });
        output = response.output as { versions: Array<{ versionId: string; timestamp: string }> };
      },
      { timeout: 60_000, interval: 3_000 }
    );
    return output!;
  };

  it('returns version history for a fee schedule', async () => {
    const output = await listVersions();

    expect(Object.keys(output)).toEqual(['versions']);
    expect(output.versions).toHaveLength(3);
    for (const version of output.versions) {
      expect(Object.keys(version).sort()).toEqual(['timestamp', 'versionId']);
    }
    const times = output.versions.map((v) => new Date(v.timestamp).getTime());
    expect(times).toEqual([...times].sort((a, b) => b - a));

    const current = await oystehrAdmin.fhir.get<ChargeItemDefinition>({
      resourceType: 'ChargeItemDefinition',
      id: feeScheduleId,
    });
    expect(output.versions[0].versionId).toBe(current.meta?.versionId);
  });

  it('returns exactly one selected historical version', async () => {
    const { versions } = await listVersions();
    const oldest = versions[versions.length - 1];

    const response = await oystehrZambdas.zambda.execute({
      id: 'get-charge-item-definition-version',
      resourceId: feeScheduleId,
      versionId: oldest.versionId,
    });
    const resource = response.output as ChargeItemDefinition;

    expect(resource.id).toBe(feeScheduleId);
    expect(resource.meta?.versionId).toBe(oldest.versionId);
    expect(resource.meta?.lastUpdated).toBeDefined();
    expect(resource.propertyGroup ?? []).toHaveLength(0);
  });

  it('reports an unknown historical version as not found', async () => {
    let caught: unknown;
    try {
      await oystehrZambdas.zambda.execute({
        id: 'get-charge-item-definition-version',
        resourceId: feeScheduleId,
        versionId: randomUUID(),
      });
    } catch (error) {
      caught = error;
    }
    expect((caught as { code?: number } | undefined)?.code).toBe(APIErrorCode.FHIR_RESOURCE_NOT_FOUND);
  });
});
