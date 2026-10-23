import Oystehr from '@oystehr/sdk';
import { DocumentReference, DomainResource, List, ServiceRequest } from 'fhir/r4b';
import { M2MClientMockType } from 'utils/lib/auth/user-me.helper';
import { BUCKET_NAMES } from 'utils/lib/fhir/constants';
import { RADIOLOGY_RESULT_DOC_REF_DOCTYPE } from 'utils/lib/fhir/radiology';
import {
  CreateRadiologyZambdaOrderInput,
  CreateRadiologyZambdaOrderOutput,
  UploadRadiologyResultZambdaOutput,
} from 'utils/lib/types/api/radiology';
import { RADIOLOGY_REPORT_CODE } from 'utils/lib/types/data/paperwork/paperwork.constants';
import { searchRadiologyResultDocRefs } from '../../src/ehr/radiology/shared/result-doc-refs';
import {
  InsertFullAppointmentDataBaseResult,
  insertInPersonAppointmentBase,
  setupIntegrationTest,
} from '../helpers/integration-test-seed-data-setup';

describe('radiology upload-result integration tests', () => {
  let oystehrTestUserM2M: Oystehr;
  let oystehrAdmin: Oystehr;
  let processId: string;
  const resourcesToCleanup: DomainResource[] = [];

  let baseResources: InsertFullAppointmentDataBaseResult;
  let appointmentBaseCleanup: () => Promise<void>;

  beforeAll(async () => {
    const setup = await setupIntegrationTest('integration/radiology-upload-result.test.ts', M2MClientMockType.provider);
    appointmentBaseCleanup = setup.cleanup;
    oystehrTestUserM2M = setup.oystehrTestUserM2M;
    oystehrAdmin = setup.oystehr;
    processId = setup.processId;
    baseResources = await insertInPersonAppointmentBase(setup.oystehr, setup.processId);
  }, 60_000);

  afterAll(async () => {
    if (!oystehrAdmin) {
      throw new Error('oystehr is null! could not clean up!');
    }
    for (const resource of resourcesToCleanup) {
      await oystehrAdmin.fhir.delete({ resourceType: resource.resourceType as any, id: resource.id! });
    }
    await appointmentBaseCleanup();
  });

  const fakeZ3Url = (fileName: string): string =>
    `https://project-api.zapehr.com/v1/z3/integration-test-radiology-results/${processId}/${fileName}`;

  const findRadiologyReportsFolder = async (): Promise<List | undefined> =>
    (
      await oystehrAdmin.fhir.search<List>({
        resourceType: 'List',
        params: [
          { name: 'subject', value: `Patient/${baseResources.patient.id}` },
          { name: 'identifier', value: BUCKET_NAMES.RADIOLOGY_REPORTS },
        ],
      })
    ).unbundle()[0];

  const waitForRadiologyReportsFolder = async (): Promise<List> => {
    for (let attempt = 0; attempt < 20; attempt++) {
      const folder = await findRadiologyReportsFolder();
      if (folder) return folder;
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    throw new Error(`Patient/${baseResources.patient.id} never got a searchable Radiology Reports folder`);
  };

  const folderReferences = async (folderId: string): Promise<string[]> =>
    (await oystehrAdmin.fhir.get<List>({ resourceType: 'List', id: folderId })).entry?.map(
      (entry) => entry.item.reference ?? ''
    ) ?? [];

  const uploadResult = async (serviceRequestId: string, z3URL: string, title: string): Promise<string> =>
    (
      (
        await oystehrTestUserM2M.zambda.execute({
          id: 'RADIOLOGY-UPLOAD-RESULT',
          serviceRequestId,
          z3URL,
          title,
        })
      ).output as UploadRadiologyResultZambdaOutput
    ).documentReferenceId;

  it('keeps one Radiology Reports entry per current external result across uploads, replacements and deletes', async () => {
    expect(await findRadiologyReportsFolder()).toBeUndefined();

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
    const orderOutput = (await oystehrTestUserM2M.zambda.execute({ id: 'RADIOLOGY-CREATE-ORDER', ...createOrderInput }))
      .output as CreateRadiologyZambdaOrderOutput;
    const serviceRequest = await oystehrAdmin.fhir.get<ServiceRequest>({
      resourceType: 'ServiceRequest',
      id: orderOutput.serviceRequestId,
    });
    resourcesToCleanup.push(serviceRequest);

    const currentResultIds = async (): Promise<string[]> =>
      (await searchRadiologyResultDocRefs(serviceRequest.id!, oystehrAdmin)).map((docRef) => docRef.id!).sort();

    const firstUploadUrl = fakeZ3Url('first-upload.pdf');
    const firstDocRefId = await uploadResult(serviceRequest.id!, firstUploadUrl, 'report-1.pdf');

    const folder = await waitForRadiologyReportsFolder();
    resourcesToCleanup.push(folder);
    expect(await folderReferences(folder.id!)).toEqual([`DocumentReference/${firstDocRefId}`]);

    const firstDocRef = await oystehrAdmin.fhir.get<DocumentReference>({
      resourceType: 'DocumentReference',
      id: firstDocRefId,
    });
    resourcesToCleanup.push(firstDocRef);
    expect(firstDocRef.type?.coding).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ system: 'http://loinc.org', code: RADIOLOGY_REPORT_CODE }),
        expect.objectContaining(RADIOLOGY_RESULT_DOC_REF_DOCTYPE),
      ])
    );
    expect(await currentResultIds()).toEqual([firstDocRefId]);

    expect(await uploadResult(serviceRequest.id!, firstUploadUrl, 'report-1.pdf')).toBe(firstDocRefId);
    expect(await folderReferences(folder.id!)).toEqual([`DocumentReference/${firstDocRefId}`]);

    const replacementDocRefId = await uploadResult(serviceRequest.id!, fakeZ3Url('second-upload.pdf'), 'report-1.pdf');
    expect(replacementDocRefId).not.toBe(firstDocRefId);

    const supersededDocRef = await oystehrAdmin.fhir.get<DocumentReference>({
      resourceType: 'DocumentReference',
      id: firstDocRefId,
    });
    expect(supersededDocRef.status).toBe('superseded');
    expect(await folderReferences(folder.id!)).toEqual([`DocumentReference/${replacementDocRefId}`]);
    expect(await currentResultIds()).toEqual([replacementDocRefId]);

    const otherDocRefId = await uploadResult(serviceRequest.id!, fakeZ3Url('third-upload.pdf'), 'report-2.pdf');
    const otherDocRef = await oystehrAdmin.fhir.get<DocumentReference>({
      resourceType: 'DocumentReference',
      id: otherDocRefId,
    });
    resourcesToCleanup.push(otherDocRef);
    expect(otherDocRef.status).toBe('current');
    expect(await folderReferences(folder.id!)).toEqual([
      `DocumentReference/${replacementDocRefId}`,
      `DocumentReference/${otherDocRefId}`,
    ]);
    expect(await currentResultIds()).toEqual([replacementDocRefId, otherDocRefId].sort());

    await oystehrTestUserM2M.zambda.execute({
      id: 'RADIOLOGY-DELETE-RESULT',
      documentReferenceId: replacementDocRefId,
    });

    expect(await folderReferences(folder.id!)).toEqual([`DocumentReference/${otherDocRefId}`]);
    expect(await currentResultIds()).toEqual([otherDocRefId]);
    await expect(
      oystehrAdmin.fhir.get<DocumentReference>({ resourceType: 'DocumentReference', id: replacementDocRefId })
    ).rejects.toBeDefined();
    expect(
      (await oystehrAdmin.fhir.get<DocumentReference>({ resourceType: 'DocumentReference', id: firstDocRefId })).status
    ).toBe('superseded');
  }, 120_000);
});
