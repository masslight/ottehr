import Oystehr from '@oystehr/sdk';
import { DocumentReference, DomainResource, ServiceRequest } from 'fhir/r4b';
import {
  CreateRadiologyZambdaOrderInput,
  CreateRadiologyZambdaOrderOutput,
  GetRadiologyOrderPdfZambdaOutput,
  M2MClientMockType,
} from 'utils';
import { RADIOLOGY_ORDER_FORM_DOC_REF_DOCTYPE } from '../../src/shared/pdf/radiology-order-form-pdf';
import {
  InsertFullAppointmentDataBaseResult,
  insertInPersonAppointmentBase,
  setupIntegrationTest,
} from '../helpers/integration-test-seed-data-setup';

describe('radiology get-order-pdf integration tests', () => {
  let oystehrTestUserM2M: Oystehr;
  let oystehrAdmin: Oystehr;
  const resourcesToCleanup: DomainResource[] = [];

  let baseResources: InsertFullAppointmentDataBaseResult;
  let appointmentBaseCleanup: () => Promise<void>;

  beforeAll(async () => {
    const setup = await setupIntegrationTest('integration/radiology-get-order-pdf.test.ts', M2MClientMockType.provider);
    appointmentBaseCleanup = setup.cleanup;
    oystehrTestUserM2M = setup.oystehrTestUserM2M;
    oystehrAdmin = setup.oystehr;
    baseResources = await insertInPersonAppointmentBase(setup.oystehr, setup.processId);
  }, 60_000);

  afterAll(async () => {
    if (!oystehrAdmin) {
      throw new Error('oystehr is null! could not clean up!');
    }
    await cleanupResources(oystehrAdmin);
    await appointmentBaseCleanup();
  });

  const cleanupResources = async (oystehr: Oystehr): Promise<void> => {
    for (const resource of resourcesToCleanup) {
      await oystehr.fhir.delete({
        resourceType: resource.resourceType as any,
        id: resource.id!,
      });
    }
  };

  it('should generate an order-form PDF for an external order and link the DocumentReference', async () => {
    // External (print-only) orders skip the AdvaPACS transmit, so this works without AdvaPACS creds.
    const createOrderInput: CreateRadiologyZambdaOrderInput = {
      encounterId: baseResources.encounter.id!,
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

    const orderOutput = (
      await oystehrTestUserM2M.zambda.execute({
        id: 'RADIOLOGY-CREATE-ORDER',
        ...createOrderInput,
      })
    ).output as CreateRadiologyZambdaOrderOutput;
    expect(orderOutput.serviceRequestId).toBeDefined();
    const serviceRequest = await oystehrAdmin.fhir.get<ServiceRequest>({
      resourceType: 'ServiceRequest',
      id: orderOutput.serviceRequestId,
    });
    resourcesToCleanup.push(serviceRequest);

    const pdfOutput = (
      await oystehrTestUserM2M.zambda.execute({
        id: 'RADIOLOGY-GET-ORDER-PDF',
        serviceRequestId: orderOutput.serviceRequestId,
      })
    ).output as GetRadiologyOrderPdfZambdaOutput;

    expect(pdfOutput.presignedURL).toBeDefined();
    expect(pdfOutput.presignedURL).toMatch(/^https?:\/\//);
    expect(pdfOutput.documentReferenceId).toBeDefined();

    const docRef = await oystehrAdmin.fhir.get<DocumentReference>({
      resourceType: 'DocumentReference',
      id: pdfOutput.documentReferenceId,
    });
    resourcesToCleanup.push(docRef);

    expect(docRef.status).toBe('current');
    expect(
      docRef.type?.coding?.some(
        (coding) =>
          coding.system === RADIOLOGY_ORDER_FORM_DOC_REF_DOCTYPE.system &&
          coding.code === RADIOLOGY_ORDER_FORM_DOC_REF_DOCTYPE.code
      )
    ).toBe(true);
    expect(
      docRef.context?.related?.some((related) => related.reference === `ServiceRequest/${orderOutput.serviceRequestId}`)
    ).toBe(true);
    expect(docRef.context?.encounter?.some((enc) => enc.reference === `Encounter/${baseResources.encounter.id}`)).toBe(
      true
    );
    expect(docRef.content?.[0]?.attachment?.url).toBeDefined();

    // A reprint supersedes the previous order-form PDF and returns a fresh current docRef.
    const secondPdfOutput = (
      await oystehrTestUserM2M.zambda.execute({
        id: 'RADIOLOGY-GET-ORDER-PDF',
        serviceRequestId: orderOutput.serviceRequestId,
      })
    ).output as GetRadiologyOrderPdfZambdaOutput;
    expect(secondPdfOutput.documentReferenceId).toBeDefined();

    const secondDocRef = await oystehrAdmin.fhir.get<DocumentReference>({
      resourceType: 'DocumentReference',
      id: secondPdfOutput.documentReferenceId,
    });
    if (secondDocRef.id !== docRef.id) {
      resourcesToCleanup.push(secondDocRef);
      const supersededDocRef = await oystehrAdmin.fhir.get<DocumentReference>({
        resourceType: 'DocumentReference',
        id: docRef.id!,
      });
      expect(supersededDocRef.status).toBe('superseded');
    }
    expect(secondDocRef.status).toBe('current');
  }, 120_000);
});
