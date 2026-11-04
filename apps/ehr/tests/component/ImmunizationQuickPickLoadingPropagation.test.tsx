import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { VaccineDetailsCard } from '../../src/features/immunization/components/VaccineDetailsCard';
import { ImmunizationOrderCreateEdit } from '../../src/features/immunization/pages/ImmunizationOrderCreateEdit';

const defaultQuickPickState = {
  mergedQuickPicks: [],
  mergedQuickPicksLoading: true,
  quickPickDialogOpen: false,
  setQuickPickDialogOpen: vi.fn(),
  quickPickName: '',
  setQuickPickName: vi.fn(),
  existingQuickPicks: [] as { id: string; name: string }[],
  quickPickSaving: false,
  onQuickPickSelect: vi.fn(),
  openQuickPickDialog: vi.fn(),
  onSaveAsQuickPick: vi.fn(),
};
const quickPickState = { ...defaultQuickPickState };

const appointmentData = {
  mappedData: {},
  resources: {
    encounter: { id: 'encounter-1' },
    patient: { id: 'patient-1' },
  },
};

const currentUser = {
  hasRole: () => false,
  profile: 'Practitioner/1',
  userName: 'Test User',
};

const immunizationOrdersResponse = { orders: [] };

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => vi.fn(),
    useParams: () => ({ id: 'appointment-1' }),
  };
});

vi.mock('../../src/features/visits/shared/components/QuickPicksButton', () => ({
  QuickPicksButton: ({ loading }: { loading?: boolean }) => (
    <div data-testid="quick-picks-button">{String(Boolean(loading))}</div>
  ),
}));

vi.mock('src/features/visits/shared/components/QuickPicksButton', () => ({
  QuickPicksButton: ({ loading }: { loading?: boolean }) => (
    <div data-testid="quick-picks-button">{String(Boolean(loading))}</div>
  ),
}));

vi.mock('../../src/features/immunization/hooks/useImmunizationQuickPickManagement', () => ({
  useImmunizationQuickPickManagement: () => quickPickState,
}));

vi.mock('../../src/features/visits/shared/hooks/useGetAppointmentAccessibility', () => ({
  useGetAppointmentAccessibility: () => ({ isAppointmentReadOnly: false }),
}));

vi.mock('src/features/visits/shared/hooks/useGetAppointmentAccessibility', () => ({
  useGetAppointmentAccessibility: () => ({ isAppointmentReadOnly: false }),
}));

vi.mock('../../src/features/visits/shared/stores/appointment/appointment.store', () => ({
  useAppointmentData: () => appointmentData,
}));

vi.mock('src/features/visits/shared/stores/appointment/appointment.store', () => ({
  useAppointmentData: () => appointmentData,
}));

vi.mock('../../src/features/visits/in-person/hooks/useImmunization', () => ({
  useAdministerImmunizationOrder: () => ({ mutateAsync: vi.fn() }),
  useCancelImmunizationOrder: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useCreateUpdateImmunizationOrder: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useGetImmunizationOrders: () => ({ data: immunizationOrdersResponse, isLoading: false }),
}));

vi.mock('../../src/hooks/useEvolveUser', () => ({
  default: () => currentUser,
}));

vi.mock('src/hooks/useEvolveUser', () => ({
  default: () => currentUser,
}));

vi.mock('../../src/hooks/useCommandPaletteSource', () => ({
  useCommandPaletteSource: vi.fn(),
}));

vi.mock('src/hooks/useCommandPaletteSource', () => ({
  useCommandPaletteSource: vi.fn(),
}));

vi.mock('../../src/hooks/usePendingQuickPick', () => ({
  usePendingQuickPick: vi.fn(),
}));

vi.mock('src/hooks/usePendingQuickPick', () => ({
  usePendingQuickPick: vi.fn(),
}));

vi.mock('../../src/components/dialogs/CustomDialog', () => ({
  CustomDialog: () => <div />,
}));

vi.mock('../../src/components/input/CheckboxInput', () => ({
  CheckboxInput: () => <div />,
}));

vi.mock('src/components/input/CheckboxInput', () => ({
  CheckboxInput: () => <div />,
}));

vi.mock('../../src/components/input/CptCodesInput', () => ({
  CptCodesInput: () => <div />,
}));

vi.mock('src/components/input/CptCodesInput', () => ({
  CptCodesInput: () => <div />,
}));

vi.mock('../../src/components/input/DateInput', () => ({
  DateInput: () => <div />,
}));

vi.mock('src/components/input/DateInput', () => ({
  DateInput: () => <div />,
}));

vi.mock('../../src/components/input/PhoneInput', () => ({
  PhoneInput: () => <div />,
}));

vi.mock('src/components/input/PhoneInput', () => ({
  PhoneInput: () => <div />,
}));

vi.mock('../../src/components/input/SelectInput', () => ({
  SelectInput: () => <div />,
}));

vi.mock('src/components/input/SelectInput', () => ({
  SelectInput: () => <div />,
}));

vi.mock('../../src/components/input/TextInput', () => ({
  TextInput: () => <div />,
}));

vi.mock('src/components/input/TextInput', () => ({
  TextInput: () => <div />,
}));

vi.mock('../../src/components/input/TimeInput', () => ({
  TimeInput: () => <div />,
}));

vi.mock('src/components/input/TimeInput', () => ({
  TimeInput: () => <div />,
}));

vi.mock('../../src/features/visits/in-person/components/RoundedButton', () => ({
  ButtonRounded: ({ children }: { children: React.ReactNode }) => <button>{children}</button>,
}));

vi.mock('src/features/visits/in-person/components/RoundedButton', () => ({
  ButtonRounded: ({ children }: { children: React.ReactNode }) => <button>{children}</button>,
}));

vi.mock('../../src/features/immunization/components/AdministrationConfirmationDialog', () => ({
  AdministrationConfirmationDialog: () => <div />,
}));

vi.mock('../../src/features/immunization/components/OrderDetailsSection', () => ({
  OrderDetailsSection: () => <div />,
}));

vi.mock('../../src/features/immunization/components/OrderStatusChip', () => ({
  OrderStatusChip: () => <div />,
}));

vi.mock('../../src/components/AccordionCard', () => ({
  AccordionCard: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('src/components/AccordionCard', () => ({
  AccordionCard: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('../../src/components/BaseBreadcrumbs', () => ({
  BaseBreadcrumbs: () => <div />,
}));

vi.mock('src/components/BaseBreadcrumbs', () => ({
  BaseBreadcrumbs: () => <div />,
}));

vi.mock('../../src/features/visits/in-person/components/WarningBlock', () => ({
  WarningBlock: () => <div />,
}));

vi.mock('src/features/visits/in-person/components/WarningBlock', () => ({
  WarningBlock: () => <div />,
}));

vi.mock('../../src/features/visits/in-person/components/medication-administration/PageHeader', () => ({
  PageHeader: () => <div />,
}));

vi.mock('../../src/features/immunization/components/OrderHistoryTable', () => ({
  OrderHistoryTable: () => <div />,
}));

describe('immunization quick pick loading propagation', () => {
  it('passes the loading state to VaccineDetailsCard quick picks', () => {
    render(
      <VaccineDetailsCard
        order={
          {
            id: 'order-1',
            administrationDetails: {},
          } as any
        }
      />
    );

    expect(screen.getByTestId('quick-picks-button')).toHaveTextContent('true');
  });

  it('passes the loading state to ImmunizationOrderCreateEdit quick picks', () => {
    render(<ImmunizationOrderCreateEdit />);

    expect(screen.getByTestId('quick-picks-button')).toHaveTextContent('true');
  });
});

describe('immunization save quick pick dialog', () => {
  afterEach(() => {
    Object.assign(quickPickState, defaultQuickPickState);
  });

  it.each([
    [
      'VaccineDetailsCard',
      () => render(<VaccineDetailsCard order={{ id: 'order-1', administrationDetails: {} } as any} />),
    ],
    ['ImmunizationOrderCreateEdit', () => render(<ImmunizationOrderCreateEdit />)],
  ])('%s uses the Add to Quick Picks dialog and confirms before replacing', async (_name, renderComponent) => {
    const onSaveAsQuickPick = vi.fn();
    Object.assign(quickPickState, {
      quickPickDialogOpen: true,
      quickPickName: 'flu shot',
      existingQuickPicks: [{ id: 'qp-flu', name: 'Flu shot' }],
      onSaveAsQuickPick,
    });
    renderComponent();

    expect(screen.getByRole('combobox', { name: 'Quick Pick Name' })).toHaveValue('flu shot');
    expect(screen.queryByText('Or overwrite an existing quick pick:')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Save Quick Pick' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Replace' }));

    expect(onSaveAsQuickPick).toHaveBeenCalledWith('qp-flu');
  });
});
