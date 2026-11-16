import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DateTime } from 'luxon';
import { enqueueSnackbar } from 'notistack';
import { GetErxRequestResponse } from 'utils/lib/types/api/erx.types';
import { PrescriptionAllergy } from 'utils/lib/types/api/order-prescription.types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RefillRequestDialog } from '../../src/features/visits/in-person/components/erx/RefillRequestDialog';

const mocks = vi.hoisted(() => ({
  getErxRequest: vi.fn(),
  respondToRenewal: vi.fn(),
  completeTask: vi.fn(),
  height: undefined as { cm: number; takenAt?: string } | undefined,
  weight: undefined as { kg: number; takenAt?: string; thisVisit: boolean } | undefined,
  allergies: undefined as PrescriptionAllergy[] | undefined,
  enrollment: undefined as { registered: boolean } | undefined,
  sendDataLoading: false,
  sendDataFailed: undefined as string | undefined,
}));

vi.mock('notistack', () => ({ enqueueSnackbar: vi.fn() }));
vi.mock('src/api/api', () => ({ getErxRequest: mocks.getErxRequest, respondToRenewal: mocks.respondToRenewal }));
vi.mock('src/hooks/useAppClients', () => ({ useApiClients: () => ({ oystehrZambda: {} }) }));
vi.mock('src/hooks/useAuthToken', () => ({ useAuthToken: () => 'user-token' }));
vi.mock('../../src/features/visits/in-person/components/erx/useVisitWeight', () => ({
  useVisitWeight: () => mocks.weight,
  useVisitHeight: () => mocks.height,
  useVisitAllergies: () => mocks.allergies,
  useErxSendDataLoading: () => mocks.sendDataLoading,
  useErxSendDataFailed: () => mocks.sendDataFailed,
}));
vi.mock('../../src/features/visits/shared/hooks/useCheckSurescriptsEnrollment', () => ({
  useCheckSurescriptsEnrollment: () => ({ data: mocks.enrollment }),
}));
vi.mock('../../src/features/visits/in-person/hooks/useTasks', () => ({
  GET_TASKS_KEY: 'get-tasks',
  useCompleteErxTask: () => ({ mutateAsync: mocks.completeTask }),
}));

const RECEIVED = '2026-10-27T16:12:00.000Z';
const ASKED_AGAIN = '2026-10-28T09:05:00.000Z';
const local = (iso: string): string => DateTime.fromISO(iso).toLocal().toFormat('M/d/yyyy h:mm a');

const REQUEST: GetErxRequestResponse = {
  taskId: 'task-1',
  kind: 'refill',
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

const onClose = vi.fn();
const open = async (request: GetErxRequestResponse = REQUEST): Promise<ReturnType<typeof userEvent.setup>> => {
  mocks.getErxRequest.mockResolvedValue(request);
  const user = userEvent.setup();
  render(
    <QueryClientProvider client={new QueryClient()}>
      <RefillRequestDialog taskId="task-1" onClose={onClose} />
    </QueryClientProvider>
  );
  await screen.findByText('Pharmacy’s request');
  return user;
};
const section = (heading: string | RegExp): HTMLElement => screen.getByText(heading).parentElement!;

describe('Refill request dialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.height = undefined;
    mocks.weight = undefined;
    mocks.allergies = undefined;
    mocks.enrollment = undefined;
    mocks.sendDataLoading = false;
    mocks.sendDataFailed = undefined;
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
    expect(within(section('Patient Info')).getByText('(512) 555-0187')).toBeInTheDocument();
    expect(screen.queryByText(/asked again/)).not.toBeInTheDocument();
  });

  it('is read-only for a user not enrolled in Surescripts, saying so where the answer would be', async () => {
    mocks.enrollment = { registered: false };
    await open();
    expect(screen.getByText('You are not enrolled in Surescripts e-prescribing.')).toBeInTheDocument();
    expect(screen.queryByText('Your answer')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Send to CVS Pharmacy #7741' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Send denial' })).not.toBeInTheDocument();
    // What the pharmacy asked is still there to read.
    expect(within(section('Pharmacy’s request')).getByText('Pharmacy asks for 3 fills')).toBeInTheDocument();
  });

  it('says why its send button is off: a denial needs a reason', async () => {
    const user = await open();
    await user.click(screen.getByRole('button', { name: 'Deny' }));
    const send = screen.getByRole('button', { name: 'Send denial' });
    expect(send).toBeDisabled();
    await user.hover(send.parentElement!);
    expect(await screen.findByRole('tooltip')).toHaveTextContent('Pick a reason');
  });

  it('waits for the patient’s allergies and vitals before it sends an answer', async () => {
    mocks.sendDataLoading = true;
    await open();
    expect(screen.getByRole('button', { name: 'Send to CVS Pharmacy #7741' })).toBeDisabled();
  });

  // Review D2-4: a failed load says so, and still sends (allergies and vitals are optional).
  it('says when the allergies and vitals couldn’t load, and still sends', async () => {
    mocks.sendDataFailed = "Couldn't load allergies and vitals: they won't be sent.";
    await open();
    expect(screen.getByText(mocks.sendDataFailed)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Send to CVS Pharmacy #7741' })).toBeEnabled();
  });

  it('says how many fills the pharmacy asks for, "fill" for one', async () => {
    await open();
    expect(within(section('Pharmacy’s request')).getByText('Pharmacy asks for 3 fills')).toBeInTheDocument();
    cleanup();
    await open({
      ...REQUEST,
      pharmacyRequest: {
        ...REQUEST.pharmacyRequest!,
        medication: { ...REQUEST.pharmacyRequest!.medication, requestedRefills: 1 },
      },
    });
    expect(within(section('Pharmacy’s request')).getByText('Pharmacy asks for 1 fill')).toBeInTheDocument();
  });

  it('dates when the pharmacy asked again, beside when the request came in', async () => {
    await open({ ...REQUEST, pharmacyRequest: { ...REQUEST.pharmacyRequest!, askedAgain: ASKED_AGAIN } });
    expect(
      screen.getByText(new RegExp(`Received ${local(RECEIVED)} · asked again ${local(ASKED_AGAIN)}`))
    ).toBeInTheDocument();
    expect(screen.queryByText(/You’re answering the newest request/)).not.toBeInTheDocument();
  });

  it('approves with the fills asked for, then completes the task', async () => {
    const user = await open();
    expect(screen.getByLabelText('Fills to authorize')).toHaveValue('3');
    await user.type(screen.getByLabelText('Note to pharmacy (optional)'), 'BP check soon');
    await user.click(screen.getByRole('button', { name: 'Send to CVS Pharmacy #7741' }));
    await waitFor(() => expect(mocks.completeTask).toHaveBeenCalledWith({ taskId: 'task-1', requestId: 'renewal-1' }));
    expect(mocks.respondToRenewal).toHaveBeenCalledWith('user-token', {
      taskId: 'renewal-1',
      decision: 'approve',
      numberOfRefills: 3,
      note: 'BP check soon',
    });
    // No vitals recorded: none sent.
    expect(mocks.respondToRenewal.mock.calls[0][1]).not.toHaveProperty('vitals');
    await waitFor(() =>
      expect(enqueueSnackbar).toHaveBeenCalledWith('Approval sent to CVS Pharmacy #7741', { variant: 'success' })
    );
    expect(onClose).toHaveBeenCalled();
  });

  it('approves with the vitals’ height and weight, each with the date measured', async () => {
    mocks.height = { cm: 162, takenAt: '2026-09-14T15:00:00Z' };
    mocks.weight = { kg: 70.5, takenAt: '2026-09-14T15:00:00Z', thisVisit: true };
    const user = await open();
    await user.click(screen.getByRole('button', { name: 'Send to CVS Pharmacy #7741' }));
    await waitFor(() => expect(mocks.respondToRenewal).toHaveBeenCalled());
    expect(mocks.respondToRenewal.mock.calls[0][1].vitals).toEqual({
      height: { value: 162, unit: 'cm', measuredDate: '2026-09-14' },
      weight: { value: 70.5, unit: 'kg', measuredDate: '2026-09-14' },
    });
  });

  it('approves with only the height when the vitals have no weight', async () => {
    mocks.height = { cm: 162, takenAt: '2026-09-14T15:00:00Z' };
    const user = await open();
    await user.click(screen.getByRole('button', { name: 'Send to CVS Pharmacy #7741' }));
    await waitFor(() => expect(mocks.respondToRenewal).toHaveBeenCalled());
    expect(mocks.respondToRenewal.mock.calls[0][1].vitals).toEqual({
      height: { value: 162, unit: 'cm', measuredDate: '2026-09-14' },
    });
  });

  it('sends the patient’s allergies with an approval and with a denial', async () => {
    mocks.allergies = [{ name: 'Penicillins', adverseEvent: 'Allergy to substance', source: 'Clinician' }];
    let user = await open();
    await user.click(screen.getByRole('button', { name: 'Send to CVS Pharmacy #7741' }));
    await waitFor(() => expect(mocks.respondToRenewal).toHaveBeenCalledTimes(1));
    expect(mocks.respondToRenewal.mock.calls[0][1]).toMatchObject({ decision: 'approve', allergies: mocks.allergies });
    cleanup();
    user = await open();
    await user.click(screen.getByRole('button', { name: 'Deny' }));
    await user.click(screen.getByRole('combobox', { name: /Reason/ }));
    await user.click(screen.getByRole('option', { name: 'Patient needs appointment' }));
    await user.click(screen.getByRole('button', { name: 'Send denial' }));
    await waitFor(() => expect(mocks.respondToRenewal).toHaveBeenCalledTimes(2));
    expect(mocks.respondToRenewal.mock.calls[1][1]).toMatchObject({ decision: 'deny', allergies: mocks.allergies });
  });

  it('shows a compound the pharmacy asks to renew as the prescriptions table does', async () => {
    await open({
      ...REQUEST,
      pharmacyRequest: {
        ...REQUEST.pharmacyRequest!,
        medication: {
          description: 'Pain cream',
          compound: {
            description: 'Pain cream',
            dosageForm: 'Cream',
            ingredients: [
              { description: 'Ketoprofen Powder', amount: { value: 6, unit: 'Gram' } },
              { description: 'Compounding cream', amount: { value: 54, unit: 'Gram' } },
            ],
          },
          quantityValue: 60,
          quantityUnit: 'Gram',
        },
      },
    });
    expect(
      within(section('Pharmacy’s request')).getByText(
        'Compound: Pain cream · Cream · Ketoprofen Powder 6 grams · Compounding cream 54 grams'
      )
    ).toHaveAttribute('data-differs', 'true');
  });

  // Decision 251: a refill can come back at another strength just as a change can.
  it('warns when the requested medication is another strength with the same amount', async () => {
    const original = 'Amoxicillin 400 mg/5ml Susp';
    await open({
      ...REQUEST,
      pharmacyRequest: {
        ...REQUEST.pharmacyRequest!,
        medication: {
          description: 'Amoxicillin 250 mg/5ml Susp',
          ndc: '00093415273',
          sig: 'Take 5 mL by mouth twice daily for 10 days',
        },
      },
      prescription: {
        ...REQUEST.prescription!,
        name: original,
        instructions: 'Take 5 mL by mouth twice daily for 10 days.',
        order: { ...REQUEST.prescription!.order!, ndc: '00093415573', medicationDescription: original },
      },
    });
    expect(
      screen.getByText('Different strength, same amount: 400 mg/5 mL → 250 mg/5 mL. Check the dose.')
    ).toBeInTheDocument();
  });

  it('doesn’t warn on a refill of the same strength', async () => {
    await open();
    expect(screen.queryByText(/^Different strength/)).not.toBeInTheDocument();
  });

  it('stays sent when the task can’t be completed, with a warning to close it from the Tasks page', async () => {
    mocks.completeTask.mockRejectedValue(new Error('Task update failed'));
    const user = await open();
    await user.click(screen.getByRole('button', { name: 'Send to CVS Pharmacy #7741' }));
    await waitFor(() =>
      expect(enqueueSnackbar).toHaveBeenCalledWith(
        'Approval sent to CVS Pharmacy #7741, but its task couldn’t be closed and is still open on the Tasks page.',
        { variant: 'warning' }
      )
    );
    expect(onClose).toHaveBeenCalled();
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
    await waitFor(() =>
      expect(enqueueSnackbar).toHaveBeenCalledWith('Denial sent to CVS Pharmacy #7741', { variant: 'success' })
    );
    expect(onClose).toHaveBeenCalled();
  });

  it('answers Pending without completing the task', async () => {
    const user = await open();
    await user.click(screen.getByRole('button', { name: 'Pending' }));
    await user.click(screen.getByRole('combobox', { name: /Reason/ }));
    await user.click(screen.getByRole('option', { name: 'Patient has labs/tests pending' }));
    await user.click(screen.getByRole('button', { name: 'Send to CVS Pharmacy #7741' }));
    await waitFor(() =>
      expect(enqueueSnackbar).toHaveBeenCalledWith('Pending sent to CVS Pharmacy #7741', { variant: 'success' })
    );
    expect(onClose).toHaveBeenCalled();
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
    // The dialog stays open, to try again.
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Send to CVS Pharmacy #7741' })).toBeEnabled();
  });

  it('can’t answer a withdrawn request', async () => {
    await open({ ...REQUEST, pharmacyRequest: { ...REQUEST.pharmacyRequest!, withdrawn: true, closed: true } });
    expect(screen.getByText('CVS Pharmacy #7741 withdrew this request. It can’t be answered.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Approve' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: /^Send/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument();
  });
});
