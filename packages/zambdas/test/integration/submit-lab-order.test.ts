import Oystehr from '@oystehr/sdk';
import { randomUUID } from 'crypto';
import { DocumentReference, Location, Organization, Practitioner, Provenance, ServiceRequest, Task } from 'fhir/r4b';
import { M2MClientMockType } from 'utils/lib/auth/user-me.helper';
import { FHIR_IDENTIFIER_NPI } from 'utils/lib/fhir/constants';
import {
  FHIR_IDC10_VALUESET_SYSTEM,
  LAB_ACCOUNT_NUMBER_SYSTEM,
  LAB_ORDER_DOC_REF_CODING_CODE,
  LAB_ORDER_TASK,
  OYSTEHR_LAB_GUID_SYSTEM,
  OYSTEHR_LAB_OI_CODE_SYSTEM,
  OYSTEHR_LAB_ORDER_PLACER_ID_SYSTEM,
  PROVENANCE_ACTIVITY_CODING_ENTITY,
} from 'utils/lib/types/data/labs/labs.constants';
import { SubmitLabOrderOutput } from 'utils/lib/types/data/labs/labs.types';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { index } from '../../src/ehr/lab/external/submit-lab-order/index';
import {
  addProcessIdMetaTagToResource,
  InsertFullAppointmentDataBaseResult,
  insertInPersonAppointmentBase,
  setupIntegrationTest,
} from '../helpers/integration-test-seed-data-setup';
import { invokeZambdaHandler } from '../helpers/invoke-zambda-handler';

const z3Location = (z3Url: string): { bucketName: string; 'objectPath+': string } => {
  const [bucketName, ...objectPath] = z3Url.split('/z3/')[1].split('/');
  return { bucketName, 'objectPath+': objectPath.join('/') };
};

describe('submit-lab-order integration', () => {
  let oystehr: Oystehr;
  let token: string;
  let cleanup: () => Promise<void>;
  let processId: string;
  let providerProfile: string;
  let base: InsertFullAppointmentDataBaseResult;
  let labOrg: Organization;
  let orderingProvider: Practitioner;
  let orderingLocation: Location;
  let serviceRequest: ServiceRequest;
  const accountNumber = `IT-${randomUUID().slice(0, 8)}`;
  const orderNumber = randomUUID().replace(/-/g, '').slice(0, 18);
  const orderSubmit = vi.spyOn(Object.getPrototypeOf(new Oystehr({}).lab) as Oystehr['lab'], 'orderSubmit');

  const tag = <T extends { resourceType: string }>(resource: T): T =>
    addProcessIdMetaTagToResource(resource as any, processId) as unknown as T;

  const findProvenances = async (): Promise<Provenance[]> =>
    (
      await oystehr.fhir.search<Provenance>({
        resourceType: 'Provenance',
        params: [{ name: 'target', value: `ServiceRequest/${serviceRequest.id}` }],
      })
    ).unbundle();

  const findOrderDocuments = async (): Promise<DocumentReference[]> =>
    (
      await oystehr.fhir.search<DocumentReference>({
        resourceType: 'DocumentReference',
        params: [{ name: 'related', value: `ServiceRequest/${serviceRequest.id}` }],
      })
    ).unbundle();

  beforeAll(async () => {
    const setup = await setupIntegrationTest('submit-lab-order.test.ts', M2MClientMockType.provider);
    oystehr = setup.oystehr;
    token = setup.testUserM2MToken;
    cleanup = setup.cleanup;
    processId = setup.processId;
    providerProfile = setup.testUserM2MProfile;
    base = await insertInPersonAppointmentBase(oystehr, processId);

    [labOrg, orderingProvider] = await Promise.all([
      oystehr.fhir.create<Organization>(
        tag({
          resourceType: 'Organization',
          name: `IT Lab ${randomUUID().slice(0, 8)}`,
          identifier: [{ system: OYSTEHR_LAB_GUID_SYSTEM, value: randomUUID() }],
        })
      ),
      oystehr.fhir.create<Practitioner>(
        tag({
          resourceType: 'Practitioner',
          name: [{ given: ['Ordering'], family: 'Provider' }],
          identifier: [{ system: FHIR_IDENTIFIER_NPI, value: '1234567893' }],
        })
      ),
    ]);

    orderingLocation = await oystehr.fhir.create<Location>(
      tag({
        resourceType: 'Location',
        status: 'active',
        name: `IT Lab Ordering Location ${randomUUID().slice(0, 8)}`,
        identifier: [
          {
            system: LAB_ACCOUNT_NUMBER_SYSTEM,
            value: accountNumber,
            assigner: { reference: `Organization/${labOrg.id}` },
          },
        ],
      })
    );

    serviceRequest = await oystehr.fhir.create<ServiceRequest>(
      tag({
        resourceType: 'ServiceRequest',
        status: 'draft',
        intent: 'order',
        priority: 'routine',
        authoredOn: new Date().toISOString(),
        subject: { reference: `Patient/${base.patient.id}` },
        encounter: { reference: `Encounter/${base.encounter.id}` },
        requester: { reference: `Practitioner/${orderingProvider.id}` },
        performer: [{ reference: `Organization/${labOrg.id}` }],
        locationReference: [{ type: 'Location', reference: `Location/${orderingLocation.id}` }],
        identifier: [{ system: OYSTEHR_LAB_ORDER_PLACER_ID_SYSTEM, value: orderNumber }],
        code: { coding: [{ system: OYSTEHR_LAB_OI_CODE_SYSTEM, code: '005009', display: 'CBC With Differential' }] },
        reasonCode: [
          {
            coding: [{ system: FHIR_IDC10_VALUESET_SYSTEM, code: 'R53.83', display: 'Other fatigue' }],
            text: 'Other fatigue',
          },
        ],
        instantiatesCanonical: ['#activityDefinitionId'],
        contained: [
          {
            resourceType: 'ActivityDefinition',
            id: 'activityDefinitionId',
            status: 'unknown',
            kind: 'ServiceRequest',
            publisher: labOrg.name,
            code: {
              coding: [{ system: OYSTEHR_LAB_OI_CODE_SYSTEM, code: '005009', display: 'CBC With Differential' }],
            },
          },
        ],
      })
    );

    await oystehr.fhir.create<Task>(
      tag({
        resourceType: 'Task',
        status: 'completed',
        intent: 'order',
        code: { coding: [{ system: LAB_ORDER_TASK.system, code: LAB_ORDER_TASK.code.preSubmission }] },
        basedOn: [{ reference: `ServiceRequest/${serviceRequest.id}` }],
        encounter: { reference: `Encounter/${base.encounter.id}` },
        for: { reference: `Patient/${base.patient.id}` },
      })
    );
  }, 60_000);

  afterAll(async () => {
    orderSubmit.mockRestore();
    if (serviceRequest?.id) {
      const [provenances, documents] = await Promise.all([findProvenances(), findOrderDocuments()]);
      await Promise.all([
        ...provenances.map((provenance) =>
          oystehr.fhir.delete({ resourceType: 'Provenance', id: provenance.id! }).catch(() => undefined)
        ),
        ...documents.flatMap((document) =>
          document.content
            .map((content) => content.attachment.url)
            .filter((url): url is string => !!url?.includes('/z3/'))
            .map((url) => oystehr.z3.deleteObject(z3Location(url)).catch(() => undefined))
        ),
      ]);
    }
    await cleanup();
    await Promise.all(
      [
        orderingLocation?.id && { resourceType: 'Location' as const, id: orderingLocation.id },
        orderingProvider?.id && { resourceType: 'Practitioner' as const, id: orderingProvider.id },
      ]
        .filter((ref): ref is { resourceType: 'Location' | 'Practitioner'; id: string } => !!ref)
        .map((ref) => oystehr.fhir.delete(ref).catch(() => undefined))
    );
    if (labOrg?.id) await oystehr.fhir.delete({ resourceType: 'Organization', id: labOrg.id }).catch(() => undefined);
  });

  it('submits the order to the lab, activates it, records the submitter and stores the order form', async () => {
    orderSubmit.mockResolvedValueOnce({} as Awaited<ReturnType<Oystehr['lab']['orderSubmit']>>);

    const { statusCode, output } = await invokeZambdaHandler<SubmitLabOrderOutput>(
      index,
      { serviceRequestIDs: [serviceRequest.id], manualOrder: false },
      { token }
    );

    expect(statusCode).toBe(200);
    expect(orderSubmit).toHaveBeenCalledWith({
      serviceRequest: [`ServiceRequest/${serviceRequest.id}`],
      accountNumber,
      orderNumber,
      useFriendlyPatientId: false,
    });
    expect(output.failedOrdersByOrderNumber).toBeUndefined();
    expect(output.orderPdfUrls).toHaveLength(1);
    expect(output.orderPdfUrls[0]).toContain(orderNumber);

    const [submitted, provenances, documents] = await Promise.all([
      oystehr.fhir.get<ServiceRequest>({ resourceType: 'ServiceRequest', id: serviceRequest.id! }),
      findProvenances(),
      findOrderDocuments(),
    ]);
    expect(submitted.status).toBe('active');
    expect(provenances).toHaveLength(1);
    expect(provenances[0].activity?.coding?.[0]?.code).toBe(PROVENANCE_ACTIVITY_CODING_ENTITY.submit.code);
    expect(provenances[0].agent[0].who?.reference).toBe(providerProfile);
    expect(documents).toHaveLength(1);
    expect(documents[0].type?.coding?.[0]?.code).toBe(LAB_ORDER_DOC_REF_CODING_CODE.code);
    expect(documents[0].subject?.reference).toBe(`Patient/${base.patient.id}`);
    expect(documents[0].content[0].attachment.title).toContain(orderNumber);
  });
});
