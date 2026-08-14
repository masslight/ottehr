import Oystehr from '@oystehr/sdk';
import { DocumentReference, ServiceRequest } from 'fhir/r4b';
import { PDFDocument } from 'pdf-lib';
import {
  FAX_DOCUMENT_ORDER,
  FAX_DOCUMENT_UNAVAILABLE_REASONS,
  FAX_PACKET_MAX_BYTES,
  FAX_PACKET_MAX_PAGES,
  FAX_PATIENT_EDUCATION_IN_DISCHARGE_SUMMARY_REASON,
} from 'utils/lib/types/api/fax.types';
import { LAB_RESULT_DOC_REF_CODING_CODE } from 'utils/lib/types/data/labs/labs.constants';
import {
  DISCHARGE_SUMMARY_CODE,
  PATIENT_EDUCATION_DOC_TYPE_CODE,
  VISIT_NOTE_SUMMARY_CODE,
} from 'utils/lib/types/data/paperwork/paperwork.constants';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockCreatePresignedUrl = vi.fn();
const mockUploadObjectToZ3 = vi.fn();
vi.mock('../../src/shared/z3Utils', () => ({
  createPresignedUrl: (...args: unknown[]) => mockCreatePresignedUrl(...args),
  uploadObjectToZ3: (...args: unknown[]) => mockUploadObjectToZ3(...args),
}));

// Lets a single test force an oversized merge result without having to synthesize a 20 MB PDF.
const mergeOverride: { bytes: Uint8Array | null } = { bytes: null };
vi.mock('../../src/shared/pdf/merge-pdfs', async (importOriginal) => {
  const actual = (await importOriginal()) as typeof import('../../src/shared/pdf/merge-pdfs');
  return {
    ...actual,
    mergePdfDocuments: async (parts: Uint8Array[]) => {
      const result = await actual.mergePdfDocuments(parts);
      return mergeOverride.bytes ? { ...result, bytes: mergeOverride.bytes } : result;
    },
  };
});

import {
  buildAndUploadPacketForRecipient,
  buildFaxPacketBody,
  buildFaxPacketSection,
  createFaxPacketByteBudget,
  faxPacketLimitGuidance,
  interleaveFaxPacketSections,
} from '../../src/shared/fax/build-fax-packet';
import { collectFaxParts, resolveFaxDocumentAvailability } from '../../src/shared/fax/collect-visit-documents';
import { FullAppointmentResourcePackage } from '../../src/shared/pdf/visit-details-pdf/types';

const APPOINTMENT_ID = 'appointment-1';
const ENCOUNTER_ID = 'encounter-1';

const docRef = (overrides: Partial<DocumentReference> & { id: string }): DocumentReference => ({
  resourceType: 'DocumentReference',
  status: 'current',
  content: [{ attachment: { url: `https://z3.example/${overrides.id}.pdf`, title: overrides.id } }],
  ...overrides,
});

const labResultDocRef = (overrides: Partial<DocumentReference> & { id: string }): DocumentReference =>
  docRef({ ...overrides, type: { coding: [LAB_RESULT_DOC_REF_CODING_CODE] } });

interface Store {
  progressNote: DocumentReference[];
  dischargeSummary: DocumentReference[];
  labs: DocumentReference[];
  education: DocumentReference[];
  serviceRequests: ServiceRequest[];
  radiologyBySr: Record<string, DocumentReference[]>;
}

let store: Store;

const emptyStore = (): Store => ({
  progressNote: [],
  dischargeSummary: [],
  labs: [],
  education: [],
  serviceRequests: [],
  radiologyBySr: {},
});

const mockFhirSearch = vi.fn(({ resourceType, params }: { resourceType: string; params: any[] }) => {
  const param = (name: string): string | undefined => params.find((p) => p.name === name)?.value;

  if (resourceType === 'ServiceRequest') {
    return Promise.resolve({ unbundle: () => store.serviceRequests });
  }

  const related = param('related');
  if (related?.startsWith('ServiceRequest/')) {
    return Promise.resolve({ unbundle: () => store.radiologyBySr[related.split('/')[1]] ?? [] });
  }
  if (related?.startsWith('Appointment/')) {
    return Promise.resolve({ unbundle: () => store.progressNote });
  }

  const type = param('type');
  const byType: Record<string, DocumentReference[]> = {
    [VISIT_NOTE_SUMMARY_CODE]: store.progressNote,
    [DISCHARGE_SUMMARY_CODE]: store.dischargeSummary,
    [`${LAB_RESULT_DOC_REF_CODING_CODE.system}|${LAB_RESULT_DOC_REF_CODING_CODE.code}`]: store.labs,
    [PATIENT_EDUCATION_DOC_TYPE_CODE]: store.education,
  };
  return Promise.resolve({ unbundle: () => (type ? byType[type] ?? [] : []) });
});

const oystehr = { fhir: { search: mockFhirSearch } } as unknown as Oystehr;

const visitResources = {
  appointment: { resourceType: 'Appointment', id: APPOINTMENT_ID },
  encounter: { resourceType: 'Encounter', id: ENCOUNTER_ID },
  patient: { resourceType: 'Patient', id: 'patient-1' },
  listResources: [],
  timezone: 'America/New_York',
} as unknown as FullAppointmentResourcePackage;

const collect = (kinds: Parameters<typeof collectFaxParts>[0]['kinds']): ReturnType<typeof collectFaxParts> =>
  collectFaxParts({ oystehr, token: 'token', secrets: null, kinds, visitResources });

const availability = (): ReturnType<typeof resolveFaxDocumentAvailability> =>
  resolveFaxDocumentAvailability({ oystehr, appointmentId: APPOINTMENT_ID, encounterId: ENCOUNTER_ID });

const makePdfBytes = async (pageCount: number): Promise<Uint8Array> => {
  const pdf = await PDFDocument.create();
  for (let i = 0; i < pageCount; i++) pdf.addPage([612, 792]);
  return pdf.save();
};

/** Each section supplies its own subject; the sheet only carries what every section shares. */
const subject = {
  patientName: 'Black, Oliver',
  patientId: 'patient-1',
  visitId: APPOINTMENT_ID,
  dateOfService: '07/14/2026',
  visitTypeLabel: 'Urgent Care Visit',
};

const coverSheet = {
  sender: {
    practitionerName: 'Dr. John Smith',
    organizationName: 'Ottehr Urgent Care',
    addressText: '123 Main St, New York, NY 10001',
  },
  generatedAt: '07/14/2026  03:45 PM',
};

beforeEach(() => {
  vi.clearAllMocks();
  mergeOverride.bytes = null;
  store = emptyStore();
});

describe('resolveFaxDocumentAvailability', () => {
  it('reports the progress note as available even when no DocumentReference exists yet', async () => {
    const rows = await availability();

    expect(rows.find((row) => row.kind === 'progress-note')).toEqual({
      kind: 'progress-note',
      available: true,
      count: 1,
    });
  });

  it('reports every other kind as unavailable with its own reason when the visit has no documents', async () => {
    const rows = await availability();

    for (const kind of ['discharge-summary', 'lab-results', 'radiology-results', 'patient-education'] as const) {
      expect(rows.find((row) => row.kind === kind)).toEqual({
        kind,
        available: false,
        count: 0,
        unavailableReason: FAX_DOCUMENT_UNAVAILABLE_REASONS[kind],
      });
    }
  });

  it('reports each kind as available with the number of source documents', async () => {
    store.dischargeSummary = [docRef({ id: 'ds-1' })];
    store.labs = [
      labResultDocRef({ id: 'lab-1', docStatus: 'final' }),
      labResultDocRef({ id: 'lab-2', docStatus: 'final' }),
    ];
    store.serviceRequests = [{ resourceType: 'ServiceRequest', id: 'sr-1' } as ServiceRequest];
    store.radiologyBySr = { 'sr-1': [docRef({ id: 'rad-1' })] };

    const rows = await availability();

    expect(rows.find((row) => row.kind === 'discharge-summary')).toMatchObject({ available: true, count: 1 });
    expect(rows.find((row) => row.kind === 'lab-results')).toMatchObject({ available: true, count: 2 });
    expect(rows.find((row) => row.kind === 'radiology-results')).toMatchObject({ available: true, count: 1 });
  });

  it('counts current lab results regardless of docStatus (in-house results are stored preliminary)', async () => {
    store.labs = [
      labResultDocRef({ id: 'lab-final', docStatus: 'final' }),
      labResultDocRef({ id: 'lab-inhouse', docStatus: 'preliminary' }),
    ];

    const rows = await availability();

    expect(rows.find((row) => row.kind === 'lab-results')).toMatchObject({ available: true, count: 2 });
  });

  it('de-duplicates a radiology result shared by two service requests', async () => {
    store.serviceRequests = [
      { resourceType: 'ServiceRequest', id: 'sr-1' } as ServiceRequest,
      { resourceType: 'ServiceRequest', id: 'sr-2' } as ServiceRequest,
    ];
    const shared = docRef({ id: 'rad-shared' });
    store.radiologyBySr = { 'sr-1': [shared], 'sr-2': [shared] };

    const rows = await availability();

    expect(rows.find((row) => row.kind === 'radiology-results')).toMatchObject({ available: true, count: 1 });
  });

  it('suppresses patient education when a discharge summary already contains it', async () => {
    store.dischargeSummary = [docRef({ id: 'ds-1' })];
    store.education = [docRef({ id: 'edu-1' })];

    const rows = await availability();

    expect(rows.find((row) => row.kind === 'patient-education')).toEqual({
      kind: 'patient-education',
      available: false,
      count: 1,
      unavailableReason: FAX_PATIENT_EDUCATION_IN_DISCHARGE_SUMMARY_REASON,
    });
  });

  it('uses the plain "none for this visit" reason when a discharge summary exists but education does not', async () => {
    store.dischargeSummary = [docRef({ id: 'ds-1' })];

    const rows = await availability();

    expect(rows.find((row) => row.kind === 'patient-education')?.unavailableReason).toBe(
      FAX_DOCUMENT_UNAVAILABLE_REASONS['patient-education']
    );
  });

  it('offers patient education on its own when there is no discharge summary', async () => {
    store.education = [docRef({ id: 'edu-1' }), docRef({ id: 'edu-2' })];

    const rows = await availability();

    expect(rows.find((row) => row.kind === 'patient-education')).toEqual({
      kind: 'patient-education',
      available: true,
      count: 2,
    });
  });
});

describe('collectFaxParts', () => {
  it('skips patient education when the discharge summary is also selected', async () => {
    store.dischargeSummary = [docRef({ id: 'ds-1' })];
    store.education = [docRef({ id: 'edu-1' })];

    const parts = await collect(['discharge-summary', 'patient-education']);

    expect(parts.map((part) => part.kind)).toEqual(['discharge-summary']);
  });

  it('includes patient education when the discharge summary is not selected', async () => {
    store.dischargeSummary = [docRef({ id: 'ds-1' })];
    store.education = [docRef({ id: 'edu-1' })];

    const parts = await collect(['patient-education']);

    expect(parts.map((part) => part.documentReferenceId)).toEqual(['edu-1']);
  });

  it('keeps patient education on a full-order request when there is no discharge summary to merge into', async () => {
    // Production always requests the full FAX_DOCUMENT_ORDER, so the dedup must key off the actual
    // discharge summary document, not merely both kinds being requested.
    store.progressNote = [docRef({ id: 'note-1' })];
    store.education = [docRef({ id: 'edu-1' })];

    const parts = await collect(FAX_DOCUMENT_ORDER);

    expect(parts.map((part) => part.kind)).toContain('patient-education');
    expect(parts.find((part) => part.kind === 'patient-education')?.documentReferenceId).toBe('edu-1');
  });

  it('still drops patient education on a full-order request when a discharge summary exists', async () => {
    store.progressNote = [docRef({ id: 'note-1' })];
    store.dischargeSummary = [docRef({ id: 'ds-1' })];
    store.education = [docRef({ id: 'edu-1' })];

    const parts = await collect(FAX_DOCUMENT_ORDER);

    expect(parts.map((part) => part.kind)).not.toContain('patient-education');
  });

  it('includes lab results regardless of docStatus, so in-house (preliminary) results are faxed', async () => {
    store.labs = [
      labResultDocRef({ id: 'lab-final', docStatus: 'final' }),
      labResultDocRef({ id: 'lab-inhouse', docStatus: 'preliminary' }),
    ];

    const parts = await collect(['lab-results']);

    expect(parts.map((part) => part.documentReferenceId).sort()).toEqual(['lab-final', 'lab-inhouse']);
  });

  it('excludes a non-current (superseded) lab result DocumentReference', async () => {
    store.labs = [
      labResultDocRef({ id: 'lab-current' }),
      labResultDocRef({ id: 'lab-superseded', status: 'superseded' }),
    ];

    const parts = await collect(['lab-results']);

    expect(parts.map((part) => part.documentReferenceId)).toEqual(['lab-current']);
  });

  it('orders parts by FAX_DOCUMENT_ORDER regardless of the requested order', async () => {
    store.progressNote = [docRef({ id: 'note-1' })];
    store.labs = [labResultDocRef({ id: 'lab-1', docStatus: 'final' })];
    store.education = [docRef({ id: 'edu-1' })];
    store.serviceRequests = [{ resourceType: 'ServiceRequest', id: 'sr-1' } as ServiceRequest];
    store.radiologyBySr = { 'sr-1': [docRef({ id: 'rad-1' })] };

    const parts = await collect(['patient-education', 'radiology-results', 'lab-results', 'progress-note']);

    expect(parts.map((part) => part.kind)).toEqual([
      'progress-note',
      'lab-results',
      'radiology-results',
      'patient-education',
    ]);
    expect(parts.every((part) => !!part.z3Url)).toBe(true);
  });

  it('orders documents of the same kind newest first', async () => {
    store.labs = [
      labResultDocRef({ id: 'lab-older', docStatus: 'final', date: '2026-01-01T00:00:00.000Z' }),
      labResultDocRef({ id: 'lab-newer', docStatus: 'final', date: '2026-06-01T00:00:00.000Z' }),
    ];

    const parts = await collect(['lab-results']);

    expect(parts.map((part) => part.documentReferenceId)).toEqual(['lab-newer', 'lab-older']);
  });
});

describe('buildFaxPacketBody', () => {
  it('throws when nothing at all could be collected', async () => {
    await expect(
      buildFaxPacketBody({
        oystehr,
        token: 'token',
        secrets: null,
        kinds: ['lab-results'],
        visitResources,
        subject,
      })
    ).rejects.toThrow(/No documents could be collected/);
  });
});

describe('interleaveFaxPacketSections', () => {
  it('places each visit cover immediately before that visit body', () => {
    const bytes = interleaveFaxPacketSections(
      [new Uint8Array([1]), new Uint8Array([2])],
      [{ bytes: new Uint8Array([10]) }, { bytes: new Uint8Array([20]) }]
    );

    expect(bytes.map((part) => part[0])).toEqual([1, 10, 2, 20]);
  });
});

describe('buildFaxPacketSection', () => {
  it('fails the whole fax explicitly when declared metadata hides unsupported bytes', async () => {
    await expect(
      buildFaxPacketSection({
        token: 'token',
        subject,
        parts: [
          {
            kind: 'progress-note',
            title: 'Visit/Progress Note',
            contentType: 'application/pdf',
            bytes: new Uint8Array([0, 0, 0, 20, 0x66, 0x74, 0x79, 0x70, 0x68, 0x65, 0x69, 0x63]),
          },
        ],
      })
    ).rejects.toThrow(
      'Fax packet part "Visit/Progress Note" Unsupported fax attachment type: application/pdf. The entire fax was not sent.'
    );
  });

  it('downloads a section with bounded concurrency instead of all at once', async () => {
    const pdf = await makePdfBytes(1);
    let inFlight = 0;
    let peakInFlight = 0;
    mockCreatePresignedUrl.mockImplementation(async (_token: string, url: string) => {
      inFlight++;
      peakInFlight = Math.max(peakInFlight, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 1));
      inFlight--;
      return url;
    });
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, status: 200, arrayBuffer: () => Promise.resolve(pdf.buffer) })
    );

    await buildFaxPacketSection({
      token: 'token',
      subject,
      parts: Array.from({ length: 25 }, (_unused, index) => ({
        title: `Document ${index}`,
        z3Url: `https://z3.example/doc-${index}.pdf`,
      })),
    });

    // A record with hundreds of documents must not open one request per document at once.
    expect(peakInFlight).toBeGreaterThan(1);
    expect(peakInFlight).toBeLessThanOrEqual(5);
  });

  it('stops downloading once the source documents exceed the size limit', async () => {
    // Each part is a quarter of the budget, so the fifth one crosses it and the rest are never fetched.
    const chunk = new Uint8Array(FAX_PACKET_MAX_BYTES / 4);
    let downloads = 0;
    mockCreatePresignedUrl.mockImplementation(async (_token: string, url: string) => {
      downloads++;
      return url;
    });
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, status: 200, arrayBuffer: () => Promise.resolve(chunk.buffer) })
    );

    await expect(
      buildFaxPacketSection({
        token: 'token',
        subject,
        budget: createFaxPacketByteBudget('medical-record'),
        parts: Array.from({ length: 40 }, (_unused, index) => ({
          title: `Document ${index}`,
          z3Url: `https://z3.example/doc-${index}.pdf`,
        })),
      })
    ).rejects.toThrow(/exceeds the 20 MB limit\. Fax the needed documents individually instead\./);

    expect(downloads).toBeLessThan(40);
  });

  it('spends one budget across every section of a multi-visit packet', async () => {
    const pdf = await makePdfBytes(1);
    const budget = createFaxPacketByteBudget('visits');
    mockCreatePresignedUrl.mockImplementation(async (_token: string, url: string) => url);
    const oversized = new Uint8Array(FAX_PACKET_MAX_BYTES);
    let call = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(() => {
        const bytes = call++ === 0 ? pdf : oversized;
        return Promise.resolve({ ok: true, status: 200, arrayBuffer: () => Promise.resolve(bytes.buffer) });
      })
    );

    const section = (title: string): Parameters<typeof buildFaxPacketSection>[0] => ({
      token: 'token',
      subject,
      budget,
      parts: [{ title, z3Url: `https://z3.example/${title}.pdf` }],
    });

    await expect(buildFaxPacketSection(section('first'))).resolves.toBeDefined();
    // The second visit draws down the same budget, so it is the one that reports the limit.
    await expect(buildFaxPacketSection(section('second'))).rejects.toThrow(/exceeds the 20 MB limit/);
  });
});

describe('buildAndUploadPacketForRecipient', () => {
  const runWithBody = async (
    body: { bytes: Uint8Array; pageCount: number },
    sourceType: 'visits' | 'medical-record' = 'visits'
  ): Promise<unknown> =>
    buildAndUploadPacketForRecipient({
      oystehr,
      token: 'token',
      secrets: null,
      body: { sections: [{ ...body, subject, parts: [] }], pageCount: body.pageCount, parts: [] },
      recipient: { faxNumber: '+12125551234' },
      coverSheet,
      patientId: 'patient-1',
      appointmentId: APPOINTMENT_ID,
      encounterId: ENCOUNTER_ID,
      sourceType,
      listResources: [],
    });

  it('throws before uploading when the packet exceeds the page limit', async () => {
    const bytes = await makePdfBytes(FAX_PACKET_MAX_PAGES);

    await expect(runWithBody({ bytes, pageCount: FAX_PACKET_MAX_PAGES })).rejects.toThrow(
      `Fax packet is ${FAX_PACKET_MAX_PAGES + 1} pages, which exceeds the ${FAX_PACKET_MAX_PAGES} page limit. ` +
        faxPacketLimitGuidance('visits')
    );
    expect(mockCreatePresignedUrl).not.toHaveBeenCalled();
    expect(mockUploadObjectToZ3).not.toHaveBeenCalled();
  });

  it('throws before uploading when the packet exceeds the size limit', async () => {
    mergeOverride.bytes = new Uint8Array(FAX_PACKET_MAX_BYTES + 1);
    const bytes = await makePdfBytes(2);

    await expect(runWithBody({ bytes, pageCount: 2 }, 'medical-record')).rejects.toThrow(
      /exceeds the 20 MB limit\. Fax the needed documents individually instead\./
    );
    expect(mockUploadObjectToZ3).not.toHaveBeenCalled();
  });
});
