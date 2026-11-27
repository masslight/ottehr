import { randomUUID } from 'node:crypto';
import Oystehr, { BatchInputDeleteRequest } from '@oystehr/sdk';
import { Claim, DocumentReference, FhirResource, Provenance } from 'fhir/r4b';
import { M2MClientMockType } from 'utils/lib/auth/user-me.helper';
import { CLAIM_PROVENANCE_ACTIVITY } from 'utils/lib/types/data/billing/claim-history';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { CLAIM_ATTACHMENT_PATH_PREFIX, z3UrlFor } from '../../../src/billing/attachments';
import { BILLING_APP_BUCKET } from '../../../src/billing/shared';
import { SECRETS } from '../../data/secrets';
import { addProcessIdMetaTagToResource, setupIntegrationTest } from '../../helpers/integration-test-seed-data-setup';

describe('rename-claim-attachment', () => {
  let billing: Oystehr;
  let caller: Oystehr;
  let callerProfile: string;
  let processId: string;
  let cleanup: () => Promise<void>;
  const deletes: BatchInputDeleteRequest[] = [];
  let claimId: string;
  let documentReferenceId: string;

  const seed = async <T extends FhirResource>(resource: T): Promise<T & { id: string }> => {
    const created = await billing.fhir.create<T>(addProcessIdMetaTagToResource(resource, processId) as T);
    deletes.unshift({ method: 'DELETE', url: `${created.resourceType}/${created.id}` });
    return created as T & { id: string };
  };

  beforeAll(async () => {
    const setup = await setupIntegrationTest(
      'integration/billing/rename-claim-attachment.test.ts',
      M2MClientMockType.provider
    );
    billing = setup.oystehrBilling;
    caller = setup.oystehrTestUserM2M;
    callerProfile = setup.testUserM2MProfile;
    processId = setup.processId;
    cleanup = setup.cleanup;

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
    const documentReference = await seed<DocumentReference>({
      resourceType: 'DocumentReference',
      status: 'current',
      date: '2026-01-01T00:00:00.000Z',
      content: [
        {
          attachment: {
            url: z3UrlFor(SECRETS.PROJECT_API, {
              bucketName: BILLING_APP_BUCKET(SECRETS.PROJECT_ID),
              path: `${CLAIM_ATTACHMENT_PATH_PREFIX}/${claimId}/${randomUUID()}-records.pdf`,
            }),
            contentType: 'application/pdf',
            title: 'Original title',
          },
        },
      ],
      context: { related: [{ reference: `Claim/${claimId}` }] },
    });
    documentReferenceId = documentReference.id;
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
        ...deletes,
      ],
    });
    await cleanup();
  }, 120_000);

  it("renames the claim document and records the rename in the claim's history", async () => {
    const name = `Renamed ${randomUUID()}`;
    const { output } = await caller.zambda.execute({
      id: 'rename-claim-attachment',
      documentReferenceId,
      name,
    });
    expect(output).toEqual({ ok: true });

    const documentReference = await billing.fhir.get<DocumentReference>({
      resourceType: 'DocumentReference',
      id: documentReferenceId,
    });
    expect(documentReference.content[0].attachment.title).toBe(name);
    expect(documentReference.content[0].attachment.url).toMatch(/-records\.pdf$/);

    const history = (
      await billing.fhir.search<Provenance>({
        resourceType: 'Provenance',
        params: [{ name: 'target', value: `Claim/${claimId}` }],
      })
    ).unbundle();
    expect(history).toHaveLength(1);
    expect(history[0].target.map((target) => target.reference)).toEqual([
      `DocumentReference/${documentReferenceId}`,
      `Claim/${claimId}`,
    ]);
    expect(history[0].activity?.coding).toContainEqual(CLAIM_PROVENANCE_ACTIVITY.update);
    expect(history[0].agent.map((agent) => agent.who?.reference)).toEqual([callerProfile]);
  }, 60_000);
});
