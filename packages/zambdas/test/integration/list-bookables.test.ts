import Oystehr from '@oystehr/sdk';
import { M2MClientMockType } from 'utils';
import { beforeAll, describe, expect, it } from 'vitest';
import { setupIntegrationTest } from '../helpers/integration-test-seed-data-setup';

// Happy path for list-bookables: public endpoint returning the bookable items
// (locations / groups) for a given service mode.
describe('list-bookables integration — happy path', () => {
  let oystehrPatient: Oystehr;

  beforeAll(async () => {
    const setup = await setupIntegrationTest('list-bookables.test.ts', M2MClientMockType.patient);
    oystehrPatient = setup.oystehrTestUserM2M;
  }, 60_000);

  it('returns a sorted items array for in-person bookables', async () => {
    const response = await oystehrPatient.zambda.executePublic({ id: 'list-bookables', serviceMode: 'in-person' });
    const output = response.output as { items: Array<{ label: string }>; categorized: boolean };
    expect(output).toBeDefined();
    expect(Array.isArray(output.items)).toBe(true);
  });
});
