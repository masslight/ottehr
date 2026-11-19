import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { adjustMedicationInventory } from 'src/api/api';
import {
  AdjustMedicationInventoryResponse,
  InventoryDrugRow,
  InventoryLotRow,
} from 'utils/lib/types/api/config/in-house-medications';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AdjustStockDialog from '../../src/features/admin/inventory/AdjustStockDialog';

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

describe('Adjust Stock dialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sends one adjustment when Enter is pressed again while the save is pending', async () => {
    let finishSave: (response: AdjustMedicationInventoryResponse) => void = () => undefined;
    vi.mocked(adjustMedicationInventory).mockReturnValue(
      new Promise((resolve) => {
        finishSave = resolve;
      })
    );
    const onClose = vi.fn();
    render(
      <AdjustStockDialog
        open
        drug={{ medicationId: 'med-1', name: 'Ondansetron' } as InventoryDrugRow}
        lot={lot}
        locationName="Main Street"
        onClose={onClose}
        onSaved={vi.fn()}
      />
    );

    await userEvent.click(screen.getByRole('combobox', { name: /reason/i }));
    await userEvent.click(screen.getByRole('option', { name: 'Expired stock' }));
    await userEvent.type(screen.getByLabelText(/quantity/i), '2{Enter}');
    await userEvent.keyboard('{Enter}');

    finishSave({
      lot: { ...lot, onHand: 23 },
      entry: {
        id: 'entry-1',
        lotId: 'lot-1',
        locationId: 'loc-a',
        type: 'adjustment',
        reason: 'expired',
        quantity: -2,
        unit: 'vial',
        effectiveDateTime: '2026-11-13T10:00:00Z',
      },
    });
    await waitFor(() => expect(onClose).toHaveBeenCalled());

    expect(adjustMedicationInventory).toHaveBeenCalledTimes(1);
    expect(adjustMedicationInventory).toHaveBeenCalledWith(
      {},
      { action: 'adjust', lotId: 'lot-1', direction: 'remove', quantity: 2, reason: 'expired', note: undefined }
    );
  });

  it('adds stock without the reason or note picked under Remove', async () => {
    vi.mocked(adjustMedicationInventory).mockResolvedValue({
      lot: { ...lot, onHand: 28 },
      entry: {
        id: 'entry-2',
        lotId: 'lot-1',
        locationId: 'loc-a',
        type: 'adjustment',
        quantity: 3,
        unit: 'vial',
        effectiveDateTime: '2026-11-13T10:00:00Z',
      },
    });
    const onClose = vi.fn();
    render(
      <AdjustStockDialog
        open
        drug={{ medicationId: 'med-1', name: 'Ondansetron' } as InventoryDrugRow}
        lot={lot}
        locationName="Main Street"
        onClose={onClose}
        onSaved={vi.fn()}
      />
    );

    await userEvent.click(screen.getByRole('combobox', { name: /reason/i }));
    await userEvent.click(screen.getByRole('option', { name: 'Other' }));
    await userEvent.type(screen.getByLabelText(/what happened/i), 'found a box');
    await userEvent.click(screen.getByRole('radio', { name: 'Add' }));

    expect(screen.queryByRole('combobox', { name: /reason/i })).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/what happened/i)).not.toBeInTheDocument();

    await userEvent.type(screen.getByLabelText(/quantity/i), '3{Enter}');
    await waitFor(() => expect(onClose).toHaveBeenCalled());

    expect(adjustMedicationInventory).toHaveBeenCalledWith(
      {},
      { action: 'adjust', lotId: 'lot-1', direction: 'add', quantity: 3 }
    );
  });

  it('adds stock after Other was picked under Remove with no note', async () => {
    vi.mocked(adjustMedicationInventory).mockResolvedValue({
      lot: { ...lot, onHand: 28 },
      entry: {
        id: 'entry-2',
        lotId: 'lot-1',
        locationId: 'loc-a',
        type: 'adjustment',
        quantity: 3,
        unit: 'vial',
        effectiveDateTime: '2026-11-13T10:00:00Z',
      },
    });
    const onClose = vi.fn();
    render(
      <AdjustStockDialog
        open
        drug={{ medicationId: 'med-1', name: 'Ondansetron' } as InventoryDrugRow}
        lot={lot}
        locationName="Main Street"
        onClose={onClose}
        onSaved={vi.fn()}
      />
    );

    await userEvent.click(screen.getByRole('combobox', { name: /reason/i }));
    await userEvent.click(screen.getByRole('option', { name: 'Other' }));
    await userEvent.click(screen.getByRole('radio', { name: 'Add' }));
    await userEvent.type(screen.getByLabelText(/quantity/i), '3{Enter}');
    await waitFor(() => expect(onClose).toHaveBeenCalled());

    expect(adjustMedicationInventory).toHaveBeenCalledWith(
      {},
      { action: 'adjust', lotId: 'lot-1', direction: 'add', quantity: 3 }
    );
  });
});
