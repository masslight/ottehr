import Oystehr from '@oystehr/sdk';
import { randomUUID } from 'crypto';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { M2MClientMockType } from 'utils/lib/auth/user-me.helper';
import { BUCKET_NAMES } from 'utils/lib/fhir/constants';
import { PrintablePdfZambdaOutput } from 'utils/lib/types/api/print-chart-data/print-chart-data.types';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { SECRETS } from '../data/secrets';
import {
  InsertFullAppointmentDataBaseResult,
  insertInPersonAppointmentBase,
  setupIntegrationTest,
} from '../helpers/integration-test-seed-data-setup';

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

describe('make-patient-instructions-pdf integration', () => {
  let oystehr: Oystehr;
  let oystehrZambdas: Oystehr;
  let cleanup: () => Promise<void>;
  let base: InsertFullAppointmentDataBaseResult;
  const instructions = [`Drink fluids ${randomUUID().slice(0, 8)}`, `Rest for two days ${randomUUID().slice(0, 8)}`];

  beforeAll(async () => {
    const setup = await setupIntegrationTest('make-patient-instructions-pdf.test.ts', M2MClientMockType.provider);
    oystehr = setup.oystehr;
    oystehrZambdas = setup.oystehrTestUserM2M;
    cleanup = setup.cleanup;
    base = await insertInPersonAppointmentBase(oystehr, setup.processId);
    await oystehrZambdas.zambda.execute({
      id: 'SAVE-CHART-DATA',
      encounterId: base.encounter.id!,
      instructions: instructions.map((text) => ({ text })),
    });
  }, 60_000);

  afterAll(async () => {
    await oystehr.z3
      .deleteObject({
        bucketName: `${SECRETS.PROJECT_ID}-${BUCKET_NAMES.VISIT_NOTES}`,
        'objectPath+': `${base.patient.id}/PatientInstructions-${base.appointment.id}.pdf`,
      })
      .catch(() => undefined);
    await cleanup();
  });

  it('renders the visit patient instructions for printing', async () => {
    const response = await oystehrZambdas.zambda.execute({
      id: 'make-patient-instructions-pdf',
      appointmentId: base.appointment.id,
    });
    const output = response.output as PrintablePdfZambdaOutput;

    expect(output.title).toBe(`PatientInstructions-${base.appointment.id}.pdf`);
    const text = await pdfText(output.presignedURL);
    expect(text).toContain('PATIENT INSTRUCTIONS');
    expect(text).toContain('Snow, Jon');
    instructions.forEach((instruction) => expect(text).toContain(instruction));
  });
});
