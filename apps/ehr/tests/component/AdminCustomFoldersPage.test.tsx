import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { FOLDERS_CONFIG } from 'utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Pick three protected display names guaranteed to land on the first paginated page
// (the page sorts alphabetically and shows 10 rows by default).
const FIRST_PAGE_PROTECTED_NAMES = [...FOLDERS_CONFIG.map((f) => f.display)]
  .sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()))
  .slice(0, 3);

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockCreateCustomFolder = vi.fn<(...args: any[]) => Promise<any>>();
const mockRenameCustomFolder = vi.fn<(...args: any[]) => Promise<any>>();
const mockDeleteCustomFolder = vi.fn<(...args: any[]) => Promise<any>>();

vi.mock('src/api/api', async (importOriginal) => {
  const actual = (await importOriginal()) as any;
  return {
    ...actual,
    createCustomFolder: (...args: any[]) => mockCreateCustomFolder(...args),
    renameCustomFolder: (...args: any[]) => mockRenameCustomFolder(...args),
    deleteCustomFolder: (...args: any[]) => mockDeleteCustomFolder(...args),
  };
});

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

vi.mock('notistack', async () => {
  const actual = (await vi.importActual('notistack')) as any;
  return { ...actual, enqueueSnackbar: vi.fn() };
});

import { List } from 'fhir/r4b';
import { AdminHeaderSlotProvider } from '../../src/features/admin/AdminPageHeader';
import AdminCustomFoldersPage from '../../src/pages/AdminCustomFoldersPage';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
  });
  // The "Add Folder" CTA portals into the admin header slot; provide a target so it renders.
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <AdminHeaderSlotProvider value={document.body}>{children}</AdminHeaderSlotProvider>
      </MemoryRouter>
    </QueryClientProvider>
  );
};

const mockCatalogBundle = (entries: { internalName: string; displayName: string }[]): { unbundle: () => List[] } => ({
  unbundle: () =>
    entries.length === 0
      ? []
      : [
          {
            resourceType: 'List',
            id: 'catalog-1',
            status: 'current',
            mode: 'working',
            entry: entries.map((e) => ({
              item: { display: e.displayName, identifier: { value: e.internalName } },
            })),
          },
        ],
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AdminCustomFoldersPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFhirSearch.mockResolvedValue(mockCatalogBundle([]));
  });

  it('renders protected folders as read-only rows when the catalog is empty (no custom rows)', async () => {
    mockFhirSearch.mockResolvedValue(mockCatalogBundle([]));
    render(<AdminCustomFoldersPage />, { wrapper: createWrapper() });
    // The list is sorted alphabetically and paginated at 10 rows. Use the first three
    // alphabetical entries from FOLDERS_CONFIG to stay on the first page even if the
    // protected folder set changes.
    await waitFor(() => expect(screen.getByText(FIRST_PAGE_PROTECTED_NAMES[0])).toBeInTheDocument());
    expect(screen.getByText(FIRST_PAGE_PROTECTED_NAMES[1])).toBeInTheDocument();
    expect(screen.getByText(FIRST_PAGE_PROTECTED_NAMES[2])).toBeInTheDocument();
    // Protected rows have no actions — there should be no rename / delete buttons rendered.
    expect(screen.queryByRole('button', { name: /rename/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /delete/i })).not.toBeInTheDocument();
  });

  it('renders a custom row alongside protected rows with rename and delete actions', async () => {
    mockFhirSearch.mockResolvedValue(
      mockCatalogBundle([{ internalName: 'custom-folder-after-visit-care', displayName: 'After-Visit Care' }])
    );
    render(<AdminCustomFoldersPage />, { wrapper: createWrapper() });
    await waitFor(() => expect(screen.getByText('After-Visit Care')).toBeInTheDocument());
    expect(screen.getByRole('button', { name: /rename/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /delete/i })).toBeInTheDocument();
  });

  it('opens the create dialog and calls createCustomFolder on submit', async () => {
    mockFhirSearch.mockResolvedValue(mockCatalogBundle([]));
    mockCreateCustomFolder.mockResolvedValue({
      internalName: 'custom-folder-new-folder',
      displayName: 'New Folder',
    });

    const user = userEvent.setup();
    render(<AdminCustomFoldersPage />, { wrapper: createWrapper() });

    await user.click(screen.getByRole('button', { name: /add folder/i }));
    expect(screen.getByText('Create New Folder')).toBeInTheDocument();

    await user.type(screen.getByLabelText(/Folder Name/i), 'New Folder');
    await user.click(screen.getByRole('button', { name: 'Create' }));

    await waitFor(() =>
      expect(mockCreateCustomFolder).toHaveBeenCalledWith(expect.anything(), { folderName: 'New Folder' })
    );
  });

  it('opens the rename dialog with the current name prefilled and calls renameCustomFolder', async () => {
    mockFhirSearch.mockResolvedValue(mockCatalogBundle([{ internalName: 'custom-folder-foo', displayName: 'Foo' }]));
    mockRenameCustomFolder.mockResolvedValue({
      internalName: 'custom-folder-foo',
      displayName: 'Foo Renamed',
    });

    const user = userEvent.setup();
    render(<AdminCustomFoldersPage />, { wrapper: createWrapper() });

    await waitFor(() => expect(screen.getByText('Foo')).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: /rename/i }));

    expect(screen.getByText('Rename Folder')).toBeInTheDocument();
    const input = screen.getByLabelText(/Folder Name/i) as HTMLInputElement;
    expect(input.value).toBe('Foo');

    await user.clear(input);
    await user.type(input, 'Foo Renamed');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() =>
      expect(mockRenameCustomFolder).toHaveBeenCalledWith(expect.anything(), {
        internalName: 'custom-folder-foo',
        newName: 'Foo Renamed',
      })
    );
  });

  it('opens the soft-delete confirm dialog and calls deleteCustomFolder on confirm', async () => {
    mockFhirSearch.mockResolvedValue(mockCatalogBundle([{ internalName: 'custom-folder-foo', displayName: 'Foo' }]));
    mockDeleteCustomFolder.mockResolvedValue({ internalName: 'custom-folder-foo' });

    const user = userEvent.setup();
    render(<AdminCustomFoldersPage />, { wrapper: createWrapper() });

    await waitFor(() => expect(screen.getByText('Foo')).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: /delete/i }));

    expect(screen.getByText('Delete Folder')).toBeInTheDocument();
    expect(screen.getByText(/folder will remain for the patients who have docs in it/i)).toBeInTheDocument();

    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete' }));

    await waitFor(() =>
      expect(mockDeleteCustomFolder).toHaveBeenCalledWith(expect.anything(), { internalName: 'custom-folder-foo' })
    );
  });

  it('filters folders by the search box (substring, case-insensitive)', async () => {
    mockFhirSearch.mockResolvedValue(
      mockCatalogBundle([
        { internalName: 'custom-folder-apples', displayName: 'Apples' },
        { internalName: 'custom-folder-bananas', displayName: 'Bananas' },
      ])
    );
    const user = userEvent.setup();
    render(<AdminCustomFoldersPage />, { wrapper: createWrapper() });

    await waitFor(() => expect(screen.getByText('Apples')).toBeInTheDocument());
    expect(screen.getByText('Bananas')).toBeInTheDocument();

    await user.type(screen.getByPlaceholderText('Search'), 'app');
    await waitFor(() => expect(screen.queryByText('Bananas')).not.toBeInTheDocument());
    expect(screen.getByText('Apples')).toBeInTheDocument();
  });
});
