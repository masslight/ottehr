import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { DocumentReference, QuestionnaireResponse } from 'fhir/r4b';
import { ReactNode } from 'react';
import { INTAKE_PAPERWORK_QR_TAG } from 'utils/lib/fhir/constants';
import {
  DocumentType,
  PHOTO_ID_EXTRACTION_EXTENSION_URL,
  PhotoIdExtraction,
  PhotoIdExtractionFields,
} from 'utils/lib/types/data/documents';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ============================================================================
// MOCKS
// ============================================================================
// One mocked fhir.search; each test dispatches on the resourceType it is asked for. The hook only
// ever calls `.unbundle()` on the result, so a bundle stub with that one method is enough.
const mockFhirSearch = vi.fn<(...args: any[]) => Promise<{ unbundle: () => any[] }>>();
const oystehrMock = { fhir: { search: (...args: any[]) => mockFhirSearch(...args) } } as any;

vi.mock('src/hooks/useAppClients', () => ({
  useApiClients: () => ({ oystehr: oystehrMock, oystehrZambda: {} as any }),
}));

// The hook (and useInsuranceCardExtraction, which it imports) reach for the extraction zambdas to
// backfill an un-OCR'd image; every fixture here already carries an extraction, so these must stay
// unused — asserted in the first test.
const mockExtractPhotoId = vi.fn();
vi.mock('src/api/api', () => ({
  extractPhotoId: (...args: any[]) => mockExtractPhotoId(...args),
  extractInsuranceCard: vi.fn(),
}));

// Imported AFTER the mocks so they take effect.
import { usePhotoIdExtraction } from '../../src/features/visits/shared/components/patient/usePhotoIdExtraction';

// ============================================================================
// FIXTURES & HARNESS
// ============================================================================
const PATIENT_ID = 'patient-1';
const TAG_PARAM = `${INTAKE_PAPERWORK_QR_TAG.system}|${INTAKE_PAPERWORK_QR_TAG.code}`;

const makeFields = (overrides: Partial<PhotoIdExtractionFields> = {}): PhotoIdExtractionFields => ({
  firstName: 'MARGERY',
  middleName: 'Q',
  lastName: 'GUARDIAN',
  suffix: 'SR',
  dateOfBirth: '1980-05-06',
  sex: 'Female',
  addressLine1: '742 EVERGREEN TER',
  addressLine2: null,
  addressCity: 'Springfield',
  addressState: 'MA',
  addressZip: '01103',
  licenseNumber: 'S1234567',
  expirationDate: '2030-01-01',
  ...overrides,
});

const makeIdentitylessFields = (): PhotoIdExtractionFields =>
  makeFields({ firstName: null, middleName: null, lastName: null, suffix: null, dateOfBirth: null, sex: null });

const makePhotoIdFront = (fields: PhotoIdExtractionFields): DocumentReference => {
  const extraction: PhotoIdExtraction = {
    version: 1,
    isPhotoId: true,
    fields,
    sourceDocRefId: 'doc-1',
    sourceAttachmentUrl: 'z3://photo-id-front.jpg',
    model: 'test',
    extractedAt: '2026-09-16T12:00:00.000Z',
  };
  return {
    resourceType: 'DocumentReference',
    id: 'doc-1',
    status: 'current',
    content: [{ attachment: { title: DocumentType.PhotoIdFront, url: 'z3://photo-id-front.jpg' } }],
    extension: [{ url: PHOTO_ID_EXTRACTION_EXTENSION_URL, valueString: JSON.stringify(extraction) }],
  };
};

const makePaperwork = (relationship: string): QuestionnaireResponse => ({
  resourceType: 'QuestionnaireResponse',
  status: 'in-progress',
  item: [
    {
      linkId: 'consent-forms-page',
      item: [{ linkId: 'consent-form-signer-relationship', answer: [{ valueString: relationship }] }],
    },
  ],
});

/** Arranges the two searches the hook makes: photo-ID DocRefs, then (maybe) paperwork. */
const arrangeSearches = (options: {
  docRefs: DocumentReference[];
  tagged?: QuestionnaireResponse[];
  untagged?: QuestionnaireResponse[];
  paperworkError?: Error;
}): void => {
  mockFhirSearch.mockImplementation(async (params: any) => {
    if (params.resourceType === 'DocumentReference') return { unbundle: () => options.docRefs };
    if (options.paperworkError) throw options.paperworkError;
    const isTagged = params.params.some((param: any) => param.name === '_tag');
    return { unbundle: () => (isTagged ? options.tagged : options.untagged) ?? [] };
  });
};

const paperworkSearchCalls = (): any[] =>
  mockFhirSearch.mock.calls.map(([params]) => params).filter((p) => p.resourceType === 'QuestionnaireResponse');

const wrapper = ({ children }: { children: ReactNode }): JSX.Element => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
};

const renderAndSettle = async (): Promise<PhotoIdExtractionFields | null> => {
  const { result } = renderHook(() => usePhotoIdExtraction(PATIENT_ID), { wrapper });
  await waitFor(() => expect(result.current.isLoading).toBe(false));
  return result.current.fields;
};

// ============================================================================
// TESTS
// ============================================================================
describe('usePhotoIdExtraction consent-signer gate', () => {
  beforeEach(() => {
    mockFhirSearch.mockReset();
    mockExtractPhotoId.mockReset();
  });

  it('strips the holder’s identity when someone other than the patient signed consent', async () => {
    arrangeSearches({ docRefs: [makePhotoIdFront(makeFields())], tagged: [makePaperwork('Parent')] });

    const fields = await renderAndSettle();

    expect(fields).toEqual(makeIdentitylessFields());
    expect(fields?.addressLine1).toBe('742 EVERGREEN TER');
    expect(mockExtractPhotoId).not.toHaveBeenCalled();
  });

  it('asks for the patient’s newest intake paperwork, newest first', async () => {
    arrangeSearches({ docRefs: [makePhotoIdFront(makeFields())], tagged: [makePaperwork('Parent')] });

    await renderAndSettle();

    expect(paperworkSearchCalls()).toHaveLength(1);
    expect(paperworkSearchCalls()[0].params).toEqual([
      { name: 'subject', value: `Patient/${PATIENT_ID}` },
      { name: '_tag', value: TAG_PARAM },
      { name: '_sort', value: '-_lastUpdated' },
      { name: '_count', value: '5' },
    ]);
  });

  it('keeps the identity when the patient signed their own consent', async () => {
    arrangeSearches({ docRefs: [makePhotoIdFront(makeFields())], tagged: [makePaperwork('Self')] });

    expect(await renderAndSettle()).toEqual(makeFields());
  });

  it('keeps the identity when no paperwork has recorded a relationship yet', async () => {
    arrangeSearches({ docRefs: [makePhotoIdFront(makeFields())], tagged: [] });

    expect(await renderAndSettle()).toEqual(makeFields());
  });

  it('falls back to an untagged search for paperwork booked before the intake tag existed', async () => {
    arrangeSearches({
      docRefs: [makePhotoIdFront(makeFields())],
      tagged: [],
      untagged: [makePaperwork('Legal Guardian')],
    });

    const fields = await renderAndSettle();

    expect(fields).toEqual(makeIdentitylessFields());
    const calls = paperworkSearchCalls();
    expect(calls).toHaveLength(2);
    expect(calls[1].params.some((param: any) => param.name === '_tag')).toBe(false);
  });

  it('never reads paperwork when the ID produced no identity to gate', async () => {
    const addressOnly = makeIdentitylessFields();
    arrangeSearches({ docRefs: [makePhotoIdFront(addressOnly)], tagged: [makePaperwork('Parent')] });

    expect(await renderAndSettle()).toEqual(addressOnly);
    expect(paperworkSearchCalls()).toHaveLength(0);
  });

  it('withholds the identity when the paperwork read fails', async () => {
    arrangeSearches({ docRefs: [makePhotoIdFront(makeFields())], paperworkError: new Error('FHIR down') });

    expect(await renderAndSettle()).toEqual(makeIdentitylessFields());
  });
});
