import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DateTime } from 'luxon';
import { enqueueSnackbar } from 'notistack';
import { GetErxRequestResponse } from 'utils/lib/types/api/erx.types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RefillRequestDialog } from '../../src/features/visits/in-person/components/erx/RefillRequestDialog';

const mocks = vi.hoisted(() => ({
  getErxRequest: vi.fn(),
  respondToRenewal: vi.fn(),
  completeTask: vi.fn(),
}));

vi.mock('notistack', () => ({ enqueueSnackbar: vi.fn() }));
vi.mock('src/api/api', () => ({ getErxRequest: mocks.getErxRequest, respondToRenewal: mocks.respondToRenewal }));
vi.mock('src/hooks/useAppClients', () => ({ useApiClients: () => ({ oystehrZambda: {} }) }));
vi.mock('src/hooks/useAuthToken', () => ({ useAuthToken: () => 'user-token' }));
vi.mock('../../src/features/visits/in-person/hooks/useTasks', () => ({
  GET_TASKS_KEY: 'get-tasks',
  useCompleteTask: () => ({ mutateAsync: mocks.completeTask }),
}));

const RECEIVED = '2026-10-27T16:12:00.000Z';
const ASKED_AGAIN = '2026-10-28T09:05:00.000Z';
const local = (iso: string): string => DateTime.fromISO(iso).toLocal().toFormat('M/d/yyyy h:mm a');

const REQUEST: GetErxRequestResponse = {
  taskId: 'task-1',
  pharmacyRequest: {
    renewalTaskId: 'renewal-1',
    pharmacy: { name: 'CVS Pharmacy #7741', ncpdpId: '0000001', npi: '1234567893', phone: '5125550142' },
    medication: {
      description: 'Lisinopril 10 mg tablet',
      ndc: '00093111101',
      quantityValue: 0.27,
      quantityUnit: 'Milliliter',
      sig: 'Take 1 tablet by mouth twice daily',
      substitutionAllowed: true,
      requestedRefills: 3,
    },
    received: RECEIVED,
    withdrawn: false,
    closed: false,
  },
  prescription: {
    resourceId: 'rx-1',
    name: 'Lisinopril 10 mg tablet',
    instructions: 'Take 1 tablet by mouth once daily',
    sent: '2026-09-14T15:00:00.000Z',
    order: {
      ndc: '00093111101',
      quantityValue: 30,
      quantityUnit: 'Tablet',
      daysSupply: 30,
      numberOfRefills: 1,
      substitutionAllowed: true,
      diagnosisCode: 'I10',
      diagnosisDescription: 'Essential hypertension',
    },
  },
  prescriberName: 'Carolyn Demo',
  patient: {
    resourceType: 'Patient',
    id: 'patient-1',
    name: [{ given: ['Maria'], family: 'Lopez' }],
    gender: 'female',
    birthDate: '1968-03-12',
    address: [{ line: ['1408 Bouldin Ave'], city: 'Austin', state: 'TX', postalCode: '78704' }],
    telecom: [{ system: 'phone', value: '5125550187' }],
  },
};

const open = async (request: GetErxRequestResponse = REQUEST): Promise<ReturnType<typeof userEvent.setup>> => {
  mocks.getErxRequest.mockResolvedValue(request);
  const user = userEvent.setup();
  render(
    <QueryClientProvider client={new QueryClient()}>
      <RefillRequestDialog taskId="task-1" onClose={vi.fn()} />
    </QueryClientProvider>
  );
  await screen.findByText('Pharmacy’s request');
  return user;
};
const section = (heading: string | RegExp): HTMLElement => screen.getByText(heading).parentElement!;

describe('Refill request dialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.respondToRenewal.mockResolvedValue({
      taskId: 'renewal-1',
      messageId: 'm',
      responseType: 'Approved',
      status: {},
    });
    mocks.completeTask.mockResolvedValue(undefined);
  });

  it('shows only what the pharmacy sent, in plain numbers, beside the original, with differences highlighted', async () => {
    await open();
    const request = section('Pharmacy’s request');
    expect(within(request).getByText('0.27 milliliters')).toBeInTheDocument();
    // Left out by the pharmacy: empty, never 0 nor the original's 30.
    const daysSupply = within(request).getByText('Days supply').nextElementSibling!;
    expect(daysSupply).toHaveTextContent('Not sent');
    expect(within(request).getByText('Take 1 tablet by mouth twice daily')).toHaveAttribute('data-differs', 'true');
    expect(within(request).getByText('Lisinopril 10 mg tablet')).not.toHaveAttribute('data-differs');
    const original = section(/^Original prescription/);
    expect(within(original).getByText('30 tablets')).toHaveAttribute('data-differs', 'true');
    expect(within(original).getByText('Essential hypertension (I10)')).toBeInTheDocument();
    expect(within(section('Patient')).getByText('(512) 555-0187')).toBeInTheDocument();
    expect(screen.queryByText(/asked again/)).not.toBeInTheDocument();
  });

  it('says the pharmacy asked again, with both dates', async () => {
    await open({ ...REQUEST, pharmacyRequest: { ...REQUEST.pharmacyRequest!, askedAgain: ASKED_AGAIN } });
    expect(
      screen.getByText(new RegExp(`Received ${local(RECEIVED)} · asked again ${local(ASKED_AGAIN)}`))
    ).toBeInTheDocument();
    expect(
      screen.getByText(`The pharmacy asked again. You’re answering the newest request (${local(ASKED_AGAIN)}).`)
    ).toBeInTheDocument();
  });

  it('approves with the fills asked for, then completes the task', async () => {
    const user = await open();
    expect(screen.getByLabelText('Fills to authorize')).toHaveValue('3');
    await user.type(screen.getByLabelText('Note to pharmacy (optional)'), 'BP check soon');
    await user.click(screen.getByRole('button', { name: 'Send to CVS Pharmacy #7741' }));
    await waitFor(() => expect(mocks.completeTask).toHaveBeenCalledWith({ taskId: 'task-1' }));
    expect(mocks.respondToRenewal).toHaveBeenCalledWith('user-token', {
      taskId: 'renewal-1',
      decision: 'approve',
      numberOfRefills: 3,
      note: 'BP check soon',
    });
    expect(await screen.findByText('Approved: 3 fills. Sent to CVS Pharmacy #7741.')).toBeInTheDocument();
  });

  it('denies only with a reason', async () => {
    const user = await open();
    await user.click(screen.getByRole('button', { name: 'Deny' }));
    expect(screen.getByRole('button', { name: 'Send denial' })).toBeDisabled();
    await user.click(screen.getByRole('combobox', { name: /Reason/ }));
    await user.click(screen.getByRole('option', { name: 'Patient needs appointment' }));
    await user.click(screen.getByRole('button', { name: 'Send denial' }));
    await waitFor(() => expect(mocks.completeTask).toHaveBeenCalled());
    expect(mocks.respondToRenewal).toHaveBeenCalledWith('user-token', {
      taskId: 'renewal-1',
      decision: 'deny',
      reason: 'Patient needs appointment',
      denialReason: undefined,
    });
  });

  it('answers Pending without completing the task', async () => {
    const user = await open();
    await user.click(screen.getByRole('button', { name: 'Pending' }));
    await user.click(screen.getByRole('combobox', { name: /Reason/ }));
    await user.click(screen.getByRole('option', { name: 'Patient has labs/tests pending' }));
    await user.click(screen.getByRole('button', { name: 'Send to CVS Pharmacy #7741' }));
    expect(
      await screen.findByText('Pending: Patient has labs/tests pending. Sent to CVS Pharmacy #7741.')
    ).toBeInTheDocument();
    expect(mocks.respondToRenewal.mock.calls[0][1]).toMatchObject({ decision: 'pending' });
    expect(mocks.completeTask).not.toHaveBeenCalled();
  });

  it('shows an error from the eRx service like other send errors, and leaves the task open', async () => {
    mocks.respondToRenewal.mockRejectedValue(new Error('The renewal request has expired'));
    const user = await open();
    await user.click(screen.getByRole('button', { name: 'Send to CVS Pharmacy #7741' }));
    await waitFor(() =>
      expect(enqueueSnackbar).toHaveBeenCalledWith('The renewal request has expired', { variant: 'error' })
    );
    expect(mocks.completeTask).not.toHaveBeenCalled();
  });

  it('can’t answer a withdrawn request', async () => {
    await open({ ...REQUEST, pharmacyRequest: { ...REQUEST.pharmacyRequest!, withdrawn: true, closed: true } });
    expect(screen.getByText('CVS Pharmacy #7741 withdrew this request. It can’t be answered.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Approve' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: /^Send/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument();
  });
});
