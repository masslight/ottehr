import { DataGridProProps } from '@mui/x-data-grid-pro';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DateTime } from 'luxon';
import { enqueueSnackbar } from 'notistack';
import { ErxEventDTO, PrescribedMedicationDTO } from 'utils/lib/types/api/chart-data/chart-data.types';
import { formatDateToMDYWithTime } from 'utils/lib/utils/date';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PrescriptionTable } from '../../src/features/visits/in-person/components/erx/PrescriptionTable';

const ordered = { code: 'ordered', recorded: '2026-10-27T15:00:30.000Z' };
const accepted = { code: 'accepted', recorded: '2026-10-27T15:01:00.000Z' };
const prescription = (
  resourceId: string,
  name: string,
  status: PrescribedMedicationDTO['status'],
  sent: string,
  events: ErxEventDTO[] = [ordered, accepted]
): PrescribedMedicationDTO => ({
  resourceId,
  name,
  status,
  instructions: `Directions for ${name}`,
  pharmacyName: 'Apex Discount Drugs',
  encounterId: 'encounter-1',
  sent,
  events,
  order: {
    patientId: 'patient-1',
    ndc: `ndc-${resourceId}`,
    medicationDescription: `${name} (NDC display)`,
    quantityValue: 250,
    quantityUnit: 'Milliliter',
    daysSupply: 10,
    numberOfRefills: 1,
    substitutionAllowed: false,
    noteToPharmacy: 'Shake well',
    diagnosisCode: 'H66.93',
    diagnosisDescription: 'Otitis media, unspecified, bilateral',
  },
});
// Newest sent first: AMOX, ERR, CEPH, PRED, OND
// At Sample Pharmacy One by its NCPDP ID.
const AMOX = {
  ...prescription('mr-amox', 'Amoxicillin 400 mg/5ml Susp', 'active', '2026-10-28T12:00:00.000Z'),
  pharmacyId: '0002026',
};
const ERR = {
  ...prescription('mr-err', 'Azithromycin 200 mg/5ml Susp', 'stopped', '2026-10-28T11:00:00.000Z', [
    {
      code: 'ordered',
      text: 'Prescription ordered',
      recorded: '2026-10-28T11:00:00.000Z',
      agentPractitionerId: 'practitioner-1',
    },
    {
      code: 'error 601',
      text: 'Surescripts reported an error: Receiver unable to process.',
      recorded: '2026-10-28T11:00:01.000Z',
      agent: 'Surescripts',
    },
  ]),
  // An optional field missing stays absent.
  order: { ...prescription('mr-err', 'x', 'stopped', '').order, noteToPharmacy: undefined, daysSupply: undefined },
};
const CEPH = {
  ...prescription('mr-ceph', 'Cephalexin 250 mg/5ml Susp', 'active', '2026-10-28T10:00:00.000Z'),
  order: { ...prescription('mr-ceph', 'x', 'active', '').order, quantityUnit: 'mL' },
};
const PRED = prescription('mr-pred', 'Prednisolone 15 mg/5ml Sol', 'active', '2026-10-28T09:00:00.000Z', [
  ordered,
  {
    code: 'cancelrequested',
    text: 'Cancellation requested with reason: Sent in error',
    recorded: '2026-10-28T09:01:00Z',
  },
]);
const OND = prescription('mr-ond', 'Ondansetron 4 mg/5ml Sol', 'draft', '2026-10-28T08:00:00.000Z', [ordered]);
const ERR_INCOMPLETE = {
  ...prescription('mr-err2', 'Cefdinir 250 mg/5ml Susp', 'stopped', '2026-10-28T07:00:00.000Z', []),
  order: { ...prescription('mr-err2', 'x', 'stopped', '').order, ndc: undefined },
};

const mocks = vi.hoisted(() => ({ refetch: vi.fn(), fetch: vi.fn() }));

// Google and the Surescripts directory find the sample pharmacies.
vi.mock('../../src/features/visits/shared/hooks/useOystehrAPIClient', async () => {
  const { searchSamplePlaces } = await import('./helpers/samplePharmacies');
  return { useOystehrAPIClient: () => ({ searchPlaces: searchSamplePlaces }) };
});
vi.mock('src/api/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('src/api/api')>()),
  searchPharmacyDirectory: (await import('./helpers/samplePharmacies')).searchSampleDirectory,
}));

// jsdom measures nothing, so the grid's virtualization would render no rows.
vi.mock('@mui/x-data-grid-pro', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@mui/x-data-grid-pro')>();
  return {
    ...actual,
    DataGridPro: (props: DataGridProProps) => <actual.DataGridPro {...props} disableVirtualization />,
  };
});
vi.mock('notistack', () => ({ enqueueSnackbar: vi.fn() }));
vi.mock('src/hooks/useAuthToken', () => ({ useAuthToken: () => 'user-token' }));
vi.mock('src/hooks/useEvolveUser', () => ({ default: () => ({ profileResource: { id: 'practitioner-1' } }) }));
vi.mock('../../src/features/visits/shared/hooks/useChartSection', () => ({
  useChartSection: () => ({
    isLoading: false,
    isFetching: false,
    data: {
      prescribedMedications: [AMOX, ERR, CEPH, PRED, OND, ERR_INCOMPLETE],
      prescribedMedicationsRequesterPractitioners: [
        { resourceType: 'Practitioner', id: 'practitioner-1', name: [{ given: ['Dana'], family: 'Abrams' }] },
      ],
    },
    refetch: mocks.refetch,
  }),
}));
vi.mock('../../src/features/visits/shared/stores/appointment/appointment.store', () => ({
  useAppointmentData: () => ({ appointment: { start: '2026-10-28T08:00:00.000Z' } }),
}));

const renderTable = (): ReturnType<typeof userEvent.setup> => {
  const user = userEvent.setup();
  render(
    <QueryClientProvider client={new QueryClient()}>
      <PrescriptionTable />
    </QueryClientProvider>
  );
  return user;
};
const row = (name: string): HTMLElement => screen.getByText(name).closest<HTMLElement>('[role="row"]')!;
const checkbox = (name: string): HTMLElement => within(row(name)).getByRole('checkbox', { hidden: true });
const response = (status: number, body: unknown): Response =>
  ({ ok: status < 300, status, json: async () => body }) as Response;
const cancelButton = (): HTMLElement => screen.getByRole('button', { name: 'Cancel prescriptions…' });
const sendButton = (): HTMLElement => screen.getByRole('button', { name: 'Send to another pharmacy…' });
// A disabled button takes no pointer events; its wrapper shows the tooltip.
const hoverTooltip = async (user: ReturnType<typeof userEvent.setup>, button: HTMLElement): Promise<string> => {
  await user.hover(button.parentElement!);
  return (await screen.findByRole('tooltip')).textContent ?? '';
};
const calls = (path: string): unknown[] =>
  mocks.fetch.mock.calls.filter(([url]) => String(url).endsWith(path)).map((call) => JSON.parse(call[1].body));
const pickPharmacyAndSend = async (user: ReturnType<typeof userEvent.setup>): Promise<void> => {
  const dialog = screen.getByRole('dialog');
  expect(within(dialog).getByRole('button', { name: 'Send to pharmacy' })).toBeDisabled();
  await user.type(within(dialog).getByRole('combobox', { name: 'Pharmacy' }), 'Two');
  await user.click(await screen.findByRole('option', { name: /Sample Pharmacy Two/ }));
  expect(await within(dialog).findByText(/Send to Sample Pharmacy Two/)).toBeInTheDocument();
  await user.click(within(dialog).getByRole('button', { name: 'Send to pharmacy' }));
};

const TODAY = DateTime.local().toISODate();
const newOrder = (item: PrescribedMedicationDTO): Record<string, unknown> => ({
  patientId: 'patient-1',
  practitionerId: 'practitioner-1',
  encounterId: 'encounter-1',
  ndc: item.order!.ndc,
  medicationDescription: item.order!.medicationDescription,
  quantityValue: 250,
  quantityUnit: 'Milliliter',
  writtenDate: TODAY,
  substitutionAllowed: false,
  numberOfRefills: 1,
  patientInstructions: item.instructions,
  pharmacyId: '0000031',
  pharmacyNpi: '1245319599',
  pharmacyName: 'Sample Pharmacy Two',
  pharmacyPhone: '5125550123',
  diagnosisCode: 'H66.93',
  diagnosisDescription: 'Otitis media, unspecified, bilateral',
});

describe('Prescription table: send to another pharmacy', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', mocks.fetch);
    mocks.fetch.mockResolvedValue(response(200, { medicationRequestId: 'new', messageId: 'm', status: {} }));
    mocks.refetch.mockResolvedValue({});
  });
  afterEach(() => vi.unstubAllGlobals());

  it('lets an errored row be checked; a row no action applies to stays uncheckable', () => {
    renderTable();
    expect(checkbox(ERR.name!)).toBeEnabled();
    expect(checkbox(AMOX.name!)).toBeEnabled();
    expect(checkbox(PRED.name!)).toBeDisabled();
    expect(checkbox(OND.name!)).toBeDisabled();
    // An errored prescription can't be cancelled, and without its NDC it can't be sent again.
    expect(checkbox(ERR_INCOMPLETE.name!)).toBeDisabled();
  });

  it('enables an action only when it applies to every ticked row, and says why not on hover', async () => {
    const user = renderTable();
    await user.click(checkbox(AMOX.name!));
    expect(cancelButton()).toBeEnabled();
    expect(sendButton()).toBeEnabled();
    await user.click(checkbox(ERR.name!));
    expect(cancelButton()).toBeDisabled();
    expect(sendButton()).toBeEnabled();
    expect(await hoverTooltip(user, cancelButton())).toBe(
      "Cancel isn't available for prescriptions with status Error."
    );
    await user.unhover(cancelButton().parentElement!);
    await user.click(checkbox(ERR.name!));
    await user.click(checkbox(CEPH.name!));
    expect(cancelButton()).toBeEnabled();
    expect(sendButton()).toBeDisabled();
    expect(await hoverTooltip(user, sendButton())).toBe(
      `Send to another pharmacy isn't available for ${CEPH.name}: missing quantity unit.`
    );
  });

  it('gives each row its actions in an Actions column, disabling one that does not apply and saying why', async () => {
    const user = renderTable();
    expect(screen.getByRole('columnheader', { name: 'Actions' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'More actions' })).not.toBeInTheDocument();
    const action = (name: string, label: string): HTMLElement => within(row(name)).getByRole('button', { name: label });
    const tooltipOf = async (button: HTMLElement): Promise<string> => {
      await user.hover(button.parentElement!);
      const text = (await screen.findByRole('tooltip')).textContent ?? '';
      await user.unhover(button.parentElement!);
      await waitFor(() => expect(screen.queryByRole('tooltip')).not.toBeInTheDocument());
      return text;
    };
    expect(action(AMOX.name!, 'Send to another pharmacy')).toBeEnabled();
    expect(action(AMOX.name!, 'Cancel prescription')).toBeEnabled();
    expect(await tooltipOf(action(AMOX.name!, 'Cancel prescription'))).toBe('Cancel prescription');
    expect(action(ERR.name!, 'Send to another pharmacy')).toBeEnabled();
    expect(action(ERR.name!, 'Cancel prescription')).toBeDisabled();
    expect(await tooltipOf(action(ERR.name!, 'Cancel prescription'))).toBe(
      "Cancel isn't available for prescriptions with status Error."
    );
    expect(action(OND.name!, 'Send to another pharmacy')).toBeDisabled();
    expect(await tooltipOf(action(OND.name!, 'Send to another pharmacy'))).toBe(
      "Send to another pharmacy isn't available for prescriptions with status Sending."
    );
    expect(action(ERR_INCOMPLETE.name!, 'Send to another pharmacy')).toBeDisabled();
    expect(await tooltipOf(action(ERR_INCOMPLETE.name!, 'Send to another pharmacy'))).toBe(
      `Send to another pharmacy isn't available for ${ERR_INCOMPLETE.name}: missing NDC.`
    );
    // History is always there.
    expect(action(PRED.name!, 'History')).toBeEnabled();
  });

  it('shows a prescription’s history, oldest first, on hover and in a dialog on click', async () => {
    const user = renderTable();
    const at = (iso: string): string => DateTime.fromISO(iso).toLocal().toFormat('MM/dd h:mm a');
    // Time | rail | the service's text with who did it inline
    const lines = [
      at('2026-10-28T11:00:00.000Z'),
      'Prescription ordered',
      'Abrams, Dana',
      at('2026-10-28T11:00:01.000Z'),
      'Surescripts reported an error: Receiver unable to process.',
      'Surescripts',
    ];
    const history = within(row(ERR.name!)).getByRole('button', { name: 'History' });
    await user.hover(history);
    const tooltip = await screen.findByRole('tooltip');
    expect(tooltip).toHaveTextContent(lines.join(''));
    await user.unhover(history);
    await waitFor(() => expect(screen.queryByRole('tooltip')).not.toBeInTheDocument());
    await user.click(history);
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAccessibleName(`History · ${ERR.name}`);
    expect(
      within(dialog).getByText(
        `Apex Discount Drugs · visit ${
          formatDateToMDYWithTime('2026-10-28T08:00:00.000Z', DateTime.local().zoneName)!.date
        }`
      )
    ).toBeInTheDocument();
    expect(within(dialog).getByRole('list')).toHaveTextContent(lines.join(''));
    // Who did it sits inline after the text, faint.
    expect(within(dialog).getByText('Abrams, Dana')).toHaveClass('who');
    await user.click(within(dialog).getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    // Opening the history doesn't select the row.
    expect(checkbox(ERR.name!)).not.toBeChecked();
    await user.hover(within(row(ERR_INCOMPLETE.name!)).getByRole('button', { name: 'History' }));
    // The history button got its focus back from the dialog, so its own tooltip may still be open.
    expect(await screen.findByText('No history yet')).toBeInTheDocument();
  });

  it('shows a prescription’s order details on hover and in a dialog on click, leaving out empty fields', async () => {
    const user = renderTable();
    const sent = formatDateToMDYWithTime(ERR.sent, DateTime.local().zoneName)!;
    // Label | value; ERR has no note to pharmacy or days supply, and no prescriber on file.
    const lines = [
      ['Medication', ERR.name],
      ['Directions', ERR.instructions],
      ['Quantity', '250 milliliters'],
      ['Refills', '1'],
      ['Substitution', 'Not allowed'],
      ['Diagnosis', 'H66.93 Otitis media, unspecified, bilateral'],
      ['Pharmacy', 'Apex Discount Drugs'],
      ['Sent', `${sent.date} ${sent.time}`],
    ].flat();
    const details = within(row(ERR.name!)).getByRole('button', { name: 'Details' });
    // Taken now: the button gets its focus back from the dialog, and its card repeats the name.
    const rowCheckbox = checkbox(ERR.name!);
    await user.hover(details);
    expect(await screen.findByRole('tooltip')).toHaveTextContent(lines.join(''), { normalizeWhitespace: false });
    await user.unhover(details);
    await waitFor(() => expect(screen.queryByRole('tooltip')).not.toBeInTheDocument());
    await user.click(details);
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAccessibleName(`Details · ${ERR.name}`);
    expect(dialog.querySelector('dl')).toHaveTextContent(lines.join(''), { normalizeWhitespace: false });
    await user.click(within(dialog).getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    // Opening the details doesn't select the row.
    expect(rowCheckbox).not.toBeChecked();
  });

  it('cancels a sent prescription (duplicate order, different pharmacy) and sends it to the new pharmacy', async () => {
    const user = renderTable();
    await user.click(within(row(AMOX.name!)).getByRole('button', { name: 'Send to another pharmacy' }));
    expect(within(screen.getByRole('dialog')).getByText(AMOX.instructions!)).toBeInTheDocument();
    await pickPharmacyAndSend(user);
    await waitFor(() => expect(mocks.refetch).toHaveBeenCalledTimes(1));
    expect(mocks.fetch.mock.calls.map(([url]) => String(url).split('/').at(-1))).toEqual([
      'cancel-prescription',
      'order-prescription',
    ]);
    expect(calls('/v4/cancel-prescription')).toEqual([
      {
        medicationRequestId: AMOX.resourceId,
        practitionerId: 'practitioner-1',
        reason: 'Duplicate order (different pharmacy)',
      },
    ]);
    expect(calls('/v4/order-prescription')).toEqual([
      { ...newOrder(AMOX), daysSupply: 10, noteToPharmacy: 'Shake well' },
    ]);
    expect(enqueueSnackbar).toHaveBeenCalledWith('Prescription sent to Sample Pharmacy Two', { variant: 'success' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('only sends an errored prescription again, leaving out what it never had', async () => {
    const user = renderTable();
    await user.click(checkbox(ERR.name!));
    await user.click(sendButton());
    await pickPharmacyAndSend(user);
    await waitFor(() => expect(mocks.refetch).toHaveBeenCalledTimes(1));
    expect(calls('/v4/cancel-prescription')).toEqual([]);
    expect(calls('/v4/order-prescription')).toEqual([newOrder(ERR)]);
    expect(screen.queryByText(/selected$/)).not.toBeInTheDocument();
  });

  it('names the prescription and the step that failed', async () => {
    mocks.fetch.mockImplementation(async (url: string) =>
      url.endsWith('/v4/order-prescription')
        ? response(400, { message: 'Pharmacy rejected the order' })
        : response(200, { messageId: 'm' })
    );
    const user = renderTable();
    await user.click(checkbox(AMOX.name!));
    await user.click(checkbox(ERR.name!));
    await user.click(sendButton());
    await pickPharmacyAndSend(user);
    await waitFor(() => expect(mocks.refetch).toHaveBeenCalledTimes(1));
    expect(enqueueSnackbar).toHaveBeenCalledWith(
      `0 of 2 sent to Sample Pharmacy Two. ${AMOX.name}: cancellation sent, but sending to Sample Pharmacy Two failed (Pharmacy rejected the order); ${ERR.name}: sending to Sample Pharmacy Two failed (Pharmacy rejected the order)`,
      { variant: 'error' }
    );
  });

  it('sends nothing for a prescription whose cancellation failed', async () => {
    mocks.fetch.mockImplementation(async (url: string) =>
      url.endsWith('/v4/cancel-prescription')
        ? response(400, { message: 'Cancellation already requested' })
        : response(200, { messageId: 'm' })
    );
    const user = renderTable();
    await user.click(checkbox(AMOX.name!));
    await user.click(checkbox(ERR.name!));
    await user.click(sendButton());
    await pickPharmacyAndSend(user);
    await waitFor(() => expect(mocks.refetch).toHaveBeenCalledTimes(1));
    expect(calls('/v4/order-prescription')).toEqual([newOrder(ERR)]);
    expect(enqueueSnackbar).toHaveBeenCalledWith(
      `1 of 2 sent to Sample Pharmacy Two. ${AMOX.name}: cancellation failed (Cancellation already requested); nothing was sent`,
      { variant: 'error' }
    );
  });

  // Review #3: closing mid-send, or reopening before the refetch lands, could cancel and send again.
  it('can’t be closed while sending, and stays until the refetch lands', async () => {
    let finishOrder: (value: Response) => void = () => undefined;
    mocks.fetch.mockImplementation((url: string) =>
      url.endsWith('/v4/order-prescription')
        ? new Promise<Response>((resolve) => (finishOrder = resolve))
        : Promise.resolve(response(200, { messageId: 'm' }))
    );
    let finishRefetch: (value: unknown) => void = () => undefined;
    mocks.refetch.mockImplementationOnce(() => new Promise((resolve) => (finishRefetch = resolve)));
    const user = renderTable();
    await user.click(within(row(ERR.name!)).getByRole('button', { name: 'Send to another pharmacy' }));
    await pickPharmacyAndSend(user);
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Close' }));
    await user.keyboard('{Escape}');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    finishOrder(response(200, { medicationRequestId: 'new', messageId: 'm', status: {} }));
    await waitFor(() => expect(mocks.refetch).toHaveBeenCalledTimes(1));
    // Sent, but the row still reads as errored until the refetch lands: the dialog stays, so nothing reopens it.
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    finishRefetch({});
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(calls('/v4/order-prescription')).toHaveLength(1);
  });

  // Review #4: the pharmacy a prescription is already at isn't another pharmacy.
  it('won’t send a prescription to the pharmacy it is already at', async () => {
    const user = renderTable();
    await user.click(within(row(AMOX.name!)).getByRole('button', { name: 'Send to another pharmacy' }));
    await user.type(within(screen.getByRole('dialog')).getByRole('combobox', { name: 'Pharmacy' }), 'Sample');
    await user.click(await screen.findByRole('option', { name: /Sample Pharmacy One/ }));
    expect(
      await screen.findByText('Sample Pharmacy One: Already sent to this pharmacy. Pick another pharmacy.')
    ).toBeInTheDocument();
    expect(within(screen.getByRole('dialog')).queryByText(/Send to Sample Pharmacy One/)).not.toBeInTheDocument();
    expect(within(screen.getByRole('dialog')).getByRole('button', { name: 'Send to pharmacy' })).toBeDisabled();
  });

  it('leaves out, and names, the selected prescriptions already at the pharmacy picked', async () => {
    const user = renderTable();
    await user.click(checkbox(AMOX.name!));
    await user.click(checkbox(ERR.name!));
    await user.click(sendButton());
    const dialog = screen.getByRole('dialog');
    await user.type(within(dialog).getByRole('combobox', { name: 'Pharmacy' }), 'One');
    await user.click(await screen.findByRole('option', { name: /Sample Pharmacy One/ }));
    expect(
      await within(dialog).findByText(`Already sent to this pharmacy, so left as is: ${AMOX.name}`)
    ).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Send to pharmacy' }));
    await waitFor(() => expect(mocks.refetch).toHaveBeenCalledTimes(1));
    expect(calls('/v4/cancel-prescription')).toEqual([]);
    expect(calls('/v4/order-prescription')).toEqual([
      {
        ...newOrder(ERR),
        pharmacyId: '0002026',
        pharmacyNpi: '1234567893',
        pharmacyName: 'Sample Pharmacy One',
        pharmacyPhone: '5125559999',
      },
    ]);
    expect(enqueueSnackbar).toHaveBeenCalledWith(
      `1 of 2 sent to Sample Pharmacy One. ${AMOX.name}: already sent to Sample Pharmacy One; nothing was sent`,
      { variant: 'error' }
    );
  });
});
