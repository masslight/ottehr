import Oystehr from '@oystehr/sdk';
import { DocumentReference, Location } from 'fhir/r4b';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { M2MClientMockType } from 'utils/lib/auth/user-me.helper';
import {
  MakeMedicationHistoryPdfZambdaOutput,
  MEDICATION_HISTORY_DOC_REF_CODING,
  MedicationInfoForPrinting,
} from 'utils/lib/types/api/print-chart-data/print-chart-data.types';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
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

const deleteZ3Object = async (oystehr: Oystehr, z3Url: string | undefined): Promise<void> => {
  const [bucketName, ...path] = z3Url?.split('/z3/')[1]?.split('/') ?? [];
  if (!bucketName || !path.length) return;
  await oystehr.z3.deleteObject({ bucketName, 'objectPath+': path.join('/') }).catch(() => undefined);
};

describe('make-medication-history-pdf integration', () => {
  let oystehr: Oystehr;
  let oystehrZambdas: Oystehr;
  let cleanup: () => Promise<void>;
  let base: InsertFullAppointmentDataBaseResult;
  let location: Location;
  let documentReferences: DocumentReference[] = [];
  const medicationHistory: MedicationInfoForPrinting[] = [
    {
      name: `Amoxicillin ${ligatureFreeSuffix()}`,
      type: 'scheduled',
      status: 'active',
      intakeInfo: { dose: '500 mg', lastFilledDate: '2025-10-12' },
    },
    { name: `Ibuprofen ${ligatureFreeSuffix()}`, type: 'as-needed', status: 'active' },
  ];

  beforeAll(async () => {
    const setup = await setupIntegrationTest('make-medication-history-pdf.test.ts', M2MClientMockType.provider);
    oystehr = setup.oystehr;
    oystehrZambdas = setup.oystehrTestUserM2M;
    cleanup = setup.cleanup;
    base = await insertInPersonAppointmentBase(oystehr, setup.processId);
    const locationId = base.appointment.participant
      .find((participant) => participant.actor?.reference?.startsWith('Location/'))
      ?.actor?.reference?.replace('Location/', '');
    location = await oystehr.fhir.get<Location>({ resourceType: 'Location', id: locationId! });
  }, 60_000);

  afterAll(async () => {
    for (const documentReference of documentReferences) {
      await deleteZ3Object(oystehr, documentReference.content[0]?.attachment.url);
      await oystehr.fhir
        .delete({ resourceType: 'DocumentReference', id: documentReference.id! })
        .catch(() => undefined);
    }
    await cleanup();
  });

  it('renders the medication history, stores it in Z3 and files it on the encounter', async () => {
    const response = await oystehrZambdas.zambda.execute({
      id: 'make-medication-history-pdf',
      patient: base.patient,
      appointment: base.appointment,
      encounter: base.encounter,
      location,
      timezone: 'America/New_York',
      medicationHistory,
    });
    const output = response.output as MakeMedicationHistoryPdfZambdaOutput;

    documentReferences = (
      await oystehr.fhir.search<DocumentReference>({
        resourceType: 'DocumentReference',
        params: [
          { name: 'encounter', value: `Encounter/${base.encounter.id}` },
          { name: 'category', value: MEDICATION_HISTORY_DOC_REF_CODING.code },
        ],
      })
    ).unbundle();
    expect(documentReferences).toHaveLength(1);
    expect(documentReferences[0]).toMatchObject({
      status: 'current',
      docStatus: 'final',
      subject: { reference: `Patient/${base.patient.id}` },
      content: [{ attachment: { title: output.title } }],
    });
    expect(output.title).toMatch(/^MedicationHistory-.*\.pdf$/);

    const text = await pdfText(output.presignedURL);
    expect(text).toContain('Medication History');
    expect(text).toContain('Snow, Jon');
    medicationHistory.forEach((medication) => expect(text).toContain(medication.name));
    expect(text).toContain('500 mg');
  });
});
