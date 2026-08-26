import { DocumentReference } from 'fhir/r4b';
import { AMBIENT_SCRIBE_RECORDING_PENDING_CODING } from 'utils/lib/fhir/constants';
import { VISIT_CONSULT_NOTE_DOC_REF_CODING_CODE } from 'utils/lib/types/api/appointment.types';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// The Z3 presign is the only network hop we can't express through the fetch stub below.
vi.mock('../src/shared/z3Utils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/shared/z3Utils')>();
  return {
    ...actual,
    createPresignedUrl: vi.fn(async () => 'https://z3.example.com/presigned-download'),
  };
});

import { NO_SPEECH_DETECTED, transcribeAndCreateResourcesFromZ3Audio } from '../src/shared/ai';

const Z3_URL = 'https://project-api.zapehr.com/v1/z3/myproject-recordings/enc-1/audio.webm';

const secrets = {
  ENVIRONMENT: 'local',
  GOOGLE_CLOUD_PROJECT_ID: 'gcp-project',
  GOOGLE_CLOUD_API_KEY: 'gcp-key',
} as any;

const pendingDocumentReference = (): DocumentReference => ({
  resourceType: 'DocumentReference',
  id: 'doc-ref-1',
  status: 'current',
  type: { coding: [AMBIENT_SCRIBE_RECORDING_PENDING_CODING] },
  subject: { reference: 'Patient/patient-1' },
  content: [{ attachment: { url: Z3_URL, title: 'Audio recording (00:15)' } }],
  context: { encounter: [{ reference: 'Encounter/enc-1' }] },
});

// Answers the Z3 download with a stub audio body and every Vertex call with `transcriptResponse`.
const stubFetch = (transcriptResponse: string): void => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: any) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.includes('aiplatform.googleapis.com')) {
        return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: transcriptResponse }] } }] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response(new Uint8Array([1, 2, 3]), {
        status: 200,
        headers: { 'Content-Type': 'audio/webm' },
      });
    })
  );
};

const makeOystehr = (): any => ({
  fhir: {
    update: vi.fn(async (resource: DocumentReference) => resource),
    transaction: vi.fn(async () => ({ entry: [] })),
    search: vi.fn(async () => ({ unbundle: () => [] })),
  },
});

describe('transcribeAndCreateResourcesFromZ3Audio - silent recordings', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('clears the pending marker on the in-person recording so the EHR stops showing it as loading', async () => {
    stubFetch(NO_SPEECH_DETECTED);
    const oystehr = makeOystehr();
    const documentReference = pendingDocumentReference();

    const result = await transcribeAndCreateResourcesFromZ3Audio(
      oystehr,
      'm2m-token',
      {
        encounterID: 'enc-1',
        z3URL: Z3_URL,
        providerUserProfile: 'Practitioner/practitioner-1',
        existingDocumentReference: documentReference,
      },
      secrets
    );

    expect(result).toContain('no speech detected');
    expect(oystehr.fhir.update).toHaveBeenCalledTimes(1);
    const updated = oystehr.fhir.update.mock.calls[0][0] as DocumentReference;
    expect(updated.id).toBe('doc-ref-1');
    expect(updated.type?.coding?.[0].code).toBe(VISIT_CONSULT_NOTE_DOC_REF_CODING_CODE.code);
    // The audio attachment survives, so the recording stays playable in the chart.
    expect(updated.content?.[0].attachment.url).toBe(Z3_URL);
    // No transcript document or AI observations get written for a silent recording.
    expect(oystehr.fhir.transaction).not.toHaveBeenCalled();
  });

  it('recognizes the sentinel when the model pads it with whitespace', async () => {
    stubFetch(`${NO_SPEECH_DETECTED}\n`);
    const oystehr = makeOystehr();

    await transcribeAndCreateResourcesFromZ3Audio(
      oystehr,
      'm2m-token',
      {
        encounterID: 'enc-1',
        z3URL: Z3_URL,
        providerUserProfile: 'Practitioner/practitioner-1',
        existingDocumentReference: pendingDocumentReference(),
      },
      secrets
    );

    expect(oystehr.fhir.update).toHaveBeenCalledTimes(1);
    expect(oystehr.fhir.transaction).not.toHaveBeenCalled();
  });

  it('has nothing to clear for a telemed recording, which has no pending DocumentReference', async () => {
    stubFetch(NO_SPEECH_DETECTED);
    const oystehr = makeOystehr();

    const result = await transcribeAndCreateResourcesFromZ3Audio(
      oystehr,
      'm2m-token',
      { encounterID: 'enc-1', z3URL: Z3_URL, providerUserProfile: 'Practitioner/practitioner-1' },
      secrets
    );

    expect(result).toContain('no speech detected');
    expect(oystehr.fhir.update).not.toHaveBeenCalled();
    expect(oystehr.fhir.transaction).not.toHaveBeenCalled();
  });

  it('still runs the normal pipeline when the transcript merely mentions the sentinel', async () => {
    stubFetch(`Provider: does the phrase ${NO_SPEECH_DETECTED} mean anything to you?`);
    const oystehr = makeOystehr();

    // Nothing downstream is stubbed (the chart-data call gets the same non-JSON body), so the pipeline throws —
    // which is itself the proof that the silent-recording branch did not swallow this transcript.
    await expect(
      transcribeAndCreateResourcesFromZ3Audio(
        oystehr,
        'm2m-token',
        {
          encounterID: 'enc-1',
          z3URL: Z3_URL,
          providerUserProfile: 'Practitioner/practitioner-1',
          existingDocumentReference: pendingDocumentReference(),
        },
        secrets
      )
    ).rejects.toThrow();

    expect(oystehr.fhir.search).toHaveBeenCalled();
    expect(oystehr.fhir.update).not.toHaveBeenCalled();
  });
});
