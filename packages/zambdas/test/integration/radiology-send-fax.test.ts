import Oystehr, { SearchParam } from '@oystehr/sdk';
import { Communication, DocumentReference, FhirResource, Practitioner, Provenance } from 'fhir/r4b';
import { M2MClientMockType } from 'utils/lib/auth/user-me.helper';
import { FAX_SENT_PROVENANCE_ACTIVITY_CODING } from 'utils/lib/fhir/constants';
import { getFullestAvailableName } from 'utils/lib/fhir/patient';
import {
  CreateRadiologyZambdaOrderInput,
  CreateRadiologyZambdaOrderOutput,
  SendRadiologyOrderFaxZambdaOutput,
} from 'utils/lib/types/api/radiology';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { index } from '../../src/ehr/radiology/send-fax/index';
import { RADIOLOGY_ORDER_FORM_DOC_REF_DOCTYPE } from '../../src/shared/pdf/radiology-order-form-pdf';
import {
  addProcessIdMetaTagToResource,
  InsertFullAppointmentDataBaseResult,
  insertInPersonAppointmentBase,
  setupIntegrationTest,
} from '../helpers/integration-test-seed-data-setup';
import { invokeZambdaHandler, loadZambdaSecrets } from '../helpers/invoke-zambda-handler';

vi.hoisted(() => vi.resetModules());

const { sendLetterFax } = vi.hoisted(() => ({ sendLetterFax: vi.fn() }));

vi.mock('../../src/shared/send-letter-fax', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../src/shared/send-letter-fax')>()),
  sendLetterFax,
}));

describe('radiology-send-fax integration', () => {
  let oystehr: Oystehr;
  let oystehrProvider: Oystehr;
  let token: string;
  let profile: string;
  let processId: string;
  let base: InsertFullAppointmentDataBaseResult;
  let cleanup: () => Promise<void>;
  const toDelete: {
    resourceType: 'Communication' | 'DocumentReference' | 'Provenance' | 'ServiceRequest';
    id: string;
  }[] = [];

  const searchUntilFound = async <T extends FhirResource>(
    resourceType: T['resourceType'],
    params: SearchParam[]
  ): Promise<T[]> => {
    for (let attempt = 0; attempt < 20; attempt++) {
      const found = (await oystehr.fhir.search<T>({ resourceType, params })).unbundle();
      if (found.length) return found;
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    throw new Error(`No ${resourceType} matched ${JSON.stringify(params)}`);
  };

  beforeAll(async () => {
    const setup = await setupIntegrationTest('radiology-send-fax.test.ts', M2MClientMockType.provider);
    oystehr = setup.oystehr;
    oystehrProvider = setup.oystehrTestUserM2M;
    token = setup.testUserM2MToken;
    profile = setup.testUserM2MProfile;
    processId = setup.processId;
    cleanup = setup.cleanup;
    base = await insertInPersonAppointmentBase(setup.oystehr, setup.processId);
  }, 60_000);

  afterAll(async () => {
    for (const { resourceType, id } of toDelete) {
      await oystehr.fhir.delete({ resourceType, id }).catch(() => undefined);
    }
    await cleanup();
  });

  it('faxes the order form on file and records who sent it to which number', async () => {
    const createOrderInput: CreateRadiologyZambdaOrderInput = {
      encounterId: base.encounter.id!,
      diagnosisCodes: ['W21.89XA'],
      cptCode: '73562',
      lateralityModifier: undefined,
      stat: false,
      clinicalHistory: 'Took an arrow to the knee',
      consentObtained: false,
      external: true,
      performingOrganization: {
        name: 'Test Imaging Center',
        address: '123 Test St, Testville, TS 00000',
        phone: '(212) 555-1234',
        fax: '(212) 555-5678',
      },
      timeWindow: 'Please perform within 4 hours',
    };
    const { serviceRequestId } = (
      await oystehrProvider.zambda.execute({ id: 'RADIOLOGY-CREATE-ORDER', ...createOrderInput })
    ).output as CreateRadiologyZambdaOrderOutput;
    toDelete.push({ resourceType: 'ServiceRequest', id: serviceRequestId });

    const faxCommunication = await oystehr.fhir.create<Communication>(
      addProcessIdMetaTagToResource(
        {
          resourceType: 'Communication',
          status: 'in-progress',
          subject: { reference: `Patient/${base.patient.id}` },
          sent: new Date().toISOString(),
          medium: [
            { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/v3-ParticipationMode', code: 'FAXWRIT' }] },
          ],
        },
        processId
      ) as Communication
    );
    toDelete.push({ resourceType: 'Communication', id: faxCommunication.id! });
    sendLetterFax.mockResolvedValueOnce(faxCommunication);

    const { statusCode, output } = await invokeZambdaHandler<SendRadiologyOrderFaxZambdaOutput>(
      index,
      { serviceRequestId, faxNumber: '(212) 555-0199' },
      { token }
    );

    const orderForms = await searchUntilFound<DocumentReference>('DocumentReference', [
      { name: 'related', value: `ServiceRequest/${serviceRequestId}` },
      {
        name: 'type',
        value: `${RADIOLOGY_ORDER_FORM_DOC_REF_DOCTYPE.system}|${RADIOLOGY_ORDER_FORM_DOC_REF_DOCTYPE.code}`,
      },
    ]);
    orderForms.forEach((docRef) => toDelete.push({ resourceType: 'DocumentReference', id: docRef.id! }));
    const provenances = await searchUntilFound<Provenance>('Provenance', [
      { name: 'target', value: `ServiceRequest/${serviceRequestId}` },
    ]);
    provenances.forEach((provenance) => toDelete.push({ resourceType: 'Provenance', id: provenance.id! }));

    expect(statusCode).toBe(200);
    expect(output).toEqual({ communicationId: faxCommunication.id });

    const currentOrderForm = orderForms.find((docRef) => docRef.status === 'current');
    expect(currentOrderForm?.content[0].attachment.url).toBeDefined();
    expect(sendLetterFax).toHaveBeenCalledTimes(1);
    expect(sendLetterFax).toHaveBeenCalledWith(
      expect.objectContaining({
        media: currentOrderForm!.content[0].attachment.url,
        patientId: base.patient.id,
        faxNumber: '+12125550199',
        organizationId: loadZambdaSecrets().ORGANIZATION_ID,
      })
    );

    const sender = await oystehr.fhir.get<Practitioner>({ resourceType: 'Practitioner', id: profile.split('/')[1] });
    expect(provenances).toHaveLength(1);
    const [provenance] = provenances;
    expect(provenance.activity?.coding).toEqual([FAX_SENT_PROVENANCE_ACTIVITY_CODING]);
    expect(provenance.target.map((target) => target.reference)).toEqual([
      `Communication/${faxCommunication.id}`,
      `ServiceRequest/${serviceRequestId}`,
    ]);
    expect(provenance.occurredDateTime).toBe(faxCommunication.sent);
    expect(provenance.agent.map((agent) => agent.who.reference)).toEqual([
      profile,
      `Patient/${base.patient.id}`,
      '#2125550199',
    ]);
    expect(provenance.agent[0].who.display).toBe(getFullestAvailableName(sender));
    expect(provenance.contained).toEqual([
      { resourceType: 'Practitioner', id: '2125550199', telecom: [{ system: 'fax', value: '+12125550199' }] },
    ]);
  }, 120_000);
});
