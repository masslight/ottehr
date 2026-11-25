import Oystehr from '@oystehr/sdk';
import { DocumentReference, Observation } from 'fhir/r4b';
import { M2MClientMockType } from 'utils/lib/auth/user-me.helper';
import { SaveTranscriptResponse } from 'utils/lib/easy-chart/api';
import { storedNarrativeOf, transcriptTextOf } from 'utils/lib/easy-chart/narrative';
import { PUBLIC_EXTENSION_BASE_URL } from 'utils/lib/fhir/constants';
import { AiObservationField } from 'utils/lib/types/api/chart-data/chart-data.constants';
import { afterAll, beforeAll, describe, expect, it, MockInstance, vi } from 'vitest';
import { index } from '../../src/ehr/easy-chart-save-transcript/index';
import {
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

const VERTEX_HOST = 'aiplatform.googleapis.com';
const FIRST_TRANSCRIPT = 'Doctor: How long have you had the cough? Patient: A dry cough for three days, no allergies.';
const EDITED_TRANSCRIPT = 'Doctor: How long have you had the cough? Patient: A dry cough for five days.';

const narrativeAnswer = (text: string, sourceText: string): unknown => ({
  parsed: { lines: [{ text, sourceTexts: [sourceText] }] },
  usage: [],
  escalation: { attempts: 1, escalated: false, failures: [] },
});

const requestUrl = (input: RequestInfo | URL): string =>
  typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;

describe('easy-chart-save-transcript integration', () => {
  let oystehrAdmin: Oystehr;
  let token: string;
  let providerProfile: string;
  let cleanup: () => Promise<void>;
  let base: InsertFullAppointmentDataBaseResult;
  let fetchSpy: MockInstance<typeof fetch>;
  let extraction: Record<string, string>;
  const vertexRequestBodies: string[] = [];

  const fetchDocument = (id: string): Promise<DocumentReference> =>
    oystehrAdmin.fhir.get<DocumentReference>({ resourceType: 'DocumentReference', id });

  const observationsDerivedFrom = async (documentId: string): Promise<{ field?: string; value?: string }[]> =>
    (
      await oystehrAdmin.fhir.search<Observation>({
        resourceType: 'Observation',
        params: [{ name: 'derived-from', value: `DocumentReference/${documentId}` }],
      })
    )
      .unbundle()
      .map((observation) => ({ field: observation.code.text, value: observation.valueString }))
      .sort((a, b) => (a.field ?? '').localeCompare(b.field ?? ''));

  beforeAll(async () => {
    const setup = await setupIntegrationTest('easy-chart-save-transcript.test.ts', M2MClientMockType.provider);
    oystehrAdmin = setup.oystehr;
    token = setup.testUserM2MToken;
    providerProfile = setup.testUserM2MProfile;
    cleanup = setup.cleanup;
    base = await insertInPersonAppointmentBase(setup.oystehr, setup.processId);

    const realFetch = globalThis.fetch.bind(globalThis);
    fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      if (!new URL(requestUrl(input)).hostname.endsWith(VERTEX_HOST)) return realFetch(input, init);
      vertexRequestBodies.push(String(init?.body));
      return new Response(
        JSON.stringify({
          candidates: [{ content: { parts: [{ text: JSON.stringify(extraction) }] }, finishReason: 'STOP' }],
        }),
        { status: 200 }
      );
    });
  }, 60_000);

  afterAll(async () => {
    fetchSpy.mockRestore();
    const observations = (
      await oystehrAdmin.fhir.search<Observation>({
        resourceType: 'Observation',
        params: [{ name: 'encounter', value: `Encounter/${base.encounter.id}` }],
      })
    ).unbundle();
    await Promise.all(
      observations.map((observation) =>
        oystehrAdmin.fhir
          .delete({ resourceType: 'Observation', id: observation.id! })
          .catch((error) => console.warn(error))
      )
    );
    await cleanup();
  });

  it('saves a new transcript under the caller, then reprocesses it in place when edited', async () => {
    extraction = { historyOfPresentIllness: 'Dry cough for three days.', allergies: 'No known allergies.' };
    callModelForJson.mockResolvedValueOnce(
      narrativeAnswer('Patient reports a dry cough for three days.', 'three days')
    );

    const created = await invokeZambdaHandler<SaveTranscriptResponse>(
      index,
      { transcript: FIRST_TRANSCRIPT, encounterId: base.encounter.id },
      { token }
    );

    expect(created.statusCode).toBe(200);
    const documentId = created.output.documentId;
    expect(vertexRequestBodies[0]).toContain(FIRST_TRANSCRIPT);
    const createdDocument = await fetchDocument(documentId);
    expect(createdDocument.subject?.reference).toBe(`Patient/${base.patient.id}`);
    expect(createdDocument.context?.encounter).toEqual([{ reference: `Encounter/${base.encounter.id}` }]);
    expect(transcriptTextOf(createdDocument)).toBe(FIRST_TRANSCRIPT);
    expect(
      createdDocument.extension?.find((extension) => extension.url === `${PUBLIC_EXTENSION_BASE_URL}/provider`)
        ?.valueReference?.reference
    ).toBe(providerProfile);
    expect(storedNarrativeOf(createdDocument)).toEqual([
      { text: 'Patient reports a dry cough for three days.', sources: ['three days'] },
    ]);
    expect(await observationsDerivedFrom(documentId)).toEqual([
      { field: AiObservationField.Allergies, value: 'No known allergies.' },
      { field: AiObservationField.HistoryOfPresentIllness, value: 'Dry cough for three days.' },
    ]);

    extraction = { historyOfPresentIllness: 'Dry cough for five days.' };
    callModelForJson.mockResolvedValueOnce(narrativeAnswer('Patient reports a dry cough for five days.', 'five days'));

    const edited = await invokeZambdaHandler<SaveTranscriptResponse>(
      index,
      { transcript: EDITED_TRANSCRIPT, encounterId: base.encounter.id, documentId },
      { token }
    );

    expect(edited.statusCode).toBe(200);
    expect(edited.output.documentId).toBe(documentId);
    expect(vertexRequestBodies[1]).toContain(EDITED_TRANSCRIPT);
    const editedDocument = await fetchDocument(documentId);
    expect(transcriptTextOf(editedDocument)).toBe(EDITED_TRANSCRIPT);
    expect(
      editedDocument.extension?.find((extension) => extension.url === `${PUBLIC_EXTENSION_BASE_URL}/provider`)
        ?.valueReference?.reference
    ).toBe(providerProfile);
    expect(storedNarrativeOf(editedDocument)).toEqual([
      { text: 'Patient reports a dry cough for five days.', sources: ['five days'] },
    ]);
    expect(await observationsDerivedFrom(documentId)).toEqual([
      { field: AiObservationField.HistoryOfPresentIllness, value: 'Dry cough for five days.' },
    ]);
  });
});
