import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { DmeQuickPickData } from 'utils/lib/types/api/quick-picks.types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('src/features/visits/telemed/components/admin/admin.queries', () => ({
  useDmeQuickPicksQuery: vi.fn(),
  useRenameDmeQuickPickMutation: vi.fn(),
  useRemoveDmeQuickPickMutation: vi.fn(),
  useRadiologyQuickPicksQuery: vi.fn(() => ({ data: [], isLoading: false })),
  useRenameRadiologyQuickPickMutation: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
  useRemoveRadiologyQuickPickMutation: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
}));

vi.mock('notistack', () => ({ enqueueSnackbar: vi.fn() }));

import {
  useDmeQuickPicksQuery,
  useRemoveDmeQuickPickMutation,
  useRenameDmeQuickPickMutation,
} from 'src/features/visits/telemed/components/admin/admin.queries';
import DmeQuickPickDetailPage from 'src/features/visits/telemed/components/admin/DmeQuickPickDetailPage';
import DmeQuickPicksPage from 'src/features/visits/telemed/components/admin/DmeQuickPicksPage';

const CRUTCHES: DmeQuickPickData = {
  id: 'qp-crutches',
  name: 'Adult crutches',
  itemName: 'Crutches',
  quantity: 1,
  billingCodes: [{ code: 'E0114', display: 'Crutches underarm' }],
  laterality: 'BI',
  modifier: 'NU',
  duration: { value: 2, unit: 'weeks' },
  instructions: 'Non weight bearing',
  external: false,
};

const BOOT: DmeQuickPickData = {
  id: 'qp-boot',
  name: 'Walking boot (vendor)',
  itemName: 'Walking boot',
  quantity: 2,
  billingCodes: [{ code: 'L4361', display: 'Walking boot, pneumatic' }],
  laterality: 'LT',
  duration: { value: 1, unit: 'days' },
  external: true,
  thirdParty: { name: 'Acme Ortho', address: '1 Main St', phone: '555-0100', fax: '555-0101' },
};

const renameMutate = vi.fn();
const removeMutate = vi.fn();

const mutationResult = (mutate: ReturnType<typeof vi.fn>): any => ({ mutate, isPending: false });

const mockQuickPicks = (data: DmeQuickPickData[]): void => {
  vi.mocked(useDmeQuickPicksQuery).mockReturnValue({ data, isLoading: false } as any);
};

const renderAt = (path: string): void => {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/admin/quick-picks/dme" element={<DmeQuickPicksPage />} />
        <Route path="/admin/quick-picks/dme/:quickPickId" element={<DmeQuickPickDetailPage />} />
      </Routes>
    </MemoryRouter>
  );
};

beforeEach(() => {
  vi.mocked(useRenameDmeQuickPickMutation).mockReturnValue(mutationResult(renameMutate));
  vi.mocked(useRemoveDmeQuickPickMutation).mockReturnValue(mutationResult(removeMutate));
  mockQuickPicks([CRUTCHES, BOOT]);
});

afterEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

describe('DME quick picks list', () => {
  it('lists quick picks with the DME name, codes and order settings', () => {
    renderAt('/admin/quick-picks/dme');

    const rows = screen.getAllByRole('row').slice(1);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent('Adult crutches');
    expect(rows[0]).toHaveTextContent('Crutches');
    expect(rows[0]).toHaveTextContent('E0114');
    expect(rows[0]).toHaveTextContent('Qty 1 · BI · NU');
    expect(rows[1]).toHaveTextContent('Walking boot (vendor)');
    expect(rows[1]).toHaveTextContent('Qty 2 · LT');
  });

  it('filters by name, DME name or code', () => {
    renderAt('/admin/quick-picks/dme');

    fireEvent.change(screen.getByLabelText('Search by name, DME or code'), { target: { value: 'l4361' } });
    expect(screen.getAllByRole('row')).toHaveLength(2);
    expect(screen.getByText('Walking boot (vendor)')).toBeInTheDocument();
    expect(screen.queryByText('Adult crutches')).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Search by name, DME or code'), { target: { value: 'wheelchair' } });
    expect(screen.getByText('No DME quick picks match "wheelchair".')).toBeInTheDocument();
  });

  it('explains where DME quick picks come from when there are none', () => {
    mockQuickPicks([]);
    renderAt('/admin/quick-picks/dme');

    expect(
      screen.getByText(
        /created from the Order DME form by opening Quick Picks and selecting "Add or Update Quick Pick"/
      )
    ).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('renames a quick pick', () => {
    renderAt('/admin/quick-picks/dme');

    fireEvent.click(screen.getByRole('button', { name: 'Rename Adult crutches' }));
    const dialog = screen.getByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText('Name'), { target: { value: '  Kids crutches ' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Rename' }));

    expect(renameMutate).toHaveBeenCalledWith({ quickPick: CRUTCHES, newName: 'Kids crutches' }, expect.any(Object));
  });

  it('removes a quick pick only after confirmation', () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    renderAt('/admin/quick-picks/dme');

    fireEvent.click(screen.getByRole('button', { name: 'Remove Walking boot (vendor)' }));
    expect(confirm).toHaveBeenCalledWith('Remove quick pick "Walking boot (vendor)"?');
    expect(removeMutate).not.toHaveBeenCalled();

    confirm.mockReturnValue(true);
    fireEvent.click(screen.getByRole('button', { name: 'Remove Walking boot (vendor)' }));
    expect(removeMutate).toHaveBeenCalledWith('qp-boot', expect.any(Object));
  });

  it('opens the detail page when a row is clicked', () => {
    renderAt('/admin/quick-picks/dme');

    fireEvent.click(screen.getByText('Crutches'));
    expect(screen.getByRole('heading', { name: 'Adult crutches' })).toBeInTheDocument();
    expect(screen.getByText('Order Details')).toBeInTheDocument();
  });

  it('opens the detail page from the name link with the keyboard', async () => {
    const user = userEvent.setup();
    renderAt('/admin/quick-picks/dme');

    const link = screen.getByRole('link', { name: 'Adult crutches' });
    expect(link).toHaveAttribute('href', '/admin/quick-picks/dme/qp-crutches');
    expect(screen.getByRole('link', { name: 'Walking boot (vendor)' })).toHaveAttribute(
      'href',
      '/admin/quick-picks/dme/qp-boot'
    );

    link.focus();
    await user.keyboard('{Enter}');
    expect(screen.getByRole('heading', { name: 'Adult crutches' })).toBeInTheDocument();
    expect(screen.getByText('Order Details')).toBeInTheDocument();
  });
});

describe('DME quick pick detail', () => {
  it('shows every saved order field for an in-house pick', () => {
    renderAt('/admin/quick-picks/dme/qp-crutches');

    expect(screen.getByRole('heading', { name: 'Adult crutches' })).toBeInTheDocument();
    expect(screen.getByText('Crutches')).toBeInTheDocument();
    expect(screen.getByText('E0114 - Crutches underarm')).toBeInTheDocument();
    expect(screen.getByText('BI (Bilateral)')).toBeInTheDocument();
    expect(screen.getByText('NU (New Purchase)')).toBeInTheDocument();
    expect(screen.getByText('2 weeks')).toBeInTheDocument();
    expect(screen.getByText('Non weight bearing')).toBeInTheDocument();
    expect(screen.getByText('In-house')).toBeInTheDocument();
    expect(screen.queryByText('Third Party Information')).not.toBeInTheDocument();
  });

  it('shows third party details for an external pick', () => {
    renderAt('/admin/quick-picks/dme/qp-boot');

    expect(screen.getByText('External Site / Third Party')).toBeInTheDocument();
    expect(screen.getByText('Third Party Information')).toBeInTheDocument();
    expect(screen.getByText('Acme Ortho')).toBeInTheDocument();
    expect(screen.getByText('1 Main St')).toBeInTheDocument();
    expect(screen.getByText('555-0100')).toBeInTheDocument();
    expect(screen.getByText('555-0101')).toBeInTheDocument();
    expect(screen.getByText('1 day')).toBeInTheDocument();
  });

  it('goes back to the DME tab', () => {
    renderAt('/admin/quick-picks/dme/qp-boot');

    fireEvent.click(screen.getByRole('button', { name: 'Back to DME quick picks' }));
    expect(screen.getByText('DME Quick Picks')).toBeInTheDocument();
  });

  it('reports a missing quick pick', () => {
    renderAt('/admin/quick-picks/dme/qp-unknown');

    expect(screen.getByText('Quick pick not found')).toBeInTheDocument();
  });
});

describe('Quick Picks admin DME tab', () => {
  const renderAdminTabs = async (dmeOrdersEnabled: boolean, subTab: string): Promise<void> => {
    vi.resetModules();
    vi.doMock('src/constants/feature-flags', () => ({ FEATURE_FLAGS: { DME_ORDERS_ENABLED: dmeOrdersEnabled } }));
    vi.doMock('src/hooks/useAppClients', () => ({ useApiClients: () => ({ oystehrZambda: undefined }) }));
    const queries = await import('src/features/visits/telemed/components/admin/admin.queries');
    vi.mocked(queries.useDmeQuickPicksQuery).mockReturnValue({ data: [CRUTCHES], isLoading: false } as any);
    vi.mocked(queries.useRenameDmeQuickPickMutation).mockReturnValue(mutationResult(renameMutate));
    vi.mocked(queries.useRemoveDmeQuickPickMutation).mockReturnValue(mutationResult(removeMutate));
    const { default: QuickPicksAdminPage } = await import(
      'src/features/visits/telemed/components/admin/QuickPicksAdminPage'
    );
    render(
      <MemoryRouter initialEntries={[`/admin/quick-picks/${subTab}`]}>
        <Routes>
          <Route path="/admin/:adminTab/:subTab" element={<QuickPicksAdminPage />} />
        </Routes>
      </MemoryRouter>
    );
  };

  afterEach(() => {
    vi.doUnmock('src/constants/feature-flags');
    vi.doUnmock('src/hooks/useAppClients');
    vi.resetModules();
  });

  it('shows the DME tab and its list when DME orders are enabled', async () => {
    await renderAdminTabs(true, 'dme');

    expect(screen.getByRole('tab', { name: 'DME' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('DME Quick Picks')).toBeInTheDocument();
    expect(screen.getByText('Adult crutches')).toBeInTheDocument();
  });

  it('hides the DME tab when DME orders are disabled', async () => {
    await renderAdminTabs(false, 'radiology');

    expect(screen.getByRole('tab', { name: 'Radiology' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.queryByRole('tab', { name: 'DME' })).not.toBeInTheDocument();
    expect(screen.queryByText('DME Quick Picks')).not.toBeInTheDocument();
  });
});
