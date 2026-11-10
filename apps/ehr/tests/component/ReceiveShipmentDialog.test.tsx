import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Medication } from 'fhir/r4b';
import { lookupNdc, receiveMedicationShipment } from 'src/api/api';
import { dataTestIds } from 'src/constants/data-test-ids';
import { InHouseMedicationInventory } from 'utils/lib/types/api/config/in-house-medications';
import { describe, expect, it, vi } from 'vitest';
import ReceiveShipmentDialog from '../../src/features/admin/inventory/ReceiveShipmentDialog';

vi.mock('src/api/api', () => ({ lookupNdc: vi.fn(), receiveMedicationShipment: vi.fn() }));
vi.mock('src/hooks/useAppClients', () => {
  const clients = { oystehrZambda: {} };
  return { useApiClients: () => clients };
});
vi.mock('notistack', () => ({ enqueueSnackbar: vi.fn() }));
vi.mock('../../src/features/admin/inventory/inventory.queries', () => ({
  useLastReceivedLot: () => ({ data: undefined, isError: false }),
}));

const medication: Medication & { id: string } = { resourceType: 'Medication', id: 'med-1' };
const inventory: InHouseMedicationInventory = {
  countedAs: 'vial',
  eachContains: { amount: 4, unit: 'mg' },
  use: 'single-use',
  reorderLevels: [],
};

describe('Receive Shipment dialog', () => {
  it('sends the lot the expiration conflict showed when staff correct it', async () => {
    vi.mocked(lookupNdc).mockResolvedValue({ status: 'unavailable' });
    vi.mocked(receiveMedicationShipment)
      .mockResolvedValueOnce({
        expirationConflict: { lotId: 'lot-shown', expirationDate: '2027-03-31', onHand: 25, unit: 'vial' },
      })
      .mockResolvedValueOnce({} as never);
    const user = userEvent.setup();
    render(
      <ReceiveShipmentDialog
        open
        onClose={vi.fn()}
        medication={medication}
        inventory={inventory}
        locations={[{ id: 'loc-a', name: 'Main Street' }]}
      />
    );

    await user.type(screen.getByTestId(dataTestIds.receiveShipmentDialog.ndcField), '72572-0160-25');
    await user.type(screen.getByTestId(dataTestIds.receiveShipmentDialog.lotNumberField), 'A123');
    await user.click(screen.getByLabelText(/Expiration Date/));
    await user.keyboard('01012028');
    await user.type(screen.getByTestId(dataTestIds.receiveShipmentDialog.quantityField), '10');
    await user.click(screen.getByTestId(dataTestIds.receiveShipmentDialog.receiveButton));
    await user.click(await screen.findByRole('button', { name: /Correct the Existing Lot/ }));

    await waitFor(() => expect(receiveMedicationShipment).toHaveBeenCalledTimes(2));
    expect(vi.mocked(receiveMedicationShipment).mock.calls[1][1]).toMatchObject({
      lotNumber: 'A123',
      expirationDate: '2028-01-01',
      expirationConflict: 'correct-existing',
      lotId: 'lot-shown',
    });
  });
});
