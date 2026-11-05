import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { InHouseLabsAdminListItem } from 'utils/lib/types/data/in-house/in-house.types';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('src/features/visits/telemed/components/admin/admin.queries', () => ({
  useAdminListInHouseLabs: vi.fn(),
}));

import { useAdminListInHouseLabs } from 'src/features/visits/telemed/components/admin/admin.queries';
import InHouseLabAdminPage from '../../src/features/visits/telemed/components/admin/in-house-labs/InHouseLabAdminPage';

const makeLab = (id: string, name: string, status: InHouseLabsAdminListItem['status']): InHouseLabsAdminListItem => ({
  name,
  status,
  canonicalUrl: `https://example.com/${id}`,
  version: '1.0.0',
  activityDefinitionId: id,
});

const renderPage = (labs: InHouseLabsAdminListItem[]): void => {
  vi.mocked(useAdminListInHouseLabs).mockReturnValue({ data: { labs }, isPending: false, isError: false } as any);
  render(
    <MemoryRouter>
      <InHouseLabAdminPage />
    </MemoryRouter>
  );
};

const selectStatus = (label: 'All statuses' | 'Active' | 'Inactive'): void => {
  fireEvent.mouseDown(screen.getByRole('combobox', { name: 'Status' }));
  fireEvent.click(within(screen.getByRole('listbox')).getByRole('option', { name: label }));
};

const labNames = (): string[] =>
  within(screen.getByRole('table'))
    .queryAllByRole('link')
    .map((link) => link.textContent ?? '');

describe('InHouseLabAdminPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows only active labs by default and filters by status', () => {
    renderPage([
      makeLab('1', 'Flu A', 'active'),
      makeLab('2', 'Old Strep', 'retired'),
      makeLab('3', 'Rapid Strep', 'active'),
    ]);

    expect(labNames()).toEqual(['Flu A', 'Rapid Strep']);

    selectStatus('Inactive');
    expect(labNames()).toEqual(['Old Strep']);

    selectStatus('All statuses');
    expect(labNames()).toEqual(['Flu A', 'Old Strep', 'Rapid Strep']);

    fireEvent.change(screen.getByLabelText('In-House Lab'), { target: { value: 'strep' } });
    expect(labNames()).toEqual(['Old Strep', 'Rapid Strep']);
  });

  it('resets to the first page when the status filter or search changes', () => {
    const labs = Array.from({ length: 15 }, (_, i) =>
      makeLab(`a${i}`, `Active ${String(i).padStart(2, '0')}`, 'active')
    );
    labs.push(makeLab('r1', 'Retired 01', 'retired'));
    renderPage(labs);

    fireEvent.click(screen.getByRole('button', { name: 'Go to next page' }));
    expect(labNames()).toEqual(['Active 10', 'Active 11', 'Active 12', 'Active 13', 'Active 14']);

    selectStatus('Inactive');
    expect(labNames()).toEqual(['Retired 01']);

    selectStatus('Active');
    fireEvent.click(screen.getByRole('button', { name: 'Go to next page' }));
    fireEvent.change(screen.getByLabelText('In-House Lab'), { target: { value: 'Active 0' } });
    expect(labNames()).toHaveLength(10);
  });
});
