import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { dataTestIds } from 'src/constants/data-test-ids';
import { PacketDocumentAvailability } from 'utils/lib/types/api/document-packet.types';
import { ReferralDTO } from 'utils/lib/types/api/referrals/referrals.types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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
    referringProvider: { id: 'p1', name: 'Jordan Rivera, MD' },
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
    referringProvider: { id: 'p1', name: 'Jordan Rivera, MD' },
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
const packetPreview = vi.hoisted(() => ({
  current: undefined as { documents: PacketDocumentAvailability[] } | undefined,
  calls: [] as { input: unknown; enabled: boolean }[],
}));
const progressNoteConfig = vi.hoisted(() => ({
  current: { data: undefined as { specialtyTransferOptions: string[] } | undefined, isLoading: false },
}));
const enqueueSnackbar = vi.hoisted(() => vi.fn());

vi.mock('src/features/referrals/referrals.api', () => api);
vi.mock('src/features/address-book/addressBook.api', () => ({
  searchAddressBook: vi.fn().mockResolvedValue({ contacts: [] }),
  createAddressBookContact: vi.fn(),
  updateAddressBookContact: vi.fn(),
  deleteAddressBookContact: vi.fn(),
}));
vi.mock('src/hooks/useAppClients', () => ({ useApiClients: () => ({ oystehrZambda: {} }) }));
vi.mock('notistack', () => ({ enqueueSnackbar }));
vi.mock('src/hooks/useProgressNoteConfig', () => ({ useProgressNoteConfig: () => progressNoteConfig.current }));
vi.mock('src/features/send-documents/hooks/useDocumentPacketPreview', () => ({
  useDocumentPacketPreview: (input: unknown, enabled: boolean) => {
    packetPreview.calls.push({ input, enabled });
    return { data: enabled ? packetPreview.current : undefined };
  },
}));
vi.mock('src/features/send-documents/hooks/useSendDocuments', () => ({
  useSendDocuments: () => ({ isOpen: false, open: faxOpen, close: vi.fn() }),
}));
vi.mock('src/features/send-documents/ui/SendDocumentsDialog', () => ({ SendDocumentsDialog: () => null }));
vi.mock('src/features/visits/shared/hooks/useGetAppointmentAccessibility', () => ({
  useGetAppointmentAccessibility: () => accessibility,
}));
vi.mock('src/features/visits/shared/stores/appointment/appointment.store', () => ({
  useAppointmentData: () => ({
    appointment: { id: 'appointment-1' },
    encounter: { id: 'encounter-1' },
    resources: { patient: { id: 'patient-1' } },
  }),
}));

import { PatientReferralsTab } from '../../src/features/referrals/PatientReferralsTab';
import { ReferralsCard } from '../../src/features/referrals/ReferralsCard';

const faxInput = (form: HTMLElement): HTMLInputElement =>
  within(form).getByTestId(dataTestIds.referrals.recipientFax).querySelector('input')!;

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
    packetPreview.current = undefined;
    packetPreview.calls = [];
    progressNoteConfig.current = { data: undefined, isLoading: false };
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
    expect(form).toHaveTextContent('Created 11/01/2026 by Jordan Rivera, MD');
  });

  it('keeps a referral with a filed response read-only, offering only Close, Cancel and Print form', async () => {
    // The server refuses to edit, fax or hand over a referral once a response is filed, and every one of those
    // actions saves the form first, so offering them would only end in "Failed to save the referral".
    const answered: ReferralDTO = {
      ...referrals[0],
      status: 'response-received',
      responseDocumentReferenceIds: ['d1'],
    };
    api.listReferrals.mockResolvedValue({ referrals: [answered] });
    const user = userEvent.setup();
    renderCard();

    await user.click(await screen.findByTestId(dataTestIds.referrals.expandButton(answered.id)));

    const form = within(screen.getByTestId(dataTestIds.referrals.row(answered.id))).getByTestId(
      dataTestIds.referrals.form
    );
    expect(within(form).getByTestId(dataTestIds.referrals.reason)).toBeDisabled();
    expect(within(form).getByTestId(dataTestIds.referrals.closeButton)).toBeEnabled();
    expect(within(form).getByTestId(dataTestIds.referrals.cancelButton)).toBeEnabled();
    expect(within(form).getByTestId(dataTestIds.referrals.printLink)).toBeEnabled();
    for (const testId of [
      dataTestIds.referrals.saveButton,
      dataTestIds.referrals.previewButton,
      dataTestIds.referrals.sendFaxButton,
      dataTestIds.referrals.sendMenuButton,
      dataTestIds.referrals.addEarlierDocumentsButton,
    ]) {
      expect(within(form).queryByTestId(testId)).toBeNull();
    }
  });

  it('names who gave the referral to the patient and who closed it the way "Created by" names its author', async () => {
    const closed: ReferralDTO = {
      ...referrals[1],
      status: 'closed',
      givenToPatientAt: '2026-11-02T15:00:00.000Z',
      givenToPatientBy: { id: 'p2', name: 'Sam Staff, RN' },
      closedAt: '2026-11-20T15:00:00.000Z',
      closedBy: { id: 'p1', name: 'Jordan Rivera, MD' },
      closeReason: 'patient-seen',
    };
    api.listReferrals.mockResolvedValue({ referrals: [closed] });
    const user = userEvent.setup();
    renderCard();

    await user.click(await screen.findByTestId(dataTestIds.referrals.expandButton(closed.id)));

    const form = within(screen.getByTestId(dataTestIds.referrals.row(closed.id))).getByTestId(
      dataTestIds.referrals.form
    );
    expect(form).toHaveTextContent('Created 11/01/2026 by Jordan Rivera, MD');
    expect(form).toHaveTextContent('Given to patient 11/02/2026 by Sam Staff, RN');
    expect(form).toHaveTextContent('Closed 11/20/2026 by Jordan Rivera, MD: Patient seen');
  });

  it('disables Send fax as soon as the Fax field is emptied', async () => {
    const user = userEvent.setup();
    renderCard();

    await user.click(await screen.findByTestId(dataTestIds.referrals.expandButton(referrals[0].id)));
    const form = within(screen.getByTestId(dataTestIds.referrals.row(referrals[0].id))).getByTestId(
      dataTestIds.referrals.form
    );
    const fax = faxInput(form);
    expect(within(form).getByTestId(dataTestIds.referrals.sendFaxButton)).toBeEnabled();

    await user.clear(fax);

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
    const fax = faxInput(form);
    expect(fax).toHaveValue('');
    expect(within(form).getByTestId(dataTestIds.referrals.sendFaxButton)).toBeDisabled();

    await user.type(fax, '2125559876');
    expect(within(form).getByTestId(dataTestIds.referrals.sendFaxButton)).toBeEnabled();

    await user.click(within(form).getByTestId(dataTestIds.referrals.saveButton));

    await waitFor(() => expect(api.saveReferral).toHaveBeenCalledTimes(1));
    expect(api.saveReferral.mock.calls[0][1]).toMatchObject({
      referralId: referrals[0].id,
      recipientContactId: 'c1',
      recipientFax: '(212) 555-9876',
    });
  });

  it('clearing the recipient drops its fax and disables Send fax', async () => {
    const user = userEvent.setup();
    renderCard();

    await user.click(await screen.findByTestId(dataTestIds.referrals.expandButton(referrals[0].id)));
    const form = screen.getByTestId(dataTestIds.referrals.form);
    expect(faxInput(form)).toHaveValue('(212) 555-4321');
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
    expect(form).toHaveTextContent('Closed 11/02/2026: Patient seen — Cast placed');
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

describe('ReferralsCard: documents this visit does not have', () => {
  const noLabsOrImaging: PacketDocumentAvailability[] = [
    { kind: 'progress-note', available: true },
    { kind: 'discharge-summary', available: true },
    { kind: 'lab-results', available: false, unavailableReason: 'No reviewed lab results for this visit' },
    { kind: 'radiology-results', available: false, unavailableReason: 'No radiology results for this visit' },
    { kind: 'patient-education', available: true },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    accessibility.isAppointmentReadOnly = false;
    packetPreview.calls = [];
    progressNoteConfig.current = { data: undefined, isLoading: false };
    api.listReferrals.mockResolvedValue({ referrals });
    api.saveReferral.mockImplementation(async (_oystehr: unknown, input: { reason: string }) => ({
      referral: { ...referrals[1], id: '33333333-3333-4333-8333-333333333333', reason: input.reason },
    }));
  });

  const addReferral = async (user: ReturnType<typeof userEvent.setup>): Promise<HTMLElement> => {
    await user.click(await screen.findByTestId(dataTestIds.referrals.addButton));
    const form = screen.getByTestId(dataTestIds.referrals.form);
    await user.click(within(within(form).getByTestId(dataTestIds.referrals.specialty)).getByRole('combobox'));
    await user.click(await screen.findByRole('option', { name: 'ENT' }));
    await user.type(within(form).getByTestId(dataTestIds.referrals.reason), 'Recurrent otitis media');
    return form;
  };

  const includeBox = (form: HTMLElement, kind: string): HTMLInputElement =>
    within(form).getByTestId(dataTestIds.referrals.includeDocument(kind)).querySelector('input')!;

  it('asks the visit which documents it has, by its appointment', async () => {
    packetPreview.current = { documents: noLabsOrImaging };
    renderCard();

    await screen.findByTestId(dataTestIds.referrals.addButton);
    await userEvent.setup().click(screen.getByTestId(dataTestIds.referrals.addButton));

    expect(packetPreview.calls.at(-1)).toEqual({ input: { appointmentId: 'appointment-1' }, enabled: true });
  });

  it('greys out and leaves unticked a default kind the visit has none of, saying why on hover', async () => {
    packetPreview.current = { documents: noLabsOrImaging };
    const user = userEvent.setup();
    renderCard();

    const form = await addReferral(user);

    expect(includeBox(form, 'progress-note')).toBeChecked();
    expect(includeBox(form, 'lab-results')).toBeDisabled();
    expect(includeBox(form, 'lab-results')).not.toBeChecked();
    expect(includeBox(form, 'radiology-results')).toBeDisabled();
    expect(includeBox(form, 'discharge-summary')).toBeEnabled();

    await user.hover(within(form).getByText('Lab Results'));
    expect(await screen.findByRole('tooltip')).toHaveTextContent('No reviewed lab results for this visit');
  });

  it('does not send a kind the visit has none of, so the form cannot list it as included', async () => {
    packetPreview.current = { documents: noLabsOrImaging };
    const user = userEvent.setup();
    renderCard();

    const form = await addReferral(user);
    await user.click(within(form).getByTestId(dataTestIds.referrals.saveButton));

    await waitFor(() => expect(api.saveReferral).toHaveBeenCalledTimes(1));
    expect(api.saveReferral.mock.calls[0][1].includeDocuments).toEqual(['progress-note']);
  });

  it('drops an unavailable kind an existing referral had saved', async () => {
    packetPreview.current = { documents: noLabsOrImaging };
    const user = userEvent.setup();
    renderCard();

    await user.click(await screen.findByTestId(dataTestIds.referrals.expandButton(referrals[0].id)));
    await user.click(screen.getByTestId(dataTestIds.referrals.saveButton));

    await waitFor(() => expect(api.saveReferral).toHaveBeenCalledTimes(1));
    expect(api.saveReferral.mock.calls[0][1].includeDocuments).toEqual(['progress-note']);
  });

  it('keeps the chosen kinds as they are until availability has loaded', async () => {
    packetPreview.current = undefined;
    const user = userEvent.setup();
    renderCard();

    const form = await addReferral(user);
    expect(includeBox(form, 'lab-results')).toBeEnabled();
    expect(includeBox(form, 'lab-results')).toBeChecked();
    await user.click(within(form).getByTestId(dataTestIds.referrals.saveButton));

    await waitFor(() => expect(api.saveReferral).toHaveBeenCalledTimes(1));
    expect(api.saveReferral.mock.calls[0][1].includeDocuments).toEqual([
      'progress-note',
      'lab-results',
      'radiology-results',
    ]);
  });
});

describe('ReferralsCard: opening the referral form PDF', () => {
  type FakeTab = { location: { href: string }; close: ReturnType<typeof vi.fn>; closed: boolean };
  let openedTabs: FakeTab[];

  beforeEach(() => {
    vi.clearAllMocks();
    accessibility.isAppointmentReadOnly = false;
    packetPreview.current = undefined;
    progressNoteConfig.current = { data: undefined, isLoading: false };
    api.listReferrals.mockResolvedValue({ referrals });
    openedTabs = [];
    vi.stubGlobal(
      'open',
      vi.fn(() => {
        const tab: FakeTab = { location: { href: '' }, close: vi.fn(), closed: false };
        openedTabs.push(tab);
        return tab;
      })
    );
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: true, blob: async () => new Blob(['%PDF']) }))
    );
    URL.createObjectURL = vi.fn(() => 'blob:referral-form');
    URL.revokeObjectURL = vi.fn();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('Preview opens the tab during the click, before the save it waits on, then shows the PDF in it', async () => {
    let finishSave: (value: { referral: ReferralDTO }) => void = () => undefined;
    api.saveReferral.mockImplementation(() => new Promise((resolve) => (finishSave = resolve)));
    api.getReferralPdf.mockResolvedValue({ presignedURL: 'https://example.test/referral.pdf' });
    const user = userEvent.setup();
    renderCard();

    await user.click(await screen.findByTestId(dataTestIds.referrals.expandButton(referrals[0].id)));
    await user.click(screen.getByTestId(dataTestIds.referrals.previewButton));

    expect(window.open).toHaveBeenCalledTimes(1);
    expect(window.open).toHaveBeenCalledWith('', '_blank');
    await waitFor(() => expect(api.saveReferral).toHaveBeenCalledTimes(1));
    expect(api.getReferralPdf).not.toHaveBeenCalled();

    finishSave({ referral: referrals[0] });

    await waitFor(() => expect(openedTabs[0].location.href).toBe('blob:referral-form'));
    expect(api.getReferralPdf).toHaveBeenCalledWith(expect.anything(), { referralId: referrals[0].id });
    expect(fetch).toHaveBeenCalledWith('https://example.test/referral.pdf', expect.anything());
    expect(window.open).toHaveBeenCalledTimes(1);
  });

  it('closes the reserved tab and says so when the form cannot be generated', async () => {
    api.saveReferral.mockResolvedValue({ referral: referrals[0] });
    api.getReferralPdf.mockRejectedValue(new Error('render failed'));
    const user = userEvent.setup();
    renderCard();

    await user.click(await screen.findByTestId(dataTestIds.referrals.expandButton(referrals[0].id)));
    await user.click(screen.getByTestId(dataTestIds.referrals.previewButton));

    await waitFor(() => expect(openedTabs[0].close).toHaveBeenCalled());
    expect(enqueueSnackbar).toHaveBeenCalledWith('Failed to open the referral form. Please try again.', {
      variant: 'error',
    });
  });

  it('closes the reserved tab without generating anything when the form does not validate', async () => {
    const user = userEvent.setup();
    renderCard();

    await user.click(await screen.findByTestId(dataTestIds.referrals.addButton));
    await user.click(screen.getByTestId(dataTestIds.referrals.previewButton));

    await waitFor(() => expect(openedTabs[0].close).toHaveBeenCalled());
    expect(api.saveReferral).not.toHaveBeenCalled();
    expect(api.getReferralPdf).not.toHaveBeenCalled();
  });

  it('opens the PDF URL itself when the PDF cannot be fetched as a file', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: false, status: 403, blob: async () => new Blob(['<Error/>']) }))
    );
    api.getReferralPdf.mockResolvedValue({ presignedURL: 'https://example.test/referral.pdf' });
    const answered: ReferralDTO = {
      ...referrals[0],
      status: 'response-received',
      responseDocumentReferenceIds: ['d1'],
    };
    api.listReferrals.mockResolvedValue({ referrals: [answered] });
    const user = userEvent.setup();
    renderCard();

    await user.click(await screen.findByTestId(dataTestIds.referrals.expandButton(answered.id)));
    await user.click(screen.getByTestId(dataTestIds.referrals.printLink));

    expect(window.open).toHaveBeenCalledWith('', '_blank');
    await waitFor(() => expect(openedTabs[0].location.href).toBe('https://example.test/referral.pdf'));
    expect(URL.createObjectURL).not.toHaveBeenCalled();
  });
});

describe('ReferralsCard: specialties', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    accessibility.isAppointmentReadOnly = false;
    packetPreview.current = undefined;
    progressNoteConfig.current = {
      data: { specialtyTransferOptions: ['Urology', 'Orthopedics'] },
      isLoading: false,
    };
    api.listReferrals.mockResolvedValue({ referrals });
  });

  it("offers the practice's configured specialties, then Other", async () => {
    const user = userEvent.setup();
    renderCard();

    await user.click(await screen.findByTestId(dataTestIds.referrals.addButton));
    await user.click(within(screen.getByTestId(dataTestIds.referrals.specialty)).getByRole('combobox'));

    const options = (await screen.findAllByRole('option')).map((option) => option.textContent);
    expect(options).toEqual(['Orthopedics', 'Urology', 'Other']);
  });

  it('shows a saved specialty that is no longer configured as Other with its text', async () => {
    const user = userEvent.setup();
    renderCard();

    await user.click(await screen.findByTestId(dataTestIds.referrals.expandButton(referrals[1].id)));

    const form = screen.getByTestId(dataTestIds.referrals.form);
    expect(within(form).getByTestId(dataTestIds.referrals.specialty)).toHaveTextContent('Other');
    expect(within(form).getByTestId(dataTestIds.referrals.specialtyOther)).toHaveValue('ENT');
  });
});

describe('ReferralsCard: closing a referral', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    accessibility.isAppointmentReadOnly = false;
    packetPreview.current = undefined;
    progressNoteConfig.current = { data: undefined, isLoading: false };
    api.listReferrals.mockResolvedValue({ referrals });
    api.updateReferralStatus.mockResolvedValue({ referral: { ...referrals[0], status: 'closed' } });
  });

  it('closes with the chosen reason and outcome from the dialog', async () => {
    const user = userEvent.setup();
    renderCard();

    await user.click(await screen.findByTestId(dataTestIds.referrals.expandButton(referrals[0].id)));
    await user.click(screen.getByTestId(dataTestIds.referrals.closeButton));
    const dialog = await screen.findByTestId(dataTestIds.referrals.closeDialog);
    expect(within(dialog).getByTestId(dataTestIds.dialog.proceedButton)).toBeDisabled();

    await user.click(within(within(dialog).getByTestId(dataTestIds.referrals.closeReason)).getByRole('combobox'));
    await user.click(await screen.findByRole('option', { name: 'Patient seen' }));
    await user.type(within(dialog).getByTestId(dataTestIds.referrals.closeOutcome), 'Cast placed');
    await user.click(within(dialog).getByTestId(dataTestIds.dialog.proceedButton));

    await waitFor(() => expect(api.updateReferralStatus).toHaveBeenCalledTimes(1));
    expect(api.updateReferralStatus).toHaveBeenCalledWith(expect.anything(), {
      action: 'close',
      referralId: referrals[0].id,
      reason: 'patient-seen',
      outcome: 'Cast placed',
    });
    await waitFor(() => expect(screen.queryByTestId(dataTestIds.referrals.closeDialog)).toBeNull());
  });
});

describe('PatientReferralsTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    packetPreview.current = undefined;
    packetPreview.calls = [];
    progressNoteConfig.current = { data: undefined, isLoading: false };
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

  it('lists the referrals with their date and the shared no-recipient label, under the same header as the card', async () => {
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <MemoryRouter>
          <PatientReferralsTab patientId="patient-1" />
        </MemoryRouter>
      </QueryClientProvider>
    );

    const row = await screen.findByTestId(dataTestIds.referrals.row(referrals[1].id));
    expect(row).toHaveTextContent('11/01/2026');
    expect(row).toHaveTextContent('No recipient');
    expect(row).not.toHaveTextContent('No recipient: patient chooses');
    expect(screen.getByTestId(dataTestIds.referrals.card)).toHaveTextContent('Referrals2');
    expect(screen.getByTestId(dataTestIds.referrals.addButton)).toBeEnabled();
  });

  it('adds a referral without a visit from the patient record', async () => {
    const user = userEvent.setup();
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <MemoryRouter>
          <PatientReferralsTab patientId="patient-1" />
        </MemoryRouter>
      </QueryClientProvider>
    );

    await user.click(await screen.findByTestId(dataTestIds.referrals.addButton));

    const form = screen.getByTestId(dataTestIds.referrals.form);
    expect(screen.getByText('No visit: created from the patient record')).toBeInTheDocument();
    expect(form).not.toHaveTextContent('This visit');
    expect(packetPreview.calls.every((call) => !call.enabled)).toBe(true);
  });

  it('opens and closes a referral from the keyboard with its Expand button, which says whether it is open', async () => {
    const user = userEvent.setup();
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <MemoryRouter>
          <PatientReferralsTab patientId="patient-1" />
        </MemoryRouter>
      </QueryClientProvider>
    );

    const expand = await screen.findByTestId(dataTestIds.referrals.expandButton(referrals[0].id));
    expect(expand).toHaveAttribute('aria-expanded', 'false');

    expand.focus();
    await user.keyboard('{Enter}');
    expect(screen.getByTestId(dataTestIds.referrals.form)).toBeInTheDocument();
    expect(expand).toHaveAttribute('aria-expanded', 'true');
    expect(expand).toHaveTextContent('Collapse');

    await user.keyboard(' ');
    expect(screen.queryByTestId(dataTestIds.referrals.form)).not.toBeInTheDocument();
  });

  it('drops an unsaved new referral when the record switches to another patient, so it cannot be saved to them', async () => {
    const user = userEvent.setup();
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const tabFor = (patientId: string): JSX.Element => (
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <PatientReferralsTab patientId={patientId} />
        </MemoryRouter>
      </QueryClientProvider>
    );
    const { rerender } = render(tabFor('patient-1'));

    await user.click(await screen.findByTestId(dataTestIds.referrals.addButton));
    const form = screen.getByTestId(dataTestIds.referrals.form);
    await user.type(within(form).getByTestId(dataTestIds.referrals.reason), 'Knee pain');

    rerender(tabFor('patient-2'));

    expect(screen.queryByTestId(dataTestIds.referrals.form)).not.toBeInTheDocument();
    expect(screen.getByTestId(dataTestIds.referrals.addButton)).toBeEnabled();
  });
});
