import { randomUUID } from 'node:crypto';
import Oystehr, { BatchInputDeleteRequest } from '@oystehr/sdk';
import { Basic, Claim, FhirResource, Provenance } from 'fhir/r4b';
import { M2MClientMockType } from 'utils/lib/auth/user-me.helper';
import { CLAIM_TAG_SYSTEM } from 'utils/lib/types/data/billing/billing.constants';
import { CLAIM_PROVENANCE_ACTIVITY } from 'utils/lib/types/data/billing/claim-history';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { TAG_CODE_SYSTEM } from '../../../src/billing/shared';
import { addProcessIdMetaTagToResource, setupIntegrationTest } from '../../helpers/integration-test-seed-data-setup';

describe('tag-billing-claim', () => {
  let billing: Oystehr;
  let caller: Oystehr;
  let callerProfile: string;
  let processId: string;
  let cleanup: () => Promise<void>;
  const deletes: BatchInputDeleteRequest[] = [];
  let claimId: string;
  const tagName = `Integration ${randomUUID()}`;

  const seed = async <T extends FhirResource>(resource: T): Promise<T & { id: string }> => {
    const created = await billing.fhir.create<T>(addProcessIdMetaTagToResource(resource, processId) as T);
    deletes.unshift({ method: 'DELETE', url: `${created.resourceType}/${created.id}` });
    return created as T & { id: string };
  };

  beforeAll(async () => {
    const setup = await setupIntegrationTest(
      'integration/billing/tag-billing-claim.test.ts',
      M2MClientMockType.provider
    );
    billing = setup.oystehrBilling;
    caller = setup.oystehrTestUserM2M;
    callerProfile = setup.testUserM2MProfile;
    processId = setup.processId;
    cleanup = setup.cleanup;

    await seed<Basic>({
      resourceType: 'Basic',
      code: { text: tagName, coding: [{ system: TAG_CODE_SYSTEM, code: 'tag' }] },
    });
    const claim = await seed<Claim>({
      resourceType: 'Claim',
      status: 'draft',
      use: 'claim',
      type: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/claim-type', code: 'professional' }] },
      patient: { display: 'Integration Test Patient' },
      created: '2026-01-01',
      provider: { display: 'Unknown' },
      priority: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/processpriority', code: 'normal' }] },
      insurance: [{ sequence: 1, focal: true, coverage: { display: 'Self-pay' } }],
    });
    claimId = claim.id;
  }, 120_000);

  afterAll(async () => {
    const provenances = (
      await billing.fhir.search<Provenance>({
        resourceType: 'Provenance',
        params: [{ name: 'target', value: `Claim/${claimId}` }],
      })
    ).unbundle();
    const requests: BatchInputDeleteRequest[] = [
      ...provenances.map(
        (provenance): BatchInputDeleteRequest => ({ method: 'DELETE', url: `Provenance/${provenance.id}` })
      ),
      ...deletes,
    ];
    await billing.fhir.batch({ requests });
    await cleanup();
  }, 120_000);

  it('adds a defined tag to the claim and records the change in the claim history', async () => {
    const { output } = await caller.zambda.execute({
      id: 'tag-billing-claim',
      claimId,
      action: 'add',
      tagName,
    });
    expect(output).toEqual({ ok: true });

    const claim = await billing.fhir.get<Claim>({ resourceType: 'Claim', id: claimId });
    expect(claim.meta?.tag).toContainEqual({ system: CLAIM_TAG_SYSTEM, code: tagName });

    const history = (
      await billing.fhir.search<Provenance>({
        resourceType: 'Provenance',
        params: [{ name: 'target', value: `Claim/${claimId}` }],
      })
    ).unbundle();
    expect(history).toHaveLength(1);
    expect(history[0].activity?.coding).toContainEqual(CLAIM_PROVENANCE_ACTIVITY.tagChange);
    expect(history[0].agent.map((agent) => agent.who?.reference)).toEqual([callerProfile]);
  }, 60_000);
});
