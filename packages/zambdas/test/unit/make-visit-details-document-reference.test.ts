import Oystehr from '@oystehr/sdk';
import { DocumentReference } from 'fhir/r4b';
import { describe, expect, it } from 'vitest';
import { makeVisitDetailsPdfDocumentReference } from '../../src/shared/pdf/make-visit-details-document-reference';

const TITLE = 'Visit Details: 11-20-2026';
const UPLOAD_URL =
  'https://project-api.zapehr.com/v1/z3/project-1-visit-notes/patient-1/2026-11-20-1763650000000-VisitDetails.pdf';

const existingDocument = (id: string, title: string): DocumentReference => ({
  resourceType: 'DocumentReference',
  id,
  status: 'current',
  type: { coding: [{ system: 'http://loinc.org', code: 'visit-details' }] },
  content: [{ attachment: { title, url: `https://z3/${id}.pdf` } }],
  context: { encounter: [{ reference: 'Encounter/enc-1' }] },
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
        const matches = documents.filter(
          (doc) => doc.status === param('status') && doc.context?.encounter?.[0]?.reference === param('encounter')
        );
        return { unbundle: () => matches };
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

const make = (oystehr: Oystehr): Promise<DocumentReference> =>
  makeVisitDetailsPdfDocumentReference(
    oystehr,
    { uploadURL: UPLOAD_URL, title: TITLE },
    'patient-1',
    'appt-1',
    'enc-1',
    []
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
    expect(superseded).toEqual([]);
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
