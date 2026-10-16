import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const ENCOUNTER_ID = '11111111-1111-4111-8111-111111111111';
const PRACTITIONER_ID = '22222222-2222-4222-8222-222222222222';

const createOrder = vi.fn();
const updateOrder = vi.fn();
const saveChartData = vi.fn();
const { getDmeQuickPicks, createDmeQuickPick, updateDmeQuickPick } = vi.hoisted(() => ({
  getDmeQuickPicks: vi.fn(),
  createDmeQuickPick: vi.fn(),
  updateDmeQuickPick: vi.fn(),
}));
const refetchQuickPicks = vi.fn();
const zambdaClient = {};

const { visitAccess } = vi.hoisted(() => ({ visitAccess: { readOnly: false } }));

const KNEE_BRACE_QUICK_PICK = {
  id: 'qp-knee',
  name: 'Knee brace, right, external',
  itemName: 'Knee brace',
  quantity: 2,
  billingCodes: [{ code: 'L1810', display: 'Knee orthosis, elastic' }],
  laterality: 'RT',
  modifier: 'NU',
  external: true,
  thirdParty: { name: 'Acme Medical Supply', address: '1 Main St' },
};
const COLLAR_QUICK_PICK = { id: 'qp-collar', name: 'Cervical collar', itemName: 'Cervical collar', quantity: 1 };

vi.mock('../../src/features/dme/dme.queries', () => ({
  useCreateDmeOrder: () => ({ mutateAsync: createOrder }),
  useUpdateDmeOrder: () => ({ mutateAsync: updateOrder }),
}));

vi.mock('../../src/features/visits/shared/stores/appointment/appointment.store', () => ({
  useAppointmentData: () => ({ encounter: { id: ENCOUNTER_ID } }),
  useSaveChartData: () => ({ mutate: saveChartData }),
}));

vi.mock('../../src/features/visits/shared/hooks/useChartData', () => ({
  useChartData: () => ({
    chartData: {
      diagnosis: [
        { code: 'M25.561', display: 'Pain in right knee', isPrimary: false },
        { code: 'S83.511A', display: 'Sprain of ACL of right knee', isPrimary: true },
      ],
    },
    setPartialChartData: vi.fn(),
  }),
}));

vi.mock('../../src/features/visits/shared/hooks/useGetAppointmentAccessibility', () => ({
  useGetAppointmentAccessibility: () => ({ isAppointmentReadOnly: visitAccess.readOnly }),
}));

vi.mock('../../src/hooks/useMergedQuickPicks', () => ({
  sortQuickPicks: (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name),
  useMergedDmeQuickPicks: () => ({
    quickPicks: [COLLAR_QUICK_PICK, KNEE_BRACE_QUICK_PICK],
    loading: false,
    refetch: refetchQuickPicks,
  }),
}));

vi.mock('../../src/api/api', () => ({ getDmeQuickPicks, createDmeQuickPick, updateDmeQuickPick }));

vi.mock('notistack', async () => ({
  ...((await vi.importActual('notistack')) as object),
  enqueueSnackbar: vi.fn(),
}));

vi.mock('../../src/features/visits/shared/stores/appointment/appointment.queries', () => ({
  useGetCPTHCPCSSearch: () => ({ isFetching: false, data: { codes: [] } }),
  useICD10SearchNew: () => ({ isFetching: false, data: { codes: [] } }),
}));

vi.mock('../../src/features/visits/shared/hooks/useGetEmployees', () => ({
  useGetEmployeesWithDetails: () => ({
    data: { providers: [], nonProviders: [{ id: PRACTITIONER_ID, name: 'Dr. Ordering' }] },
    isLoading: false,
  }),
  toProviderDetails: (e: { id: string; name: string }) => ({ practitionerId: e.id, name: e.name }),
}));

vi.mock('../../src/shared/utils/employeeFilters', () => ({
  PROVIDERS_FILTER: () => true,
}));

vi.mock('../../src/hooks/useAppClients', () => ({
  useApiClients: () => ({ oystehrZambda: zambdaClient, oystehr: {} }),
}));

vi.mock('../../src/hooks/useEvolveUser', () => ({
  default: () => ({ profile: `Practitioner/${PRACTITIONER_ID}`, userName: 'Dr. Ordering', hasRole: () => true }),
}));

vi.mock('../../src/shared/hooks/useDebounce', () => ({
  useDebounce: () => ({ debounce: (callback: () => void) => callback() }),
}));

import { enqueueSnackbar } from 'notistack';
import { DmeOrderDTO, DmeOrderStatus } from 'utils/lib/types/api/dme.types';
import { dataTestIds } from '../../src/constants/data-test-ids';
import { DmeOrderForm } from '../../src/features/dme/components/DmeOrderForm';

const ids = dataTestIds.dmeOrders.form;

const renderForm = (order?: DmeOrderDTO): { onFinished: ReturnType<typeof vi.fn> } => {
  const onFinished = vi.fn();
  render(<DmeOrderForm order={order} onFinished={onFinished} onCancel={vi.fn()} />);
  return { onFinished };
};

const itemNameInput = (): HTMLElement => within(screen.getByTestId(ids.item)).getByRole('textbox');

const typeItemName = async (name: string): Promise<void> => {
  await userEvent.type(itemNameInput(), name);
};

const EXISTING_ORDER: DmeOrderDTO = {
  id: 'dr-existing',
  encounterId: ENCOUNTER_ID,
  status: DmeOrderStatus.pending,
  itemName: 'Cervical collar',
  diagnoses: [],
  quantity: 2,
  billingCodes: [{ code: 'L0120', display: 'Cervical, flexible' }],
  orderedBy: { practitionerId: PRACTITIONER_ID, name: 'Dr. Ordering' },
  orderedAt: '2026-10-01T10:00:00.000Z',
  external: false,
};

const openQuickPicks = async (): Promise<void> => {
  await userEvent.click(screen.getByRole('textbox', { name: 'Quick Picks' }));
};

const inputOf = (testId: string): HTMLInputElement =>
  screen.getByTestId(testId).querySelector('input, textarea:not([aria-hidden])') as HTMLInputElement;

describe('DmeOrderForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    visitAccess.readOnly = false;
    createOrder.mockResolvedValue({ deviceRequestId: 'dr-1', cptCodesSaved: [] });
    getDmeQuickPicks.mockResolvedValue({ quickPicks: [] });
    createDmeQuickPick.mockResolvedValue({ message: 'ok', quickPick: {} });
    updateDmeQuickPick.mockResolvedValue({ message: 'ok', quickPick: {} });
  });

  it('submits a create request with the item, chart diagnoses (primary first) and defaults', async () => {
    const { onFinished } = renderForm();

    await typeItemName('  Knee brace ');
    await userEvent.click(screen.getByTestId(ids.submitButton));

    await waitFor(() => expect(createOrder).toHaveBeenCalledTimes(1));
    expect(createOrder).toHaveBeenCalledWith({
      encounterId: ENCOUNTER_ID,
      itemName: 'Knee brace',
      diagnoses: [
        { code: 'S83.511A', display: 'Sprain of ACL of right knee' },
        { code: 'M25.561', display: 'Pain in right knee' },
      ],
      quantity: 1,
      billingCodes: [],
      orderedByPractitionerId: PRACTITIONER_ID,
      external: false,
    });
    expect(createOrder.mock.calls[0][0].thirdParty).toBeUndefined();
    expect(saveChartData).not.toHaveBeenCalled();
    expect(onFinished).toHaveBeenCalledWith('dr-1');
  });

  it('adds third party information when fulfilled externally', async () => {
    renderForm();

    await typeItemName('Knee brace');
    await userEvent.click(screen.getByTestId(ids.externalSwitch));
    await userEvent.type(within(screen.getByTestId(ids.thirdPartyName)).getByRole('textbox'), 'Acme Medical Supply');
    await userEvent.type(within(screen.getByTestId(ids.thirdPartyAddress)).getByRole('textbox'), '1 Main St');
    await userEvent.click(screen.getByTestId(ids.submitButton));

    await waitFor(() => expect(createOrder).toHaveBeenCalledTimes(1));
    expect(createOrder.mock.calls[0][0]).toMatchObject({
      external: true,
      thirdParty: { name: 'Acme Medical Supply', address: '1 Main St' },
    });
  });

  it('does not submit without a DME item name', async () => {
    renderForm();

    await userEvent.click(screen.getByTestId(ids.submitButton));
    expect(await screen.findByText('This field is required')).toBeInTheDocument();

    await typeItemName('   ');
    await userEvent.click(screen.getByTestId(ids.submitButton));
    expect(await screen.findByText('DME is required')).toBeInTheDocument();
    expect(createOrder).not.toHaveBeenCalled();
  });

  it('prefills the item name when editing and submits the edited name', async () => {
    const { onFinished } = renderForm(EXISTING_ORDER);

    expect(itemNameInput()).toHaveValue('Cervical collar');
    await userEvent.clear(itemNameInput());
    await typeItemName('Soft cervical collar');
    await userEvent.click(screen.getByTestId(ids.submitButton));

    await waitFor(() => expect(updateOrder).toHaveBeenCalledTimes(1));
    expect(updateOrder).toHaveBeenCalledWith({
      action: 'update',
      deviceRequestId: 'dr-existing',
      fields: expect.objectContaining({
        itemName: 'Soft cervical collar',
        quantity: 2,
        billingCodes: [{ code: 'L0120', display: 'Cervical, flexible' }],
      }),
    });
    expect(updateOrder.mock.calls[0][0].fields).not.toHaveProperty('menuItemId');
    expect(onFinished).toHaveBeenCalledWith('dr-existing');
  });

  it('fills the form from a quick pick and orders it', async () => {
    renderForm();

    await openQuickPicks();
    await userEvent.click(await screen.findByRole('menuitem', { name: KNEE_BRACE_QUICK_PICK.name }));

    expect(inputOf(ids.item)).toHaveValue('Knee brace');
    expect(inputOf(ids.quantity)).toHaveValue(2);
    expect(inputOf(ids.laterality)).toHaveValue('RT (Right)');
    expect(inputOf(ids.modifier)).toHaveValue('NU (New Purchase)');
    expect(within(screen.getByTestId(ids.billingCodes)).getByText('L1810 Knee orthosis, elastic')).toBeInTheDocument();
    expect(screen.getByTestId(ids.externalSwitch)).toBeChecked();
    expect(inputOf(ids.thirdPartyName)).toHaveValue('Acme Medical Supply');
    expect(inputOf(ids.thirdPartyAddress)).toHaveValue('1 Main St');

    await userEvent.click(screen.getByTestId(ids.submitButton));

    await waitFor(() => expect(createOrder).toHaveBeenCalledTimes(1));
    expect(createOrder.mock.calls[0][0]).toMatchObject({
      itemName: 'Knee brace',
      quantity: 2,
      billingCodes: [{ code: 'L1810', display: 'Knee orthosis, elastic' }],
      laterality: 'RT',
      modifier: 'NU',
      orderedByPractitionerId: PRACTITIONER_ID,
      external: true,
      thirdParty: { name: 'Acme Medical Supply', address: '1 Main St' },
      diagnoses: [
        { code: 'S83.511A', display: 'Sprain of ACL of right knee' },
        { code: 'M25.561', display: 'Pain in right knee' },
      ],
    });
  });

  it('replaces the DME name and codes of an order being edited with the pick ones', async () => {
    renderForm(EXISTING_ORDER);

    await openQuickPicks();
    await userEvent.click(await screen.findByRole('menuitem', { name: KNEE_BRACE_QUICK_PICK.name }));

    expect(itemNameInput()).toHaveValue('Knee brace');
    const billingCodes = within(screen.getByTestId(ids.billingCodes));
    expect(billingCodes.getByText('L1810 Knee orthosis, elastic')).toBeInTheDocument();
    expect(billingCodes.queryByText('L0120 Cervical, flexible')).not.toBeInTheDocument();
  });

  it('clears the codes when the pick has none', async () => {
    renderForm(EXISTING_ORDER);

    await openQuickPicks();
    await userEvent.click(await screen.findByRole('menuitem', { name: COLLAR_QUICK_PICK.name }));

    expect(itemNameInput()).toHaveValue('Cervical collar');
    expect(
      within(screen.getByTestId(ids.billingCodes)).queryByText('L0120 Cervical, flexible')
    ).not.toBeInTheDocument();
  });

  it('saves the current DME name and codes as a new quick pick', async () => {
    renderForm();

    await openQuickPicks();
    await userEvent.click(await screen.findByRole('menuitem', { name: KNEE_BRACE_QUICK_PICK.name }));
    await userEvent.click(screen.getByTestId(ids.externalSwitch));
    await userEvent.clear(itemNameInput());
    await typeItemName('Hinged knee brace');
    await userEvent.type(inputOf(ids.instructions), 'Wear while walking');
    await openQuickPicks();
    await userEvent.click(await screen.findByRole('menuitem', { name: '+ Add or Update Quick Pick' }));

    const nameInput = await screen.findByRole('combobox', { name: 'Quick Pick Name' });
    await waitFor(() => expect(nameInput).toHaveValue('Hinged knee brace'));
    await userEvent.clear(nameInput);
    await userEvent.type(nameInput, 'Knee brace, walking');
    await userEvent.click(screen.getByRole('button', { name: 'Save Quick Pick' }));

    await waitFor(() => expect(createDmeQuickPick).toHaveBeenCalledTimes(1));
    expect(createDmeQuickPick).toHaveBeenCalledWith(zambdaClient, {
      quickPick: {
        name: 'Knee brace, walking',
        itemName: 'Hinged knee brace',
        billingCodes: [{ code: 'L1810', display: 'Knee orthosis, elastic' }],
        quantity: 2,
        laterality: 'RT',
        modifier: 'NU',
        instructions: 'Wear while walking',
        external: false,
      },
    });
    expect(createDmeQuickPick.mock.calls[0][1].quickPick.orderedByPractitionerId).toBeUndefined();
    await waitFor(() => expect(refetchQuickPicks).toHaveBeenCalledTimes(1));
    expect(createOrder).not.toHaveBeenCalled();
  });

  it('does not open the save dialog without a DME name', async () => {
    renderForm();

    await openQuickPicks();
    await userEvent.click(await screen.findByRole('menuitem', { name: '+ Add or Update Quick Pick' }));

    expect(enqueueSnackbar).toHaveBeenCalledWith('Enter the DME name before saving a quick pick', { variant: 'error' });
    expect(screen.queryByRole('combobox', { name: 'Quick Pick Name' })).not.toBeInTheDocument();
    expect(getDmeQuickPicks).not.toHaveBeenCalled();
  });

  it('replaces an existing quick pick with the same name', async () => {
    getDmeQuickPicks.mockResolvedValue({ quickPicks: [{ id: 'qp-existing', name: 'Knee brace' }] });
    renderForm();

    await typeItemName('Knee brace');
    await openQuickPicks();
    await userEvent.click(await screen.findByRole('menuitem', { name: '+ Add or Update Quick Pick' }));
    await waitFor(() => expect(screen.getByRole('combobox', { name: 'Quick Pick Name' })).toHaveValue('Knee brace'));
    await userEvent.click(screen.getByRole('button', { name: 'Save Quick Pick' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Replace' }));

    await waitFor(() => expect(updateDmeQuickPick).toHaveBeenCalledTimes(1));
    expect(updateDmeQuickPick).toHaveBeenCalledWith(
      zambdaClient,
      'qp-existing',
      expect.objectContaining({ name: 'Knee brace', itemName: 'Knee brace', billingCodes: [] })
    );
    expect(createDmeQuickPick).not.toHaveBeenCalled();
  });

  it('hides quick picks on a read-only visit', () => {
    visitAccess.readOnly = true;
    renderForm();

    expect(screen.queryByRole('textbox', { name: 'Quick Picks' })).not.toBeInTheDocument();
  });
});
