import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Medication } from 'fhir/r4b';
import { ReactElement, useState } from 'react';
import { getMedicationInventory, lookupNdc, receiveMedicationShipment } from 'src/api/api';
import { dataTestIds } from 'src/constants/data-test-ids';
import {
  GetMedicationInventoryResponse,
  InHouseMedicationInventory,
} from 'utils/lib/types/api/config/in-house-medications';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ReceiveShipmentDialog from '../../src/features/admin/inventory/ReceiveShipmentDialog';

vi.mock('src/api/api', () => ({
  getMedicationInventory: vi.fn(),
  lookupNdc: vi.fn(),
  receiveMedicationShipment: vi.fn(),
}));
vi.mock('src/hooks/useAppClients', () => {
  const clients = { oystehrZambda: {} };
  return { useApiClients: () => clients };
});
vi.mock('notistack', () => ({ enqueueSnackbar: vi.fn() }));

type User = ReturnType<typeof userEvent.setup>;

const medication: Medication & { id: string } = { resourceType: 'Medication', id: 'med-1' };
const inventory: InHouseMedicationInventory = {
  countedAs: 'vial',
  eachContains: { amount: 4, unit: 'mg' },
  use: 'single-use',
  reorderLevels: [],
};
const OLD_LOT = {
  id: 'lot-old',
  locationId: 'loc-a',
  lotNumber: 'OLD1',
  ndc: '11111-1111-11',
  manufacturer: 'Old Labs',
  vendor: 'Old Vendor',
};
const NEW_LOT = {
  id: 'lot-new',
  locationId: 'loc-a',
  lotNumber: 'NEW1',
  ndc: '22222-2222-22',
  manufacturer: 'New Labs',
  vendor: 'New Vendor',
};

function MedicationPage(): ReactElement {
  const [open, setOpen] = useState(true);
  return (
    <>
      <button onClick={() => setOpen(true)}>Receive Shipment</button>
      {open ? (
        <ReceiveShipmentDialog
          open
          onClose={() => setOpen(false)}
          medication={medication}
          inventory={inventory}
          locations={[{ id: 'loc-a', name: 'Main Street' }]}
        />
      ) : null}
    </>
  );
}

const ndcField = (): HTMLInputElement => screen.getByTestId(dataTestIds.receiveShipmentDialog.ndcField);
const manufacturerField = (): HTMLInputElement => screen.getByLabelText('Manufacturer');
const vendorField = (): HTMLInputElement => screen.getByLabelText('Vendor (optional)');
const prefilled = (): { ndc: string; manufacturer: string; vendor: string } => ({
  ndc: ndcField().value,
  manufacturer: manufacturerField().value,
  vendor: vendorField().value,
});
const replace = async (user: User, field: HTMLInputElement, value: string): Promise<void> => {
  await user.clear(field);
  await user.type(field, value);
};
const waitMs = (ms: number): Promise<void> => act(() => new Promise((resolve) => setTimeout(resolve, ms)));

describe('Receive Shipment dialog reopened after a receipt', () => {
  let lastLotResponse: {
    resolve: (response: GetMedicationInventoryResponse) => void;
    reject: (error: Error) => void;
  };

  beforeEach(() => {
    vi.mocked(getMedicationInventory).mockReset().mockResolvedValueOnce({ lastReceivedLot: OLD_LOT });
    vi.mocked(lookupNdc).mockReset().mockResolvedValue({ status: 'unavailable' });
    vi.mocked(receiveMedicationShipment)
      .mockReset()
      .mockResolvedValue({} as never);
    const queryClient = new QueryClient({ defaultOptions: { queries: { refetchOnWindowFocus: false, retry: false } } });
    render(
      <QueryClientProvider client={queryClient}>
        <MedicationPage />
      </QueryClientProvider>
    );
  });

  const receiveNewLotThenReopen = async (user: User): Promise<void> => {
    await waitFor(() => expect(ndcField().value).toBe(OLD_LOT.ndc));
    await replace(user, ndcField(), NEW_LOT.ndc);
    await replace(user, manufacturerField(), NEW_LOT.manufacturer);
    await replace(user, vendorField(), NEW_LOT.vendor);
    await user.type(screen.getByTestId(dataTestIds.receiveShipmentDialog.lotNumberField), NEW_LOT.lotNumber);
    await user.click(screen.getByLabelText(/Expiration Date/));
    await user.keyboard('01012028');
    await user.type(screen.getByTestId(dataTestIds.receiveShipmentDialog.quantityField), '10');
    await screen.findByText(/lookup unavailable/);
    await user.click(screen.getByTestId(dataTestIds.receiveShipmentDialog.receiveButton));
    await waitFor(() => expect(screen.queryByTestId(dataTestIds.receiveShipmentDialog.dialog)).not.toBeInTheDocument());

    vi.mocked(getMedicationInventory).mockReturnValue(
      new Promise<GetMedicationInventoryResponse>((resolve, reject) => (lastLotResponse = { resolve, reject }))
    );
    vi.mocked(lookupNdc).mockClear();
    await user.click(screen.getByRole('button', { name: 'Receive Shipment' }));
  };

  it('waits for the last lot to load and fills from the lot just received, looking up only its NDC', async () => {
    const user = userEvent.setup();
    await receiveNewLotThenReopen(user);
    await waitMs(50);

    expect(prefilled()).toEqual({ ndc: '', manufacturer: '', vendor: '' });
    expect(screen.queryByText(/filled from the last lot received/)).not.toBeInTheDocument();

    await act(async () => lastLotResponse.resolve({ lastReceivedLot: NEW_LOT }));

    await waitFor(() =>
      expect(prefilled()).toEqual({ ndc: NEW_LOT.ndc, manufacturer: NEW_LOT.manufacturer, vendor: NEW_LOT.vendor })
    );
    await waitFor(() => expect(lookupNdc).toHaveBeenCalledTimes(1));
    expect(vi.mocked(lookupNdc).mock.calls[0][1].ndc).toBe(NEW_LOT.ndc);
  });

  it('fills nothing and looks nothing up when the last lot fails to load', async () => {
    const user = userEvent.setup();
    await receiveNewLotThenReopen(user);
    await act(async () => lastLotResponse.reject(new Error('Network error')));

    expect(await screen.findByText("Couldn't load the last lot received.")).toBeInTheDocument();
    await waitMs(800);
    expect(prefilled()).toEqual({ ndc: '', manufacturer: '', vendor: '' });
    expect(lookupNdc).not.toHaveBeenCalled();
  });

  it('keeps an NDC typed before the last lot loads and fills the other fields from the lot just received', async () => {
    const user = userEvent.setup();
    await receiveNewLotThenReopen(user);

    await user.type(ndcField(), '33333-3333-33');
    await act(async () => lastLotResponse.resolve({ lastReceivedLot: NEW_LOT }));

    await waitFor(() => expect(vendorField().value).toBe(NEW_LOT.vendor));
    expect(manufacturerField().value).toBe(NEW_LOT.manufacturer);
    expect(ndcField().value).toBe('33333-3333-33');
  });
});
