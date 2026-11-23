import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent, { PointerEventsCheckLevel } from '@testing-library/user-event';
import { Medication } from 'fhir/r4b';
import { lookupNdc, receiveMedicationShipment } from 'src/api/api';
import { dataTestIds } from 'src/constants/data-test-ids';
import {
  InHouseMedicationInventory,
  LookupNdcResponse,
  VACCINE_DEFAULT_INVENTORY,
} from 'utils/lib/types/api/config/in-house-medications';
import {
  CVX_CODE_SYSTEM_URL,
  INVENTORY_VACCINE_TYPE_CODE,
  MEDICATION_IDENTIFIER_NAME_SYSTEM,
  MEDICATION_TYPE_SYSTEM,
} from 'utils/lib/types/api/medication-administration.constants';
import { MVX_MANUFACTURERS } from 'utils/lib/types/data/immunization/mvx-manufacturers.generated';
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

  it.each([
    [25, '25 vials'],
    [0, '0 vials'],
    [-2, '-2 vials'],
  ])('describes the expiration conflict the same way for a lot with a balance of %i', async (onHand, balance) => {
    vi.mocked(lookupNdc).mockReset().mockResolvedValue({ status: 'unavailable' });
    vi.mocked(receiveMedicationShipment)
      .mockReset()
      .mockResolvedValue({
        expirationConflict: { lotId: 'lot-shown', expirationDate: '2027-03-31', onHand, unit: 'vial' },
      });
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

    expect(
      await screen.findByText(
        `Lot A123 already exists at Main Street with expiration 03/31/2027. Current balance: ${balance}.`
      )
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'Creates a new lot with the new expiration date. The existing lot and its stock history remain unchanged.'
      )
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Updates the existing lot's expiration date and adds the received quantity to it. The correction is recorded in stock history."
      )
    ).toBeInTheDocument();
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

  it('receives a medication lot dated in the past without asking, and sends no funding source', async () => {
    vi.mocked(lookupNdc).mockReset().mockResolvedValue({ status: 'unavailable' });
    vi.mocked(receiveMedicationShipment)
      .mockReset()
      .mockResolvedValue({} as never);
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
    expect(screen.queryByRole('combobox', { name: /Funding source/ })).not.toBeInTheDocument();
    // a medication's manufacturer is typed, not picked from the vaccine manufacturers list
    expect(screen.queryByRole('combobox', { name: /Manufacturer/ })).not.toBeInTheDocument();
    await user.type(screen.getByRole('textbox', { name: /Manufacturer/ }), 'Fresenius Kabi');

    await user.type(screen.getByTestId(dataTestIds.receiveShipmentDialog.ndcField), '72572-0160-25');
    await user.type(screen.getByTestId(dataTestIds.receiveShipmentDialog.lotNumberField), 'A123');
    await user.click(screen.getByLabelText(/Expiration Date/));
    await user.keyboard('01012020');
    await user.type(screen.getByTestId(dataTestIds.receiveShipmentDialog.quantityField), '10');
    await screen.findByText(/lookup unavailable/);
    await user.click(screen.getByTestId(dataTestIds.receiveShipmentDialog.receiveButton));

    await waitFor(() => expect(receiveMedicationShipment).toHaveBeenCalledTimes(1));
    expect(screen.queryByText('Receive an expired lot?')).not.toBeInTheDocument();
    const sent = vi.mocked(receiveMedicationShipment).mock.calls[0][1];
    expect(sent).toMatchObject({
      medicationId: 'med-1',
      expirationDate: '2020-01-01',
      manufacturer: 'Fresenius Kabi',
    });
    expect(sent).not.toHaveProperty('fundingSource');
    expect(sent).not.toHaveProperty('mvx');
  });

  describe('for a vaccine', () => {
    const vaccine: Medication & { id: string } = {
      resourceType: 'Medication',
      id: 'vaccine-1',
      identifier: [
        { system: MEDICATION_TYPE_SYSTEM, value: INVENTORY_VACCINE_TYPE_CODE },
        { system: MEDICATION_IDENTIFIER_NAME_SYSTEM, value: 'MMR' },
      ],
      code: { coding: [{ system: CVX_CODE_SYSTEM_URL, code: '03' }] },
    };
    const onClose = vi.fn();

    const fundingSource = (): HTMLElement => screen.getByRole('combobox', { name: /Funding source/ });

    const chooseFundingSource = async (user: ReturnType<typeof userEvent.setup>, label: string): Promise<void> => {
      await user.click(fundingSource());
      await user.click(within(screen.getByRole('listbox')).getByRole('option', { name: label }));
    };

    const manufacturer = (): HTMLElement => screen.getByRole('combobox', { name: /Manufacturer/ });

    const chooseManufacturer = async (user: ReturnType<typeof userEvent.setup>, label: string): Promise<void> => {
      await user.click(manufacturer());
      await user.click(within(screen.getByRole('listbox')).getByRole('option', { name: label }));
    };

    /** Everything about the lot but its funding source. `manufacturerName: null` leaves the manufacturer unpicked. */
    const fillLot = async (
      user: ReturnType<typeof userEvent.setup>,
      expiration = '01012028',
      manufacturerName: string | null = 'Merck and Co., Inc.'
    ): Promise<void> => {
      if (manufacturerName) await chooseManufacturer(user, manufacturerName);
      await user.type(screen.getByTestId(dataTestIds.receiveShipmentDialog.ndcField), '00006-4681-00');
      await user.type(screen.getByTestId(dataTestIds.receiveShipmentDialog.lotNumberField), 'Y0112');
      await user.click(screen.getByLabelText(/Expiration Date/));
      await user.keyboard(expiration);
      await user.type(screen.getByTestId(dataTestIds.receiveShipmentDialog.quantityField), '10');
    };

    beforeEach(() => {
      vi.mocked(lookupNdc).mockReset().mockResolvedValue({ status: 'unavailable' });
      vi.mocked(receiveMedicationShipment)
        .mockReset()
        .mockResolvedValue({} as never);
      onClose.mockReset();
      render(
        <ReceiveShipmentDialog
          open
          onClose={onClose}
          medication={vaccine}
          inventory={VACCINE_DEFAULT_INVENTORY}
          locations={[{ id: 'loc-a', name: 'Main Street' }]}
        />
      );
    });

    it('counts in doses and asks for the funding source, with none chosen to begin with', async () => {
      const user = userEvent.setup();
      expect(screen.getByText('MMR · counted in doses')).toBeInTheDocument();
      expect(screen.getByTestId(dataTestIds.receiveShipmentDialog.fundingSourceSelect)).toContainElement(
        fundingSource()
      );
      expect(fundingSource()).toHaveTextContent(/^\W*$/);

      await user.click(fundingSource());

      expect(
        within(screen.getByRole('listbox'))
          .getAllByRole('option')
          .map((option) => option.textContent)
      ).toEqual(['VFC', 'Private', 'State program']);
    });

    it('does not receive until a funding source is chosen, then sends the one chosen', async () => {
      const user = userEvent.setup();
      await fillLot(user);

      await user.click(screen.getByTestId(dataTestIds.receiveShipmentDialog.receiveButton));
      expect(receiveMedicationShipment).not.toHaveBeenCalled();
      expect(onClose).not.toHaveBeenCalled();

      await chooseFundingSource(user, 'State program');
      await user.click(screen.getByRole('button', { name: 'Receive 10 Doses' }));

      await waitFor(() => expect(receiveMedicationShipment).toHaveBeenCalledTimes(1));
      expect(vi.mocked(receiveMedicationShipment).mock.calls[0][1]).toMatchObject({
        medicationId: 'vaccine-1',
        locationId: 'loc-a',
        lotNumber: 'Y0112',
        expirationDate: '2028-01-01',
        quantity: 10,
        ndc: '00006-4681-00',
        mvx: 'MSD',
        fundingSource: 'state',
      });
      expect(onClose).toHaveBeenCalled();
    });

    it('offers the manufacturers list for the manufacturer, with none picked to begin with', async () => {
      const user = userEvent.setup();
      expect(screen.getByTestId(dataTestIds.receiveShipmentDialog.manufacturerSelect)).toContainElement(manufacturer());
      expect(manufacturer()).toHaveTextContent(/^\W*$/);
      // a pick list, not a box to type in
      expect(screen.queryByRole('textbox', { name: /Manufacturer/ })).not.toBeInTheDocument();

      await user.click(manufacturer());

      expect(
        within(screen.getByRole('listbox'))
          .getAllByRole('option')
          .map((option) => option.textContent)
      ).toEqual(MVX_MANUFACTURERS.map((listed) => listed.name));
    });

    it('does not receive until a manufacturer is picked, then sends its MVX code and no typed name', async () => {
      const user = userEvent.setup();
      await fillLot(user, '01012028', null);
      await chooseFundingSource(user, 'Private');

      await user.click(screen.getByTestId(dataTestIds.receiveShipmentDialog.receiveButton));
      expect(receiveMedicationShipment).not.toHaveBeenCalled();
      expect(onClose).not.toHaveBeenCalled();

      await chooseManufacturer(user, 'Sanofi Pasteur');
      await user.click(screen.getByRole('button', { name: 'Receive 10 Doses' }));

      await waitFor(() => expect(receiveMedicationShipment).toHaveBeenCalledTimes(1));
      const sent = vi.mocked(receiveMedicationShipment).mock.calls[0][1];
      expect(sent).toMatchObject({ mvx: 'PMC', fundingSource: 'private' });
      expect(sent).not.toHaveProperty('manufacturer');
      expect(onClose).toHaveBeenCalled();
    });

    it('does not look the NDC up in the FDA directory', async () => {
      const user = userEvent.setup();
      await fillLot(user);
      await chooseFundingSource(user, 'VFC');
      // longer than the debounce a medication's NDC lookup waits
      await new Promise((resolve) => setTimeout(resolve, 800));

      expect(lookupNdc).not.toHaveBeenCalled();
      expect(screen.queryByText(/FDA NDC directory/)).not.toBeInTheDocument();
      await user.click(screen.getByTestId(dataTestIds.receiveShipmentDialog.receiveButton));

      await waitFor(() => expect(receiveMedicationShipment).toHaveBeenCalledTimes(1));
      expect(vi.mocked(receiveMedicationShipment).mock.calls[0][1]).toMatchObject({
        mvx: 'MSD',
        fundingSource: 'vfc',
      });
      expect(lookupNdc).not.toHaveBeenCalled();
    });

    it('asks before receiving a lot whose expiration date has passed, and never blocks', async () => {
      const user = userEvent.setup();
      await fillLot(user, '01012020');
      await chooseFundingSource(user, 'Private');

      await user.click(screen.getByTestId(dataTestIds.receiveShipmentDialog.receiveButton));
      expect(await screen.findByText('Receive an expired lot?')).toBeInTheDocument();
      expect(screen.getByText('This lot expired on 01/01/2020.')).toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: 'Change date' }));
      expect(receiveMedicationShipment).not.toHaveBeenCalled();

      await user.click(screen.getByTestId(dataTestIds.receiveShipmentDialog.receiveButton));
      await user.click(await screen.findByTestId(dataTestIds.dialog.proceedButton));
      await waitFor(() => expect(receiveMedicationShipment).toHaveBeenCalledTimes(1));
      expect(vi.mocked(receiveMedicationShipment).mock.calls[0][1]).toMatchObject({
        expirationDate: '2020-01-01',
        fundingSource: 'private',
      });
    });

    it('does not ask about an expired lot before the funding source is chosen', async () => {
      const user = userEvent.setup();
      await fillLot(user, '01012020');

      await user.click(screen.getByTestId(dataTestIds.receiveShipmentDialog.receiveButton));

      expect(screen.queryByText('Receive an expired lot?')).not.toBeInTheDocument();
      expect(receiveMedicationShipment).not.toHaveBeenCalled();
    });
  });
});
