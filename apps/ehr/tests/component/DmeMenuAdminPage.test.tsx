import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { ReactNode, useState } from 'react';
import { DmeMenuItem } from 'utils/lib/types/api/dme.types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('src/features/dme/dme.queries', () => ({
  useDmeMenuItems: vi.fn(),
  useCreateDmeMenuItem: vi.fn(),
  useUpdateDmeMenuItem: vi.fn(),
  useDeleteDmeMenuItem: vi.fn(),
}));

vi.mock('src/features/visits/shared/stores/appointment/appointment.queries', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useGetCPTHCPCSSearch: vi.fn(),
}));

vi.mock('notistack', () => ({
  enqueueSnackbar: vi.fn(),
}));

import { AdminHeaderSlotProvider } from 'src/features/admin/AdminPageHeader';
import { DmeMenuAdminPage } from 'src/features/dme/admin/DmeMenuAdminPage';
import { dmeMenuTestIds } from 'src/features/dme/admin/dmeMenuTestIds';
import {
  useCreateDmeMenuItem,
  useDeleteDmeMenuItem,
  useDmeMenuItems,
  useUpdateDmeMenuItem,
} from 'src/features/dme/dme.queries';
import { useGetCPTHCPCSSearch } from 'src/features/visits/shared/stores/appointment/appointment.queries';

const ITEMS: DmeMenuItem[] = [
  {
    id: 'item-crutches',
    name: 'Crutches',
    hcpcsCodes: [{ code: 'E0114', display: 'Crutches underarm other than wood adjustable or fixed' }],
  },
  {
    id: 'item-ankle',
    name: 'Ankle Brace',
    hcpcsCodes: [{ code: 'L1906', display: 'Ankle foot orthosis, multiligamentous ankle support' }],
  },
  { id: 'item-sling', name: 'Arm Sling', hcpcsCodes: [] },
];

const HCPCS_RESULTS = [
  { code: 'L1810', display: 'Knee orthosis, elastic with joints' },
  { code: 'L1820', display: 'Knee orthosis, elastic with condylar pads and joints' },
];

const createMutate = vi.fn();
const updateMutate = vi.fn();
const deleteMutate = vi.fn();

const mutationResult = (mutate: ReturnType<typeof vi.fn>): any => ({
  mutate,
  reset: vi.fn(),
  isPending: false,
  error: null,
});

const mockMenu = (overrides: Record<string, unknown> = {}): void => {
  vi.mocked(useDmeMenuItems).mockReturnValue({
    data: { items: ITEMS },
    isPending: false,
    isError: false,
    error: null,
    ...overrides,
  } as any);
};

const AdminHeaderWrapper = ({ children }: { children: ReactNode }): JSX.Element => {
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  return (
    <>
      <div ref={setSlot} />
      <AdminHeaderSlotProvider value={slot}>{children}</AdminHeaderSlotProvider>
    </>
  );
};

const renderPage = (): ReturnType<typeof render> => render(<DmeMenuAdminPage />, { wrapper: AdminHeaderWrapper });

const dataRowNames = (): string[] =>
  within(screen.getByTestId(dmeMenuTestIds.table))
    .getAllByRole('row')
    .slice(1)
    .map((row) => within(row).getAllByRole('cell')[0].textContent ?? '');

describe('DmeMenuAdminPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMenu();
    vi.mocked(useCreateDmeMenuItem).mockReturnValue(mutationResult(createMutate));
    vi.mocked(useUpdateDmeMenuItem).mockReturnValue(mutationResult(updateMutate));
    vi.mocked(useDeleteDmeMenuItem).mockReturnValue(mutationResult(deleteMutate));
    vi.mocked(useGetCPTHCPCSSearch).mockImplementation(
      ({ search }) => ({ data: search ? { codes: HCPCS_RESULTS } : undefined, isFetching: false }) as any
    );
  });

  it('lists menu items sorted by name with their HCPCS codes', () => {
    renderPage();

    expect(dataRowNames()).toEqual(['Ankle Brace', 'Arm Sling', 'Crutches']);
    const ankleRow = screen.getByTestId(dmeMenuTestIds.itemRow('item-ankle'));
    expect(within(ankleRow).getByText('L1906 - Ankle foot orthosis, multiligamentous ankle support')).toBeVisible();
    expect(within(screen.getByTestId(dmeMenuTestIds.itemRow('item-sling'))).getByText('No HCPCS code')).toBeVisible();
  });

  it('filters by name or HCPCS code', () => {
    renderPage();
    const search = screen.getByTestId(dmeMenuTestIds.searchField);

    fireEvent.change(search, { target: { value: 'ankle' } });
    expect(dataRowNames()).toEqual(['Ankle Brace']);

    fireEvent.change(search, { target: { value: 'e0114' } });
    expect(dataRowNames()).toEqual(['Crutches']);

    fireEvent.change(search, { target: { value: 'wheelchair' } });
    expect(screen.queryByTestId(dmeMenuTestIds.table)).not.toBeInTheDocument();
    expect(screen.getByTestId(dmeMenuTestIds.emptyState)).toHaveTextContent('No DME items match "wheelchair"');
  });

  it('shows the empty, loading and error states', () => {
    mockMenu({ data: { items: [] } });
    const { rerender } = renderPage();
    expect(screen.getByTestId(dmeMenuTestIds.emptyState)).toHaveTextContent('No DME items configured yet');

    mockMenu({ data: undefined, isPending: true });
    rerender(<DmeMenuAdminPage />);
    expect(screen.getByRole('progressbar')).toBeInTheDocument();

    mockMenu({ data: undefined, isError: true, error: new Error('boom') });
    rerender(<DmeMenuAdminPage />);
    expect(screen.getByText('Failed to load the DME menu: boom')).toBeVisible();
  });

  it('creates an item with its name and the HCPCS codes picked from search', async () => {
    renderPage();

    fireEvent.click(screen.getByTestId(dmeMenuTestIds.addButton));
    const dialog = await screen.findByTestId(dmeMenuTestIds.dialog);
    const save = within(dialog).getByTestId(dmeMenuTestIds.saveButton);
    expect(save).toBeDisabled();

    fireEvent.change(within(dialog).getByTestId(dmeMenuTestIds.nameField), { target: { value: '  Knee Brace ' } });

    const hcpcsInput = within(within(dialog).getByTestId(dmeMenuTestIds.hcpcsField)).getByRole('combobox');
    act(() => hcpcsInput.focus());
    fireEvent.change(hcpcsInput, { target: { value: 'L18' } });
    fireEvent.click(await screen.findByText('L1810 - Knee orthosis, elastic with joints', {}, { timeout: 3000 }));

    expect(vi.mocked(useGetCPTHCPCSSearch)).toHaveBeenCalledWith({ search: 'L18', type: 'hcpcs' });

    fireEvent.click(save);
    expect(createMutate).toHaveBeenCalledWith(
      { name: 'Knee Brace', hcpcsCodes: [{ code: 'L1810', display: 'Knee orthosis, elastic with joints' }] },
      expect.any(Object)
    );
    expect(updateMutate).not.toHaveBeenCalled();
  });

  it('shows the server error inline in the dialog', async () => {
    vi.mocked(useCreateDmeMenuItem).mockReturnValue({
      ...mutationResult(createMutate),
      error: new Error('A DME item named "Crutches" already exists'),
    });
    renderPage();

    fireEvent.click(screen.getByTestId(dmeMenuTestIds.addButton));
    const dialog = await screen.findByTestId(dmeMenuTestIds.dialog);
    expect(within(dialog).getByTestId(dmeMenuTestIds.dialogError)).toHaveTextContent(
      'A DME item named "Crutches" already exists'
    );
  });

  it('edits an existing item through the update mutation', async () => {
    renderPage();

    fireEvent.click(screen.getByTestId(dmeMenuTestIds.editButton('item-ankle')));
    const dialog = await screen.findByTestId(dmeMenuTestIds.dialog);
    const name = within(dialog).getByTestId(dmeMenuTestIds.nameField);
    expect(name).toHaveValue('Ankle Brace');

    fireEvent.change(name, { target: { value: 'Ankle Brace, lace-up' } });
    fireEvent.click(within(dialog).getByTestId(dmeMenuTestIds.saveButton));

    expect(updateMutate).toHaveBeenCalledWith(
      {
        menuItemId: 'item-ankle',
        name: 'Ankle Brace, lace-up',
        hcpcsCodes: [{ code: 'L1906', display: 'Ankle foot orthosis, multiligamentous ankle support' }],
      },
      expect.any(Object)
    );
    expect(createMutate).not.toHaveBeenCalled();
  });

  it('asks for confirmation before deleting', async () => {
    renderPage();

    fireEvent.click(screen.getByTestId(dmeMenuTestIds.deleteButton('item-crutches')));
    const dialog = await screen.findByTestId(dmeMenuTestIds.confirmDeleteDialog);
    expect(dialog).toHaveTextContent('Crutches');
    expect(deleteMutate).not.toHaveBeenCalled();

    fireEvent.click(within(dialog).getByTestId(dmeMenuTestIds.confirmDeleteButton));
    expect(deleteMutate).toHaveBeenCalledWith({ menuItemId: 'item-crutches' }, expect.any(Object));
  });
});

describe('DME Menu admin nav item', () => {
  const loadClinicalPaths = async (dmeOrdersEnabled: boolean): Promise<string[]> => {
    vi.resetModules();
    vi.doMock('src/constants/feature-flags', () => ({
      FEATURE_FLAGS: { DME_ORDERS_ENABLED: dmeOrdersEnabled },
    }));
    const { adminNavGroups } = await import('../../src/features/admin/adminNav');
    return (adminNavGroups.find((group) => group.label === 'Clinical')?.items ?? []).map((item) => item.path);
  };

  afterEach(() => {
    vi.doUnmock('src/constants/feature-flags');
    vi.resetModules();
  });

  it('is listed under Clinical only when DME orders are enabled', async () => {
    expect(await loadClinicalPaths(true)).toContain('/admin/dme-menu');
    expect(await loadClinicalPaths(false)).not.toContain('/admin/dme-menu');
  });
});
