import { randomUUID } from 'node:crypto';
import Oystehr, { BatchInputDeleteRequest } from '@oystehr/sdk';
import { Claim, DocumentReference, Provenance } from 'fhir/r4b';
import { M2MClientMockType } from 'utils/lib/auth/user-me.helper';
import { AddClaimAttachmentResponse } from 'utils/lib/types/data/billing/billing.types';
import { CLAIM_PROVENANCE_ACTIVITY } from 'utils/lib/types/data/billing/claim-history';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { CLAIM_ATTACHMENT_PATH_PREFIX } from '../../../src/billing/attachments';
import { BILLING_APP_BUCKET } from '../../../src/billing/shared';
import { SECRETS } from '../../data/secrets';
import { addProcessIdMetaTagToResource, setupIntegrationTest } from '../../helpers/integration-test-seed-data-setup';

describe('add-claim-attachment', () => {
  let billing: Oystehr;
  let caller: Oystehr;
  let callerProfile: string;
  let cleanup: () => Promise<void>;
  let claimId: string;
  const documentReferenceIds: string[] = [];

  beforeAll(async () => {
    const setup = await setupIntegrationTest(
      'integration/billing/add-claim-attachment.test.ts',
      M2MClientMockType.provider
    );
    billing = setup.oystehrBilling;
    caller = setup.oystehrTestUserM2M;
    callerProfile = setup.testUserM2MProfile;
    cleanup = setup.cleanup;

    const claim = await billing.fhir.create<Claim>(
      addProcessIdMetaTagToResource(
        {
          resourceType: 'Claim',
          status: 'draft',
          use: 'claim',
          type: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/claim-type', code: 'professional' }] },
          patient: { display: 'Integration Test Patient' },
          created: '2026-01-01',
          provider: { display: 'Unknown' },
          priority: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/processpriority', code: 'normal' }] },
          insurance: [{ sequence: 1, focal: true, coverage: { display: 'Self-pay' } }],
        },
        setup.processId
      ) as Claim
    );
    claimId = claim.id!;
  }, 120_000);

  afterAll(async () => {
    const provenances = (
      await billing.fhir.search<Provenance>({
        resourceType: 'Provenance',
        params: [{ name: 'target', value: `Claim/${claimId}` }],
      })
    ).unbundle();
    await billing.fhir.batch({
      requests: [
        ...provenances.map(
          (provenance): BatchInputDeleteRequest => ({ method: 'DELETE', url: `Provenance/${provenance.id}` })
        ),
        ...documentReferenceIds.map(
          (id): BatchInputDeleteRequest => ({ method: 'DELETE', url: `DocumentReference/${id}` })
        ),
        { method: 'DELETE', url: `Claim/${claimId}` },
      ],
    });
    await cleanup();
  }, 120_000);

  it('records the document on the claim and hands back where to upload it', async () => {
    const name = `Medical records ${randomUUID()}`;
    const output = (
      await caller.zambda.execute({
        id: 'add-claim-attachment',
        claimId,
        name,
        fileName: 'records.pdf',
      })
    ).output as AddClaimAttachmentResponse;
    documentReferenceIds.push(output.documentReferenceId);

    const expectedFolder = `${BILLING_APP_BUCKET(SECRETS.PROJECT_ID)}/${CLAIM_ATTACHMENT_PATH_PREFIX}/${claimId}/`;
    expect(output.uploadUrl).toMatch(/^https:\/\//);

    const documentReference = await billing.fhir.get<DocumentReference>({
      resourceType: 'DocumentReference',
      id: output.documentReferenceId,
    });
    expect(documentReference.status).toBe('current');
    expect(documentReference.context?.related).toEqual([{ reference: `Claim/${claimId}` }]);
    expect(documentReference.content[0].attachment).toMatchObject({ title: name, contentType: 'application/pdf' });
    expect(documentReference.content[0].attachment.url).toContain(`${SECRETS.PROJECT_API}/z3/${expectedFolder}`);
    expect(documentReference.content[0].attachment.url).toMatch(/-records\.pdf$/);

    const claim = await billing.fhir.get<Claim>({ resourceType: 'Claim', id: claimId });
    expect(claim.supportingInfo?.map((info) => info.valueReference?.reference)).toEqual([
      `DocumentReference/${output.documentReferenceId}`,
    ]);

    const history = (
      await billing.fhir.search<Provenance>({
        resourceType: 'Provenance',
        params: [{ name: 'target', value: `Claim/${claimId}` }],
      })
    ).unbundle();
    expect(history).toHaveLength(1);
    expect(history[0].target.map((target) => target.reference)).toEqual([
      `DocumentReference/${output.documentReferenceId}`,
      `Claim/${claimId}`,
    ]);
    expect(history[0].activity?.coding).toContainEqual(CLAIM_PROVENANCE_ACTIVITY.create);
    expect(history[0].agent.map((agent) => agent.who?.reference)).toEqual([callerProfile]);
  }, 60_000);
});
