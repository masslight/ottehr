import Oystehr from '@oystehr/sdk';
import { randomUUID } from 'crypto';
import { DocumentReference, Organization, Provenance, ServiceRequest, Task } from 'fhir/r4b';
import { M2MClientMockType } from 'utils/lib/auth/user-me.helper';
import {
  LAB_ORDER_TASK,
  OYSTEHR_LAB_GUID_SYSTEM,
  OYSTEHR_LAB_OI_CODE_SYSTEM,
  OYSTEHR_LAB_ORDER_PLACER_ID_SYSTEM,
  PROVENANCE_ACTIVITY_CODING_ENTITY,
} from 'utils/lib/types/data/labs/labs.constants';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  addProcessIdMetaTagToResource,
  InsertFullAppointmentDataBaseResult,
  insertInPersonAppointmentBase,
  setupIntegrationTest,
} from '../helpers/integration-test-seed-data-setup';

describe('delete-lab-order integration', () => {
  let oystehr: Oystehr;
  let oystehrZambdas: Oystehr;
  let cleanup: () => Promise<void>;
  let processId: string;
  let providerProfile: string;
  let base: InsertFullAppointmentDataBaseResult;
  let labOrg: Organization;
  let serviceRequest: ServiceRequest;
  let preSubmissionTask: Task;
  let orderDocument: DocumentReference;

  const tag = <T extends { resourceType: string }>(resource: T): T =>
    addProcessIdMetaTagToResource(resource as any, processId) as unknown as T;

  beforeAll(async () => {
    const setup = await setupIntegrationTest('delete-lab-order.test.ts', M2MClientMockType.provider);
    oystehr = setup.oystehr;
    oystehrZambdas = setup.oystehrTestUserM2M;
    cleanup = setup.cleanup;
    processId = setup.processId;
    providerProfile = setup.testUserM2MProfile;
    base = await insertInPersonAppointmentBase(oystehr, processId);

    labOrg = await oystehr.fhir.create<Organization>(
      tag({
        resourceType: 'Organization',
        name: `IT Lab ${randomUUID().slice(0, 8)}`,
        identifier: [{ system: OYSTEHR_LAB_GUID_SYSTEM, value: randomUUID() }],
      })
    );

    serviceRequest = await oystehr.fhir.create<ServiceRequest>(
      tag({
        resourceType: 'ServiceRequest',
        status: 'draft',
        intent: 'order',
        subject: { reference: `Patient/${base.patient.id}` },
        encounter: { reference: `Encounter/${base.encounter.id}` },
        performer: [{ reference: `Organization/${labOrg.id}` }],
        code: { coding: [{ system: OYSTEHR_LAB_OI_CODE_SYSTEM, code: '005009', display: 'CBC With Differential' }] },
        identifier: [{ system: OYSTEHR_LAB_ORDER_PLACER_ID_SYSTEM, value: randomUUID().slice(0, 18) }],
      })
    );

    [preSubmissionTask, orderDocument] = await Promise.all([
      oystehr.fhir.create<Task>(
        tag({
          resourceType: 'Task',
          status: 'ready',
          intent: 'order',
          code: { coding: [{ system: LAB_ORDER_TASK.system, code: LAB_ORDER_TASK.code.preSubmission }] },
          basedOn: [{ reference: `ServiceRequest/${serviceRequest.id}` }],
          encounter: { reference: `Encounter/${base.encounter.id}` },
          for: { reference: `Patient/${base.patient.id}` },
        })
      ),
      oystehr.fhir.create<DocumentReference>(
        tag({
          resourceType: 'DocumentReference',
          status: 'current',
          subject: { reference: `Patient/${base.patient.id}` },
          content: [{ attachment: { contentType: 'application/pdf', url: 'https://example.com/lab-order.pdf' } }],
          context: { related: [{ reference: `ServiceRequest/${serviceRequest.id}` }] },
        })
      ),
    ]);
  }, 60_000);

  afterAll(async () => {
    if (serviceRequest?.id) {
      const provenances = (
        await oystehr.fhir.search<Provenance>({
          resourceType: 'Provenance',
          params: [{ name: 'target', value: `ServiceRequest/${serviceRequest.id}` }],
        })
      ).unbundle();
      await Promise.all(
        provenances.map((provenance) =>
          oystehr.fhir.delete({ resourceType: 'Provenance', id: provenance.id! }).catch(() => undefined)
        )
      );
    }
    await cleanup();
    if (labOrg?.id) await oystehr.fhir.delete({ resourceType: 'Organization', id: labOrg.id }).catch(() => undefined);
  });

  it('soft-deletes the order and its related resources and records who deleted it', async () => {
    const response = await oystehrZambdas.zambda.execute({
      id: 'delete-lab-order',
      serviceRequestId: serviceRequest.id,
    });
    expect(response.status).toBe(200);
    expect(response.output).toEqual({});

    const [deletedServiceRequest, cancelledTask, retiredDocument, provenances] = await Promise.all([
      oystehr.fhir.get<ServiceRequest>({ resourceType: 'ServiceRequest', id: serviceRequest.id! }),
      oystehr.fhir.get<Task>({ resourceType: 'Task', id: preSubmissionTask.id! }),
      oystehr.fhir.get<DocumentReference>({ resourceType: 'DocumentReference', id: orderDocument.id! }),
      oystehr.fhir
        .search<Provenance>({
          resourceType: 'Provenance',
          params: [{ name: 'target', value: `ServiceRequest/${serviceRequest.id}` }],
        })
        .then((bundle) => bundle.unbundle()),
    ]);

    expect(deletedServiceRequest.status).toBe('revoked');
    expect(cancelledTask.status).toBe('cancelled');
    expect(retiredDocument.status).toBe('entered-in-error');
    expect(provenances).toHaveLength(1);
    expect(provenances[0].activity?.coding?.[0]?.code).toBe(PROVENANCE_ACTIVITY_CODING_ENTITY.deleteOrder.code);
    expect(provenances[0].agent[0].who?.reference).toBe(providerProfile);
    expect(provenances[0].target.map((target) => target.reference)).toEqual(
      expect.arrayContaining([
        `ServiceRequest/${serviceRequest.id}`,
        `Task/${preSubmissionTask.id}`,
        `DocumentReference/${orderDocument.id}`,
      ])
    );
  });
});
