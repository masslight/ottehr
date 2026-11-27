import Oystehr from '@oystehr/sdk';
import { DocumentReference } from 'fhir/r4b';
import { M2MClientMockType } from 'utils/lib/auth/user-me.helper';
import { ChartNarrativeResponse } from 'utils/lib/easy-chart/api';
import { storedNarrativeOf, TRANSCRIPT_ATTACHMENT_TITLE } from 'utils/lib/easy-chart/narrative';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { index } from '../../src/ehr/easy-chart-narrative/index';
import {
  addProcessIdMetaTagToResource,
  InsertFullAppointmentDataBaseResult,
  insertInPersonAppointmentBase,
  setupIntegrationTest,
} from '../helpers/integration-test-seed-data-setup';
import { invokeZambdaHandler } from '../helpers/invoke-zambda-handler';

vi.hoisted(() => vi.resetModules());

const { callModelForJson } = vi.hoisted(() => ({ callModelForJson: vi.fn() }));

vi.mock('../../src/ehr/easy-chart-shared/model', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../src/ehr/easy-chart-shared/model')>()),
  callModelForJson,
}));

const TRANSCRIPT = 'Doctor: What brings you in? Patient: I have had a dry cough for three days and a mild sore throat.';

describe('easy-chart-narrative integration', () => {
  let oystehrAdmin: Oystehr;
  let token: string;
  let cleanup: () => Promise<void>;
  let base: InsertFullAppointmentDataBaseResult;
  let transcriptDocument: DocumentReference;

  beforeAll(async () => {
    const setup = await setupIntegrationTest('easy-chart-narrative.test.ts', M2MClientMockType.provider);
    oystehrAdmin = setup.oystehr;
    token = setup.testUserM2MToken;
    cleanup = setup.cleanup;
    base = await insertInPersonAppointmentBase(setup.oystehr, setup.processId);
    transcriptDocument = await oystehrAdmin.fhir.create<DocumentReference>(
      addProcessIdMetaTagToResource(
        {
          resourceType: 'DocumentReference',
          status: 'current',
          subject: { reference: `Patient/${base.patient.id}` },
          content: [
            {
              attachment: {
                contentType: 'text/plain',
                title: TRANSCRIPT_ATTACHMENT_TITLE,
                data: Buffer.from(TRANSCRIPT, 'utf8').toString('base64'),
              },
            },
          ],
          context: { encounter: [{ reference: `Encounter/${base.encounter.id}` }] },
        },
        setup.processId
      ) as DocumentReference
    );
  }, 60_000);

  afterAll(async () => {
    await cleanup();
  });

  it('returns the narrative and stamps it on the transcript document of the unlocked visit', async () => {
    callModelForJson.mockResolvedValue({
      parsed: {
        lines: [
          { text: 'Patient reports a dry cough for three days.', sourceTexts: ['a dry cough for three days'] },
          { text: 'Patient also reports a mild sore throat.', sourceTexts: ['a mild sore throat'] },
        ],
      },
      usage: [],
      escalation: { attempts: 1, escalated: false, failures: [] },
    });

    const { statusCode, output } = await invokeZambdaHandler<ChartNarrativeResponse>(
      index,
      { transcript: TRANSCRIPT, encounterId: base.encounter.id, documentId: transcriptDocument.id },
      { token }
    );

    expect(statusCode).toBe(200);
    expect(callModelForJson).toHaveBeenCalledWith(
      expect.objectContaining({ prompt: expect.stringContaining(TRANSCRIPT), feature: 'easy-chart-narrative' })
    );
    const expectedLines = [
      { text: 'Patient reports a dry cough for three days.', sources: ['a dry cough for three days'] },
      { text: 'Patient also reports a mild sore throat.', sources: ['a mild sore throat'] },
    ];
    expect(output.lines).toEqual(expectedLines);

    const stamped = await oystehrAdmin.fhir.get<DocumentReference>({
      resourceType: 'DocumentReference',
      id: transcriptDocument.id!,
    });
    expect(storedNarrativeOf(stamped)).toEqual(expectedLines);
    expect(stamped.content).toEqual(transcriptDocument.content);
  });
});
