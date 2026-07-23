import { DocumentReference, Encounter } from 'fhir/r4b';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// vi.mock factories are hoisted above other top-level statements, so shared mock fns must be created via vi.hoisted.
const { transcribeAndCreateResourcesFromZ3Audio, fhirGet, getAttendingPractitionerId } = vi.hoisted(() => ({
  transcribeAndCreateResourcesFromZ3Audio: vi.fn(async () => 'DocumentReference/new,Observation/new'),
  fhirGet: vi.fn(),
  getAttendingPractitionerId: vi.fn(),
}));

// Mock the shared AI pipeline so no real transcription / FHIR writes happen.
vi.mock('../src/shared/ai', () => ({
  transcribeAndCreateResourcesFromZ3Audio,
}));

// Mock auth so the handler runs offline.
vi.mock('../src/shared', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/shared')>();
  return {
    ...actual,
    getAuth0Token: vi.fn(async () => 'mock-token'),
  };
});

// createOystehrClient/getAttendingPractitionerId are imported from 'utils' by the handler, so mock the encounter
// lookup and provider attribution here instead of '../src/shared'.
vi.mock('utils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('utils')>();
  return {
    ...actual,
    createOystehrClient: vi.fn(() => ({ fhir: { get: fhirGet } })),
    getAttendingPractitionerId,
  };
});

import { index } from '../src/subscriptions/document-reference/process-telemed-recording/index';

const RECORDING_URL = 'https://project-api.zapehr.com/v1/z3/myproject-TelemedRecordings/meeting-uuid/audio.mp4';
const secrets = {
  ENVIRONMENT: 'local',
  PROJECT_ID: 'myproject',
  FHIR_API: 'https://fhir-api.zapehr.com',
  PROJECT_API: 'https://project-api.zapehr.com',
} as any;

const telemedRecordingDocRef = (overrides: Partial<DocumentReference> = {}): DocumentReference => ({
  resourceType: 'DocumentReference',
  id: 'doc-ref-1',
  status: 'current',
  type: { coding: [{ system: 'http://loinc.org', code: '56444-3', display: 'Healthcare communication Document' }] },
  content: [{ attachment: { url: RECORDING_URL, contentType: 'audio/mp4', title: 'Audio recording of the meeting' } }],
  context: { encounter: [{ reference: 'Encounter/enc-1' }] },
  ...overrides,
});

const invoke = (documentReference: DocumentReference): Promise<any> =>
  (index as any)({ body: JSON.stringify(documentReference), secrets }, {} as any, () => {});

const encounter: Encounter = { resourceType: 'Encounter', id: 'enc-1', status: 'finished', class: { code: 'VR' } };

describe('process-telemed-recording subscription', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fhirGet.mockResolvedValue(encounter);
    getAttendingPractitionerId.mockReturnValue('prac-1');
  });

  it('processes a telemed recording: resolves the encounter, attributes the provider, and runs the AI pipeline', async () => {
    const result = await invoke(telemedRecordingDocRef());

    expect(fhirGet).toHaveBeenCalledWith({ resourceType: 'Encounter', id: 'enc-1' });
    expect(getAttendingPractitionerId).toHaveBeenCalledWith(encounter);
    expect(transcribeAndCreateResourcesFromZ3Audio).toHaveBeenCalledWith(
      expect.anything(),
      'mock-token',
      { encounterID: 'enc-1', z3URL: RECORDING_URL, providerUserProfile: 'Practitioner/prac-1' },
      secrets
    );
    expect(result.statusCode).toBe(200);
  });

  it('skips lab HL7 documents that share LOINC 56444-3 but have no audio attachment', async () => {
    const labDoc = telemedRecordingDocRef({
      content: [
        {
          attachment: {
            url: 'https://project-api.zapehr.com/v1/z3/myproject-labs/x.pdf',
            contentType: 'application/pdf',
          },
        },
      ],
    });

    const result = await invoke(labDoc);

    expect(transcribeAndCreateResourcesFromZ3Audio).not.toHaveBeenCalled();
    expect(fhirGet).not.toHaveBeenCalled();
    expect(result.statusCode).toBe(200);
  });

  it('skips when there is no encounter context reference', async () => {
    const result = await invoke(telemedRecordingDocRef({ context: undefined }));

    expect(transcribeAndCreateResourcesFromZ3Audio).not.toHaveBeenCalled();
    expect(result.statusCode).toBe(200);
  });

  it('skips when the encounter has no attending practitioner', async () => {
    getAttendingPractitionerId.mockReturnValue(undefined);

    const result = await invoke(telemedRecordingDocRef());

    expect(transcribeAndCreateResourcesFromZ3Audio).not.toHaveBeenCalled();
    expect(result.statusCode).toBe(200);
  });
});
