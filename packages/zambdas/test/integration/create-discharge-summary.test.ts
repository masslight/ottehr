import Oystehr from '@oystehr/sdk';
import { randomUUID } from 'crypto';
import { DocumentReference } from 'fhir/r4b';
import { PDFDocument } from 'pdf-lib';
import { M2MClientMockType } from 'utils/lib/auth/user-me.helper';
import { BUCKET_NAMES } from 'utils/lib/fhir/constants';
import { CreateDischargeSummaryResponse } from 'utils/lib/types/api/create-discharge-summary/create-discharge-summary.types';
import {
  DISCHARGE_SUMMARY_CODE,
  PATIENT_EDUCATION_DOC_TYPE_CODE,
} from 'utils/lib/types/data/paperwork/paperwork.constants';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { SECRETS } from '../data/secrets';
import {
  addProcessIdMetaTagToResource,
  InsertFullAppointmentDataBaseResult,
  insertInPersonAppointmentBase,
  setupIntegrationTest,
} from '../helpers/integration-test-seed-data-setup';

const EDUCATION_PAGE_SIZES: [number, number][] = [
  [200, 300],
  [240, 360],
];

const z3Location = (z3Url: string): { bucketName: string; 'objectPath+': string } => {
  const [bucketName, ...objectPath] = z3Url.split('/z3/')[1].split('/');
  return { bucketName, 'objectPath+': objectPath.join('/') };
};

describe('create-discharge-summary integration', () => {
  let oystehrAdmin: Oystehr;
  let oystehrZambdas: Oystehr;
  let cleanup: () => Promise<void>;
  let processId: string;
  let base: InsertFullAppointmentDataBaseResult;
  const z3ObjectsToCleanUp: string[] = [];
  const documentIdsToCleanUp: string[] = [];

  const createEducationDocument = async ([width, height]: [number, number]): Promise<void> => {
    const pdf = await PDFDocument.create();
    pdf.addPage([width, height]);
    const bytes = await pdf.save();
    const bucketName = `${SECRETS.PROJECT_ID}-${BUCKET_NAMES.PATIENT_EDUCATION}`;
    const objectPath = `${base.patient.id}/integration-test-education-${randomUUID()}.pdf`;
    await oystehrAdmin.z3.uploadFile({
      bucketName,
      'objectPath+': objectPath,
      file: new Blob([bytes], { type: 'application/pdf' }),
    });
    const z3Url = `${SECRETS.PROJECT_API}/z3/${bucketName}/${objectPath}`;
    z3ObjectsToCleanUp.push(z3Url);

    const document = await oystehrAdmin.fhir.create<DocumentReference>(
      addProcessIdMetaTagToResource(
        {
          resourceType: 'DocumentReference',
          status: 'current',
          type: {
            coding: [
              {
                system: 'https://fhir.ottehr.com/CodeSystem/document-type',
                code: PATIENT_EDUCATION_DOC_TYPE_CODE,
                display: 'Patient Education',
              },
            ],
          },
          subject: { reference: `Patient/${base.patient.id}` },
          context: { encounter: [{ reference: `Encounter/${base.encounter.id}` }] },
          content: [{ attachment: { url: z3Url, contentType: 'application/pdf', title: 'Education.pdf' } }],
        },
        processId
      ) as DocumentReference
    );
    documentIdsToCleanUp.push(document.id!);
  };

  beforeAll(async () => {
    const setup = await setupIntegrationTest('create-discharge-summary.test.ts', M2MClientMockType.provider);
    oystehrAdmin = setup.oystehr;
    oystehrZambdas = setup.oystehrTestUserM2M;
    cleanup = setup.cleanup;
    processId = setup.processId;
    base = await insertInPersonAppointmentBase(setup.oystehr, processId);
    for (const size of EDUCATION_PAGE_SIZES) await createEducationDocument(size);
  }, 60_000);

  afterAll(async () => {
    for (const z3Url of z3ObjectsToCleanUp) {
      await oystehrAdmin.z3.deleteObject(z3Location(z3Url)).catch((error) => console.warn(error));
    }
    for (const id of documentIdsToCleanUp) {
      await oystehrAdmin.fhir.delete({ resourceType: 'DocumentReference', id }).catch((error) => console.warn(error));
    }
    await cleanup();
  });

  it('creates the discharge summary document with the visit education PDFs appended', async () => {
    const { output } = await oystehrZambdas.zambda.execute({
      id: 'create-discharge-summary',
      appointmentId: base.appointment.id,
    });
    const { message, documentId } = output as CreateDischargeSummaryResponse;
    expect(message).toBe('Discharge Summary created.');
    expect(documentId).toBeTruthy();
    documentIdsToCleanUp.push(documentId);

    const document = await oystehrAdmin.fhir.get<DocumentReference>({
      resourceType: 'DocumentReference',
      id: documentId,
    });
    const dischargeSummaryUrl = document.content?.[0]?.attachment?.url;
    expect(dischargeSummaryUrl).toBeDefined();
    z3ObjectsToCleanUp.push(dischargeSummaryUrl!);

    expect(document.status).toBe('current');
    expect(document.type?.coding?.[0]).toMatchObject({ system: 'http://loinc.org', code: DISCHARGE_SUMMARY_CODE });
    expect(document.subject?.reference).toBe(`Patient/${base.patient.id}`);
    expect(document.context?.encounter).toEqual([{ reference: `Encounter/${base.encounter.id}` }]);
    expect(document.context?.related).toContainEqual({ reference: `Appointment/${base.appointment.id}` });

    const merged = await PDFDocument.load(await oystehrAdmin.z3.downloadFile(z3Location(dischargeSummaryUrl!)));
    const pages = merged.getPages();
    expect(pages.length).toBeGreaterThan(EDUCATION_PAGE_SIZES.length);
    const appendedSizes = pages.slice(-EDUCATION_PAGE_SIZES.length).map((page) => {
      const { width, height } = page.getSize();
      return [width, height];
    });
    expect(appendedSizes).toHaveLength(EDUCATION_PAGE_SIZES.length);
    expect(appendedSizes).toEqual(expect.arrayContaining(EDUCATION_PAGE_SIZES));
  });
});
