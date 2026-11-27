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

describe('delete-claim-attachment', () => {
  let billing: Oystehr;
  let caller: Oystehr;
  let callerProfile: string;
  let processId: string;
  let cleanup: () => Promise<void>;
  const deletes: BatchInputDeleteRequest[] = [];
  let claimId: string;
  let keptDocumentReferenceId: string;
  let deletedDocumentReferenceId: string;

  const seed = async <T extends FhirResource>(resource: T): Promise<T & { id: string }> => {
    const created = await billing.fhir.create<T>(addProcessIdMetaTagToResource(resource, processId) as T);
    deletes.unshift({ method: 'DELETE', url: `${created.resourceType}/${created.id}` });
    return created as T & { id: string };
  };

  const attachment = (title: string): Promise<DocumentReference & { id: string }> =>
    seed<DocumentReference>({
      resourceType: 'DocumentReference',
      status: 'current',
      date: '2026-01-01T00:00:00.000Z',
      content: [
        {
          attachment: {
            url: z3UrlFor(SECRETS.PROJECT_API, {
              bucketName: BILLING_APP_BUCKET(SECRETS.PROJECT_ID),
              path: `${CLAIM_ATTACHMENT_PATH_PREFIX}/${claimId}/${randomUUID()}-${title}.pdf`,
            }),
            contentType: 'application/pdf',
            title,
          },
        },
      ],
      context: { related: [{ reference: `Claim/${claimId}` }] },
    });

  const supportingInfo = (
    sequence: number,
    documentReferenceId: string
  ): NonNullable<Claim['supportingInfo']>[number] => ({
    sequence,
    category: {
      coding: [{ system: 'http://terminology.hl7.org/CodeSystem/claiminformationcategory', code: 'attachment' }],
    },
    valueReference: { reference: `DocumentReference/${documentReferenceId}` },
  });

  beforeAll(async () => {
    const setup = await setupIntegrationTest(
      'integration/billing/delete-claim-attachment.test.ts',
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
    const [deleted, kept] = await Promise.all([attachment('deleted'), attachment('kept')]);
    deletedDocumentReferenceId = deleted.id;
    keptDocumentReferenceId = kept.id;
    await billing.fhir.patch<Claim>({
      resourceType: 'Claim',
      id: claimId,
      operations: [
        {
          op: 'add',
          path: '/supportingInfo',
          value: [supportingInfo(1, deletedDocumentReferenceId), supportingInfo(2, keptDocumentReferenceId)],
        },
      ],
    });
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

  it("takes the document off the claim, removes it and records the deletion in the claim's history", async () => {
    const { output } = await caller.zambda.execute({
      id: 'delete-claim-attachment',
      claimId,
      documentReferenceId: deletedDocumentReferenceId,
    });
    expect(output).toEqual({ deleted: true });

    const remaining = (
      await billing.fhir.search<DocumentReference>({
        resourceType: 'DocumentReference',
        params: [{ name: '_id', value: `${deletedDocumentReferenceId},${keptDocumentReferenceId}` }],
      })
    ).unbundle();
    expect(remaining.map((documentReference) => documentReference.id)).toEqual([keptDocumentReferenceId]);

    const claim = await billing.fhir.get<Claim>({ resourceType: 'Claim', id: claimId });
    expect(claim.supportingInfo).toEqual([supportingInfo(1, keptDocumentReferenceId)]);

    const history = (
      await billing.fhir.search<Provenance>({
        resourceType: 'Provenance',
        params: [{ name: 'target', value: `Claim/${claimId}` }],
      })
    ).unbundle();
    expect(history).toHaveLength(1);
    expect(history[0].target.map((target) => target.reference)).toEqual([
      `DocumentReference/${deletedDocumentReferenceId}`,
      `Claim/${claimId}`,
    ]);
    expect(history[0].activity?.coding).toContainEqual(CLAIM_PROVENANCE_ACTIVITY.delete);
    expect(history[0].agent.map((agent) => agent.who?.reference)).toEqual([callerProfile]);
  }, 60_000);
});
