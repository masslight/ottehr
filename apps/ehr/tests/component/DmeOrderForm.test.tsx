import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const ENCOUNTER_ID = '11111111-1111-4111-8111-111111111111';
const PRACTITIONER_ID = '22222222-2222-4222-8222-222222222222';
const MENU_ITEM_ID = '33333333-3333-4333-8333-333333333333';

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
  menuItemId: '33333333-3333-4333-8333-333333333333',
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
  useDmeMenuItems: () => ({
    data: {
      items: [
        {
          id: MENU_ITEM_ID,
          name: 'Knee brace',
          hcpcsCodes: [
            { code: 'L1830', display: 'Knee orthosis' },
            { code: 'L1810', display: 'Knee orthosis, elastic' },
          ],
        },
      ],
    },
    isLoading: false,
  }),
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

import { dataTestIds } from '../../src/constants/data-test-ids';
import { DmeOrderForm } from '../../src/features/dme/components/DmeOrderForm';

const ids = dataTestIds.dmeOrders.form;

const renderForm = (): { onFinished: ReturnType<typeof vi.fn> } => {
  const onFinished = vi.fn();
  render(<DmeOrderForm onFinished={onFinished} onCancel={vi.fn()} />);
  return { onFinished };
};

const selectMenuItem = async (name: string): Promise<void> => {
  await userEvent.click(within(screen.getByTestId(ids.item)).getByRole('combobox'));
  await userEvent.click(await screen.findByRole('option', { name }));
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

  it('fills the HCPCS codes of the selected menu item', async () => {
    renderForm();

    await selectMenuItem('Knee brace');

    const billingCodes = screen.getByTestId(ids.billingCodes);
    expect(within(billingCodes).getByText('L1830 Knee orthosis')).toBeInTheDocument();
    expect(within(billingCodes).getByText('L1810 Knee orthosis, elastic')).toBeInTheDocument();
  });

  it('submits a create request with the item, chart diagnoses (primary first) and defaults', async () => {
    const { onFinished } = renderForm();

    await selectMenuItem('Knee brace');
    await userEvent.click(screen.getByTestId(ids.submitButton));

    await waitFor(() => expect(createOrder).toHaveBeenCalledTimes(1));
    expect(createOrder).toHaveBeenCalledWith({
      encounterId: ENCOUNTER_ID,
      menuItemId: MENU_ITEM_ID,
      itemName: 'Knee brace',
      diagnoses: [
        { code: 'S83.511A', display: 'Sprain of ACL of right knee' },
        { code: 'M25.561', display: 'Pain in right knee' },
      ],
      quantity: 1,
      billingCodes: [
        { code: 'L1830', display: 'Knee orthosis' },
        { code: 'L1810', display: 'Knee orthosis, elastic' },
      ],
      orderedByPractitionerId: PRACTITIONER_ID,
      external: false,
    });
    expect(createOrder.mock.calls[0][0].thirdParty).toBeUndefined();
    expect(saveChartData).not.toHaveBeenCalled();
    expect(onFinished).toHaveBeenCalledWith('dr-1');
  });

  it('adds third party information when fulfilled externally', async () => {
    renderForm();

    await selectMenuItem('Knee brace');
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

  it('requires a name for an "Other" item and sends it without a menu item id', async () => {
    renderForm();

    await selectMenuItem('Other');
    await userEvent.click(screen.getByTestId(ids.submitButton));

    expect(await screen.findByText('This field is required')).toBeInTheDocument();
    expect(createOrder).not.toHaveBeenCalled();

    await userEvent.type(within(screen.getByTestId(ids.otherItemName)).getByRole('textbox'), 'Cervical collar');
    await userEvent.click(screen.getByTestId(ids.submitButton));

    await waitFor(() => expect(createOrder).toHaveBeenCalledTimes(1));
    expect(createOrder.mock.calls[0][0]).toMatchObject({ itemName: 'Cervical collar', billingCodes: [] });
    expect(createOrder.mock.calls[0][0].menuItemId).toBeUndefined();
  });

  it('does not submit without a DME item', async () => {
    renderForm();

    await userEvent.click(screen.getByTestId(ids.submitButton));

    expect(await screen.findByText('This field is required')).toBeInTheDocument();
    expect(createOrder).not.toHaveBeenCalled();
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
    expect(within(screen.getByTestId(ids.billingCodes)).queryByText('L1830 Knee orthosis')).not.toBeInTheDocument();
    expect(screen.getByTestId(ids.externalSwitch)).toBeChecked();
    expect(inputOf(ids.thirdPartyName)).toHaveValue('Acme Medical Supply');
    expect(inputOf(ids.thirdPartyAddress)).toHaveValue('1 Main St');

    await userEvent.click(screen.getByTestId(ids.submitButton));

    await waitFor(() => expect(createOrder).toHaveBeenCalledTimes(1));
    expect(createOrder.mock.calls[0][0]).toMatchObject({
      menuItemId: MENU_ITEM_ID,
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

  it('applies a pick whose item is not on the menu as "Other"', async () => {
    renderForm();

    await openQuickPicks();
    await userEvent.click(await screen.findByRole('menuitem', { name: COLLAR_QUICK_PICK.name }));

    expect(inputOf(ids.item)).toHaveValue('Other');
    expect(inputOf(ids.otherItemName)).toHaveValue('Cervical collar');
  });

  it('saves the current order as a new quick pick', async () => {
    renderForm();

    await selectMenuItem('Knee brace');
    await userEvent.type(inputOf(ids.instructions), 'Wear while walking');
    await openQuickPicks();
    await userEvent.click(await screen.findByRole('menuitem', { name: '+ Add or Update Quick Pick' }));

    const nameInput = await screen.findByRole('combobox', { name: 'Quick Pick Name' });
    await waitFor(() => expect(nameInput).toHaveValue('Knee brace'));
    await userEvent.clear(nameInput);
    await userEvent.type(nameInput, 'Knee brace, walking');
    await userEvent.click(screen.getByRole('button', { name: 'Save Quick Pick' }));

    await waitFor(() => expect(createDmeQuickPick).toHaveBeenCalledTimes(1));
    expect(createDmeQuickPick).toHaveBeenCalledWith(zambdaClient, {
      quickPick: {
        name: 'Knee brace, walking',
        menuItemId: MENU_ITEM_ID,
        itemName: 'Knee brace',
        quantity: 1,
        billingCodes: [
          { code: 'L1830', display: 'Knee orthosis' },
          { code: 'L1810', display: 'Knee orthosis, elastic' },
        ],
        instructions: 'Wear while walking',
        external: false,
      },
    });
    expect(createDmeQuickPick.mock.calls[0][1].quickPick.orderedByPractitionerId).toBeUndefined();
    await waitFor(() => expect(refetchQuickPicks).toHaveBeenCalledTimes(1));
    expect(createOrder).not.toHaveBeenCalled();
  });

  it('replaces an existing quick pick with the same name', async () => {
    getDmeQuickPicks.mockResolvedValue({ quickPicks: [{ id: 'qp-existing', name: 'Knee brace' }] });
    renderForm();

    await selectMenuItem('Knee brace');
    await openQuickPicks();
    await userEvent.click(await screen.findByRole('menuitem', { name: '+ Add or Update Quick Pick' }));
    await waitFor(() => expect(screen.getByRole('combobox', { name: 'Quick Pick Name' })).toHaveValue('Knee brace'));
    await userEvent.click(screen.getByRole('button', { name: 'Save Quick Pick' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Replace' }));

    await waitFor(() => expect(updateDmeQuickPick).toHaveBeenCalledTimes(1));
    expect(updateDmeQuickPick).toHaveBeenCalledWith(
      zambdaClient,
      'qp-existing',
      expect.objectContaining({ name: 'Knee brace', menuItemId: MENU_ITEM_ID })
    );
    expect(createDmeQuickPick).not.toHaveBeenCalled();
  });

  it('hides quick picks on a read-only visit', () => {
    visitAccess.readOnly = true;
    renderForm();

    expect(screen.queryByRole('textbox', { name: 'Quick Picks' })).not.toBeInTheDocument();
  });
});
