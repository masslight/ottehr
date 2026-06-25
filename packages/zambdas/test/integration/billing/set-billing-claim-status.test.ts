import Oystehr from '@oystehr/sdk';
import { Claim } from 'fhir/r4b';
import { AR_STAGE, CLAIM_STATUS_TAG_SYSTEMS, M2MClientMockType } from 'utils';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { setupIntegrationTest } from '../../helpers/integration-test-seed-data-setup';

describe('set-billing-claim-status', () => {
  let oystehr: Oystehr;
  let cleanup: () => Promise<void>;
  const createdClaimIds: string[] = [];

  beforeAll(async () => {
    const setup = await setupIntegrationTest(
      'integration/set-billing-claim-status.test.ts',
      M2MClientMockType.provider
    );
    oystehr = setup.oystehrBilling;
    cleanup = setup.cleanup;
  }, 60_000);

  afterAll(async () => {
    for (const id of createdClaimIds) {
      try {
        await oystehr.fhir.delete({ resourceType: 'Claim', id });
      } catch {
        // best-effort cleanup
      }
    }
    await cleanup();
  });

  it('sets AR Stage to Insurance Payer AR and initializes the insurance progress status', async () => {
    const claim = await oystehr.fhir.create<Claim>({
      resourceType: 'Claim',
      status: 'draft',
      use: 'claim',
      type: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/claim-type', code: 'professional' }] },
      patient: { display: 'Integration Test Patient' },
      created: '2026-01-01',
      provider: { display: 'Unknown' },
      priority: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/processpriority', code: 'normal' }] },
      // Claim.insurance is 1..* in FHIR R4; one display-only entry satisfies the cardinality.
      insurance: [{ sequence: 1, focal: true, coverage: { display: 'Self-pay' } }],
    });
    createdClaimIds.push(claim.id!);

    console.log('colin test fhir api url', oystehr.config.services?.fhirApiUrl);
    console.log('colin test created claim id', claim.id);
    await oystehr.zambda.execute({
      id: 'set-billing-claim-status',
      claimId: claim.id,
      field: 'arStage',
      value: AR_STAGE.insurancePayer,
    });

    const updated = await oystehr.fhir.get<Claim>({ resourceType: 'Claim', id: claim.id! });
    const tags = updated.meta?.tag ?? [];
    expect(tags).toContainEqual({ system: CLAIM_STATUS_TAG_SYSTEMS.arStage, code: AR_STAGE.insurancePayer });
    expect(tags).toContainEqual({ system: CLAIM_STATUS_TAG_SYSTEMS.insuranceArStatus, code: 'created' });
  }, 60_000);
});
