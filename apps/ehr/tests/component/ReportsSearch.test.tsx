import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ReactElement } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { RoleType } from 'utils/lib/types/api/user.types';
import { beforeEach, describe, expect, it, vi } from 'vitest';

let isAdmin = true;

vi.mock('../../src/hooks/useEvolveUser', () => ({
  default: () => ({ hasRole: (roles: RoleType[]) => isAdmin && roles.includes(RoleType.Administrator) }),
}));

const apiClients = { oystehrZambda: {} };
vi.mock('../../src/hooks/useAppClients', () => ({
  useApiClients: () => apiClients,
}));

vi.mock('../../src/api/api', () => ({
  listAdHocReports: vi.fn(async () => ({
    reports: [
      {
        id: 'saved-1',
        name: 'Monthly Revenue',
        description: 'Revenue by month',
        datasetId: 'encounters',
        criteria: { dateRange: 'last-30-days' },
      },
    ],
  })),
  deleteAdHocReport: vi.fn(),
  saveAdHocReport: vi.fn(),
}));

vi.mock('../../src/layout/PageContainer', () => ({
  default: ({ children }: { children: ReactElement }) => children,
}));

import Reports from '../../src/pages/Reports';

const renderReports = async (): Promise<void> => {
  render(
    <MemoryRouter>
      <Reports />
    </MemoryRouter>
  );
  if (isAdmin) await screen.findByText('Monthly Revenue');
};

const search = (value: string): void => {
  fireEvent.change(screen.getByRole('textbox', { name: 'Search report' }), { target: { value } });
};

describe('Reports search', () => {
  beforeEach(() => {
    isAdmin = true;
  });

  it('filters report tiles and saved reports by name', async () => {
    await renderReports();
    search('Encounter');

    expect(screen.getByText('Incomplete Encounters')).toBeTruthy();
    expect(screen.getByText('Complete Encounters')).toBeTruthy();
    expect(screen.getByText('AI-Assisted Encounters')).toBeTruthy();
    expect(screen.queryByText('Daily Payments')).toBeNull();
    expect(screen.queryByText('Visits Overview')).toBeNull();
    expect(screen.queryByText('Monthly Revenue')).toBeNull();
  });

  it('matches on description, case-insensitively', async () => {
    await renderReports();
    search('BY MAIL');

    expect(screen.getByText('Mailed Statements')).toBeTruthy();
    expect(screen.queryByText('Daily Payments')).toBeNull();
  });

  it('shows a no-results state that suggests the ad-hoc report', async () => {
    await renderReports();
    search('Providers');

    expect(screen.getByText('No Results Found')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Ad-hoc report' }).getAttribute('href')).toBe('/reports/ad-hoc');
  });

  it('restores every tile when the search is cleared', async () => {
    await renderReports();
    search('Providers');
    fireEvent.click(screen.getByRole('button', { name: 'clear search' }));

    expect(screen.queryByText('No Results Found')).toBeNull();
    expect(screen.getByText('Daily Payments')).toBeTruthy();
    expect(screen.getByText('Monthly Revenue')).toBeTruthy();
  });

  it('omits the ad-hoc suggestion for users who cannot build ad-hoc reports', async () => {
    isAdmin = false;
    await renderReports();
    search('Providers');

    await waitFor(() => expect(screen.getByText('No Results Found')).toBeTruthy());
    expect(screen.queryByRole('link', { name: 'Ad-hoc report' })).toBeNull();
  });
});
