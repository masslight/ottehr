import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GetErxRequestResponse } from 'utils/lib/types/api/erx.types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RefillRequestDialog } from '../../src/features/visits/in-person/components/erx/RefillRequestDialog';

const mocks = vi.hoisted(() => ({
  getErxRequest: vi.fn(),
  respondToChange: vi.fn(),
  respondToRenewal: vi.fn(),
  completeTask: vi.fn(),
}));

vi.mock('notistack', () => ({ enqueueSnackbar: vi.fn() }));
vi.mock('src/api/api', () => ({
  getErxRequest: mocks.getErxRequest,
  respondToChange: mocks.respondToChange,
  respondToRenewal: mocks.respondToRenewal,
}));
vi.mock('src/hooks/useAppClients', () => ({ useApiClients: () => ({ oystehrZambda: {} }) }));
vi.mock('src/hooks/useAuthToken', () => ({ useAuthToken: () => 'user-token' }));
vi.mock('../../src/features/visits/in-person/hooks/useTasks', () => ({
  GET_TASKS_KEY: 'get-tasks',
  useCompleteErxTask: () => ({ mutateAsync: mocks.completeTask }),
}));

const CHANGE = (code: string, extra: object = {}): GetErxRequestResponse => ({
  taskId: 'task-1',
  kind: 'change',
  pharmacyChangeRequest: {
    changeTaskId: 'change-1',
    pharmacy: { name: 'CVS Pharmacy #7741', ncpdpId: '0000001', npi: '1234567890', phone: '5125550142' },
    code,
    subCodes: [],
    suggestions: [],
    received: '2026-10-28T14:02:00.000Z',
    withdrawn: false,
    closed: false,
    ...extra,
  },
  prescription: {
    resourceId: 'rx-1',
    name: 'Dexilant 60 mg capsule',
    instructions: 'Take 1 capsule by mouth once daily',
    encounterId: 'encounter-9',
    sent: '2026-10-27T15:00:00.000Z',
    order: {
      ndc: '64764017530',
      medicationDescription: 'Dexilant 60 mg capsule',
      quantityValue: 30,
      quantityUnit: 'Capsule',
      daysSupply: 30,
      numberOfRefills: 2,
      diagnosisCode: 'K21.9',
      diagnosisDescription: 'GERD without esophagitis',
    },
  },
  patient: { resourceType: 'Patient', id: 'patient-1', name: [{ given: ['Ann'], family: 'Cooper' }] },
});

const OUT_OF_STOCK = CHANGE('OS', {
  reason: 'Dexilant 60 mg on backorder until December',
  suggestions: [
    {
      description: 'Omeprazole 40 mg delayed-release capsule',
      ndc: '00093521998',
      quantityValue: 30,
      quantityUnit: 'Capsule',
      sig: 'Take 1 capsule by mouth once daily before breakfast',
      daysSupply: 30,
      numberOfRefills: 2,
    },
    // Only a name and a quantity: the rest stays empty, never 0 nor the original's (S.207).
    {
      description: 'Pantoprazole 40 mg delayed-release tablet',
      ndc: '00008084181',
      quantityValue: 0.5,
      quantityUnit: 'Tablet',
    },
  ],
});

const open = async (request: GetErxRequestResponse): Promise<ReturnType<typeof userEvent.setup>> => {
  mocks.getErxRequest.mockResolvedValue(request);
  const user = userEvent.setup();
  render(
    <QueryClientProvider client={new QueryClient()}>
      <RefillRequestDialog taskId="task-1" onClose={vi.fn()} />
    </QueryClientProvider>
  );
  await screen.findByText(/^Original prescription/);
  return user;
};
const original = (): HTMLElement => screen.getByText(/^Original prescription/).parentElement!;

describe('Change request dialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.respondToChange.mockResolvedValue({
      taskId: 'change-1',
      messageId: 'm',
      responseType: 'Approved',
      status: {},
    });
    mocks.completeTask.mockResolvedValue(undefined);
  });

  it('shows an out of stock request’s reason and its two suggestions as choices, and approves the selected one', async () => {
    const user = await open(OUT_OF_STOCK);
    expect(screen.getByText('Change request from CVS Pharmacy #7741')).toBeInTheDocument();
    expect(screen.getByText('Out of stock.')).toBeInTheDocument();
    expect(screen.getByText(/“Dexilant 60 mg on backorder until December”/)).toBeInTheDocument();
    const suggestions = screen.getByText('Pharmacy’s suggestions').parentElement!;
    expect(
      within(suggestions).getByText(
        '30 capsules · Take 1 capsule by mouth once daily before breakfast · 30 days · 2 refills'
      )
    ).toBeInTheDocument();
    expect(within(suggestions).getByText('0.5 tablets')).toBeInTheDocument();
    expect(screen.getAllByRole('radio')).toHaveLength(2);
    expect(screen.getByRole('radio', { name: /Omeprazole/ })).toBeChecked();
    expect(screen.getByRole('button', { name: 'Change and approve' })).toBeInTheDocument();
    // The original against the selected suggestion.
    expect(within(original()).getByText('Dexilant 60 mg capsule')).toHaveAttribute('data-differs', 'true');
    expect(within(original()).getByText('Take 1 capsule by mouth once daily')).toHaveAttribute('data-differs', 'true');

    await user.click(screen.getByRole('radio', { name: /Pantoprazole/ }));
    // Pantoprazole sent no directions: nothing to compare.
    expect(within(original()).getByText('Take 1 capsule by mouth once daily')).not.toHaveAttribute('data-differs');
    await user.click(screen.getByRole('button', { name: 'Send to CVS Pharmacy #7741' }));
    await waitFor(() => expect(mocks.completeTask).toHaveBeenCalledWith({ taskId: 'task-1' }));
    expect(mocks.respondToChange).toHaveBeenCalledWith('user-token', {
      taskId: 'change-1',
      decision: 'approve',
      requestedMedicationIndex: 1,
      note: undefined,
    });
    expect(mocks.respondToRenewal).not.toHaveBeenCalled();
    expect(await screen.findByText('Sent to CVS Pharmacy #7741')).toBeInTheDocument();
  });

  it('denies a change request with a change denial reason', async () => {
    const user = await open(OUT_OF_STOCK);
    await user.click(screen.getByRole('button', { name: 'Deny' }));
    await user.click(screen.getByRole('combobox', { name: /Reason/ }));
    await user.click(screen.getByRole('option', { name: 'Change not appropriate' }));
    await user.click(screen.getByRole('button', { name: 'Send denial' }));
    await waitFor(() => expect(mocks.completeTask).toHaveBeenCalled());
    expect(mocks.respondToChange).toHaveBeenCalledWith('user-token', {
      taskId: 'change-1',
      decision: 'deny',
      reason: 'Change not appropriate',
      denialReason: undefined,
    });
  });

  it('approves a drug-use alert with no suggestion as written, with no suggestion or changes', async () => {
    const user = await open(CHANGE('D', { reason: 'Interacts with clopidogrel' }));
    expect(screen.getByText('Drug-use alert.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Approve as written' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Change and approve' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Send to CVS Pharmacy #7741' }));
    await waitFor(() => expect(mocks.completeTask).toHaveBeenCalled());
    expect(mocks.respondToChange.mock.calls[0][1]).toStrictEqual({
      taskId: 'change-1',
      decision: 'approve',
      note: undefined,
    });
    expect(await screen.findByText('Sent to CVS Pharmacy #7741')).toBeInTheDocument();
  });

  it('approves a prior authorization request with its number, with no Change and approve', async () => {
    const user = await open(CHANGE('P', { reason: 'Plan requires prior authorization' }));
    expect(screen.getByText('Prior authorization.')).toBeInTheDocument();
    expect(screen.queryByText('Pharmacy’s suggestions')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Change and approve' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Approve' })).toHaveAttribute('aria-pressed', 'true');
    const send = screen.getByRole('button', { name: 'Send to CVS Pharmacy #7741' });
    expect(send).toBeDisabled();
    await user.type(screen.getByLabelText(/Prior authorization number/), 'PA-88431207');
    await user.click(send);
    await waitFor(() => expect(mocks.completeTask).toHaveBeenCalled());
    expect(mocks.respondToChange).toHaveBeenCalledWith('user-token', {
      taskId: 'change-1',
      decision: 'approve',
      note: undefined,
      priorAuthorization: { number: 'PA-88431207', status: 'approved' },
    });
    expect(await screen.findByText('Sent to CVS Pharmacy #7741')).toBeInTheDocument();
  });
});
