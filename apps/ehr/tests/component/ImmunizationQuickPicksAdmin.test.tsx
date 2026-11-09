import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ImmunizationQuickPickData } from 'utils/lib/types/api/quick-picks.types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('src/features/visits/telemed/components/admin/admin.queries', () => ({
  useImmunizationQuickPicksQuery: vi.fn(),
  useRenameImmunizationQuickPickMutation: vi.fn(),
  useRemoveImmunizationQuickPickMutation: vi.fn(),
}));

vi.mock('notistack', () => ({ enqueueSnackbar: vi.fn() }));

import {
  useImmunizationQuickPicksQuery,
  useRemoveImmunizationQuickPickMutation,
  useRenameImmunizationQuickPickMutation,
} from 'src/features/visits/telemed/components/admin/admin.queries';
import ImmunizationQuickPicksPage from 'src/features/visits/telemed/components/admin/ImmunizationQuickPicksPage';

const DTAP: ImmunizationQuickPickData = {
  id: 'qp-dtap',
  name: 'Dtap',
  vaccine: { id: 'vac-dtap', name: 'Diphtheria, Tetanus, Pertussis' },
  dose: '3',
  units: 'ml',
  cvx: '444',
};

const removeMutate = vi.fn();

const renderPage = (): void => {
  render(
    <MemoryRouter initialEntries={['/admin/quick-picks/immunization']}>
      <Routes>
        <Route path="/admin/quick-picks/immunization" element={<ImmunizationQuickPicksPage />} />
        <Route path="/admin/quick-picks/immunization/:quickPickId" element={<div>Quick pick detail</div>} />
      </Routes>
    </MemoryRouter>
  );
};

beforeEach(() => {
  vi.mocked(useImmunizationQuickPicksQuery).mockReturnValue({ data: [DTAP], isLoading: false } as any);
  vi.mocked(useRenameImmunizationQuickPickMutation).mockReturnValue({ mutate: vi.fn(), isPending: false } as any);
  vi.mocked(useRemoveImmunizationQuickPickMutation).mockReturnValue({ mutate: removeMutate, isPending: false } as any);
});

afterEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

describe('Immunization quick picks admin', () => {
  it('confirms removal in a styled dialog instead of the browser confirm', async () => {
    const confirm = vi.spyOn(window, 'confirm');
    renderPage();

    fireEvent.click(screen.getByTitle('Remove'));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText('Remove Quick Pick')).toBeInTheDocument();
    expect(within(dialog).getByText('Remove quick pick "Dtap"?')).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(removeMutate).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTitle('Remove'));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Remove' }));
    await waitFor(() => expect(removeMutate).toHaveBeenCalledWith('qp-dtap', expect.any(Object)));
    expect(removeMutate).toHaveBeenCalledTimes(1);
    expect(confirm).not.toHaveBeenCalled();
    expect(screen.queryByText('Quick pick detail')).not.toBeInTheDocument();
  });
});
