import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { enqueueSnackbar } from 'notistack';
import { adjustMedicationInventory } from 'src/api/api';
import { InventoryDrugRow, InventoryLotRow } from 'utils/lib/types/api/config/in-house-medications';
import { describe, expect, it, vi } from 'vitest';
import CountLotDialog from '../../src/features/admin/inventory/CountLotDialog';
import { formatQuantity } from '../../src/features/admin/inventory/inventory.helpers';

vi.mock('src/api/api', () => ({ adjustMedicationInventory: vi.fn() }));
vi.mock('src/hooks/useAppClients', () => ({ useApiClients: () => ({ oystehrZambda: {} }) }));
vi.mock('notistack', () => ({ enqueueSnackbar: vi.fn() }));

const lot: InventoryLotRow = {
  id: 'lot-1',
  catalogMedicationId: 'med-1',
  locationId: 'loc-a',
  lotNumber: 'A123',
  expirationDate: '2027-03-31',
  onHand: 25,
  unit: 'vial',
  status: 'active',
  markers: [],
};

describe('Count Lot dialog', () => {
  it('reports the difference the server recorded, not the one previewed from the balance it opened with', async () => {
    vi.mocked(adjustMedicationInventory).mockResolvedValue({
      lot: { ...lot, onHand: 20 },
      entry: {
        id: 'entry-1',
        lotId: 'lot-1',
        locationId: 'loc-a',
        type: 'count',
        reason: 'count-adjustment',
        quantity: -4,
        unit: 'vial',
        effectiveDateTime: '2026-11-10T10:00:00Z',
      },
    });
    render(
      <CountLotDialog
        open
        drug={{ medicationId: 'med-1', name: 'Ondansetron' } as InventoryDrugRow}
        lot={lot}
        locationName="Main Street"
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />
    );

    await userEvent.type(screen.getByLabelText(/on the shelf/i), '20');
    await userEvent.click(screen.getByRole('button', { name: 'Save Count' }));

    await waitFor(() =>
      expect(enqueueSnackbar).toHaveBeenCalledWith(
        `Counted lot A123: recorded ${formatQuantity(-4, 'vial', { signed: true })}`,
        { variant: 'success' }
      )
    );
  });
});
