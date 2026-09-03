import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { List } from 'fhir/r4b';
import { ReactNode } from 'react';
import { FOLDERS_CONFIG } from 'utils/lib/fhir/constants';
import {
  CUSTOM_FOLDER_DELETED_FLAG_CODE,
  CUSTOM_FOLDER_ENTRY_FLAG_SYSTEM,
  CUSTOM_FOLDERS_CATALOG_IDENTIFIER,
} from 'utils/lib/fhir/list';
import { SYNTHETIC_FOLDER_ID_PREFIX } from 'utils/lib/types/data/custom-folder.types';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock useAppClients before the hook is imported.
const mockFhirSearch = vi.fn<(...args: any[]) => Promise<any>>();

vi.mock('src/hooks/useAppClients', () => ({
  useApiClients: () => ({
    oystehr: { fhir: { search: (...args: any[]) => mockFhirSearch(...args) } } as any,
    oystehrZambda: {} as any,
  }),
}));

vi.mock('../../src/hooks/useAppClients', () => ({
  useApiClients: () => ({
    oystehr: { fhir: { search: (...args: any[]) => mockFhirSearch(...args) } } as any,
    oystehrZambda: {} as any,
  }),
}));

// Auth0 isn't relevant for the folders merge but the hook imports it.
vi.mock('@auth0/auth0-react', () => ({
  useAuth0: () => ({ getAccessTokenSilently: vi.fn().mockResolvedValue('token') }),
}));

import { PatientDocumentsFilters, PatientDocumentsFolder, useGetPatientDocs } from '../../src/hooks/useGetPatientDocs';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const PROTECTED_FOLDER = FOLDERS_CONFIG[0];
const PATIENT_ID = 'patient-1';

const protectedList = (id: string, title: string, display: string, entryCount = 0): List => ({
  resourceType: 'List',
  id,
  status: 'current',
  mode: 'working',
  title,
  code: {
    coding: [{ system: 'https://fhir.zapehr.com/r4/StructureDefinitions', code: 'patient-docs-folder', display }],
  },
  subject: { reference: `Patient/${PATIENT_ID}` },
  entry: Array.from({ length: entryCount }, (_, i) => ({
    item: { type: 'DocumentReference', reference: `DocumentReference/doc-${id}-${i}` },
  })),
});

// Per-patient List for a custom folder. Mirrors `createCustomPatientDocumentList`:
// no `display` on the coding — the displayName is resolved from the catalog.
const customList = (id: string, internalName: string, entryCount = 0): List => ({
  resourceType: 'List',
  id,
  status: 'current',
  mode: 'working',
  title: internalName,
  code: {
    coding: [
      { system: 'https://fhir.zapehr.com/r4/StructureDefinitions', code: 'patient-docs-folder' },
      { system: 'https://fhir.ottehr.com/r4/CodeSystem/folder-kind', code: 'custom' },
    ],
  },
  subject: { reference: `Patient/${PATIENT_ID}` },
  entry: Array.from({ length: entryCount }, (_, i) => ({
    item: { type: 'DocumentReference', reference: `DocumentReference/doc-${id}-${i}` },
  })),
});

const catalogList = (entries: { internalName: string; displayName: string; deleted?: boolean }[]): List => ({
  resourceType: 'List',
  id: 'catalog-1',
  status: 'current',
  mode: 'working',
  identifier: [{ value: CUSTOM_FOLDERS_CATALOG_IDENTIFIER }],
  entry: entries.map((e) => ({
    item: { display: e.displayName, identifier: { value: e.internalName } },
    ...(e.deleted
      ? {
          flag: {
            coding: [{ system: CUSTOM_FOLDER_ENTRY_FLAG_SYSTEM, code: CUSTOM_FOLDER_DELETED_FLAG_CODE }],
          },
        }
      : {}),
  })),
});

const stubBundle = (resources: List[]): any => ({ unbundle: () => resources });

// configure mockFhirSearch by params: identify catalog vs lists query.
const setupSearch = (
  perPatientLists: List[],
  catalogEntries: { internalName: string; displayName: string; deleted?: boolean }[]
): void => {
  mockFhirSearch.mockImplementation(async (req: any) => {
    const params: { name: string; value: string }[] = req?.params ?? [];
    const isCatalogSearch = params.some(
      (p) => p.name === 'identifier' && p.value === CUSTOM_FOLDERS_CATALOG_IDENTIFIER
    );
    if (isCatalogSearch) {
      return stubBundle(catalogEntries.length > 0 ? [catalogList(catalogEntries)] : []);
    }
    // Per-patient List search.
    return stubBundle(perPatientLists);
  });
};

const wrapper = ({ children }: { children: ReactNode }): JSX.Element => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
  });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
};

const renderUseGetPatientDocs = (filters?: PatientDocumentsFilters): { current: () => PatientDocumentsFolder[] } => {
  const result = renderHook(() => useGetPatientDocs(PATIENT_ID, filters), { wrapper });
  return { current: () => result.result.current.documentsFolders };
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useGetPatientDocs — folders merge', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('synthesizes a folder for a catalog entry that has no per-patient List yet', async () => {
    setupSearch(
      [protectedList('list-1', PROTECTED_FOLDER.title, PROTECTED_FOLDER.display)],
      [{ internalName: 'custom-folder-after-visit-care', displayName: 'After-Visit Care' }]
    );
    const folders = renderUseGetPatientDocs();
    await waitFor(() => expect(folders.current().length).toBeGreaterThan(0));
    const synth = folders.current().find((f) => f.internalName === 'custom-folder-after-visit-care');
    expect(synth).toBeDefined();
    expect(synth!.id.startsWith(SYNTHETIC_FOLDER_ID_PREFIX)).toBe(true);
    expect(synth!.folderName).toBe('After-Visit Care');
    expect(synth!.documentsCount).toBe(0);
    expect(synth!.isCustom).toBe(true);
  });

  it('synthesizes every system folder for a patient with no per-patient Lists', async () => {
    // Models a patient created before system-folder seeding existed: no Lists at all.
    // Every FOLDERS_CONFIG folder must still appear so the user can open and upload to it.
    setupSearch([], []);
    const folders = renderUseGetPatientDocs();
    await waitFor(() => expect(folders.current().length).toBe(FOLDERS_CONFIG.length));
    for (const config of FOLDERS_CONFIG) {
      const synth = folders.current().find((f) => f.internalName === config.title);
      expect(synth, `missing system folder ${config.title}`).toBeDefined();
      expect(synth!.id.startsWith(SYNTHETIC_FOLDER_ID_PREFIX)).toBe(true);
      expect(synth!.folderName).toBe(config.display);
      expect(synth!.documentsCount).toBe(0);
      expect(synth!.isCustom).toBe(false);
    }
  });

  it('uses the real per-patient List for a system folder instead of synthesizing it', async () => {
    setupSearch([protectedList('list-1', PROTECTED_FOLDER.title, PROTECTED_FOLDER.display, 2)], []);
    const folders = renderUseGetPatientDocs();
    await waitFor(() => expect(folders.current().some((f) => f.internalName === PROTECTED_FOLDER.title)).toBe(true));
    const seeded = folders.current().filter((f) => f.internalName === PROTECTED_FOLDER.title);
    expect(seeded).toHaveLength(1);
    expect(seeded[0].id).toBe('list-1');
    expect(seeded[0].documentsCount).toBe(2);
    expect(seeded[0].id.startsWith(SYNTHETIC_FOLDER_ID_PREFIX)).toBe(false);
    // The remaining system folders are still synthesized.
    expect(folders.current().length).toBe(FOLDERS_CONFIG.length);
  });

  it('drops a custom per-patient List with no matching catalog entry', async () => {
    // Anomalous state: per-patient List references an internalName the catalog knows
    // nothing about (not even as a tombstone). Skip rather than render an unnamed folder.
    setupSearch([customList('list-orphan', 'custom-folder-orphan', 0)], []);
    const folders = renderUseGetPatientDocs();
    await waitFor(() => expect(mockFhirSearch).toHaveBeenCalled());
    expect(folders.current().some((f) => f.internalName === 'custom-folder-orphan')).toBe(false);
  });

  it('catalog displayName drives folder name even after rename', async () => {
    setupSearch(
      [customList('list-renamed', 'custom-folder-renamed', 2)],
      [{ internalName: 'custom-folder-renamed', displayName: 'New Name' }]
    );
    const folders = renderUseGetPatientDocs();
    await waitFor(() => expect(folders.current().some((f) => f.internalName === 'custom-folder-renamed')).toBe(true));
    const folder = folders.current().find((f) => f.internalName === 'custom-folder-renamed')!;
    expect(folder.folderName).toBe('New Name');
    expect(folder.id).toBe('list-renamed');
    expect(folder.documentsCount).toBe(2);
  });

  it('soft-deleted catalog entry still resolves the latest displayName for an existing per-patient List', async () => {
    // Simulates: admin created "Custom Folder", patient uploaded a doc, admin renamed to
    // "Primary Folder" then deleted. The catalog entry is now a tombstone with the
    // latest displayName "Primary Folder". The patient docs view must show "Primary Folder".
    setupSearch(
      [customList('list-soft-deleted', 'custom-folder-x', 1)],
      [{ internalName: 'custom-folder-x', displayName: 'Primary Folder', deleted: true }]
    );
    const folders = renderUseGetPatientDocs();
    await waitFor(() => expect(folders.current().some((f) => f.internalName === 'custom-folder-x')).toBe(true));
    const folder = folders.current().find((f) => f.internalName === 'custom-folder-x')!;
    expect(folder.folderName).toBe('Primary Folder');
    expect(folder.documentsCount).toBe(1);
  });

  it('does not synthesize a folder for a soft-deleted catalog entry when no per-patient List exists', async () => {
    setupSearch(
      [protectedList('list-1', PROTECTED_FOLDER.title, PROTECTED_FOLDER.display)],
      [{ internalName: 'custom-folder-tombstoned', displayName: 'Tombstoned Folder', deleted: true }]
    );
    const folders = renderUseGetPatientDocs();
    await waitFor(() => expect(mockFhirSearch).toHaveBeenCalled());
    expect(folders.current().some((f) => f.internalName === 'custom-folder-tombstoned')).toBe(false);
  });

  it('deduplicates by internalName when both a per-patient List and a catalog entry exist', async () => {
    setupSearch(
      [customList('list-dup', 'custom-folder-foo', 3)],
      [{ internalName: 'custom-folder-foo', displayName: 'Foo from catalog' }]
    );
    const folders = renderUseGetPatientDocs();
    await waitFor(() => expect(folders.current().some((f) => f.internalName === 'custom-folder-foo')).toBe(true));
    const matches = folders.current().filter((f) => f.internalName === 'custom-folder-foo');
    expect(matches).toHaveLength(1);
    expect(matches[0].id).toBe('list-dup');
    expect(matches[0].folderName).toBe('Foo from catalog');
  });
});

describe('useGetPatientDocs — document search short-circuit on synthetic folders', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not query DocumentReference when the selected folder id is synthetic', async () => {
    setupSearch([], [{ internalName: 'custom-folder-synthetic', displayName: 'Synthetic' }]);
    // Mount the hook with a synthetic folder selected.
    const filters: PatientDocumentsFilters = {
      documentsFolder: {
        id: `${SYNTHETIC_FOLDER_ID_PREFIX}custom-folder-synthetic`,
        folderName: 'Synthetic',
        internalName: 'custom-folder-synthetic',
        documentsCount: 0,
        isCustom: true,
      },
    };
    renderHook(() => useGetPatientDocs(PATIENT_ID, filters), { wrapper });
    // Allow effects to run.
    await waitFor(() => expect(mockFhirSearch).toHaveBeenCalled());
    // The DocumentReference search is short-circuited; mockFhirSearch should only have
    // been called for the per-patient List + catalog queries (resourceType: 'List').
    const docRefCalls = mockFhirSearch.mock.calls.filter(([req]: any[]) => req?.resourceType === 'DocumentReference');
    expect(docRefCalls).toHaveLength(0);
  });
});

describe('useGetPatientDocs — visit filter', () => {
  const ENCOUNTER_ID = 'encounter-1';

  // Documents that belong to the visit, out of the three the folder holds patient-wide.
  const VISIT_DOC_IDS = ['doc-list-1-0', 'doc-list-1-2'];

  const docRef = (id: string): any => ({
    resourceType: 'DocumentReference',
    id,
    status: 'current',
    date: '2026-07-28T12:00:00.000Z',
    content: [{ attachment: { title: `${id}.pdf`, url: `https://z3/${id}.pdf` } }],
    context: { encounter: [{ reference: `Encounter/${ENCOUNTER_ID}` }] },
  });

  // Distinguishes the three searches the hook makes: the folder Lists, the visit's document ids
  // (identified by `_elements`), and the main document search.
  const setupVisitSearch = (perPatientLists: List[]): void => {
    mockFhirSearch.mockImplementation(async (req: any) => {
      const params: { name: string; value: string }[] = req?.params ?? [];

      if (req?.resourceType === 'List') {
        const isCatalogSearch = params.some(
          (p) => p.name === 'identifier' && p.value === CUSTOM_FOLDERS_CATALOG_IDENTIFIER
        );
        return stubBundle(isCatalogSearch ? [] : perPatientLists);
      }

      if (params.some((p) => p.name === '_elements')) {
        return stubBundle(VISIT_DOC_IDS.map((id) => ({ resourceType: 'DocumentReference', id })) as any);
      }

      return stubBundle(VISIT_DOC_IDS.map(docRef) as any);
    });
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('narrows the document search to the visit', async () => {
    setupVisitSearch([protectedList('list-1', PROTECTED_FOLDER.title, PROTECTED_FOLDER.display, 3)]);

    renderHook(() => useGetPatientDocs(PATIENT_ID, { visit: { encounterId: ENCOUNTER_ID } }), { wrapper });

    await waitFor(() => {
      const mainSearch = mockFhirSearch.mock.calls.find(
        ([req]: any[]) =>
          req?.resourceType === 'DocumentReference' && !req.params.some((p: any) => p.name === '_elements')
      );
      expect(mainSearch).toBeDefined();
      expect(mainSearch![0].params).toEqual(
        expect.arrayContaining([{ name: 'encounter', value: `Encounter/${ENCOUNTER_ID}` }])
      );
    });
  });

  it('reports the visit each returned document belongs to', async () => {
    setupVisitSearch([protectedList('list-1', PROTECTED_FOLDER.title, PROTECTED_FOLDER.display, 3)]);

    const { result } = renderHook(() => useGetPatientDocs(PATIENT_ID, { visit: { encounterId: ENCOUNTER_ID } }), {
      wrapper,
    });

    await waitFor(() => expect(result.current.documents?.length).toBe(VISIT_DOC_IDS.length));
    expect(result.current.documents?.every((doc) => doc.encounterId === ENCOUNTER_ID)).toBe(true);
  });

  it('counts only the visit’s documents in the folder sidebar', async () => {
    // The folder holds three documents patient-wide, two of which belong to this visit.
    setupVisitSearch([protectedList('list-1', PROTECTED_FOLDER.title, PROTECTED_FOLDER.display, 3)]);

    const { result } = renderHook(() => useGetPatientDocs(PATIENT_ID, { visit: { encounterId: ENCOUNTER_ID } }), {
      wrapper,
    });

    await waitFor(() => {
      const folder = result.current.documentsFolders.find((f) => f.internalName === PROTECTED_FOLDER.title);
      expect(folder?.documentsCount).toBe(VISIT_DOC_IDS.length);
    });
  });

  it('pages through every visit document id so counters do not undercount', async () => {
    // The visit's documents span two pages: ids 0-1 on the first, id 4 on the second. A
    // single-page fetch would count 2 of 3 and undercount the folder.
    const FIRST_PAGE = ['doc-list-1-0', 'doc-list-1-1'];
    const SECOND_PAGE = ['doc-list-1-4'];
    const lists = [protectedList('list-1', PROTECTED_FOLDER.title, PROTECTED_FOLDER.display, 5)];

    mockFhirSearch.mockImplementation(async (req: any) => {
      const params: { name: string; value: string }[] = req?.params ?? [];

      if (req?.resourceType === 'List') {
        const isCatalogSearch = params.some(
          (p) => p.name === 'identifier' && p.value === CUSTOM_FOLDERS_CATALOG_IDENTIFIER
        );
        return stubBundle(isCatalogSearch ? [] : lists);
      }

      if (params.some((p) => p.name === '_elements')) {
        const offset = Number(params.find((p) => p.name === '_offset')?.value ?? '0');
        const page = offset === 0 ? FIRST_PAGE : SECOND_PAGE;
        return {
          // Only the first page advertises a successor, so the loop makes exactly two requests.
          link: offset === 0 ? [{ relation: 'next', url: 'next-page' }] : [],
          unbundle: () => page.map((id) => ({ resourceType: 'DocumentReference', id })),
        };
      }

      return stubBundle([...FIRST_PAGE, ...SECOND_PAGE].map(docRef) as any);
    });

    const { result } = renderHook(() => useGetPatientDocs(PATIENT_ID, { visit: { encounterId: ENCOUNTER_ID } }), {
      wrapper,
    });

    await waitFor(() => {
      const folder = result.current.documentsFolders.find((f) => f.internalName === PROTECTED_FOLDER.title);
      expect(folder?.documentsCount).toBe(FIRST_PAGE.length + SECOND_PAGE.length);
    });

    // Two id pages requested, with a monotonically advancing offset.
    const idsQueries = mockFhirSearch.mock.calls.filter(([req]: any[]) =>
      (req?.params ?? []).some((p: any) => p.name === '_elements')
    );
    expect(idsQueries).toHaveLength(2);
    expect(idsQueries[0][0].params.find((p: any) => p.name === '_offset').value).toBe('0');
    expect(Number(idsQueries[1][0].params.find((p: any) => p.name === '_offset').value)).toBeGreaterThan(0);
  });

  it('pages through every document in the table results', async () => {
    // Two pages of documents for the same search; a single-page fetch would hide the second page's
    // documents from the table with nothing on screen to say so.
    const FIRST_PAGE = ['doc-a', 'doc-b'];
    const SECOND_PAGE = ['doc-c'];
    const lists = [protectedList('list-1', PROTECTED_FOLDER.title, PROTECTED_FOLDER.display, 3)];

    mockFhirSearch.mockImplementation(async (req: any) => {
      const params: { name: string; value: string }[] = req?.params ?? [];

      if (req?.resourceType === 'List') {
        const isCatalogSearch = params.some(
          (p) => p.name === 'identifier' && p.value === CUSTOM_FOLDERS_CATALOG_IDENTIFIER
        );
        return stubBundle(isCatalogSearch ? [] : lists);
      }

      const offset = Number(params.find((p) => p.name === '_offset')?.value ?? '0');
      const page = offset === 0 ? FIRST_PAGE : SECOND_PAGE;
      return {
        link: offset === 0 ? [{ relation: 'next', url: 'next-page' }] : [],
        unbundle: () => page.map(docRef),
      };
    });

    const { result } = renderHook(() => useGetPatientDocs(PATIENT_ID), { wrapper });

    await waitFor(() => expect(result.current.documents?.length).toBe(FIRST_PAGE.length + SECOND_PAGE.length));
    expect(result.current.documents?.map((doc) => doc.id).sort()).toEqual([...FIRST_PAGE, ...SECOND_PAGE].sort());
  });

  it('advances by the page actually returned when the server caps the requested count', async () => {
    // A server free to cap `_count` returns fewer resources than asked for. Advancing the offset by
    // the requested size would leave a gap the size of the shortfall and silently skip documents.
    const ALL = ['doc-a', 'doc-b', 'doc-c', 'doc-d', 'doc-e'];
    const SERVER_CAP = 1;
    const lists = [protectedList('list-1', PROTECTED_FOLDER.title, PROTECTED_FOLDER.display, 3)];

    mockFhirSearch.mockImplementation(async (req: any) => {
      const params: { name: string; value: string }[] = req?.params ?? [];

      if (req?.resourceType === 'List') {
        const isCatalogSearch = params.some(
          (p) => p.name === 'identifier' && p.value === CUSTOM_FOLDERS_CATALOG_IDENTIFIER
        );
        return stubBundle(isCatalogSearch ? [] : lists);
      }

      const offset = Number(params.find((p) => p.name === '_offset')?.value ?? '0');
      const page = ALL.slice(offset, offset + SERVER_CAP);
      return {
        link: offset + page.length < ALL.length ? [{ relation: 'next', url: 'next-page' }] : [],
        unbundle: () => page.map(docRef),
      };
    });

    const { result } = renderHook(() => useGetPatientDocs(PATIENT_ID), { wrapper });

    // Every document is collected despite each page returning one at a time.
    await waitFor(() => expect(result.current.documents?.length).toBe(ALL.length));
    expect(result.current.documents?.map((doc) => doc.id).sort()).toEqual([...ALL].sort());

    const offsets = mockFhirSearch.mock.calls
      .filter(([req]: any[]) => req?.resourceType !== 'List')
      .map(([req]: any[]) => Number(req.params.find((p: any) => p.name === '_offset').value));
    expect(offsets).toEqual([0, 1, 2, 3, 4]);
  });

  it('stops paging on an empty page even if a next link is advertised', async () => {
    // A server that always advertises a successor would otherwise spin to the ceiling.
    const lists = [protectedList('list-1', PROTECTED_FOLDER.title, PROTECTED_FOLDER.display, 3)];

    mockFhirSearch.mockImplementation(async (req: any) => {
      const params: { name: string; value: string }[] = req?.params ?? [];

      if (req?.resourceType === 'List') {
        const isCatalogSearch = params.some(
          (p) => p.name === 'identifier' && p.value === CUSTOM_FOLDERS_CATALOG_IDENTIFIER
        );
        return stubBundle(isCatalogSearch ? [] : lists);
      }

      const offset = Number(params.find((p) => p.name === '_offset')?.value ?? '0');
      return {
        link: [{ relation: 'next', url: 'next-page' }],
        unbundle: () => (offset === 0 ? [docRef('doc-a')] : []),
      };
    });

    const { result } = renderHook(() => useGetPatientDocs(PATIENT_ID), { wrapper });

    await waitFor(() => expect(result.current.documents?.length).toBe(1));

    const docQueries = mockFhirSearch.mock.calls.filter(([req]: any[]) => req?.resourceType !== 'List');
    // The first page plus the empty one that ends it — not a run up to the ceiling.
    expect(docQueries).toHaveLength(2);
  });

  it('leaves folder counters patient-wide when no visit filter is applied', async () => {
    setupVisitSearch([protectedList('list-1', PROTECTED_FOLDER.title, PROTECTED_FOLDER.display, 3)]);

    const { result } = renderHook(() => useGetPatientDocs(PATIENT_ID), { wrapper });

    await waitFor(() => {
      const folder = result.current.documentsFolders.find((f) => f.internalName === PROTECTED_FOLDER.title);
      expect(folder?.documentsCount).toBe(3);
    });
    // No visit means no need to resolve which documents belong to one.
    const idsQueries = mockFhirSearch.mock.calls.filter(([req]: any[]) =>
      (req?.params ?? []).some((p: any) => p.name === '_elements')
    );
    expect(idsQueries).toHaveLength(0);
  });
});

describe('useGetPatientDocs — intake documents linked by appointment', () => {
  const ENCOUNTER_ID = 'encounter-1';
  const APPOINTMENT_ID = 'appointment-1';

  // Intake paperwork (photo IDs, insurance cards, condition photos, consents) records the visit as
  // an Appointment in context.related and never sets context.encounter.
  const intakeDocRef = (id: string): any => ({
    resourceType: 'DocumentReference',
    id,
    status: 'current',
    date: '2026-07-28T12:00:00.000Z',
    content: [{ attachment: { title: `${id}.pdf`, url: `https://z3/${id}.pdf` } }],
    context: { related: [{ reference: `Appointment/${APPOINTMENT_ID}` }] },
  });

  // A document whose `related` holds something that is not a visit at all — update-visit-files
  // writes a Patient there, radiology a ServiceRequest.
  const nonVisitRelatedDocRef = (id: string): any => ({
    resourceType: 'DocumentReference',
    id,
    status: 'current',
    date: '2026-07-28T12:00:00.000Z',
    content: [{ attachment: { title: `${id}.pdf`, url: `https://z3/${id}.pdf` } }],
    context: { related: [{ reference: `Patient/${PATIENT_ID}` }, { reference: 'ServiceRequest/sr-1' }] },
  });

  const setupIntakeSearch = (docsByLinkage: { encounter: any[]; related: any[] }): void => {
    mockFhirSearch.mockImplementation(async (req: any) => {
      const params: { name: string; value: string }[] = req?.params ?? [];

      if (req?.resourceType === 'List') {
        const isCatalogSearch = params.some(
          (p) => p.name === 'identifier' && p.value === CUSTOM_FOLDERS_CATALOG_IDENTIFIER
        );
        return stubBundle(isCatalogSearch ? [] : []);
      }

      // Serve whichever linkage this request queried.
      if (params.some((p) => p.name === 'encounter')) return stubBundle(docsByLinkage.encounter);
      if (params.some((p) => p.name === 'related')) return stubBundle(docsByLinkage.related);
      return stubBundle([...docsByLinkage.encounter, ...docsByLinkage.related]);
    });
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('queries both the encounter and the related-appointment linkage', async () => {
    setupIntakeSearch({ encounter: [], related: [intakeDocRef('intake-a')] });

    renderHook(
      () => useGetPatientDocs(PATIENT_ID, { visit: { encounterId: ENCOUNTER_ID, appointmentId: APPOINTMENT_ID } }),
      {
        wrapper,
      }
    );

    await waitFor(() => {
      const docQueries = mockFhirSearch.mock.calls.filter(([req]: any[]) => req?.resourceType === 'DocumentReference');
      expect(docQueries.some(([r]: any[]) => r.params.some((p: any) => p.name === 'encounter'))).toBe(true);
      expect(
        docQueries.some(([r]: any[]) =>
          r.params.some((p: any) => p.name === 'related' && p.value === `Appointment/${APPOINTMENT_ID}`)
        )
      ).toBe(true);
    });
  });

  it('surfaces intake documents that only carry an appointment, and reports that appointment', async () => {
    setupIntakeSearch({ encounter: [], related: [intakeDocRef('intake-a'), intakeDocRef('intake-b')] });

    const { result } = renderHook(
      () => useGetPatientDocs(PATIENT_ID, { visit: { encounterId: ENCOUNTER_ID, appointmentId: APPOINTMENT_ID } }),
      { wrapper }
    );

    await waitFor(() => expect(result.current.documents?.length).toBe(2));
    expect(result.current.documents?.every((doc) => doc.appointmentId === APPOINTMENT_ID)).toBe(true);
    // These carry no encounter at all; that is the whole point.
    expect(result.current.documents?.every((doc) => doc.encounterId === undefined)).toBe(true);
  });

  it('unions the two linkages without double-counting a document linked both ways', async () => {
    const both = {
      ...intakeDocRef('linked-both'),
      context: {
        encounter: [{ reference: `Encounter/${ENCOUNTER_ID}` }],
        related: [{ reference: `Appointment/${APPOINTMENT_ID}` }],
      },
    };
    // The same resource comes back from both searches, as the server would return it.
    setupIntakeSearch({ encounter: [both], related: [both] });

    const { result } = renderHook(
      () => useGetPatientDocs(PATIENT_ID, { visit: { encounterId: ENCOUNTER_ID, appointmentId: APPOINTMENT_ID } }),
      { wrapper }
    );

    await waitFor(() => expect(result.current.documents?.length).toBe(1));
    expect(result.current.documents?.[0].id).toBe('linked-both');
  });

  it('ignores related references that are not appointments', async () => {
    setupIntakeSearch({ encounter: [], related: [nonVisitRelatedDocRef('doc-with-patient-related')] });

    const { result } = renderHook(() => useGetPatientDocs(PATIENT_ID), { wrapper });

    await waitFor(() => expect(result.current.documents?.length).toBe(1));
    // A Patient or ServiceRequest in `related` must not be mistaken for the visit.
    expect(result.current.documents?.[0].appointmentId).toBeUndefined();
  });
});
