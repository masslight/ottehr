import { render, screen, within } from '@testing-library/react';
import { ProviderNotificationMethod } from 'utils/lib/types/api/practitioner.types';
import {
  normalizeNotificationPreferencesV2,
  UI_TASK_CATEGORY_LABELS,
} from 'utils/lib/types/api/provider-notifications';
import { describe, expect, it, vi } from 'vitest';
import NotificationSettingsTable from '../../src/features/notifications/NotificationSettingsTable';

const locations = [
  { id: 'loc-1', name: 'Downtown' },
  { id: 'loc-2', name: 'Uptown' },
];

/** The row for a given notification type, found by its label cell. */
const rowFor = (label: string): HTMLElement => {
  const row = screen.getByText(label).closest('tr');
  if (!row) throw new Error(`No table row for "${label}"`);
  return row as HTMLElement;
};

/** MUI renders a Select's current text into a div; `disabled` shows up as aria-disabled on it. */
const locationCellOf = (label: string): HTMLElement => rowFor(label).querySelectorAll('td')[2] as HTMLElement;

const renderTable = (storedPrefs: Record<string, unknown> = {}): void => {
  render(
    <NotificationSettingsTable
      preferences={normalizeNotificationPreferencesV2({
        taskCategories: {
          inboundFax: { enabled: true, method: ProviderNotificationMethod.computer, allLocations: true },
          coding: { enabled: true, method: ProviderNotificationMethod.computer, allLocations: true },
          ...storedPrefs,
        },
      } as any)}
      locations={locations}
      onChange={vi.fn()}
    />
  );
};

describe('NotificationSettingsTable — locations for categories whose tasks have no location', () => {
  it('locks the Inbound Fax location filter to "All locations"', () => {
    renderTable();
    const cell = locationCellOf(UI_TASK_CATEGORY_LABELS.inboundFax);
    expect(within(cell).getByText('All locations')).toBeInTheDocument();
    expect(cell.querySelector('[aria-disabled="true"]')).not.toBeNull();
  });

  it('leaves the filter usable for a category that does carry locations', () => {
    renderTable();
    const cell = locationCellOf(UI_TASK_CATEGORY_LABELS.coding);
    expect(cell.querySelector('[aria-disabled="true"]')).toBeNull();
  });

  // The repair path: a stored blob that narrowed Inbound Fax to one location must not render as a live
  // filter — normalization pins it, and the cell shows the pinned value rather than "Downtown".
  it('shows "All locations" even when the stored prefs named a location', () => {
    renderTable({ inboundFax: { enabled: true, allLocations: false, locationIds: ['loc-1'] } });
    const cell = locationCellOf(UI_TASK_CATEGORY_LABELS.inboundFax);
    expect(within(cell).getByText('All locations')).toBeInTheDocument();
    expect(within(cell).queryByText('Downtown')).toBeNull();
  });
});
