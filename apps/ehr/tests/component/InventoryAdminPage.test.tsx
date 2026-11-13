import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { listMedicationInventory } from 'src/api/api';
import {
  InventoryDrugRow,
  InventoryLotRow,
  ListMedicationInventoryInput,
} from 'utils/lib/types/api/config/in-house-medications';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { dataTestIds } from '../../src/constants/data-test-ids';
import InventoryAdminPage from '../../src/features/admin/inventory/InventoryAdminPage';

const locations = { isSuccess: true, data: [{ id: 'loc-a', name: 'Main Street' }] };

vi.mock('src/api/api', () => ({ listMedicationInventory: vi.fn(), adjustMedicationInventory: vi.fn() }));
vi.mock('src/hooks/useAppClients', () => ({ useApiClients: () => ({ oystehrZambda: {} }) }));
vi.mock('src/features/notifications/notifications.queries', () => ({ useGetAllLocations: () => locations }));
vi.mock('notistack', () => ({ enqueueSnackbar: vi.fn() }));

const { inventoryPage } = dataTestIds;

const lot = (overrides: Partial<InventoryLotRow>): InventoryLotRow => ({
  id: 'lot-1',
  catalogMedicationId: 'med-a',
  locationId: 'loc-a',
  lotNumber: 'AB1234C',
  expirationDate: '2027-10-10',
  ndc: '11111-1111-11',
  onHand: 30,
  unit: 'tablet',
  status: 'active',
  markers: [],
  ...overrides,
});

const drug = (overrides: Partial<InventoryDrugRow>): InventoryDrugRow => ({
  medicationId: 'med-a',
  name: 'Albuterol Sulfate (1mg)',
  countedAs: 'tablet',
  use: 'single-use',
  onHand: 0,
  locationsBelowReorderLevel: 0,
  locationsWithReorderLevel: 0,
  markers: [],
  locations: [],
  lots: [],
  ...overrides,
});

const albuterol = drug({
  onHand: 33,
  lots: [
    lot({}),
    lot({ id: 'lot-2', lotNumber: 'ZZ9', ndc: '22222222222', onHand: 3 }),
    lot({ id: 'lot-empty', lotNumber: 'OLD1', ndc: '33333-3333-33', onHand: 0, status: 'inactive' }),
  ],
});
const ondansetron = drug({ medicationId: 'med-o', name: 'Ondansetron', countedAs: 'vial' });

const allClinics = [
  drug({
    onHand: 33,
    earliestExpiration: '2027-10-10',
    locationsBelowReorderLevel: 1,
    locationsWithReorderLevel: 1,
    markers: ['low'],
    locations: [{ locationId: 'loc-a', locationName: 'Main Street', onHand: 33, reorderLevel: 40, markers: ['low'] }],
  }),
];

const renderPage = (): void => {
  vi.mocked(listMedicationInventory).mockImplementation(async (_oystehr, view: ListMedicationInventoryInput) => ({
    drugs: view.view === 'location' ? [albuterol, ondansetron] : allClinics,
    entries: [],
  }));
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter>
        <InventoryAdminPage />
      </MemoryRouter>
    </QueryClientProvider>
  );
};

const shownRows = (): string[] =>
  screen
    .getAllByRole('row')
    .map((row) => row.getAttribute('data-testid'))
    .filter((testId): testId is string => testId !== null);

const search = async (testId: string, text: string): Promise<void> => {
  await userEvent.clear(screen.getByTestId(testId));
  if (text) await userEvent.type(screen.getByTestId(testId), text);
};

const expandAlbuterol = async (): Promise<void> =>
  userEvent.click(
    within(await screen.findByTestId(inventoryPage.medicationRow('med-a'))).getByRole('button', { name: 'Expand' })
  );

describe('Inventory admin page', () => {
  beforeEach(() => {
    localStorage.setItem('selectedLocation', JSON.stringify({ id: 'loc-a' }));
  });

  it('filters the medications of a clinic by name, and by the NDC and lot number of their lots', async () => {
    renderPage();
    await expandAlbuterol();
    expect(shownRows()).toEqual([
      inventoryPage.medicationRow('med-a'),
      inventoryPage.lotRow('lot-1'),
      inventoryPage.lotRow('lot-2'),
      inventoryPage.medicationRow('med-o'),
    ]);

    await search(inventoryPage.searchField, 'ondan');
    expect(shownRows()).toEqual([inventoryPage.medicationRow('med-o')]);
    await search(inventoryPage.searchField, '');

    await search(inventoryPage.ndcSearchField, '22222-2222-22');
    expect(shownRows()).toEqual([inventoryPage.medicationRow('med-a'), inventoryPage.lotRow('lot-2')]);
    await search(inventoryPage.ndcSearchField, '');

    await search(inventoryPage.lotSearchField, 'ab12');
    expect(shownRows()).toEqual([inventoryPage.medicationRow('med-a'), inventoryPage.lotRow('lot-1')]);

    await search(inventoryPage.ndcSearchField, '2222');
    expect(shownRows()).toEqual([]);
  });

  it('finds an empty lot, which stays behind the show link', async () => {
    renderPage();
    await expandAlbuterol();

    await search(inventoryPage.lotSearchField, 'old1');
    expect(shownRows()).toEqual([inventoryPage.medicationRow('med-a')]);

    await userEvent.click(screen.getByRole('button', { name: 'Show 1 empty lot' }));
    expect(shownRows()).toEqual([inventoryPage.medicationRow('med-a'), inventoryPage.lotRow('lot-empty')]);
  });

  it('totals each medication across all clinics, where lots cannot be searched', async () => {
    localStorage.removeItem('selectedLocation');
    renderPage();

    await screen.findByTestId(inventoryPage.medicationRow('med-a'));
    expect(screen.getByTestId(inventoryPage.locationSelect)).toHaveTextContent('All clinics');
    expect(screen.getAllByRole('columnheader').map((header) => header.textContent)).toEqual([
      '',
      'Medication',
      'On Hand',
      'Clinics at or Below Reorder Level',
      'Earliest Expiration',
    ]);
    expect(screen.getByTestId(inventoryPage.ndcSearchField)).toBeDisabled();
    expect(screen.getByTestId(inventoryPage.lotSearchField)).toBeDisabled();

    await search(inventoryPage.searchField, 'ondan');
    expect(shownRows()).toEqual([]);
  });
});
