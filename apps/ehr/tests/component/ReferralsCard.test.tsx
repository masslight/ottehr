import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { dataTestIds } from 'src/constants/data-test-ids';
import { ReferralDTO } from 'utils/lib/types/api/referrals/referrals.types';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const referrals: ReferralDTO[] = vi.hoisted(() => [
  {
    id: '11111111-1111-4111-8111-111111111111',
    patientId: 'patient-1',
    encounterId: 'encounter-1',
    appointmentId: 'appointment-1',
    specialty: 'Orthopedics',
    recipient: {
      contactId: 'c1',
      name: 'Riverside Orthopedic Associates',
      organizationName: 'Riverside Orthopedic Associates',
      fax: '+12125554321',
    },
    reason: 'Distal radius fracture, closed; evaluate for reduction vs cast',
    urgency: 'urgent',
    whatIsAsked: 'evaluate-and-treat',
    whoSchedules: 'patient',
    responseRequested: true,
    includeDocuments: ['progress-note', 'lab-results', 'radiology-results'],
    earlierDocuments: [
      {
        id: 'doc-xr',
        title: 'XR wrist 3 views.pdf',
        date: '2026-09-23T15:00:00.000Z',
        visitDate: '2026-09-22T15:00:00.000Z',
      },
      { id: 'doc-note', title: 'VisitNote.pdf', date: '2026-09-22T16:00:00.000Z' },
    ],
    notesToRecipient: 'Splint applied.',
    referringProvider: { id: 'p1', name: 'J. Rivera, MD' },
    status: 'not-sent',
    createdAt: '2026-11-01T15:00:00.000Z',
    responseDocumentReferenceIds: [],
  },
  {
    id: '22222222-2222-4222-8222-222222222222',
    patientId: 'patient-1',
    encounterId: 'encounter-1',
    specialty: 'ENT',
    reason: 'Recurrent otitis media',
    urgency: 'routine',
    whatIsAsked: 'evaluate-and-treat',
    whoSchedules: 'patient',
    responseRequested: false,
    includeDocuments: ['progress-note'],
    earlierDocuments: [],
    referringProvider: { id: 'p1', name: 'J. Rivera, MD' },
    status: 'given-to-patient',
    createdAt: '2026-11-01T15:00:00.000Z',
    responseDocumentReferenceIds: [],
  },
]);

const api = vi.hoisted(() => ({
  listReferrals: vi.fn(),
  saveReferral: vi.fn(),
  updateReferralStatus: vi.fn(),
  getReferralPdf: vi.fn(),
}));
const faxOpen = vi.hoisted(() => vi.fn());
const accessibility = vi.hoisted(() => ({ isAppointmentReadOnly: false }));

vi.mock('src/features/referrals/referrals.api', () => api);
vi.mock('src/features/address-book/addressBook.api', () => ({
  searchAddressBook: vi.fn().mockResolvedValue({ contacts: [] }),
  createAddressBookContact: vi.fn(),
  updateAddressBookContact: vi.fn(),
  deleteAddressBookContact: vi.fn(),
}));
vi.mock('src/hooks/useAppClients', () => ({ useApiClients: () => ({ oystehrZambda: {} }) }));
vi.mock('notistack', () => ({ enqueueSnackbar: vi.fn() }));
vi.mock('src/features/fax/hooks/useSendFax', () => ({
  useSendFax: () => ({ isOpen: false, open: faxOpen, close: vi.fn() }),
}));
vi.mock('src/features/fax/ui/SendFaxDialog', () => ({ SendFaxDialog: () => null }));
vi.mock('src/features/visits/shared/hooks/useGetAppointmentAccessibility', () => ({
  useGetAppointmentAccessibility: () => accessibility,
}));
vi.mock('src/features/visits/shared/stores/appointment/appointment.store', () => ({
  useAppointmentData: () => ({ encounter: { id: 'encounter-1' }, resources: { patient: { id: 'patient-1' } } }),
}));

import { PatientReferralsTab } from '../../src/features/referrals/PatientReferralsTab';
import { ReferralsCard } from '../../src/features/referrals/ReferralsCard';

const renderCard = (): void => {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <ReferralsCard />
    </QueryClientProvider>
  );
};

describe('ReferralsCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    accessibility.isAppointmentReadOnly = false;
    api.listReferrals.mockResolvedValue({ referrals });
    api.saveReferral.mockImplementation(async (_oystehr: unknown, input: { reason: string }) => ({
      referral: { ...referrals[1], id: '33333333-3333-4333-8333-333333333333', reason: input.reason },
    }));
  });

  it('lists the visit referrals with recipient, urgency and status', async () => {
    renderCard();

    const first = await screen.findByTestId(dataTestIds.referrals.row(referrals[0].id));
    expect(first).toHaveTextContent('Orthopedics');
    expect(first).toHaveTextContent('Riverside Orthopedic Associates');
    expect(first).toHaveTextContent('URGENT');
    expect(first).toHaveTextContent('NOT SENT');

    const second = screen.getByTestId(dataTestIds.referrals.row(referrals[1].id));
    expect(second).toHaveTextContent('No recipient: patient chooses a provider their insurance covers');
    expect(second).toHaveTextContent('GIVEN TO PATIENT');
    expect(api.listReferrals).toHaveBeenCalledWith(expect.anything(), { encounterId: 'encounter-1' });
  });

  it('expands a referral into its form, offering the fax when the recipient has a fax number', async () => {
    const user = userEvent.setup();
    renderCard();

    await user.click(await screen.findByTestId(dataTestIds.referrals.expandButton(referrals[0].id)));

    const form = within(screen.getByTestId(dataTestIds.referrals.row(referrals[0].id))).getByTestId(
      dataTestIds.referrals.form
    );
    expect(within(form).getByTestId(dataTestIds.referrals.reason)).toHaveValue(referrals[0].reason);
    expect(within(form).getByTestId(dataTestIds.referrals.sendFaxButton)).toBeEnabled();
    expect(within(form).getByTestId(dataTestIds.referrals.sendMenuButton)).toBeEnabled();
    expect(within(form).getByTestId(dataTestIds.referrals.responseRequested).querySelector('input')).toBeChecked();
    expect(form).toHaveTextContent('Created 11/01/2026 by J. Rivera, MD');
  });

  it('disables Send fax as soon as the Fax field is emptied, even to whitespace', async () => {
    const user = userEvent.setup();
    renderCard();

    await user.click(await screen.findByTestId(dataTestIds.referrals.expandButton(referrals[0].id)));
    const form = within(screen.getByTestId(dataTestIds.referrals.row(referrals[0].id))).getByTestId(
      dataTestIds.referrals.form
    );
    const fax = within(form).getByTestId(dataTestIds.referrals.recipientFax);
    expect(within(form).getByTestId(dataTestIds.referrals.sendFaxButton)).toBeEnabled();

    await user.clear(fax);
    await user.type(fax, ' ');

    expect(within(form).getByTestId(dataTestIds.referrals.sendFaxButton)).toBeDisabled();
  });

  it('hides "Response requested" and disables Send fax when there is no recipient', async () => {
    const user = userEvent.setup();
    renderCard();

    await user.click(await screen.findByTestId(dataTestIds.referrals.expandButton(referrals[1].id)));

    const form = screen.getByTestId(dataTestIds.referrals.form);
    expect(within(form).queryByTestId(dataTestIds.referrals.responseRequested)).toBeNull();
    expect(within(form).getByTestId(dataTestIds.referrals.sendFaxButton)).toBeDisabled();
    expect(within(form).getByTestId(dataTestIds.referrals.printLink)).toBeInTheDocument();
    // Either action stays available whatever the status; the server decides what it changes.
    await user.click(within(form).getByTestId(dataTestIds.referrals.sendMenuButton));
    expect(await screen.findByTestId(dataTestIds.referrals.givenToPatientButton)).not.toHaveAttribute('aria-disabled');
  });

  it('sends the fax from the main part of the split button', async () => {
    const user = userEvent.setup();
    renderCard();

    await user.click(await screen.findByTestId(dataTestIds.referrals.expandButton(referrals[0].id)));
    await user.click(screen.getByTestId(dataTestIds.referrals.sendFaxButton));

    await waitFor(() => expect(faxOpen).toHaveBeenCalledTimes(1));
    expect(api.saveReferral).toHaveBeenCalledTimes(1);
    expect(api.updateReferralStatus).not.toHaveBeenCalled();
  });

  it('marks the referral given to patient from the split button menu', async () => {
    const user = userEvent.setup();
    api.updateReferralStatus.mockResolvedValue({ referral: referrals[1] });
    renderCard();

    await user.click(await screen.findByTestId(dataTestIds.referrals.expandButton(referrals[0].id)));
    await user.click(screen.getByTestId(dataTestIds.referrals.sendMenuButton));
    await user.click(await screen.findByTestId(dataTestIds.referrals.givenToPatientButton));

    await waitFor(() => expect(api.updateReferralStatus).toHaveBeenCalledTimes(1));
    expect(api.updateReferralStatus).toHaveBeenCalledWith(expect.anything(), {
      action: 'given-to-patient',
      referralId: '33333333-3333-4333-8333-333333333333',
    });
    expect(faxOpen).not.toHaveBeenCalled();
  });

  it('keeps Given to patient reachable when the recipient has no fax number', async () => {
    const user = userEvent.setup();
    const { fax: _fax, ...recipientWithoutFax } = referrals[0].recipient!;
    api.listReferrals.mockResolvedValue({ referrals: [{ ...referrals[0], recipient: recipientWithoutFax }] });
    api.updateReferralStatus.mockResolvedValue({ referral: referrals[1] });
    renderCard();

    await user.click(await screen.findByTestId(dataTestIds.referrals.expandButton(referrals[0].id)));
    expect(screen.getByTestId(dataTestIds.referrals.sendFaxButton)).toBeDisabled();
    expect(screen.getByTestId(dataTestIds.referrals.sendMenuButton)).toBeEnabled();

    await user.click(screen.getByTestId(dataTestIds.referrals.sendMenuButton));
    await user.click(await screen.findByTestId(dataTestIds.referrals.givenToPatientButton));

    await waitFor(() => expect(api.updateReferralStatus).toHaveBeenCalledTimes(1));
    expect(api.updateReferralStatus.mock.calls[0][1]).toMatchObject({ action: 'given-to-patient' });
  });

  it('saves a fax typed for a recipient without one and offers Send fax once it is there', async () => {
    const user = userEvent.setup();
    const { fax: _fax, ...recipientWithoutFax } = referrals[0].recipient!;
    api.listReferrals.mockResolvedValue({ referrals: [{ ...referrals[0], recipient: recipientWithoutFax }] });
    renderCard();

    await user.click(await screen.findByTestId(dataTestIds.referrals.expandButton(referrals[0].id)));
    const form = screen.getByTestId(dataTestIds.referrals.form);
    const fax = within(form).getByTestId(dataTestIds.referrals.recipientFax);
    expect(fax).toHaveValue('');
    expect(within(form).getByTestId(dataTestIds.referrals.sendFaxButton)).toBeDisabled();

    await user.type(fax, '2125559876');
    expect(within(form).getByTestId(dataTestIds.referrals.sendFaxButton)).toBeEnabled();

    await user.click(within(form).getByTestId(dataTestIds.referrals.saveButton));

    await waitFor(() => expect(api.saveReferral).toHaveBeenCalledTimes(1));
    expect(api.saveReferral.mock.calls[0][1]).toMatchObject({
      referralId: referrals[0].id,
      recipientContactId: 'c1',
      recipientFax: '2125559876',
    });
  });

  it('clearing the recipient drops its fax and disables Send fax', async () => {
    const user = userEvent.setup();
    renderCard();

    await user.click(await screen.findByTestId(dataTestIds.referrals.expandButton(referrals[0].id)));
    const form = screen.getByTestId(dataTestIds.referrals.form);
    expect(within(form).getByTestId(dataTestIds.referrals.recipientFax)).toHaveValue('+12125554321');
    expect(within(form).getByTestId(dataTestIds.referrals.sendFaxButton)).toBeEnabled();

    await user.clear(within(form).getByTestId(dataTestIds.referrals.recipient).querySelector('input')!);

    // The Fax field goes with the recipient; what it held is not saved either.
    await waitFor(() => expect(within(form).queryByTestId(dataTestIds.referrals.recipientFax)).toBeNull());
    expect(within(form).getByTestId(dataTestIds.referrals.sendFaxButton)).toBeDisabled();

    await user.click(within(form).getByTestId(dataTestIds.referrals.saveButton));

    await waitFor(() => expect(api.saveReferral).toHaveBeenCalledTimes(1));
    const input = api.saveReferral.mock.calls[0][1];
    expect(input.referralId).toBe(referrals[0].id);
    expect(input.recipientContactId).toBeUndefined();
    expect(input.recipientFax).toBeUndefined();
    expect(input.responseRequested).toBe(false);
  });

  it('requires a specialty and a reason before saving a new referral', async () => {
    const user = userEvent.setup();
    renderCard();

    await user.click(await screen.findByTestId(dataTestIds.referrals.addButton));
    await user.click(screen.getByTestId(dataTestIds.referrals.saveButton));

    expect(await screen.findByText('Specialty is required')).toBeInTheDocument();
    expect(screen.getByText('Reason for referral is required')).toBeInTheDocument();
    expect(api.saveReferral).not.toHaveBeenCalled();
  });

  it('saves a new referral with the defaults and the visit ids', async () => {
    const user = userEvent.setup();
    renderCard();

    await user.click(await screen.findByTestId(dataTestIds.referrals.addButton));
    const form = screen.getByTestId(dataTestIds.referrals.form);
    await user.click(within(within(form).getByTestId(dataTestIds.referrals.specialty)).getByRole('combobox'));
    await user.click(await screen.findByRole('option', { name: 'ENT' }));
    await user.type(within(form).getByTestId(dataTestIds.referrals.reason), 'Recurrent otitis media');
    await user.click(within(form).getByTestId(dataTestIds.referrals.saveButton));

    await waitFor(() => expect(api.saveReferral).toHaveBeenCalledTimes(1));
    expect(api.saveReferral).toHaveBeenCalledWith(expect.anything(), {
      referralId: undefined,
      patientId: 'patient-1',
      encounterId: 'encounter-1',
      specialty: 'ENT',
      recipientContactId: undefined,
      reason: 'Recurrent otitis media',
      urgency: 'routine',
      whatIsAsked: 'evaluate-and-treat',
      whoSchedules: 'patient',
      responseRequested: false,
      includeDocuments: ['progress-note', 'lab-results', 'radiology-results'],
      earlierDocumentIds: [],
      notesToRecipient: undefined,
    });
    // The new form is gone once the referral is saved.
    await waitFor(() => expect(screen.queryByTestId(dataTestIds.referrals.form)).toBeNull());
  });

  it('shows earlier-visit documents as chips dated by their visit, and saves without a removed one', async () => {
    const user = userEvent.setup();
    renderCard();

    await user.click(await screen.findByTestId(dataTestIds.referrals.expandButton(referrals[0].id)));
    const form = screen.getByTestId(dataTestIds.referrals.form);
    expect(form).toHaveTextContent('This visit');
    expect(form).toHaveTextContent('Earlier visits');
    expect(within(form).getByTestId(dataTestIds.referrals.earlierDocument('doc-xr'))).toHaveTextContent(
      '09/22/2026 · XR wrist 3 views.pdf'
    );
    // No visit: dated by when it was added.
    expect(within(form).getByTestId(dataTestIds.referrals.earlierDocument('doc-note'))).toHaveTextContent(
      '09/22/2026 · VisitNote.pdf'
    );
    expect(within(form).getByTestId(dataTestIds.referrals.addEarlierDocumentsButton)).toHaveTextContent(
      '+ Add from earlier visits'
    );

    await user.click(
      within(within(form).getByTestId(dataTestIds.referrals.earlierDocument('doc-xr'))).getByTestId('CancelIcon')
    );
    expect(within(form).queryByTestId(dataTestIds.referrals.earlierDocument('doc-xr'))).toBeNull();
    await user.click(within(form).getByTestId(dataTestIds.referrals.saveButton));

    await waitFor(() => expect(api.saveReferral).toHaveBeenCalledTimes(1));
    expect(api.saveReferral.mock.calls[0][1]).toMatchObject({ earlierDocumentIds: ['doc-note'] });
  });

  it('sends the typed "Other" specialty as the specialty', async () => {
    const user = userEvent.setup();
    renderCard();

    await user.click(await screen.findByTestId(dataTestIds.referrals.addButton));
    const form = screen.getByTestId(dataTestIds.referrals.form);
    await user.click(within(within(form).getByTestId(dataTestIds.referrals.specialty)).getByRole('combobox'));
    await user.click(await screen.findByRole('option', { name: 'Other' }));
    await user.type(within(form).getByTestId(dataTestIds.referrals.specialtyOther), 'Rheumatology');
    await user.type(within(form).getByTestId(dataTestIds.referrals.reason), 'Joint pain');
    await user.click(within(form).getByTestId(dataTestIds.referrals.saveButton));

    await waitFor(() => expect(api.saveReferral).toHaveBeenCalledTimes(1));
    expect(api.saveReferral.mock.calls[0][1]).toMatchObject({ specialty: 'Rheumatology' });
  });

  it('shows a read-only form with the close reason for a closed referral', async () => {
    const user = userEvent.setup();
    api.listReferrals.mockResolvedValue({
      referrals: [
        {
          ...referrals[0],
          status: 'closed',
          closedAt: '2026-11-02T12:00:00.000Z',
          closeReason: 'patient-seen',
          outcome: 'Cast placed',
        },
      ],
    });
    renderCard();

    await user.click(await screen.findByTestId(dataTestIds.referrals.expandButton(referrals[0].id)));

    const form = screen.getByTestId(dataTestIds.referrals.form);
    expect(within(form).getByTestId(dataTestIds.referrals.reason)).toBeDisabled();
    expect(within(form).queryByTestId(dataTestIds.referrals.saveButton)).toBeNull();
    expect(form).toHaveTextContent('Closed 11/02/2026: Patient seen (confirmed by phone) — Cast placed');
  });

  it('on a signed visit still offers Add and lets an existing referral be edited and faxed', async () => {
    const user = userEvent.setup();
    accessibility.isAppointmentReadOnly = true;
    renderCard();

    await user.click(await screen.findByTestId(dataTestIds.referrals.expandButton(referrals[0].id)));

    expect(screen.getByTestId(dataTestIds.referrals.addButton)).toBeEnabled();
    const form = screen.getByTestId(dataTestIds.referrals.form);
    const reason = within(form).getByTestId(dataTestIds.referrals.reason);
    expect(within(form).getByTestId(dataTestIds.referrals.recipient).querySelector('input')).toBeEnabled();
    expect(within(form).getByTestId(dataTestIds.referrals.saveButton)).toBeEnabled();
    // Fax saves the edit first, then opens the fax dialog.
    await user.type(reason, '; seen in ED');
    await user.click(within(form).getByTestId(dataTestIds.referrals.sendFaxButton));

    await waitFor(() => expect(faxOpen).toHaveBeenCalledTimes(1));
    expect(api.saveReferral.mock.calls[0][1]).toMatchObject({
      referralId: referrals[0].id,
      reason: `${referrals[0].reason}; seen in ED`,
    });
  });
});

describe('PatientReferralsTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.listReferrals.mockResolvedValue({ referrals });
    api.saveReferral.mockImplementation(async (_oystehr: unknown, input: { reason: string }) => ({
      referral: { ...referrals[0], reason: input.reason },
    }));
  });

  it("lets a visit's referral be edited from the patient record, keeping its visit", async () => {
    const user = userEvent.setup();
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <MemoryRouter>
          <PatientReferralsTab patientId="patient-1" />
        </MemoryRouter>
      </QueryClientProvider>
    );

    await user.click(await screen.findByTestId(dataTestIds.referrals.row(referrals[0].id)));

    const form = screen.getByTestId(dataTestIds.referrals.form);
    await user.type(within(form).getByTestId(dataTestIds.referrals.reason), '; seen in ED');
    await user.click(within(form).getByTestId(dataTestIds.referrals.saveButton));

    await waitFor(() => expect(api.saveReferral).toHaveBeenCalledTimes(1));
    expect(api.saveReferral.mock.calls[0][1]).toMatchObject({
      referralId: referrals[0].id,
      patientId: 'patient-1',
      encounterId: 'encounter-1',
      reason: `${referrals[0].reason}; seen in ED`,
    });
    expect(within(form).getByTestId(dataTestIds.referrals.sendFaxButton)).toBeEnabled();
  });
});
