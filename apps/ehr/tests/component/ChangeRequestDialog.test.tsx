import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { enqueueSnackbar } from 'notistack';
import { GetErxRequestResponse } from 'utils/lib/types/api/erx.types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RefillRequestDialog } from '../../src/features/visits/in-person/components/erx/RefillRequestDialog';

const mocks = vi.hoisted(() => ({
  getErxRequest: vi.fn(),
  respondToChange: vi.fn(),
  respondToRenewal: vi.fn(),
  completeTask: vi.fn(),
  height: undefined as { cm: number; takenAt?: string } | undefined,
  weight: undefined as { kg: number; takenAt?: string; thisVisit: boolean } | undefined,
  allergies: undefined as { name: string; adverseEvent: 'Allergy to substance'; source: 'Clinician' }[] | undefined,
}));

vi.mock('notistack', () => ({ enqueueSnackbar: vi.fn() }));
vi.mock('src/api/api', () => ({
  getErxRequest: mocks.getErxRequest,
  respondToChange: mocks.respondToChange,
  respondToRenewal: mocks.respondToRenewal,
}));
vi.mock('src/hooks/useAppClients', () => ({ useApiClients: () => ({ oystehrZambda: {} }) }));
vi.mock('src/hooks/useAuthToken', () => ({ useAuthToken: () => 'user-token' }));
vi.mock('../../src/features/visits/in-person/components/erx/useVisitWeight', () => ({
  useVisitWeight: () => mocks.weight,
  useVisitHeight: () => mocks.height,
  useVisitAllergies: () => mocks.allergies,
  useErxSendDataLoading: () => false,
  useErxSendDataFailed: () => undefined,
}));
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

const onClose = vi.fn();
const open = async (request: GetErxRequestResponse): Promise<ReturnType<typeof userEvent.setup>> => {
  mocks.getErxRequest.mockResolvedValue(request);
  const user = userEvent.setup();
  render(
    <QueryClientProvider client={new QueryClient()}>
      <RefillRequestDialog taskId="task-1" onClose={onClose} />
    </QueryClientProvider>
  );
  await screen.findByText(/^Original prescription/);
  return user;
};
const original = (): HTMLElement => screen.getByText(/^Original prescription/).parentElement!;

describe('Change request dialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.height = undefined;
    mocks.weight = undefined;
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
    expect(screen.getByRole('button', { name: 'Change' })).toBeInTheDocument();
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
    await waitFor(() =>
      expect(enqueueSnackbar).toHaveBeenCalledWith('Approval sent to CVS Pharmacy #7741', { variant: 'success' })
    );
    expect(onClose).toHaveBeenCalled();
  });

  it('approves a suggestion with the vitals’ weight alone, and shows a suggested compound', async () => {
    mocks.weight = { kg: 70.5, takenAt: '2026-09-14T15:00:00Z', thisVisit: false };
    const user = await open({
      ...OUT_OF_STOCK,
      pharmacyChangeRequest: {
        ...OUT_OF_STOCK.pharmacyChangeRequest!,
        suggestions: [
          {
            description: 'Lansoprazole suspension',
            compound: {
              description: 'Lansoprazole suspension',
              dosageForm: 'Suspension',
              ingredients: [{ description: 'Lansoprazole', amount: { value: 300, unit: 'Milligram' } }],
            },
            quantityValue: 100,
            quantityUnit: 'Milliliter',
          },
        ],
      },
    });
    const suggestions = screen.getByText('Pharmacy’s suggestion').parentElement!;
    expect(within(suggestions).getByText('Compound: Lansoprazole suspension')).toBeInTheDocument();
    expect(
      within(suggestions).getByText('Suspension · Lansoprazole 300 milligrams · 100 milliliters')
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Send to CVS Pharmacy #7741' }));
    await waitFor(() => expect(mocks.respondToChange).toHaveBeenCalled());
    expect(mocks.respondToChange.mock.calls[0][1]).toMatchObject({
      requestedMedicationIndex: 0,
      vitals: { weight: { value: 70.5, unit: 'kg', measuredDate: '2026-09-14' } },
    });
    expect(mocks.respondToChange.mock.calls[0][1].vitals).not.toHaveProperty('height');
  });

  // No raw codes to staff: the sub-codes have no plain names to show, and a kind Ottehr doesn't know reads "Other change".
  // (With a suggestion, so the dialog opens on Approve, not on the order form.)
  const suggestions = (): object => ({ suggestions: OUT_OF_STOCK.pharmacyChangeRequest!.suggestions });
  it('shows no sub-codes', async () => {
    await open(CHANGE('U', { subCodes: ['A', 'B'], ...suggestions() }));
    expect(screen.getByText('Prescriber authorization.')).toBeInTheDocument();
    expect(screen.queryByText(/sub-codes/)).not.toBeInTheDocument();
  });

  it('shows a change kind it doesn’t know as "Other change"', async () => {
    await open(CHANGE('ZZ', { subCodes: ['C'], ...suggestions() }));
    expect(screen.getByText('Other change.')).toBeInTheDocument();
    expect(screen.queryByText(/ZZ/)).not.toBeInTheDocument();
    expect(screen.queryByText(/sub-codes/)).not.toBeInTheDocument();
  });

  it('offers Pending on every change request', async () => {
    const answers = (): string[] =>
      within(screen.getByText('Your answer').parentElement!)
        .getAllByRole('button')
        .map((button) => button.textContent ?? '');
    await open(OUT_OF_STOCK);
    expect(answers()).toEqual(['Approve', 'Change', 'Deny', 'Pending']);
    cleanup();
    await open(CHANGE('G', { suggestions: OUT_OF_STOCK.pharmacyChangeRequest!.suggestions }));
    expect(answers()).toEqual(['Approve', 'Change', 'Deny', 'Pending']);
    cleanup();
    await open(CHANGE('P'));
    expect(answers()).toEqual(['Approve', 'Deny', 'Pending']);
  });

  it('moves to the note once a reason is picked', async () => {
    const user = await open(OUT_OF_STOCK);
    await user.click(screen.getByRole('button', { name: 'Deny' }));
    await user.click(screen.getByRole('combobox', { name: /Reason/ }));
    await user.click(screen.getByRole('option', { name: 'Change not appropriate' }));
    await waitFor(() => expect(screen.getByLabelText(/Note to pharmacy/)).toHaveFocus());
  });

  it('sends the patient’s allergies with a denial', async () => {
    mocks.allergies = [{ name: 'Penicillins', adverseEvent: 'Allergy to substance', source: 'Clinician' }];
    const user = await open(OUT_OF_STOCK);
    await user.click(screen.getByRole('button', { name: 'Deny' }));
    await user.click(screen.getByRole('combobox', { name: /Reason/ }));
    await user.click(screen.getByRole('option', { name: 'Change not appropriate' }));
    await user.click(screen.getByRole('button', { name: 'Send denial' }));
    await waitFor(() => expect(mocks.respondToChange).toHaveBeenCalled());
    expect(mocks.respondToChange.mock.calls[0][1]).toMatchObject({ decision: 'deny', allergies: mocks.allergies });
    mocks.allergies = undefined;
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
    await waitFor(() =>
      expect(enqueueSnackbar).toHaveBeenCalledWith('Denial sent to CVS Pharmacy #7741', { variant: 'success' })
    );
    expect(onClose).toHaveBeenCalled();
  });

  // Review R75: a safety alert starts with no answer picked, so the provider chooses; Approve is still offered. The
  // eRx service refuses this answer today: this only pins what the dialog sends.
  it('starts a drug-use alert with no suggestion on no answer, and sends its Approve with no suggestion or changes', async () => {
    const user = await open(CHANGE('D', { reason: 'Interacts with clopidogrel' }));
    expect(screen.getByText('Drug-use alert.')).toBeInTheDocument();
    for (const name of ['Approve', 'Change', 'Deny', 'Pending']) {
      expect(screen.getByRole('button', { name })).toHaveAttribute('aria-pressed', 'false');
    }
    const send = screen.getByRole('button', { name: 'Send to CVS Pharmacy #7741' });
    expect(send).toBeDisabled();
    await user.hover(send.parentElement!);
    expect(await screen.findByRole('tooltip')).toHaveTextContent('Pick an answer');
    await user.click(screen.getByRole('button', { name: 'Approve' }));
    await user.click(send);
    await waitFor(() => expect(mocks.completeTask).toHaveBeenCalled());
    expect(mocks.respondToChange.mock.calls[0][1]).toStrictEqual({
      taskId: 'change-1',
      decision: 'approve',
      note: undefined,
    });
    await waitFor(() =>
      expect(enqueueSnackbar).toHaveBeenCalledWith('Approval sent to CVS Pharmacy #7741', { variant: 'success' })
    );
    expect(onClose).toHaveBeenCalled();
  });

  it('approves a prior authorization request with its number, with no Change', async () => {
    const user = await open(CHANGE('P', { reason: 'Plan requires prior authorization' }));
    expect(screen.getByText('Prior authorization.')).toBeInTheDocument();
    expect(screen.queryByText('Pharmacy’s suggestions')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Change' })).not.toBeInTheDocument();
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
    await waitFor(() =>
      expect(enqueueSnackbar).toHaveBeenCalledWith('Approval sent to CVS Pharmacy #7741', { variant: 'success' })
    );
    expect(onClose).toHaveBeenCalled();
  });

  // Review D2-2: another strength with the original's amount is another dose (400 mg/5 mL to 250 mg/5 mL, 5 mL each
  // time), in whatever words the pharmacy writes it: warned, never blocked. The same strength from another maker isn't.
  describe('another strength with the same directions', () => {
    const suggestion = (description: string, sig: string): GetErxRequestResponse =>
      CHANGE('G', {
        suggestions: [{ description, ndc: '64764017130', quantityValue: 30, quantityUnit: 'Capsule', sig }],
      });
    const WARNING = 'Different strength, same directions: 60 mg → 30 mg. Check the dose.';

    it('warns under the comparison, and still lets the approval go', async () => {
      await open(suggestion('Dexlansoprazole 30 mg capsule', 'TAKE ONE CAPSULE BY MOUTH EVERY DAY'));
      expect(screen.getAllByText(WARNING)).toHaveLength(1);
      expect(screen.getByRole('button', { name: 'Send to CVS Pharmacy #7741' })).toBeEnabled();
    });

    it('doesn’t warn for the same strength from another maker', async () => {
      await open(suggestion('Dexlansoprazole 60 mg capsule', 'Take 1 capsule by mouth once daily'));
      expect(screen.queryByText(/^Different strength/)).not.toBeInTheDocument();
    });

    it('doesn’t warn for another amount', async () => {
      await open(suggestion('Dexlansoprazole 30 mg capsule', 'Take 2 capsules by mouth once daily'));
      expect(screen.queryByText(/^Different strength/)).not.toBeInTheDocument();
    });
  });
});
