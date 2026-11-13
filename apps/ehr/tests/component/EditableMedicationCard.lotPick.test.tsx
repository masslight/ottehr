import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DateTime } from 'luxon';
import { InventoryLot } from 'utils/lib/types/api/config/in-house-medications';
import { IN_HOUSE_CONTAINED_MEDICATION_ID } from 'utils/lib/types/api/medication-administration.constants';
import {
  ExtendedMedicationDataForResponse,
  inHouseMedicationsMedicationApplianceRoutes,
} from 'utils/lib/types/api/medication-administration.types';
import { describe, expect, it, vi } from 'vitest';
import { dataTestIds } from '../../src/constants/data-test-ids';
import { EditableMedicationCard } from '../../src/features/visits/in-person/components/medication-administration/medication-editable-card/EditableMedicationCard';

const inAYear = DateTime.now().plus({ years: 1 }).toISODate()!;

const lotWithoutManufacturer: InventoryLot = {
  id: 'lot-b',
  catalogMedicationId: 'med-1',
  locationId: 'loc-a',
  lotNumber: 'B456',
  expirationDate: inAYear,
  ndc: 'ndc-B456',
  onHand: 10,
  unit: 'vial',
  status: 'active',
};

const savedOrder: ExtendedMedicationDataForResponse = {
  id: 'ma-1',
  status: 'administered',
  patient: 'p-1',
  encounterId: 'enc-med-test',
  medicationId: IN_HOUSE_CONTAINED_MEDICATION_ID,
  medicationName: 'Medication One',
  dose: 2,
  units: 'mg',
  route: inHouseMedicationsMedicationApplianceRoutes.ORAL.code,
  providerId: 'prov-1',
  lotNumber: 'A123',
  expDate: inAYear,
  ndc: 'ndc-A123',
  manufacturer: 'Pfizer',
  effectiveDateTime: DateTime.now().toISO()!,
  providerCreatedTheOrder: 'Dr One',
  providerCreatedTheOrderId: 'prov-1',
  dateTimeCreated: DateTime.now().toISO()!,
};

const { updateMedication, lotsRequestedFor, lotsRequestedAt } = vi.hoisted(() => ({
  updateMedication: vi.fn(),
  lotsRequestedFor: vi.fn(),
  lotsRequestedAt: vi.fn(),
}));

vi.mock('react-router-dom', async () => ({
  ...(await vi.importActual('react-router-dom')),
  useNavigate: () => vi.fn(),
  useParams: () => ({ id: 'appointment-1' }),
}));
vi.mock('src/api/api', () => ({
  getInHouseMedicationQuickPicks: vi.fn(),
  createInHouseMedicationQuickPick: vi.fn(),
  updateInHouseMedicationQuickPick: vi.fn(),
}));
vi.mock(
  '../../src/features/visits/in-person/components/medication-administration/statuses/MedicationStatusChip',
  () => ({ MedicationStatusChip: () => <div /> })
);
vi.mock(
  '../../src/features/visits/in-person/components/medication-administration/medication-editable-card/MedicationCardField',
  () => ({
    MedicationCardField: ({ field, value, inventoryLots, onInventoryLotPick, onChange }: any) =>
      field === 'lotNumber' && inventoryLots ? (
        <>
          <button onClick={() => onInventoryLotPick(inventoryLots.lots[0])}>
            Pick {inventoryLots.lots[0].lotNumber}
          </button>
          <input
            aria-label="Type a lot"
            value={value ?? ''}
            onChange={(event) => onChange('lotNumber', event.target.value)}
          />
        </>
      ) : (
        <div />
      ),
  })
);
vi.mock('src/components/input/CptCodesInput', () => ({
  CptCodesInput: () => <div />,
  CptCodeSearch: () => <div />,
  addCptCode: (codes: unknown[]) => codes,
  removeCptCode: (codes: unknown[]) => codes,
  designateMedicationCptCode: (codes: unknown[]) => codes,
}));
vi.mock('../../src/features/admin/inventory/inventory.queries', () => ({
  useInventoryLotsOnHand: (params: { catalogMedicationId?: string; locationId?: string }) => {
    lotsRequestedFor(params.catalogMedicationId);
    lotsRequestedAt(params.locationId);
    return { data: [lotWithoutManufacturer] };
  },
}));
vi.mock('../../src/features/visits/in-person/components/InPersonModal', () => ({
  InPersonModal: ({ open, handleConfirm, entity }: any) =>
    open && entity ? <button onClick={() => handleConfirm(entity)}>Confirm</button> : null,
}));
vi.mock('../../src/features/visits/in-person/hooks/useMedicationHistory', () => ({
  useMedicationHistory: () => ({ isLoading: false, medicationHistory: [], refetchHistory: vi.fn() }),
}));
vi.mock('../../src/features/visits/shared/stores/appointment/appointment.store', () => ({
  useAppointmentData: () => ({
    mappedData: {},
    resources: { encounter: { id: 'enc-med-test' }, location: { id: 'loc-a', name: 'Main Street' } },
  }),
}));
vi.mock('../../src/hooks/useAppClients', () => ({ useApiClients: () => ({ oystehr: {}, oystehrZambda: {} }) }));
vi.mock('../../src/hooks/useEvolveUser', () => ({ default: () => ({ hasRole: () => false }) }));
vi.mock('../../src/hooks/useMergedQuickPicks', () => ({
  sortQuickPicks: () => 0,
  useMergedInHouseMedicationQuickPicks: () => ({ quickPicks: [], loading: false, refetch: vi.fn() }),
}));
vi.mock('../../src/hooks/usePendingQuickPick', () => ({ usePendingQuickPick: vi.fn() }));
vi.mock('../../src/features/visits/in-person/hooks/useGetFieldOptions', () => ({
  useFieldsSelectsOptions: () =>
    new Proxy(
      {
        medicationId: {
          options: [
            { value: 'med-same-name', label: 'Medication One' },
            { value: 'med-1', label: 'Medication One' },
            { value: 'med-2', label: 'Medication Two' },
          ],
          status: 'loaded',
          ndcToMedicationId: {},
          medispanCodeToMedicationId: {},
        },
      },
      {
        get: (target, prop) =>
          prop in target
            ? (target as Record<string | symbol, unknown>)[prop]
            : { options: [], defaultOption: undefined },
      }
    ),
}));
vi.mock('../../src/features/visits/in-person/hooks/useMedicationManagement', () => ({
  useMedicationManagement: () => ({
    updateMedication,
    getMedicationFieldValue: (medication: any, field: string) => medication?.[field] ?? '',
    getIsMedicationEditable: () => true,
    deleteMedication: vi.fn(),
  }),
}));

const saveAsAdministered = async (user: ReturnType<typeof userEvent.setup>): Promise<Record<string, unknown>> => {
  await user.click(screen.getByTestId(dataTestIds.inHouseMedicationsPage.administeredButton));
  await user.click(await screen.findByRole('button', { name: 'Confirm' }));
  await waitFor(() => expect(updateMedication).toHaveBeenCalledTimes(1));
  return JSON.parse(JSON.stringify(updateMedication.mock.calls[0][0])).orderData;
};

describe('EditableMedicationCard - the inventory lot sent with a saved order', () => {
  it('sends the id of the lot picked from the suggestions', async () => {
    updateMedication.mockReset().mockResolvedValue({});
    const user = userEvent.setup();
    render(<EditableMedicationCard type="completed-edit" medication={savedOrder} />);

    await user.click(screen.getByRole('button', { name: 'Pick B456' }));

    expect(await saveAsAdministered(user)).toMatchObject({ lotNumber: 'B456', inventoryLotId: 'lot-b' });
  });

  it('sends no lot id once a typed lot number replaces the picked lot', async () => {
    updateMedication.mockReset().mockResolvedValue({});
    const user = userEvent.setup();
    render(<EditableMedicationCard type="completed-edit" medication={{ ...savedOrder, inventoryLotId: 'lot-a' }} />);

    const lotInput = screen.getByLabelText('Type a lot');
    await user.clear(lotInput);
    await user.type(lotInput, 'SAMPLE-1');

    const sent = await saveAsAdministered(user);
    expect(sent).toMatchObject({ lotNumber: 'SAMPLE-1' });
    expect(sent).not.toHaveProperty('inventoryLotId');
  });

  it('keeps the lot id of a saved order whose lot was not touched', async () => {
    updateMedication.mockReset().mockResolvedValue({});
    const user = userEvent.setup();
    render(<EditableMedicationCard type="completed-edit" medication={{ ...savedOrder, inventoryLotId: 'lot-a' }} />);

    expect(await saveAsAdministered(user)).toMatchObject({ lotNumber: 'A123', inventoryLotId: 'lot-a' });
  });

  it('keeps the lot id of a saved order whose lot is no longer suggested when its number is changed and typed back', async () => {
    updateMedication.mockReset().mockResolvedValue({});
    const user = userEvent.setup();
    render(<EditableMedicationCard type="completed-edit" medication={{ ...savedOrder, inventoryLotId: 'lot-a' }} />);

    const lotInput = screen.getByRole('textbox', { name: 'Type a lot' });

    expect(lotInput).toHaveValue('A123');

    await user.type(lotInput, '4');
    expect(lotInput).toHaveValue('A1234');

    await user.type(lotInput, '{Backspace}');
    expect(lotInput).toHaveValue('A123');

    expect(await saveAsAdministered(user)).toMatchObject({
      lotNumber: 'A123',
      inventoryLotId: 'lot-a',
    });
  });
});

describe('EditableMedicationCard - picking an inventory lot on a saved order', () => {
  it('sends an empty manufacturer when the picked lot has none', async () => {
    updateMedication.mockReset().mockResolvedValue({});
    const user = userEvent.setup();
    render(<EditableMedicationCard type="completed-edit" medication={savedOrder} />);

    await user.click(screen.getByRole('button', { name: 'Pick B456' }));
    await user.click(screen.getByTestId(dataTestIds.inHouseMedicationsPage.administeredButton));
    await user.click(await screen.findByRole('button', { name: 'Confirm' }));

    await waitFor(() => expect(updateMedication).toHaveBeenCalledTimes(1));
    const sent = JSON.parse(JSON.stringify(updateMedication.mock.calls[0][0]));
    expect(sent.orderData).toMatchObject({ lotNumber: 'B456', ndc: 'ndc-B456' });
    expect(sent.orderData).toHaveProperty('manufacturer', '');
  });

  it('suggests lots of the catalog drug the order was made from when another drug has the same name', () => {
    lotsRequestedFor.mockClear();
    render(
      <EditableMedicationCard type="completed-edit" medication={{ ...savedOrder, catalogMedicationId: 'med-1' }} />
    );
    expect(lotsRequestedFor).toHaveBeenLastCalledWith('med-1');
  });

  it('suggests lots of the drug with the order name when the order has no catalog drug recorded', () => {
    lotsRequestedFor.mockClear();
    render(
      <EditableMedicationCard type="completed-edit" medication={{ ...savedOrder, medicationName: 'Medication Two' }} />
    );
    expect(lotsRequestedFor).toHaveBeenLastCalledWith('med-2');
  });
});

describe('EditableMedicationCard - administering an order applied from a template', () => {
  it("preselects a lot on hand at the visit's location and sends its id when the order carries no lot", async () => {
    updateMedication.mockReset().mockResolvedValue({});
    lotsRequestedFor.mockClear();
    lotsRequestedAt.mockClear();
    const user = userEvent.setup();
    const templateAppliedOrder: ExtendedMedicationDataForResponse = {
      ...savedOrder,
      status: 'pending',
      catalogMedicationId: 'med-1',
      lotNumber: undefined,
      expDate: undefined,
      manufacturer: undefined,
      inventoryLotId: undefined,
    };
    render(<EditableMedicationCard type="dispense" medication={templateAppliedOrder} />);

    await waitFor(() => expect(screen.getByRole('textbox', { name: 'Type a lot' })).toHaveValue('B456'));
    expect(lotsRequestedFor).toHaveBeenLastCalledWith('med-1');
    expect(lotsRequestedAt).toHaveBeenLastCalledWith('loc-a');

    expect(await saveAsAdministered(user)).toMatchObject({
      lotNumber: 'B456',
      inventoryLotId: 'lot-b',
      ndc: 'ndc-B456',
    });
  });
});
