import Oystehr from '@oystehr/sdk';
import { randomUUID } from 'crypto';
import { Claim, Provenance } from 'fhir/r4b';
import { M2MClientMockType } from 'utils/lib/auth/user-me.helper';
import { OkResponse } from 'utils/lib/types/data/billing/billing.types';
import {
  CLAIM_PROVENANCE_ACTIVITY,
  CLAIM_PROVENANCE_AGENT_TYPE,
  CLAIM_PROVENANCE_NOTE_EXTENSION_URL,
} from 'utils/lib/types/data/billing/claim-history';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { addProcessIdMetaTagToResource, setupIntegrationTest } from '../../helpers/integration-test-seed-data-setup';

describe('add-billing-claim-note', () => {
  let billing: Oystehr;
  let caller: Oystehr;
  let callerProfile: string;
  let cleanup: () => Promise<void>;
  let claim: Claim;

  beforeAll(async () => {
    const setup = await setupIntegrationTest(
      'integration/billing/add-billing-claim-note.test.ts',
      M2MClientMockType.provider
    );
    billing = setup.oystehrBilling;
    caller = setup.oystehrTestUserM2M;
    callerProfile = setup.testUserM2MProfile;
    cleanup = setup.cleanup;

    claim = await billing.fhir.create<Claim>(
      addProcessIdMetaTagToResource(
        {
          resourceType: 'Claim',
          status: 'draft',
          use: 'claim',
          type: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/claim-type', code: 'professional' }] },
          patient: { display: 'Note Test Patient' },
          created: '2026-01-01',
          provider: { display: 'Unknown' },
          priority: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/processpriority', code: 'normal' }] },
          insurance: [{ sequence: 1, focal: true, coverage: { display: 'Self-pay' } }],
        },
        setup.processId
      ) as Claim
    );
  }, 60_000);

  afterAll(async () => {
    const provenances = (
      await billing.fhir.search<Provenance>({
        resourceType: 'Provenance',
        params: [{ name: 'target', value: `Claim/${claim.id}` }],
      })
    ).unbundle();
    await Promise.all(
      provenances.map((provenance) =>
        billing.fhir.delete({ resourceType: 'Provenance', id: provenance.id! }).catch(() => undefined)
      )
    );
    await billing.fhir.delete({ resourceType: 'Claim', id: claim.id! }).catch(() => undefined);
    await cleanup();
  }, 60_000);

  it('records the note as a claim-history Provenance by the calling practitioner', async () => {
    const message = `Called the payer ${randomUUID()}`;

    const output = (await caller.zambda.execute({ id: 'add-billing-claim-note', claimId: claim.id, message }))
      .output as OkResponse;

    expect(output).toEqual({ ok: true });
    const provenances = (
      await billing.fhir.search<Provenance>({
        resourceType: 'Provenance',
        params: [{ name: 'target', value: `Claim/${claim.id}` }],
      })
    ).unbundle();
    expect(provenances).toHaveLength(1);
    const [note] = provenances;
    expect(note.target).toEqual([{ reference: `Claim/${claim.id}` }]);
    expect(note.activity?.coding).toEqual([CLAIM_PROVENANCE_ACTIVITY.note]);
    expect(note.extension).toContainEqual({ url: CLAIM_PROVENANCE_NOTE_EXTENSION_URL, valueString: message });
    expect(note.agent).toEqual([
      { type: { coding: [CLAIM_PROVENANCE_AGENT_TYPE.human] }, who: { reference: callerProfile } },
    ]);
    expect(note.entity).toContainEqual({
      role: 'revision',
      what: { reference: `Claim/${claim.id}/_history/${claim.meta?.versionId}` },
    });
  }, 60_000);
});
