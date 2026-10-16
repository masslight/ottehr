import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const ENCOUNTER_ID = '11111111-1111-4111-8111-111111111111';
const PRACTITIONER_ID = '22222222-2222-4222-8222-222222222222';
const MENU_ITEM_ID = '33333333-3333-4333-8333-333333333333';

const createOrder = vi.fn();
const updateOrder = vi.fn();
const saveChartData = vi.fn();

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
  useGetAppointmentAccessibility: () => ({ isAppointmentReadOnly: false }),
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
  useApiClients: () => ({ oystehrZambda: {}, oystehr: {} }),
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

describe('DmeOrderForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createOrder.mockResolvedValue({ deviceRequestId: 'dr-1', cptCodesSaved: [] });
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
});
