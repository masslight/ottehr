import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { List } from 'fhir/r4b';
import { ReactNode } from 'react';
import { FOLDERS_CONFIG, SYNTHETIC_FOLDER_ID_PREFIX } from 'utils';
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

const customList = (id: string, internalName: string, display: string, entryCount = 0): List => ({
  resourceType: 'List',
  id,
  status: 'current',
  mode: 'working',
  title: internalName,
  code: {
    coding: [
      { system: 'https://fhir.zapehr.com/r4/StructureDefinitions', code: 'patient-docs-folder', display },
      { system: 'https://fhir.ottehr.com/r4/CodeSystem/folder-kind', code: 'custom' },
    ],
  },
  subject: { reference: `Patient/${PATIENT_ID}` },
  entry: Array.from({ length: entryCount }, (_, i) => ({
    item: { type: 'DocumentReference', reference: `DocumentReference/doc-${id}-${i}` },
  })),
});

const catalogList = (entries: { internalName: string; displayName: string }[]): List => ({
  resourceType: 'List',
  id: 'catalog-1',
  status: 'current',
  mode: 'working',
  identifier: [{ value: 'ottehr-custom-folders-catalog' }],
  entry: entries.map((e) => ({
    item: { display: e.displayName, identifier: { value: e.internalName } },
  })),
});

const stubBundle = (resources: List[]): any => ({ unbundle: () => resources });

// configure mockFhirSearch by params: identify catalog vs lists query.
const setupSearch = (
  perPatientLists: List[],
  catalogEntries: { internalName: string; displayName: string }[]
): void => {
  mockFhirSearch.mockImplementation(async (req: any) => {
    const params: { name: string; value: string }[] = req?.params ?? [];
    const isCatalogSearch = params.some((p) => p.name === 'identifier' && p.value === 'ottehr-custom-folders-catalog');
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

  it('keeps an orphan per-patient List (catalog entry deleted) and resolves folderName from the per-patient coding', async () => {
    // The catalog has been "soft-deleted" — no entries — but the patient still has a custom List
    // with one document. The hook should keep the folder and resolve its display from
    // code.coding[0].display.
    setupSearch([customList('list-orphan', 'custom-folder-removed', 'Removed Folder', 1)], []);
    const folders = renderUseGetPatientDocs();
    await waitFor(() => expect(folders.current().some((f) => f.internalName === 'custom-folder-removed')).toBe(true));
    const orphan = folders.current().find((f) => f.internalName === 'custom-folder-removed')!;
    expect(orphan.id).toBe('list-orphan');
    expect(orphan.folderName).toBe('Removed Folder');
    expect(orphan.documentsCount).toBe(1);
    expect(orphan.isCustom).toBe(true);
  });

  it('drops an orphan per-patient List when it has no documents (no point keeping an empty deleted folder)', async () => {
    setupSearch([customList('list-empty-orphan', 'custom-folder-empty', 'Empty Removed', 0)], []);
    const folders = renderUseGetPatientDocs();
    // Wait for the query to settle. Because there are no folders to expose, we wait
    // for at least one render cycle and then assert the orphan is absent.
    await waitFor(() => expect(mockFhirSearch).toHaveBeenCalled());
    expect(folders.current().some((f) => f.internalName === 'custom-folder-empty')).toBe(false);
  });

  it('catalog rename wins over the frozen display on the per-patient List', async () => {
    setupSearch(
      // Per-patient List was created when display was "Old Name" (frozen on the coding).
      [customList('list-renamed', 'custom-folder-renamed', 'Old Name', 2)],
      // Catalog has been renamed to "New Name".
      [{ internalName: 'custom-folder-renamed', displayName: 'New Name' }]
    );
    const folders = renderUseGetPatientDocs();
    await waitFor(() => expect(folders.current().some((f) => f.internalName === 'custom-folder-renamed')).toBe(true));
    const folder = folders.current().find((f) => f.internalName === 'custom-folder-renamed')!;
    expect(folder.folderName).toBe('New Name');
    expect(folder.id).toBe('list-renamed');
    expect(folder.documentsCount).toBe(2);
  });

  it('deduplicates by internalName when both a per-patient List and a catalog entry exist', async () => {
    setupSearch(
      [customList('list-dup', 'custom-folder-foo', 'Foo from list', 3)],
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
