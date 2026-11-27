import Oystehr from '@oystehr/sdk';
import { randomUUID } from 'crypto';
import { Claim, FhirResource, Patient } from 'fhir/r4b';
import { M2MClientMockType } from 'utils/lib/auth/user-me.helper';
import { AR_STAGE, CLAIM_STATUS_TAG_SYSTEMS } from 'utils/lib/types/data/billing/claim-status';
import { ClaimsListFilters } from 'utils/lib/types/data/billing/claims-list-view.schemas';
import {
  BillingWorkQueueResponse,
  GetBillingWorkQueuesResponse,
} from 'utils/lib/types/data/billing/work-queue.schemas';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { addProcessIdMetaTagToResource, setupIntegrationTest } from '../../helpers/integration-test-seed-data-setup';

describe('get-billing-work-queues', () => {
  let admin: Oystehr;
  let billing: Oystehr;
  let processId: string;
  let cleanup: () => Promise<void>;

  const unique = randomUUID().slice(0, 8);
  let seeded: FhirResource[] = [];
  const queueIds: string[] = [];
  let allClaimsQueueId: string;
  let patientArQueueId: string;

  const tagged = <T extends FhirResource>(resource: T): T => addProcessIdMetaTagToResource(resource, processId) as T;
  const claimFor = (arStage: string, charge: number): Claim =>
    tagged<Claim>({
      resourceType: 'Claim',
      meta: { tag: [{ system: CLAIM_STATUS_TAG_SYSTEMS.arStage, code: arStage }] },
      status: 'draft',
      use: 'claim',
      type: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/claim-type', code: 'professional' }] },
      patient: { reference: 'urn:uuid:patient' },
      created: '2026-03-01',
      provider: { display: 'Unknown' },
      priority: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/processpriority', code: 'normal' }] },
      insurance: [{ sequence: 1, focal: true, coverage: { display: 'Self-pay' } }],
      total: { value: charge, currency: 'USD' },
    });
  const saveQueue = async (name: string, filters: ClaimsListFilters): Promise<string> => {
    const { queue } = (await billing.zambda.execute({ id: 'save-billing-work-queue', name, filters }))
      .output as BillingWorkQueueResponse;
    queueIds.push(queue.id);
    return queue.id;
  };

  beforeAll(async () => {
    const setup = await setupIntegrationTest(
      'integration/billing/get-billing-work-queues.test.ts',
      M2MClientMockType.provider
    );
    admin = setup.oystehr;
    billing = setup.oystehrBilling;
    processId = setup.processId;
    cleanup = setup.cleanup;

    seeded = (
      await billing.fhir.transaction<FhirResource>({
        requests: [
          {
            method: 'POST',
            url: '/Patient',
            fullUrl: 'urn:uuid:patient',
            resource: tagged<Patient>({
              resourceType: 'Patient',
              name: [{ family: `Queued${unique}`, given: ['Quinn'] }],
            }),
          },
          { method: 'POST', url: '/Claim', resource: claimFor(AR_STAGE.insurancePayer, 100) },
          { method: 'POST', url: '/Claim', resource: claimFor(AR_STAGE.patient, 50.5) },
        ],
      })
    ).entry!.map((entry) => entry.resource!);
    const patient = seeded.find((resource): resource is Patient => resource.resourceType === 'Patient')!;
    const patients = [{ id: patient.id!, name: `Queued${unique}, Quinn` }];

    allClaimsQueueId = await saveQueue(`All claims ${unique}`, { patients });
    patientArQueueId = await saveQueue(`Patient AR ${unique}`, { patients, arStage: [AR_STAGE.patient] });
  }, 90_000);

  afterAll(async () => {
    for (const queueId of queueIds) {
      await billing.zambda
        .execute({ id: 'delete-billing-work-queue', queueId })
        .catch((error) => console.error(`could not delete work queue ${queueId}:`, error));
    }
    await admin.fhir
      .batch({
        requests: seeded
          .reverse()
          .map((resource) => ({ method: 'DELETE' as const, url: `${resource.resourceType}/${resource.id}` })),
      })
      .catch((error) => console.error('get-billing-work-queues cleanup failed:', error));
    await cleanup();
  }, 60_000);

  it('counts the claims each queue holds and their billed total', async () => {
    const { queues } = (await billing.zambda.execute({ id: 'get-billing-work-queues' }))
      .output as GetBillingWorkQueuesResponse;

    const allClaims = queues.find((queue) => queue.id === allClaimsQueueId);
    const patientAr = queues.find((queue) => queue.id === patientArQueueId);
    expect(allClaims).toMatchObject({ name: `All claims ${unique}`, claimCount: 2, charged: 150.5, incomplete: false });
    expect(patientAr).toMatchObject({
      name: `Patient AR ${unique}`,
      filters: { arStage: [AR_STAGE.patient] },
      claimCount: 1,
      charged: 50.5,
      incomplete: false,
    });
  }, 90_000);
});
