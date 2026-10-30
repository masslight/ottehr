/**
 * @vitest-environment jsdom
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ComponentProps, ReactElement } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { PatientFormResponse } from 'utils/lib/types/data/practice-managed-questionnaires/practice-managed-questionnaire.types';
import { beforeEach, describe, expect, it, Mock, vi } from 'vitest';

vi.mock('notistack', () => ({ enqueueSnackbar: vi.fn() }));
vi.mock('../../src/api/api', () => ({
  getPatientFormResponses: vi.fn(),
  sendPatientForm: vi.fn(),
  deleteVisitForm: vi.fn(),
}));
vi.mock('../../src/hooks/useAppClients', () => ({ useApiClients: vi.fn(() => ({ oystehrZambda: {} })) }));
vi.mock('../../src/components/dialogs/EditFormResponseDialog', () => ({
  EditFormResponseDialog: ({ form }: { form: { questionnaireTitle: string } }) => (
    <div>Editing {form.questionnaireTitle}</div>
  ),
}));
vi.mock('../../src/features/visits/shared/stores/appointment/appointment.store', () => ({
  useAppointmentData: vi.fn(() => ({
    appointment: { id: 'appt-now' },
    encounter: { id: 'enc-now' },
    patient: { id: 'patient-1' },
  })),
}));
vi.mock('../../src/features/visits/shared/hooks/useGetAppointmentAccessibility', () => ({
  useGetAppointmentAccessibility: vi.fn(() => ({ isAppointmentReadOnly: false })),
}));
vi.mock('../../src/features/visits/telemed/hooks/usePracticeManagedQuestionnaires', () => ({
  usePracticeManagedQuestionnaires: vi.fn(() => ({
    active: [
      { id: 'sdoh-id', title: 'SDOH', status: 'active', url: 'sdoh', placement: 'questionnaires' },
      { id: 'screen-id', title: 'Staff screening', status: 'active', url: 'screen', placement: 'screening' },
      { id: 'consent-id', title: 'Consent', status: 'active', url: 'consent', placement: 'visit-details' },
    ],
    isLoading: false,
    error: null,
  })),
}));

import { getPatientFormResponses, sendPatientForm } from '../../src/api/api';
import { SendFormDialog } from '../../src/components/dialogs/SendFormDialog';
import { dataTestIds } from '../../src/constants/data-test-ids';
import {
  FormResponsesSummary,
  PatientFormResponses,
} from '../../src/features/visits/shared/components/patient-forms/PatientFormResponses';
import { useGetAppointmentAccessibility } from '../../src/features/visits/shared/hooks/useGetAppointmentAccessibility';

const response = (id: string, encounterId: string, visitDate: string): PatientFormResponse => ({
  questionnaireId: `sdoh-${id}`,
  questionnaireTitle: 'SDOH',
  questionnaireUrl: 'sdoh',
  placement: 'questionnaires',
  allItems: [
    {
      linkId: 'page',
      type: 'group',
      acceptsMultipleAnswers: false,
      alwaysFilter: false,
      item: [{ linkId: 'cig', text: 'Cigarettes', type: 'string', acceptsMultipleAnswers: false, alwaysFilter: false }],
    },
  ],
  questionnaireResponse: {
    resourceType: 'QuestionnaireResponse',
    id,
    status: 'completed',
    item: [{ linkId: 'page', item: [{ linkId: 'cig', answer: [{ valueString: id === 'qr-now' ? 'Yes' : 'No' }] }] }],
  },
  encounterId,
  visitDate,
  deletable: true,
});

const renderWithProviders = (
  ui: ReactElement,
  initialEntries?: ComponentProps<typeof MemoryRouter>['initialEntries']
): void => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={initialEntries}>{ui}</MemoryRouter>
    </QueryClientProvider>
  );
};

describe('PatientFormResponses', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (useGetAppointmentAccessibility as Mock).mockReturnValue({ isAppointmentReadOnly: false });
    (getPatientFormResponses as Mock).mockResolvedValue({
      responses: [
        response('qr-old', 'enc-old', '2025-10-02T14:00:00Z'),
        response('qr-now', 'enc-now', '2026-10-09T14:00:00Z'),
      ],
    });
  });

  it("lets staff change this visit's response, while earlier visits' responses are view-only", async () => {
    renderWithProviders(<PatientFormResponses placement="questionnaires" scope="all-visits" />);

    expect(await screen.findByText(/This visit/)).toBeInTheDocument();
    // Only this visit's response has the Edit/Delete menu.
    expect(screen.getAllByTestId(dataTestIds.visitDetailsPage.customFormMenuButton('sdoh-qr-now'))).toHaveLength(1);
    expect(screen.queryByTestId(dataTestIds.visitDetailsPage.customFormMenuButton('sdoh-qr-old'))).toBeNull();
    expect(screen.getByRole('button', { name: 'Add form' })).toBeInTheDocument();
  });

  it('offers no changes once the visit is locked', async () => {
    (useGetAppointmentAccessibility as Mock).mockReturnValue({ isAppointmentReadOnly: true });
    renderWithProviders(<PatientFormResponses placement="questionnaires" scope="all-visits" />);

    expect(await screen.findByText(/This visit/)).toBeInTheDocument();
    expect(screen.queryByTestId(dataTestIds.visitDetailsPage.customFormMenuButton('sdoh-qr-now'))).toBeNull();
    expect(screen.queryByRole('button', { name: 'Add form' })).toBeNull();
  });

  it('opens a form started from another page in its edit dialog', async () => {
    renderWithProviders(<PatientFormResponses placement="questionnaires" scope="all-visits" />, [
      { pathname: '/in-person/appt-now/questionnaires', state: { openFormResponseId: 'qr-now' } },
    ]);

    expect(await screen.findByText('Editing SDOH')).toBeInTheDocument();
  });

  // Visit Details can start a Screening or Clinical Forms response on a signed visit; landing on the locked
  // chart page must not hand staff an editor for it.
  it('does not open a form started from another page once the visit is locked', async () => {
    (useGetAppointmentAccessibility as Mock).mockReturnValue({ isAppointmentReadOnly: true });
    renderWithProviders(<PatientFormResponses placement="questionnaires" scope="all-visits" />, [
      { pathname: '/in-person/appt-now/questionnaires', state: { openFormResponseId: 'qr-now' } },
    ]);

    expect(await screen.findByText(/This visit/)).toBeInTheDocument();
    expect(screen.queryByText('Editing SDOH')).toBeNull();
  });

  // Forms answered in the visit's paperwork are separate entries that share the paperwork's one response.
  it('renders each form of a shared paperwork response as its own entry', async () => {
    const flowForm = (questionnaireId: string, title: string): PatientFormResponse => ({
      ...response('qr-intake', 'enc-now', '2026-10-09T14:00:00Z'),
      questionnaireId,
      questionnaireTitle: title,
      questionnaireUrl: questionnaireId,
      placement: 'screening',
      deletable: false,
    });
    (getPatientFormResponses as Mock).mockResolvedValue({
      responses: [flowForm('vanderbilt', 'Vanderbilt'), flowForm('phq9', 'PHQ-9')],
    });
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    renderWithProviders(<PatientFormResponses placement="screening" scope="this-visit" />);

    expect(await screen.findByText('Vanderbilt')).toBeInTheDocument();
    expect(screen.getByText('PHQ-9')).toBeInTheDocument();
    expect(consoleError.mock.calls.flat().join(' ')).not.toMatch(/same key/);
    consoleError.mockRestore();
  });

  it('shows only the Screening section of this visit on the Screening page', async () => {
    renderWithProviders(<PatientFormResponses placement="screening" scope="this-visit" />);

    await waitFor(() => expect(getPatientFormResponses).toHaveBeenCalled());
    expect(screen.queryByText(/SDOH/)).toBeNull();
  });
});

describe('FormResponsesSummary', () => {
  it('says the forms could not load instead of showing that there are none', () => {
    render(<FormResponsesSummary responses={[]} emptyMessage="No clinical forms" isLoading={false} isError />);

    expect(screen.getByText('Could not load forms. Reload to try again.')).toBeInTheDocument();
    expect(screen.queryByText('No clinical forms')).toBeNull();
  });

  it('shows the empty message once the forms have loaded', () => {
    render(<FormResponsesSummary responses={[]} emptyMessage="No clinical forms" isLoading={false} isError={false} />);

    expect(screen.getByText('No clinical forms')).toBeInTheDocument();
  });
});

describe('SendFormDialog form type', () => {
  it("defaults to the page's type, lists only that type's forms, and passes the chosen type to Fill out now", async () => {
    const onFillOut = vi.fn();
    renderWithProviders(
      <SendFormDialog
        open
        onClose={vi.fn()}
        appointmentId="appt-now"
        placement="questionnaires"
        onFillOut={onFillOut}
      />
    );
    const user = userEvent.setup();

    await user.click(screen.getByRole('combobox', { name: 'Form' }));
    expect(screen.getByRole('option', { name: 'SDOH' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Consent' })).toBeNull();
    await user.keyboard('{Escape}');

    await user.click(screen.getByLabelText('Form type'));
    await user.click(within(screen.getByRole('listbox')).getByRole('option', { name: 'Screening' }));
    await user.click(screen.getByRole('combobox', { name: 'Form' }));
    await user.click(screen.getByRole('option', { name: 'Staff screening' }));
    await user.click(screen.getByRole('button', { name: 'Fill out now' }));

    expect(onFillOut).toHaveBeenCalledWith('screen-id', 'screening');
    expect(sendPatientForm).not.toHaveBeenCalled();
  });
});
