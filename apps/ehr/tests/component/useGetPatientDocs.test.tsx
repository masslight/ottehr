import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { List } from 'fhir/r4b';
import { ReactNode } from 'react';
import {
  CUSTOM_FOLDER_DELETED_FLAG_CODE,
  CUSTOM_FOLDER_ENTRY_FLAG_SYSTEM,
  CUSTOM_FOLDERS_CATALOG_IDENTIFIER,
  FOLDERS_CONFIG,
  SYNTHETIC_FOLDER_ID_PREFIX,
} from 'utils';
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
