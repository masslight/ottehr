import Oystehr, { BatchInputPostRequest } from '@oystehr/sdk';
import { DocumentReference } from 'fhir/r4b';
import { describe, expect, it, vi } from 'vitest';
import { createFilesDocumentReferences } from './helpers';

const writtenDate = async (dateCreated: string): Promise<DocumentReference['date']> => {
  const transaction = vi
    .fn<(input: { requests: BatchInputPostRequest<DocumentReference>[] }) => Promise<unknown>>()
    .mockResolvedValue({ entry: [] });
  const oystehr = {
    fhir: { search: vi.fn().mockResolvedValue({ unbundle: () => [] }), transaction },
  } as unknown as Oystehr;

  await createFilesDocumentReferences({
    files: [{ url: 'z3://bucket/card.jpg', title: 'insurance-card-front' }],
    type: { coding: [{ system: 'http://loinc.org', code: '64290-0' }] },
    dateCreated,
    references: { subject: { reference: 'Patient/pat-1' } },
    oystehr,
    searchParams: [],
  });

  expect(transaction).toHaveBeenCalledTimes(1);
  return transaction.mock.calls[0][0].requests[0].resource.date;
};

describe('createFilesDocumentReferences date', () => {
  it.each(['', '   '])('omits DocumentReference.date when dateCreated is %j', async (dateCreated) => {
    expect(await writtenDate(dateCreated)).toBeUndefined();
  });

  it('writes the given dateCreated as DocumentReference.date', async () => {
    expect(await writtenDate('2026-08-01T10:00:00.000Z')).toBe('2026-08-01T10:00:00.000Z');
  });
});
