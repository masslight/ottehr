import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ─── Mocks (must come before component imports) ─────────────────────────────

const { createUpdateOrder, navigate, accessibility, quickPicks } = vi.hoisted(() => ({
  createUpdateOrder: vi.fn(),
  navigate: vi.fn(),
  accessibility: { isAppointmentReadOnly: false },
  quickPicks: {
    list: [
      {
        id: 'qp-1',
        name: 'Adult booster',
        vaccine: { id: '115', name: 'Tdap' },
        dose: '0.5',
        units: 'ml',
        manufacturer: 'Sanofi Pasteur',
        mvx: 'PMC',
        cvx: '999',
        lot: 'QP-LOT',
        expDate: '2027-01-31',
        ndc: '49281-0400-10',
        cptCodes: [{ code: '90715', display: 'Tdap' }],
      },
    ],
  },
}));

// An order as get-immunization-orders returns it, with a manufacturer and MVX code typed before the MVX list.
const SAVED_ORDER = vi.hoisted(() => ({
  orders: [
    {
      id: 'order-1',
      status: 'pending',
      encounterId: 'enc-1',
      details: {
        medication: { id: '03', name: 'MMR' },
        dose: '0.5',
        units: 'ml',
        orderedProvider: { id: 'prov-2', name: 'Dr. Other' },
        orderedDateTime: '2026-11-09T10:00:00Z',
        manufacturer: 'example',
      },
      administrationDetails: {
        lot: 'L-42',
        expDate: '',
        mvx: '1111fff',
        cvx: '03',
        cptCodes: [],
        ndc: '',
        administeredProvider: { id: '', name: '' },
        administeredDateTime: '',
      },
    },
  ],
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => navigate, useParams: () => ({ id: 'appt-1' }) };
});

vi.mock('notistack', () => ({ enqueueSnackbar: vi.fn() }));

vi.mock('../../src/hooks/useEvolveUser', () => ({
  default: () => ({
    hasRole: (roles: string[]) => roles.includes('Provider'),
    profile: 'Practitioner/prov-1',
    userName: 'Dr. Test',
  }),
}));

vi.mock('../../src/hooks/useCommandPaletteSource', () => ({ useCommandPaletteSource: vi.fn() }));
vi.mock('../../src/hooks/usePendingQuickPick', () => ({ usePendingQuickPick: vi.fn() }));

vi.mock('../../src/features/visits/shared/hooks/useGetAppointmentAccessibility', () => ({
  useGetAppointmentAccessibility: () => accessibility,
}));

vi.mock('../../src/features/visits/shared/stores/appointment/appointment.store', () => ({
  useAppointmentData: () => ({ resources: { encounter: { id: 'enc-1' }, patient: { id: 'pat-1' } } }),
}));

vi.mock('../../src/features/visits/in-person/components/RoundedButton', () => ({
  ButtonRounded: ({ children, onClick }: any) => <button onClick={onClick}>{children}</button>,
}));
vi.mock('../../src/components/AccordionCard', () => ({
  AccordionCard: ({ children }: any) => <div>{children}</div>,
}));
vi.mock('../../src/components/BaseBreadcrumbs', () => ({ BaseBreadcrumbs: () => <div /> }));
vi.mock('../../src/components/dialogs/CustomDialog', () => ({ CustomDialog: () => <div /> }));
vi.mock('../../src/features/visits/in-person/components/medication-administration/PageHeader', () => ({
  PageHeader: ({ title }: { title: string }) => <h1>{title}</h1>,
}));
vi.mock('../../src/features/visits/shared/components/QuickPickSaveDialogs', () => ({
  QuickPickSaveDialogs: () => <div />,
}));
vi.mock('../../src/features/immunization/components/OrderHistoryTable', () => ({
  OrderHistoryTable: () => <div />,
}));

vi.mock('../../src/features/immunization/hooks/useImmunizationQuickPickManagement', () => ({
  useImmunizationQuickPickManagement: () => ({
    mergedQuickPicks: quickPicks.list,
    mergedQuickPicksLoading: false,
    quickPickDialogOpen: false,
    setQuickPickDialogOpen: vi.fn(),
    quickPickName: '',
    setQuickPickName: vi.fn(),
    existingQuickPicks: [],
    quickPickSaving: false,
    openQuickPickDialog: vi.fn(),
    onSaveAsQuickPick: vi.fn(),
  }),
}));

vi.mock('../../src/features/visits/in-person/hooks/useImmunization', () => ({
  useCancelImmunizationOrder: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useCreateUpdateImmunizationOrder: () => ({ mutateAsync: createUpdateOrder, isPending: false }),
  useGetImmunizationOrders: ({ orderId }: { orderId?: string }) => ({
    data: orderId ? SAVED_ORDER : undefined,
    isLoading: false,
  }),
}));

// The sentences are the real ones; only what they load is stubbed.
vi.mock('src/features/immunization/hooks/useImmunizationDiagnosisOptions', () => ({
  useImmunizationDiagnosisOptions: () => [],
}));
vi.mock('src/components/input/EmployeeSelectInput', () => ({
  useEmployeeOptions: () => ({ options: [{ id: 'prov-1', name: 'Dr. Test' }], isLoading: false }),
}));
vi.mock('src/components/input/CptCodesInput', () => ({ CptCodesInput: () => <div /> }));

import { dataTestIds } from '../../src/constants/data-test-ids';
import { ImmunizationOrderCreateEdit } from '../../src/features/immunization/pages/ImmunizationOrderCreateEdit';
import { useImmunizationOrderStore } from '../../src/state/draft-data.store';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const orderButton = (): HTMLElement => screen.getByTestId(dataTestIds.orderVaccinePage.orderVaccineButton);

const pickVaccine = async (user: ReturnType<typeof userEvent.setup>, name: string): Promise<void> => {
  await user.click(screen.getByTestId(dataTestIds.orderVaccinePage.vaccine));
  await user.type(screen.getByRole('combobox', { name: 'Immunization' }), name);
  await user.click(within(screen.getByRole('listbox', { name: 'Vaccines' })).getByRole('option', { name }));
};

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('ImmunizationOrderCreateEdit — ordering', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createUpdateOrder.mockResolvedValue({ orderId: 'order-new' });
    accessibility.isAppointmentReadOnly = false;
    useImmunizationOrderStore.setState({ draftsByEncounterId: {} });
  });

  it('opens with the current provider as Ordered by, Administration collapsed and the safety alert', () => {
    render(<ImmunizationOrderCreateEdit />);

    expect(screen.getByRole('heading', { name: 'Immunizations' })).toBeInTheDocument();
    expect(screen.getByTestId(dataTestIds.orderVaccinePage.orderedBy)).toHaveTextContent('Dr. Test');
    expect(screen.getByTestId(dataTestIds.orderVaccinePage.administrationToggle)).toHaveAttribute(
      'aria-expanded',
      'false'
    );
    expect(screen.getByText(/Vaccine orders do not automatically check for patient allergies/)).toBeInTheDocument();
    expect(orderButton()).toHaveTextContent('Order Immunization');
    // a default is not a change of the user's
    expect(useImmunizationOrderStore.getState().hasDraft('enc-1')).toBe(false);
  });

  it('does not order while the immunization, dose or units are missing, and says which', async () => {
    const user = userEvent.setup();
    render(<ImmunizationOrderCreateEdit />);

    await user.click(orderButton());

    expect(createUpdateOrder).not.toHaveBeenCalled();
    expect(screen.getByText('Pick the immunization. Enter the dose. Pick the units.')).toBeInTheDocument();
  });

  it('orders the vaccine with its dose and units alone, and sends no CVX code', async () => {
    const user = userEvent.setup();
    render(<ImmunizationOrderCreateEdit />);

    await pickVaccine(user, 'Tdap');
    await user.type(screen.getByTestId(dataTestIds.orderVaccinePage.dose), '0.5');
    await user.click(screen.getByTestId(dataTestIds.orderVaccinePage.units));
    await user.click(screen.getByRole('option', { name: 'mL' }));
    expect(useImmunizationOrderStore.getState().hasDraft('enc-1')).toBe(true);
    await user.click(orderButton());

    await waitFor(() => expect(navigate).toHaveBeenCalled());
    expect(createUpdateOrder).toHaveBeenCalledTimes(1);
    expect(createUpdateOrder).toHaveBeenCalledWith({
      encounterId: 'enc-1',
      orderId: undefined,
      details: {
        medication: { id: '115', name: 'Tdap' },
        dose: '0.5',
        units: 'ml',
        orderedProvider: { id: 'prov-1', name: 'Dr. Test' },
      },
      administrationDetails: {},
    });
    expect(useImmunizationOrderStore.getState().hasDraft('enc-1')).toBe(false);
  });

  it('fills the order and its administration details from a quick pick picked in the immunization menu', async () => {
    const user = userEvent.setup();
    render(<ImmunizationOrderCreateEdit />);

    await user.click(screen.getByTestId(dataTestIds.orderVaccinePage.vaccine));
    await user.click(
      within(screen.getByRole('listbox', { name: 'Quick picks' })).getByRole('option', { name: 'Adult booster' })
    );
    expect(screen.getByTestId(dataTestIds.orderVaccinePage.vaccine)).toHaveTextContent('Tdap');
    expect(screen.getByTestId(dataTestIds.orderVaccinePage.administrationSummary)).toHaveTextContent(
      /Lot QP-LOT .* NDC 49281-0400-10 · Sanofi Pasteur · CPT 90715/
    );
    await user.click(orderButton());

    await waitFor(() => expect(createUpdateOrder).toHaveBeenCalledTimes(1));
    expect(createUpdateOrder.mock.calls[0][0]).toEqual({
      encounterId: 'enc-1',
      orderId: undefined,
      details: {
        medication: { id: '115', name: 'Tdap' },
        dose: '0.5',
        units: 'ml',
        manufacturer: 'Sanofi Pasteur',
        orderedProvider: { id: 'prov-1', name: 'Dr. Test' },
      },
      administrationDetails: {
        lot: 'QP-LOT',
        expDate: '2027-01-31',
        mvx: 'PMC',
        ndc: '49281-0400-10',
        cptCodes: [{ code: '90715', display: 'Tdap' }],
      },
    });
  });

  it('keeps the form and the draft when the order cannot be saved', async () => {
    createUpdateOrder.mockRejectedValue(new Error('boom'));
    const user = userEvent.setup();
    render(<ImmunizationOrderCreateEdit />);

    await user.click(screen.getByTestId(dataTestIds.orderVaccinePage.vaccine));
    await user.click(screen.getByRole('option', { name: 'Adult booster' }));
    await user.click(orderButton());

    await waitFor(() => expect(createUpdateOrder).toHaveBeenCalledTimes(1));
    expect(navigate).not.toHaveBeenCalled();
    expect(screen.getByTestId(dataTestIds.orderVaccinePage.vaccine)).toHaveTextContent('Tdap');
    expect(useImmunizationOrderStore.getState().hasDraft('enc-1')).toBe(true);
    expect(orderButton()).toBeEnabled();
  });

  it('edits an order without quick picks, and saves a manufacturer typed before the MVX list as it was', async () => {
    const user = userEvent.setup();
    render(<ImmunizationOrderCreateEdit orderId="order-1" />);

    expect(screen.getByRole('heading', { name: 'Edit Immunization Order' })).toBeInTheDocument();
    expect(screen.getByTestId(dataTestIds.orderVaccinePage.vaccine)).toHaveTextContent('MMR');
    expect(screen.getByTestId(dataTestIds.orderVaccinePage.orderedBy)).toHaveTextContent('Dr. Other');
    expect(screen.getByTestId(dataTestIds.orderVaccinePage.administrationSummary)).toHaveTextContent(
      'Lot L-42 · example (MVX 1111fff)'
    );
    await user.click(screen.getByTestId(dataTestIds.orderVaccinePage.vaccine));
    expect(screen.queryByRole('listbox', { name: 'Quick picks' })).not.toBeInTheDocument();
    await user.keyboard('{Escape}');

    await user.clear(screen.getByTestId(dataTestIds.orderVaccinePage.dose));
    await user.type(screen.getByTestId(dataTestIds.orderVaccinePage.dose), '1');
    expect(orderButton()).toHaveTextContent('Save changes');
    await user.click(orderButton());

    await waitFor(() => expect(createUpdateOrder).toHaveBeenCalledTimes(1));
    expect(createUpdateOrder.mock.calls[0][0]).toEqual({
      encounterId: 'enc-1',
      orderId: 'order-1',
      details: {
        medication: { id: '03', name: 'MMR' },
        dose: '1',
        units: 'ml',
        orderedProvider: { id: 'prov-2', name: 'Dr. Other' },
        manufacturer: 'example',
      },
      administrationDetails: { lot: 'L-42', mvx: '1111fff' },
    });
    expect(useImmunizationOrderStore.getState().hasDraft('enc-1')).toBe(false);
  });

  it('lets nothing be changed or ordered on a read-only visit', () => {
    accessibility.isAppointmentReadOnly = true;
    render(<ImmunizationOrderCreateEdit />);

    expect(orderButton()).toBeDisabled();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument();
  });
});
