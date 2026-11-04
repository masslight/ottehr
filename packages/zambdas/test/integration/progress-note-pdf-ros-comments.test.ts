import Oystehr from '@oystehr/sdk';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { M2MClientMockType } from 'utils/lib/auth/user-me.helper';
import { getRosCommentFieldKey } from 'utils/lib/config-helpers/review-of-systems';
import { PrintablePdfZambdaOutput } from 'utils/lib/types/api/print-chart-data/print-chart-data.types';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
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

describe('progress note pdf: ROS system comments', () => {
  let oystehrZambdas: Oystehr;
  let baseResources: InsertFullAppointmentDataBaseResult;
  let cleanup: () => Promise<void>;

  beforeAll(async () => {
    const setup = await setupIntegrationTest('progress-note-pdf-ros-comments.test.ts', M2MClientMockType.provider);
    oystehrZambdas = setup.oystehrTestUserM2M;
    baseResources = await insertInPersonAppointmentBase(setup.oystehr, setup.processId);
    cleanup = setup.cleanup;
  }, 60_000);

  afterAll(async () => {
    await cleanup();
  });

  it('prints each system comment, including a system with only a comment', async () => {
    await oystehrZambdas.zambda.execute({
      id: 'SAVE-CHART-DATA',
      encounterId: baseResources.encounter.id!,
      rosObservations: [
        { field: 'ros-constitutional-fever-reports', label: 'Fever', value: true },
        {
          field: getRosCommentFieldKey('constitutional'),
          label: 'Constitutional comment',
          note: 'Fever since Tuesday',
        },
        { field: getRosCommentFieldKey('eyes'), label: 'Eyes comment', note: 'Wears glasses' },
      ],
    });

    const { presignedURL } = (
      await oystehrZambdas.zambda.execute({
        id: 'make-progress-note-pdf',
        appointmentId: baseResources.appointment.id!,
      })
    ).output as PrintablePdfZambdaOutput;

    const text = await pdfText(presignedURL);
    expect(text).toMatch(/Constitutional:\s*Fever\s+Fever since Tuesday/);
    expect(text).toMatch(/Eyes:\s*Wears glasses/);
  }, 120_000);
});
