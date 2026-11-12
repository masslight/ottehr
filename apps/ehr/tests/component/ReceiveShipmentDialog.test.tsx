import { render, screen, waitFor } from '@testing-library/react';
import userEvent, { PointerEventsCheckLevel } from '@testing-library/user-event';
import { Medication } from 'fhir/r4b';
import { lookupNdc, receiveMedicationShipment } from 'src/api/api';
import { dataTestIds } from 'src/constants/data-test-ids';
import { InHouseMedicationInventory, LookupNdcResponse } from 'utils/lib/types/api/config/in-house-medications';
import { beforeEach, describe, expect, it, vi } from 'vitest';
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
    await screen.findByText(/lookup unavailable/);
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

  describe('while the NDC lookup is pending', () => {
    let resolveLookup: (result: LookupNdcResponse) => void;
    const onClose = vi.fn();

    beforeEach(() => {
      vi.mocked(lookupNdc)
        .mockReset()
        .mockReturnValue(new Promise((resolve) => (resolveLookup = resolve)));
      vi.mocked(receiveMedicationShipment)
        .mockReset()
        .mockResolvedValue({} as never);
      onClose.mockReset();
      render(
        <ReceiveShipmentDialog
          open
          onClose={onClose}
          medication={medication}
          inventory={inventory}
          locations={[{ id: 'loc-a', name: 'Main Street' }]}
        />
      );
    });

    const fillEverythingButNdc = async (user: ReturnType<typeof userEvent.setup>): Promise<void> => {
      await user.type(screen.getByTestId(dataTestIds.receiveShipmentDialog.lotNumberField), 'A123');
      await user.click(screen.getByLabelText(/Expiration Date/));
      await user.keyboard('01012028');
      await user.type(screen.getByTestId(dataTestIds.receiveShipmentDialog.quantityField), '10');
    };

    it('does not receive during the debounce, before the lookup has started', async () => {
      const user = userEvent.setup({ pointerEventsCheck: PointerEventsCheckLevel.Never });
      await fillEverythingButNdc(user);
      await user.type(screen.getByTestId(dataTestIds.receiveShipmentDialog.ndcField), '0409-4888-02');
      expect(lookupNdc).not.toHaveBeenCalled();
      await user.click(screen.getByTestId(dataTestIds.receiveShipmentDialog.receiveButton));

      expect(receiveMedicationShipment).not.toHaveBeenCalled();
      expect(onClose).not.toHaveBeenCalled();
    });

    it('does not receive on Enter in the NDC field before the lookup answers', async () => {
      const user = userEvent.setup();
      await fillEverythingButNdc(user);
      await user.type(screen.getByTestId(dataTestIds.receiveShipmentDialog.ndcField), '0409-4888-02{Enter}');

      expect(receiveMedicationShipment).not.toHaveBeenCalled();
    });

    it('does not receive while the lookup request is in flight, and asks once it returns a mismatch', async () => {
      const user = userEvent.setup({ pointerEventsCheck: PointerEventsCheckLevel.Never });
      await fillEverythingButNdc(user);
      await user.type(screen.getByTestId(dataTestIds.receiveShipmentDialog.ndcField), '0409-4888-02');
      await waitFor(() => expect(lookupNdc).toHaveBeenCalledTimes(1));
      await user.click(screen.getByTestId(dataTestIds.receiveShipmentDialog.receiveButton));
      expect(receiveMedicationShipment).not.toHaveBeenCalled();

      resolveLookup({
        status: 'mismatch',
        product: { packageNdc: '0409-4888-02', name: 'Sodium Bicarbonate', rxcuis: [] },
      });
      await screen.findByText(/is Sodium Bicarbonate/);
      await user.click(screen.getByTestId(dataTestIds.receiveShipmentDialog.receiveButton));

      expect(await screen.findByText('Receive under a different medication?')).toBeInTheDocument();
      expect(receiveMedicationShipment).not.toHaveBeenCalled();
    });

    it.each(['unavailable', 'not-found'] as const)('receives once the lookup comes back %s', async (status) => {
      const user = userEvent.setup();
      await fillEverythingButNdc(user);
      await user.type(screen.getByTestId(dataTestIds.receiveShipmentDialog.ndcField), '0409-4888-02');
      await waitFor(() => expect(lookupNdc).toHaveBeenCalledTimes(1));
      resolveLookup({ status });
      await waitFor(() => expect(screen.getByTestId(dataTestIds.receiveShipmentDialog.receiveButton)).toBeEnabled());
      await user.click(screen.getByTestId(dataTestIds.receiveShipmentDialog.receiveButton));

      await waitFor(() => expect(receiveMedicationShipment).toHaveBeenCalledTimes(1));
      expect(onClose).toHaveBeenCalled();
    });
  });
});
