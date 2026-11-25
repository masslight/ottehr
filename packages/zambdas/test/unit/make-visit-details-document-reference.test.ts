import Oystehr from '@oystehr/sdk';
import { DocumentReference } from 'fhir/r4b';
import { describe, expect, it } from 'vitest';
import {
  findSignedVisitDetailsDocument,
  makeVisitDetailsPdfDocumentReference,
} from '../../src/shared/pdf/make-visit-details-document-reference';

const TITLE = 'Visit Details: 11-20-2026';
const UPLOAD_URL =
  'https://project-api.zapehr.com/v1/z3/project-1-visit-notes/patient-1/2026-11-20-1763650000000-VisitDetails.pdf';
const SEARCH_PAGE_SIZE = 20;

const existingDocument = (
  id: string,
  title: string,
  overrides: Partial<DocumentReference> = {}
): DocumentReference => ({
  resourceType: 'DocumentReference',
  id,
  status: 'current',
  type: { coding: [{ system: 'http://loinc.org', code: 'visit-details' }] },
  content: [{ attachment: { title, url: `https://z3/${id}.pdf` } }],
  context: { encounter: [{ reference: 'Encounter/enc-1' }] },
  ...overrides,
});

const fakeOystehr = (
  documents: DocumentReference[]
): { oystehr: Oystehr; searches: string[]; superseded: string[]; created: DocumentReference[] } => {
  const searches: string[] = [];
  const superseded: string[] = [];
  const created: DocumentReference[] = [];
  const oystehr = {
    fhir: {
      search: async ({ resourceType, params }: { resourceType: string; params: { name: string; value: string }[] }) => {
        searches.push(`${resourceType}?${params.map((p) => `${p.name}=${p.value}`).join('&')}`);
        const param = (name: string): string | undefined => params.find((p) => p.name === name)?.value;
        const [typeSystem, typeCode] = param('type')?.split('|') ?? [];
        const matches = documents.filter(
          (doc) =>
            doc.status === param('status') &&
            doc.context?.encounter?.[0]?.reference === param('encounter') &&
            (!typeCode || !!doc.type?.coding?.some((c) => c.system === typeSystem && c.code === typeCode))
        );
        return { unbundle: () => matches.slice(0, SEARCH_PAGE_SIZE) };
      },
      patch: async ({ resourceType, id }: { resourceType: string; id: string }) => {
        if (resourceType === 'DocumentReference') {
          superseded.push(id);
          const doc = documents.find((candidate) => candidate.id === id);
          if (doc) doc.status = 'superseded';
        }
        return {};
      },
      transaction: async ({ requests }: { requests: { resource: DocumentReference }[] }) => {
        const resource = { ...requests[0].resource, id: 'new-document' };
        created.push(resource);
        documents.push(resource);
        return { entry: [{ resource }] };
      },
      create: async (resource: object) => ({ ...resource, id: 'folder-list' }),
    },
  } as unknown as Oystehr;
  return { oystehr, searches, superseded, created };
};

const make = (oystehr: Oystehr, signingCopy?: boolean): Promise<DocumentReference> =>
  makeVisitDetailsPdfDocumentReference(
    oystehr,
    { uploadURL: UPLOAD_URL, title: TITLE },
    'patient-1',
    'appt-1',
    'enc-1',
    [],
    undefined,
    signingCopy
  );

describe('makeVisitDetailsPdfDocumentReference', () => {
  it('saves the PDF under its title, linked to the encounter and the appointment', async () => {
    const { oystehr, created, superseded } = fakeOystehr([]);
    await make(oystehr);
    expect(created).toHaveLength(1);
    expect(created[0].content[0].attachment.title).toBe(TITLE);
    expect(created[0].content[0].attachment.url).toBe(UPLOAD_URL);
    expect(created[0].content[0].attachment.url).toMatch(/^\S*$/);
    expect(created[0].context?.encounter).toEqual([{ reference: 'Encounter/enc-1' }]);
    expect(created[0].context?.related).toContainEqual({ reference: 'Appointment/appt-1' });
    expect(created[0].docStatus).toBeUndefined();
    expect(superseded).toEqual([]);
  });

  it('saves the signing-time copy as final, superseding the copy downloaded before signing', async () => {
    const { oystehr, created, superseded } = fakeOystehr([existingDocument('downloaded-before-signing', TITLE)]);
    await make(oystehr, true);
    expect(created[0].docStatus).toBe('final');
    expect(superseded).toEqual(['downloaded-before-signing']);
  });

  it('replaces the earlier signing-time copy when the visit is signed again', async () => {
    const { oystehr, created, superseded } = fakeOystehr([
      existingDocument('first-signing', TITLE, { docStatus: 'final' }),
    ]);
    await make(oystehr, true);
    expect(created[0].docStatus).toBe('final');
    expect(superseded).toEqual(['first-signing']);
  });

  it('supersedes the previous copy with the same title on regeneration', async () => {
    const { oystehr, superseded } = fakeOystehr([existingDocument('previous-copy', TITLE)]);
    await make(oystehr);
    expect(superseded).toEqual(['previous-copy']);
  });

  it('leaves a copy saved under another title current, after a single search', async () => {
    const { oystehr, searches, superseded, created } = fakeOystehr([
      existingDocument('previous-copy', 'VisitDetails.pdf'),
    ]);
    await make(oystehr);
    expect(created).toHaveLength(1);
    expect(superseded).toEqual([]);
    expect(searches).toEqual(['DocumentReference?status=current&encounter=Encounter/enc-1']);
  });
});

describe('findSignedVisitDetailsDocument', () => {
  it("finds the encounter's current signing-time copy among its other documents", async () => {
    const { oystehr } = fakeOystehr([
      existingDocument('downloaded', TITLE),
      existingDocument('signing-copy', TITLE, { docStatus: 'final' }),
    ]);
    expect((await findSignedVisitDetailsDocument(oystehr, 'enc-1'))?.id).toBe('signing-copy');
  });

  it('searches for Visit Details only, so a full page of other encounter documents cannot hide the signing-time copy', async () => {
    const otherDocuments = Array.from({ length: SEARCH_PAGE_SIZE }, (_, i) =>
      existingDocument(`consent-${i}`, `Consent ${i}`, {
        type: { coding: [{ system: 'http://loinc.org', code: '59284-0' }] },
      })
    );
    const { oystehr, searches } = fakeOystehr([
      ...otherDocuments,
      existingDocument('signing-copy', TITLE, { docStatus: 'final' }),
    ]);
    expect((await findSignedVisitDetailsDocument(oystehr, 'enc-1'))?.id).toBe('signing-copy');
    expect(searches).toEqual([
      'DocumentReference?status=current&encounter=Encounter/enc-1&type=http://loinc.org|visit-details',
    ]);
  });

  it.each([
    ['only unmarked copies', [existingDocument('downloaded', TITLE), existingDocument('legacy', 'VisitDetails.pdf')]],
    ['a superseded signing-time copy', [existingDocument('old', TITLE, { docStatus: 'final', status: 'superseded' })]],
    [
      'a final document of another type',
      [
        existingDocument('visit-note', 'Visit Note', {
          docStatus: 'final',
          type: { coding: [{ system: 'http://loinc.org', code: '75498-6' }] },
        }),
      ],
    ],
    [
      "another encounter's signing-time copy",
      [
        existingDocument('other', TITLE, {
          docStatus: 'final',
          context: { encounter: [{ reference: 'Encounter/enc-2' }] },
        }),
      ],
    ],
  ])('finds nothing when the encounter has %s', async (_, documents) => {
    expect(await findSignedVisitDetailsDocument(fakeOystehr(documents).oystehr, 'enc-1')).toBeUndefined();
  });
});
