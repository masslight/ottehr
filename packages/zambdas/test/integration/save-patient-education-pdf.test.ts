import Oystehr from '@oystehr/sdk';
import { DocumentReference, List } from 'fhir/r4b';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { M2MClientMockType } from 'utils/lib/auth/user-me.helper';
import { BUCKET_NAMES, FOLDERS_CONFIG } from 'utils/lib/fhir/constants';
import { createPatientDocumentList } from 'utils/lib/fhir/list';
import { PATIENT_EDUCATION_DOC_TYPE_CODE } from 'utils/lib/types/data/paperwork/paperwork.constants';
import { SavePatientEducationPdfOutput } from 'utils/lib/types/data/patient-education.types';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  addProcessIdMetaTagToResource,
  InsertFullAppointmentDataBaseResult,
  insertInPersonAppointmentBase,
  setupIntegrationTest,
} from '../helpers/integration-test-seed-data-setup';
import { ligatureFreeSuffix } from '../helpers/ligature-free-suffix';

const pdfText = async (url: string): Promise<string> => {
  const data = new Uint8Array(await (await fetch(url)).arrayBuffer());
  const pdf = await getDocument({ data }).promise;
  const pages: string[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const content = await (await pdf.getPage(i)).getTextContent();
    pages.push(content.items.map((item) => ('str' in item ? item.str : '')).join(' '));
  }
  return pages.join(' ').replace(/\s+/g, ' ');
};

describe('save-patient-education-pdf integration', () => {
  let oystehr: Oystehr;
  let oystehrZambdas: Oystehr;
  let cleanup: () => Promise<void>;
  let base: InsertFullAppointmentDataBaseResult;
  let educationList: List;
  let documentReference: DocumentReference | undefined;
  const title = `Strep throat education ${ligatureFreeSuffix()}`;
  const section = {
    patientTitle: `About strep throat ${ligatureFreeSuffix()}`,
    content: 'Take the full course of antibiotics.',
    icdCode: 'J02.0',
    icdDescription: 'Streptococcal pharyngitis',
  };

  beforeAll(async () => {
    const setup = await setupIntegrationTest('save-patient-education-pdf.test.ts', M2MClientMockType.provider);
    oystehr = setup.oystehr;
    oystehrZambdas = setup.oystehrTestUserM2M;
    cleanup = setup.cleanup;
    base = await insertInPersonAppointmentBase(oystehr, setup.processId);
    const folderConfig = FOLDERS_CONFIG.find((config) => config.title === BUCKET_NAMES.PATIENT_EDUCATION)!;
    educationList = await oystehr.fhir.create<List>(
      addProcessIdMetaTagToResource(
        createPatientDocumentList(`Patient/${base.patient.id}`, folderConfig),
        setup.processId
      ) as List
    );
  }, 60_000);

  afterAll(async () => {
    const z3Path = documentReference?.content[0]?.attachment.url?.split('/z3/')[1];
    if (z3Path) {
      const [bucketName, ...path] = z3Path.split('/');
      await oystehr.z3.deleteObject({ bucketName, 'objectPath+': path.join('/') }).catch(() => undefined);
    }
    if (documentReference?.id) {
      await oystehr.fhir.delete({ resourceType: 'DocumentReference', id: documentReference.id }).catch(() => undefined);
    }
    if (educationList?.id) {
      await oystehr.fhir.delete({ resourceType: 'List', id: educationList.id }).catch(() => undefined);
    }
    await cleanup();
  });

  it('stores the generated PDF, files it in the education folder and returns a download link', async () => {
    const response = await oystehrZambdas.zambda.execute({
      id: 'save-patient-education-pdf',
      encounterId: base.encounter.id,
      patientId: base.patient.id,
      title,
      sections: [section],
    });
    const output = response.output as SavePatientEducationPdfOutput;

    documentReference = await oystehr.fhir.get<DocumentReference>({
      resourceType: 'DocumentReference',
      id: output.documentReferenceId,
    });
    expect(documentReference).toMatchObject({
      status: 'current',
      type: { coding: [{ code: PATIENT_EDUCATION_DOC_TYPE_CODE }] },
      subject: { reference: `Patient/${base.patient.id}` },
      context: { encounter: [{ reference: `Encounter/${base.encounter.id}` }] },
      content: [{ attachment: { title, language: 'en' } }],
    });
    expect(documentReference.content[0].attachment.url).toContain(
      `-${BUCKET_NAMES.PATIENT_EDUCATION}/${base.patient.id}/`
    );

    const updatedList = await oystehr.fhir.get<List>({ resourceType: 'List', id: educationList.id! });
    expect(updatedList.entry?.map((entry) => entry.item.reference)).toEqual([
      `DocumentReference/${output.documentReferenceId}`,
    ]);

    const text = await pdfText(output.presignedDownloadUrl);
    expect(text).toContain(section.patientTitle);
    expect(text).toContain(section.content);
  });
});
