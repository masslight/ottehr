import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const ENCOUNTER_ID = '11111111-1111-4111-8111-111111111111';
const PRACTITIONER_ID = '22222222-2222-4222-8222-222222222222';

const createOrder = vi.fn();
const updateOrder = vi.fn();
const saveChartData = vi.fn();

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

describe('DmeOrderForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createOrder.mockResolvedValue({ deviceRequestId: 'dr-1', cptCodesSaved: [] });
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
});
