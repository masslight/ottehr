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

const { updateMedication } = vi.hoisted(() => ({ updateMedication: vi.fn() }));

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
    MedicationCardField: ({ field, inventoryLots, onInventoryLotPick }: any) =>
      field === 'lotNumber' && inventoryLots ? (
        <button onClick={() => onInventoryLotPick(inventoryLots.lots[0])}>
          Pick {inventoryLots.lots[0].lotNumber}
        </button>
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
  useInventoryLotsOnHand: () => ({ data: [lotWithoutManufacturer] }),
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
          options: [{ value: 'med-1', label: 'Medication One' }],
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
});
