import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { GetRadiologyOrderListZambdaOrder, RadiologyOrderStatus } from 'utils/lib/types/api/radiology';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: vi.fn(),
    useParams: vi.fn(),
  };
});

vi.mock('../../src/features/radiology/components/usePatientRadiologyOrders', () => ({
  usePatientRadiologyOrders: vi.fn(),
}));

vi.mock('../../src/features/radiology/components/useRadiologyConsentExists', () => ({
  useRadiologyConsentExists: vi.fn(),
}));

vi.mock('src/hooks/useAppClients', () => ({
  useApiClients: () => ({ oystehrZambda: null }),
}));

const { mockEnqueueSnackbar } = vi.hoisted(() => ({ mockEnqueueSnackbar: vi.fn() }));

vi.mock('notistack', () => ({ enqueueSnackbar: mockEnqueueSnackbar }));

vi.mock('src/api/api', () => ({
  radiologyLaunchViewer: vi.fn(),
}));

// Sign-off goes through react-query; stub it so the page needs no QueryClientProvider, and expose the spy
// so tests can assert what gets written to the review task.
const { mockCompleteTask } = vi.hoisted(() => ({ mockCompleteTask: vi.fn().mockResolvedValue(undefined) }));

vi.mock('src/features/visits/in-person/hooks/useTasks', () => ({
  useCompleteTask: () => ({ mutateAsync: mockCompleteTask, isPending: false }),
}));

vi.mock('../../src/features/radiology/components/RadiologyOrderHistoryCard', () => ({
  RadiologyOrderHistoryCard: () => <div data-testid="order-history-card" />,
}));

// Stub the ICD-10 diagnosis picker (it uses react-query internally); expose a button that
// selects a fixed diagnosis and surface the validation message so tests can drive the flow.
vi.mock('../../src/features/radiology/components/RadiologyDiagnosisField', () => ({
  RadiologyDiagnosisField: ({ onChange, error, helperText }: any) => (
    <div data-testid="report-dx-field">
      <button type="button" onClick={() => onChange([{ code: 'A00', display: 'Cholera' }])}>
        mock-add-dx
      </button>
      {error ? <span>{helperText}</span> : null}
    </div>
  ),
}));

vi.mock('src/themes/ottehr/icons/mui-radiology.svg', () => ({
  default: 'radiology-icon.svg',
}));

vi.mock('../../src/features/visits/shared/components/PageTitle', () => ({
  PageTitleStyled: ({ children }: any) => <h1>{children}</h1>,
  PageTitle: ({ label, dataTestId }: any) => <h1 data-testid={dataTestId}>{label}</h1>,
}));

vi.mock('../../src/features/visits/shared/hooks/useGetAppointmentAccessibility', () => ({
  useGetAppointmentAccessibility: vi.fn(),
}));

// The order-details page writes the read-time diagnosis to the encounter chart/Assessment through the
// appointment store. Stub it so saveChartData resolves synchronously (echoing the submitted diagnosis)
// and expose the spies so tests can assert what gets written to the Assessment.
const { mockSaveChartData, mockSetPartialChartData } = vi.hoisted(() => ({
  mockSaveChartData: vi.fn((vars: any, opts: any) => opts?.onSuccess?.({ chartData: { diagnosis: vars.diagnosis } })),
  mockSetPartialChartData: vi.fn(),
}));

vi.mock('src/features/visits/shared/stores/appointment/appointment.store', () => ({
  useSaveChartData: () => ({ mutate: mockSaveChartData }),
  useChartData: () => ({ chartData: { diagnosis: [] }, setPartialChartData: mockSetPartialChartData }),
}));

vi.mock('src/hooks/useEvolveUser', () => ({
  default: vi.fn(),
}));

import { useNavigate, useParams } from 'react-router-dom';
import { dataTestIds } from '../../src/constants/data-test-ids';
import { usePatientRadiologyOrders } from '../../src/features/radiology/components/usePatientRadiologyOrders';
import { useRadiologyConsentExists } from '../../src/features/radiology/components/useRadiologyConsentExists';
import { RadiologyOrderDetailsPage } from '../../src/features/radiology/pages/RadiologyOrderDetails';
import { useGetAppointmentAccessibility } from '../../src/features/visits/shared/hooks/useGetAppointmentAccessibility';
import useEvolveUser from '../../src/hooks/useEvolveUser';

const mockUsePatientRadiologyOrders = vi.mocked(usePatientRadiologyOrders);
const mockUseRadiologyConsentExists = vi.mocked(useRadiologyConsentExists);
const mockUseGetAppointmentAccessibility = vi.mocked(useGetAppointmentAccessibility);
const mockUseNavigate = vi.mocked(useNavigate);
const mockUseParams = vi.mocked(useParams);
const mockUseEvolveUser = vi.mocked(useEvolveUser);

const SERVICE_REQUEST_ID = 'sr-001';
const CURRENT_USER_ID = 'practitioner-current';
const CURRENT_USER_NAME = 'Dr. Current';
const ORDERING_PROVIDER_ID = 'practitioner-ordering';
const PERFORMED_BY_LABEL = 'Performed by';
const PERFORMED_BY_REQUIRED_MESSAGE = 'Performed by is required';
const WRITE_FINAL_REPORT_CHECKBOX_LABEL = "Don't send to teleradiology, I will write the final report myself.";
const SEND_FOR_FINAL_READ_BTN_LABEL = 'Send for Final Read';
const SAVE_AS_FINAL_BTN_LABEL = 'Save as Final';
const FINAL_REPORT_TEXTBOX_LABEL = 'Final Read';
const FINAL_REPORT_REQUIRED_MESSAGE = 'Final report is required';
const SAVE_PRELIMINARY_REPORT_BTN_LABEL = 'Save Preliminary Report';
const PRELIMINARY_REPORT_TEXTBOX_LABEL = 'Preliminary Read';
const DIAGNOSIS_REQUIRED_MESSAGE = 'Please enter a diagnosis to continue';
const ADD_DX_BTN_LABEL = 'mock-add-dx';

// MUI Checkbox doesn't create an accessible <label>. The text sits in a sibling
// Typography element, so we find it by text then walk up to the flex container and
// query for the actual <input type="checkbox"> within it.
const getWriteFinalReportCheckbox = (): HTMLElement => {
  const label = screen.getByText(WRITE_FINAL_REPORT_CHECKBOX_LABEL);
  const checkbox = label.parentElement!.querySelector('input[type="checkbox"]');
  if (!checkbox) throw new Error('Could not find write-final-report checkbox');
  return checkbox as HTMLElement;
};

// By test id rather than accessible name: the section headings are display copy and get retitled.
const editField = (reportType: 'preliminary' | 'final'): HTMLElement =>
  within(screen.getByTestId(dataTestIds.radiologyPage.editReportInput(reportType))).getByRole('textbox');

const makeMockOrder = (
  overrides: Partial<GetRadiologyOrderListZambdaOrder> = {}
): GetRadiologyOrderListZambdaOrder => ({
  serviceRequestId: SERVICE_REQUEST_ID,
  appointmentId: 'appt-001',
  cptCodeDisplay: 'X-Ray Chest PA',
  studyType: 'X-Ray Chest PA',
  visitDateTime: '2024-12-20T09:00:00Z',
  orderAddedDateTime: '2024-12-20T10:00:00Z',
  providerName: 'Dr. Test',
  providerId: ORDERING_PROVIDER_ID,
  canEditFinalReport: false,
  diagnosis: 'Chest pain',
  status: RadiologyOrderStatus.preliminary,
  isStat: false,
  consentObtained: true,
  ...overrides,
});

const makeHookResult = (overrides = {}): ReturnType<typeof usePatientRadiologyOrders> => ({
  orders: [makeMockOrder()],
  loading: false,
  error: null,
  totalPages: 1,
  page: 1,
  setPage: vi.fn(),
  fetchOrders: vi.fn(),
  getCurrentSearchParams: vi.fn(),
  showPagination: false,
  deleteOrder: vi.fn(),
  showDeleteRadiologyOrderDialog: vi.fn(),
  DeleteOrderDialog: null,
  handleSaveReport: vi.fn(),
  handleUpdateReport: vi.fn().mockResolvedValue(true),
  handleSavePerformedBy: vi.fn().mockResolvedValue(true),
  handleSendForFinalRead: vi.fn(),
  isSavingReport: false,
  isSavingPerformedBy: false,
  isSendingForFinalRead: false,
  handleUpdateConsent: vi.fn(),
  isUpdatingConsent: false,
  ...overrides,
});

describe('RadiologyOrderDetailsPage - final report', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseParams.mockReturnValue({ serviceRequestID: SERVICE_REQUEST_ID, id: 'appt-001' } as any);
    mockUseNavigate.mockReturnValue(vi.fn());
    mockUseRadiologyConsentExists.mockReturnValue(false);
    mockUsePatientRadiologyOrders.mockReturnValue(makeHookResult());
    mockUseEvolveUser.mockReturnValue({
      userName: CURRENT_USER_NAME,
      profileResource: { resourceType: 'Practitioner', id: CURRENT_USER_ID },
    } as any);

    mockUseGetAppointmentAccessibility.mockReturnValue({
      isAppointmentReadOnly: false,
      isPractitionerLicensedInState: true,
      isEncounterAssignedToCurrentPractitioner: true,
      visitType: 'main',
    });
  });

  const renderPage = (): ReturnType<typeof render> =>
    render(
      <BrowserRouter>
        <RadiologyOrderDetailsPage />
      </BrowserRouter>
    );

  describe('preliminary status — default view', () => {
    it('shows the "write final report myself" checkbox text', () => {
      renderPage();
      expect(screen.getByText(WRITE_FINAL_REPORT_CHECKBOX_LABEL)).toBeInTheDocument();
    });

    it('checkbox is unchecked by default', () => {
      renderPage();
      expect(getWriteFinalReportCheckbox()).not.toBeChecked();
    });

    it('shows "Send for Final Read" button by default', () => {
      renderPage();
      expect(screen.getByRole('button', { name: SEND_FOR_FINAL_READ_BTN_LABEL })).toBeInTheDocument();
    });

    it('does not show the final report text field by default', () => {
      renderPage();
      expect(screen.queryByRole('textbox', { name: FINAL_REPORT_TEXTBOX_LABEL })).not.toBeInTheDocument();
    });

    it('does not show "Save as Final" button by default', () => {
      renderPage();
      expect(screen.queryByRole('button', { name: SAVE_AS_FINAL_BTN_LABEL })).not.toBeInTheDocument();
    });
  });

  describe('checking "write final report myself"', () => {
    it('reveals the final report text field when checked', async () => {
      const user = userEvent.setup();
      renderPage();

      await user.click(getWriteFinalReportCheckbox());

      expect(screen.getByRole('textbox', { name: FINAL_REPORT_TEXTBOX_LABEL })).toBeInTheDocument();
    });

    it('replaces "Send for Final Read" with "Save as Final" when checked', async () => {
      const user = userEvent.setup();
      renderPage();

      await user.click(getWriteFinalReportCheckbox());

      expect(screen.queryByRole('button', { name: SEND_FOR_FINAL_READ_BTN_LABEL })).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: SAVE_AS_FINAL_BTN_LABEL })).toBeInTheDocument();
    });

    it('hides the final report text field and restores "Send for Final Read" when unchecked', async () => {
      const user = userEvent.setup();
      renderPage();

      await user.click(getWriteFinalReportCheckbox());
      await user.click(getWriteFinalReportCheckbox());

      expect(screen.queryByRole('textbox', { name: FINAL_REPORT_TEXTBOX_LABEL })).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: SEND_FOR_FINAL_READ_BTN_LABEL })).toBeInTheDocument();
    });
  });

  describe('"Save as Final" action', () => {
    it('calls handleSaveReport with the typed report and "final" type', async () => {
      const user = userEvent.setup();
      const mockHandleSaveReport = vi.fn();
      mockUsePatientRadiologyOrders.mockReturnValue(makeHookResult({ handleSaveReport: mockHandleSaveReport }));

      renderPage();

      await user.click(getWriteFinalReportCheckbox());
      await user.type(screen.getByRole('textbox', { name: FINAL_REPORT_TEXTBOX_LABEL }), 'No acute findings');
      await user.click(screen.getByRole('button', { name: SAVE_AS_FINAL_BTN_LABEL }));

      expect(mockHandleSaveReport).toHaveBeenCalledWith(SERVICE_REQUEST_ID, 'No acute findings', 'final');
    });

    it('shows a validation error and does not call handleSaveReport when no text is entered', async () => {
      const user = userEvent.setup();
      const mockHandleSaveReport = vi.fn();
      mockUsePatientRadiologyOrders.mockReturnValue(makeHookResult({ handleSaveReport: mockHandleSaveReport }));

      renderPage();

      await user.click(getWriteFinalReportCheckbox());
      await user.click(screen.getByRole('button', { name: SAVE_AS_FINAL_BTN_LABEL }));

      expect(screen.getByText(FINAL_REPORT_REQUIRED_MESSAGE)).toBeInTheDocument();
      expect(mockHandleSaveReport).not.toHaveBeenCalled();
    });

    it('clears the validation error when the user starts typing in the text field', async () => {
      const user = userEvent.setup();
      renderPage();

      await user.click(getWriteFinalReportCheckbox());
      await user.click(screen.getByRole('button', { name: SAVE_AS_FINAL_BTN_LABEL }));

      expect(screen.getByText(FINAL_REPORT_REQUIRED_MESSAGE)).toBeInTheDocument();

      await user.type(screen.getByRole('textbox', { name: FINAL_REPORT_TEXTBOX_LABEL }), 'N');

      expect(screen.queryByText(FINAL_REPORT_REQUIRED_MESSAGE)).not.toBeInTheDocument();
    });
  });

  describe('"Send for Final Read" action', () => {
    it('calls handleSendForFinalRead with the serviceRequestId', async () => {
      const user = userEvent.setup();
      const mockHandleSendForFinalRead = vi.fn();
      mockUsePatientRadiologyOrders.mockReturnValue(
        makeHookResult({ handleSendForFinalRead: mockHandleSendForFinalRead })
      );

      renderPage();
      await user.click(screen.getByRole('button', { name: SEND_FOR_FINAL_READ_BTN_LABEL }));

      expect(mockHandleSendForFinalRead).toHaveBeenCalledWith(SERVICE_REQUEST_ID);
    });
  });

  describe('preliminary report — diagnosis (status "performed")', () => {
    const performedHookResult = (overrides = {}): ReturnType<typeof usePatientRadiologyOrders> =>
      makeHookResult({ orders: [makeMockOrder({ status: RadiologyOrderStatus.performed })], ...overrides });

    it('shows the diagnosis field and the Save Preliminary Report button', () => {
      mockUsePatientRadiologyOrders.mockReturnValue(performedHookResult());
      renderPage();

      expect(screen.getByTestId('report-dx-field')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: SAVE_PRELIMINARY_REPORT_BTN_LABEL })).toBeInTheDocument();
    });

    it('shows a validation error and does not call handleSaveReport when no diagnosis is selected', async () => {
      const user = userEvent.setup();
      const mockHandleSaveReport = vi.fn();
      mockUsePatientRadiologyOrders.mockReturnValue(performedHookResult({ handleSaveReport: mockHandleSaveReport }));

      renderPage();
      await user.click(screen.getByRole('button', { name: SAVE_PRELIMINARY_REPORT_BTN_LABEL }));

      expect(screen.getByText(DIAGNOSIS_REQUIRED_MESSAGE)).toBeInTheDocument();
      expect(mockHandleSaveReport).not.toHaveBeenCalled();
    });

    it('calls handleSaveReport with the report text and selected diagnosis codes', async () => {
      const user = userEvent.setup();
      const mockHandleSaveReport = vi.fn();
      mockUsePatientRadiologyOrders.mockReturnValue(performedHookResult({ handleSaveReport: mockHandleSaveReport }));

      renderPage();
      await user.click(screen.getByRole('button', { name: ADD_DX_BTN_LABEL }));
      await user.type(screen.getByRole('textbox', { name: PRELIMINARY_REPORT_TEXTBOX_LABEL }), 'Prelim findings');
      await user.click(screen.getByRole('button', { name: SAVE_PRELIMINARY_REPORT_BTN_LABEL }));

      await waitFor(() =>
        expect(mockHandleSaveReport).toHaveBeenCalledWith(
          SERVICE_REQUEST_ID,
          'Prelim findings',
          'preliminary',
          ['A00'],
          // The performer select defaults to the current user, so a save always carries one.
          CURRENT_USER_ID
        )
      );
    });

    it('writes the selected diagnosis to the encounter chart/Assessment before saving the read', async () => {
      const user = userEvent.setup();
      const mockHandleSaveReport = vi.fn();
      mockUsePatientRadiologyOrders.mockReturnValue(performedHookResult({ handleSaveReport: mockHandleSaveReport }));

      renderPage();
      await user.click(screen.getByRole('button', { name: ADD_DX_BTN_LABEL }));
      await user.type(screen.getByRole('textbox', { name: PRELIMINARY_REPORT_TEXTBOX_LABEL }), 'Prelim findings');
      await user.click(screen.getByRole('button', { name: SAVE_PRELIMINARY_REPORT_BTN_LABEL }));

      await waitFor(() =>
        expect(mockSaveChartData).toHaveBeenCalledWith(
          { diagnosis: [{ code: 'A00', display: 'Cholera', isPrimary: false }] },
          expect.objectContaining({ onSuccess: expect.any(Function), onError: expect.any(Function) })
        )
      );
      expect(mockHandleSaveReport).toHaveBeenCalled();
    });
    describe('"Performed by"', () => {
      const makePerformedOrder = (
        overrides: Partial<GetRadiologyOrderListZambdaOrder> = {}
      ): GetRadiologyOrderListZambdaOrder => makeMockOrder({ status: RadiologyOrderStatus.performed, ...overrides });

      const getPerformedBySelect = (): HTMLElement => screen.getByRole('combobox', { name: PERFORMED_BY_LABEL });

      it('defaults the select to the current user', () => {
        mockUsePatientRadiologyOrders.mockReturnValue(makeHookResult({ orders: [makePerformedOrder()] }));
        renderPage();

        expect(getPerformedBySelect()).toHaveTextContent(CURRENT_USER_NAME);
      });

      it('offers the current user and the ordering provider as options', async () => {
        const user = userEvent.setup();
        mockUsePatientRadiologyOrders.mockReturnValue(makeHookResult({ orders: [makePerformedOrder()] }));
        renderPage();

        await user.click(getPerformedBySelect());

        expect(screen.getByRole('option', { name: CURRENT_USER_NAME })).toBeInTheDocument();
        expect(screen.getByRole('option', { name: 'Dr. Test' })).toBeInTheDocument();
      });

      it('lists only the current user when they are also the ordering provider', async () => {
        const user = userEvent.setup();
        mockUsePatientRadiologyOrders.mockReturnValue(
          makeHookResult({ orders: [makePerformedOrder({ providerId: CURRENT_USER_ID, providerName: 'Dr. Current' })] })
        );
        renderPage();

        await user.click(getPerformedBySelect());

        expect(screen.getAllByRole('option')).toHaveLength(1);
        expect(screen.getByRole('option', { name: CURRENT_USER_NAME })).toBeInTheDocument();
      });

      it('defaults to the performer already recorded on the order', () => {
        mockUsePatientRadiologyOrders.mockReturnValue(
          makeHookResult({
            orders: [makePerformedOrder({ performedBy: { id: ORDERING_PROVIDER_ID, name: 'Dr. Test' } })],
          })
        );
        renderPage();

        expect(getPerformedBySelect()).toHaveTextContent('Dr. Test');
      });

      // The "performed" row itself appears as soon as the PACS callback stamps the performed-on time; it is
      // the row's *performer* that stays blank, because that callback carries no practitioner we can resolve.
      // So recording the name must not require writing a read first.
      it('saves the performer on its own, without a preliminary read', async () => {
        const user = userEvent.setup();
        const mockHandleSavePerformedBy = vi.fn().mockResolvedValue(true);
        const mockHandleSaveReport = vi.fn();
        mockUsePatientRadiologyOrders.mockReturnValue(
          makeHookResult({
            orders: [makePerformedOrder()],
            handleSavePerformedBy: mockHandleSavePerformedBy,
            handleSaveReport: mockHandleSaveReport,
          })
        );
        renderPage();

        await user.click(screen.getByTestId(dataTestIds.radiologyPage.savePerformedByButton));

        expect(mockHandleSavePerformedBy).toHaveBeenCalledWith(SERVICE_REQUEST_ID, CURRENT_USER_ID);
        // No read was written, and no diagnosis was demanded, to record it.
        expect(mockHandleSaveReport).not.toHaveBeenCalled();
        expect(screen.queryByText(DIAGNOSIS_REQUIRED_MESSAGE)).not.toBeInTheDocument();
      });

      it('saves the performer the user picked rather than the default', async () => {
        const user = userEvent.setup();
        const mockHandleSavePerformedBy = vi.fn().mockResolvedValue(true);
        mockUsePatientRadiologyOrders.mockReturnValue(
          makeHookResult({ orders: [makePerformedOrder()], handleSavePerformedBy: mockHandleSavePerformedBy })
        );
        renderPage();

        await user.click(getPerformedBySelect());
        await user.click(screen.getByRole('option', { name: 'Dr. Test' }));
        await user.click(screen.getByTestId(dataTestIds.radiologyPage.savePerformedByButton));

        expect(mockHandleSavePerformedBy).toHaveBeenCalledWith(SERVICE_REQUEST_ID, ORDERING_PROVIDER_ID);
      });

      it('is not offered while the progress note is locked', () => {
        mockUseGetAppointmentAccessibility.mockReturnValue({
          isAppointmentReadOnly: true,
          isPractitionerLicensedInState: true,
          isEncounterAssignedToCurrentPractitioner: true,
          visitType: 'main',
        } as any);
        mockUsePatientRadiologyOrders.mockReturnValue(makeHookResult({ orders: [makePerformedOrder()] }));
        renderPage();

        expect(screen.queryByRole('combobox', { name: PERFORMED_BY_LABEL })).not.toBeInTheDocument();
        expect(screen.queryByTestId(dataTestIds.radiologyPage.savePerformedByButton)).not.toBeInTheDocument();
      });

      it('passes the selected performer to handleSaveReport', async () => {
        const user = userEvent.setup();
        const mockHandleSaveReport = vi.fn();
        mockUsePatientRadiologyOrders.mockReturnValue(
          makeHookResult({ orders: [makePerformedOrder()], handleSaveReport: mockHandleSaveReport })
        );
        renderPage();

        await user.click(getPerformedBySelect());
        await user.click(screen.getByRole('option', { name: 'Dr. Test' }));
        // A diagnosis is required alongside the performer, otherwise the save is blocked.
        await user.click(screen.getByRole('button', { name: ADD_DX_BTN_LABEL }));
        await user.type(screen.getByRole('textbox', { name: PRELIMINARY_REPORT_TEXTBOX_LABEL }), 'No acute findings');
        await user.click(screen.getByRole('button', { name: 'Save Preliminary Report' }));

        await waitFor(() =>
          expect(mockHandleSaveReport).toHaveBeenCalledWith(
            SERVICE_REQUEST_ID,
            'No acute findings',
            'preliminary',
            ['A00'],
            ORDERING_PROVIDER_ID
          )
        );
      });

      it('defaults to the recorded performer even when the order arrives after the first render', async () => {
        mockUsePatientRadiologyOrders.mockReturnValue(makeHookResult({ orders: [], loading: true }));
        const { rerender } = renderPage();

        mockUsePatientRadiologyOrders.mockReturnValue(
          makeHookResult({
            orders: [makePerformedOrder({ performedBy: { id: ORDERING_PROVIDER_ID, name: 'Dr. Test' } })],
          })
        );
        rerender(
          <BrowserRouter>
            <RadiologyOrderDetailsPage />
          </BrowserRouter>
        );

        await waitFor(() => expect(getPerformedBySelect()).toHaveTextContent('Dr. Test'));
      });

      it('shows a validation error and does not save when no performer can be defaulted or selected', async () => {
        const user = userEvent.setup();
        const mockHandleSaveReport = vi.fn();
        // No profileResource and no ordering provider id => nothing to default to and nothing to pick.
        mockUseEvolveUser.mockReturnValue({ userName: CURRENT_USER_NAME } as any);
        mockUsePatientRadiologyOrders.mockReturnValue(
          makeHookResult({ orders: [makePerformedOrder({ providerId: '' })], handleSaveReport: mockHandleSaveReport })
        );
        renderPage();

        // The diagnosis is validated first, so it has to be filled in for the performer check to run.
        await user.click(screen.getByRole('button', { name: ADD_DX_BTN_LABEL }));
        await user.type(screen.getByRole('textbox', { name: PRELIMINARY_REPORT_TEXTBOX_LABEL }), 'No acute findings');
        await user.click(screen.getByRole('button', { name: 'Save Preliminary Report' }));

        expect(screen.getByText(PERFORMED_BY_REQUIRED_MESSAGE)).toBeInTheDocument();
        expect(mockHandleSaveReport).not.toHaveBeenCalled();
      });

      // Correctable on the same terms as the reads: any status the study has actually happened in, right up
      // until sign-off locks the order.
      it.each([RadiologyOrderStatus.preliminary, RadiologyOrderStatus.pendingFinal, RadiologyOrderStatus.final])(
        'stays editable for status "%s"',
        (status) => {
          mockUsePatientRadiologyOrders.mockReturnValue(
            makeHookResult({
              orders: [makeMockOrder({ status, performedBy: { id: CURRENT_USER_ID, name: CURRENT_USER_NAME } })],
            })
          );
          renderPage();

          expect(screen.getByRole('combobox', { name: PERFORMED_BY_LABEL })).toBeInTheDocument();
          expect(screen.getByTestId(dataTestIds.radiologyPage.savePerformedByButton)).toBeInTheDocument();
        }
      );

      it.each([RadiologyOrderStatus.reviewed, RadiologyOrderStatus.pending])(
        'shows the recorded performer read-only for status "%s"',
        (status) => {
          mockUsePatientRadiologyOrders.mockReturnValue(
            makeHookResult({
              orders: [makeMockOrder({ status, performedBy: { id: CURRENT_USER_ID, name: CURRENT_USER_NAME } })],
            })
          );
          renderPage();

          expect(screen.queryByRole('combobox', { name: PERFORMED_BY_LABEL })).not.toBeInTheDocument();
          expect(screen.getByTestId(dataTestIds.radiologyPage.performedByValue)).toBeInTheDocument();
          expect(screen.getByText(CURRENT_USER_NAME)).toBeInTheDocument();
        }
      );

      it('is not offered on an external order, which is performed elsewhere', () => {
        mockUsePatientRadiologyOrders.mockReturnValue(
          makeHookResult({
            orders: [makeMockOrder({ status: RadiologyOrderStatus.ordered, external: true })],
          })
        );
        renderPage();

        expect(screen.queryByRole('combobox', { name: PERFORMED_BY_LABEL })).not.toBeInTheDocument();
      });

      it('renders nothing when the order has no recorded performer and can no longer be edited', () => {
        mockUsePatientRadiologyOrders.mockReturnValue(
          makeHookResult({ orders: [makeMockOrder({ status: RadiologyOrderStatus.reviewed })] })
        );
        renderPage();

        expect(screen.queryByTestId(dataTestIds.radiologyPage.performedByValue)).not.toBeInTheDocument();
      });

      it('stays editable once a preliminary report exists', () => {
        mockUsePatientRadiologyOrders.mockReturnValue(
          makeHookResult({ orders: [makePerformedOrder({ preliminaryReport: btoa('Prelim') })] })
        );
        renderPage();

        expect(screen.getByRole('combobox', { name: PERFORMED_BY_LABEL })).toBeInTheDocument();
      });
    });

    describe('non-preliminary statuses', () => {
      it.each([
        RadiologyOrderStatus.pending,
        RadiologyOrderStatus.performed,
        RadiologyOrderStatus.pendingFinal,
        RadiologyOrderStatus.final,
        RadiologyOrderStatus.reviewed,
      ])('does not show the final report checkbox for status "%s"', (status) => {
        mockUsePatientRadiologyOrders.mockReturnValue(makeHookResult({ orders: [makeMockOrder({ status })] }));
        renderPage();
        expect(screen.queryByText(WRITE_FINAL_REPORT_CHECKBOX_LABEL)).not.toBeInTheDocument();
      });

      it.each([
        RadiologyOrderStatus.pending,
        RadiologyOrderStatus.performed,
        RadiologyOrderStatus.pendingFinal,
        RadiologyOrderStatus.final,
        RadiologyOrderStatus.reviewed,
      ])('does not show "Send for Final Read" or "Save as Final" for status "%s"', (status) => {
        mockUsePatientRadiologyOrders.mockReturnValue(makeHookResult({ orders: [makeMockOrder({ status })] }));
        renderPage();
        expect(screen.queryByRole('button', { name: SEND_FOR_FINAL_READ_BTN_LABEL })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: SAVE_AS_FINAL_BTN_LABEL })).not.toBeInTheDocument();
      });
    });

    describe('existing report display', () => {
      it('shows the decoded final report when the order already has one', () => {
        const reportText = 'Radiology final: no findings.';
        mockUsePatientRadiologyOrders.mockReturnValue(
          makeHookResult({
            orders: [makeMockOrder({ status: RadiologyOrderStatus.final, finalReport: btoa(reportText) })],
          })
        );
        renderPage();
        expect(screen.getByText(reportText)).toBeInTheDocument();
      });

      // A read is displayed as the radiologist sent it, so the radiologist's formatting has to survive — but
      // a final read comes from AdvaPACS, so nothing executable may come with it.
      it("keeps the radiologist's formatting", () => {
        mockUsePatientRadiologyOrders.mockReturnValue(
          makeHookResult({
            orders: [
              makeMockOrder({
                status: RadiologyOrderStatus.final,
                finalReport: btoa('<i>Subtle</i> lucency, <b>no</b> acute fracture'),
              }),
            ],
          })
        );
        const { container } = renderPage();

        expect(container.querySelector('i')?.textContent).toBe('Subtle');
        expect(container.querySelector('b')?.textContent).toBe('no');
      });

      it('drops anything executable a read may carry', () => {
        mockUsePatientRadiologyOrders.mockReturnValue(
          makeHookResult({
            orders: [
              makeMockOrder({
                status: RadiologyOrderStatus.final,
                finalReport: btoa(
                  'Impression: fracture<img src=x onerror="alert(1)"><script>alert(2)</script><a href="javascript:alert(3)">x</a>'
                ),
              }),
            ],
          })
        );
        const { container } = renderPage();

        // Scoped to what the report could have introduced — the page has its own `img` (the View Image icon)
        // and its own `a` (the consent link).
        expect(container.querySelector('img[src="x"]')).toBeNull();
        expect(container.querySelector('script')).toBeNull();
        expect(container.querySelector('a[href^="javascript:"]')).toBeNull();
        expect(screen.getByText(/Impression: fracture/)).toBeInTheDocument();
      });

      // The zambdas encode UTF-8; decoding a byte at a time would show (and then save back) mojibake.
      it('decodes non-ASCII characters in a read', async () => {
        const user = userEvent.setup();
        const reportText = 'Impression: 38.5° — no fracture, per Dr. Fauré';
        mockUsePatientRadiologyOrders.mockReturnValue(
          makeHookResult({
            orders: [makeMockOrder({ preliminaryReport: btoa(unescape(encodeURIComponent(reportText))) })],
          })
        );
        renderPage();

        expect(screen.getByText(reportText)).toBeInTheDocument();

        // And the edit field is seeded with the same text, so saving can't write the mangled form back.
        await user.click(screen.getByTestId(dataTestIds.radiologyPage.editReportButton('preliminary')));
        expect(editField('preliminary')).toHaveValue(reportText);
      });

      it('keeps the line breaks of a multi-line read', () => {
        mockUsePatientRadiologyOrders.mockReturnValue(
          makeHookResult({ orders: [makeMockOrder({ preliminaryReport: btoa('Line one<br>Line two') })] })
        );
        const { container } = renderPage();

        expect(container.querySelectorAll('br')).toHaveLength(1);
        expect(container.textContent).toContain('Line oneLine two');
      });

      it('shows the decoded preliminary report when the order already has one', () => {
        const reportText = 'Preliminary: suspected fracture.';
        mockUsePatientRadiologyOrders.mockReturnValue(
          makeHookResult({
            orders: [makeMockOrder({ preliminaryReport: btoa(reportText) })],
          })
        );
        renderPage();
        expect(screen.getByText(reportText)).toBeInTheDocument();
      });
    });

    describe('editing a saved read', () => {
      const PRELIM_TEXT = 'Preliminary: suspected fracture.';
      const FINAL_TEXT = 'Final: no acute findings.';

      const editPrelimButton = (): HTMLElement | null =>
        screen.queryByTestId(dataTestIds.radiologyPage.editReportButton('preliminary'));
      const editFinalButton = (): HTMLElement | null =>
        screen.queryByTestId(dataTestIds.radiologyPage.editReportButton('final'));

      // A final read the order list says this user may correct. Which callers earn that is the order list's
      // decision, covered in `radiology-order-list-final-read-editing.test.ts`; the page only obeys the flag.
      const ownFinalOrder = (
        overrides: Partial<GetRadiologyOrderListZambdaOrder> = {}
      ): GetRadiologyOrderListZambdaOrder =>
        makeMockOrder({
          status: RadiologyOrderStatus.final,
          finalReport: btoa(FINAL_TEXT),
          canEditFinalReport: true,
          providerId: CURRENT_USER_ID,
          ...overrides,
        });

      describe('preliminary read', () => {
        it.each([
          RadiologyOrderStatus.preliminary,
          RadiologyOrderStatus.pendingFinal,
          // Still correctable once the final read is back — it survives as its own report until sign-off.
          RadiologyOrderStatus.final,
        ])('offers the edit icon for status "%s"', (status) => {
          mockUsePatientRadiologyOrders.mockReturnValue(
            makeHookResult({ orders: [makeMockOrder({ status, preliminaryReport: btoa(PRELIM_TEXT) })] })
          );
          renderPage();
          expect(editPrelimButton()).toBeInTheDocument();
        });

        it('does not offer the edit icon once the order has been reviewed', () => {
          mockUsePatientRadiologyOrders.mockReturnValue(
            makeHookResult({
              orders: [makeMockOrder({ status: RadiologyOrderStatus.reviewed, preliminaryReport: btoa(PRELIM_TEXT) })],
            })
          );
          renderPage();
          expect(editPrelimButton()).not.toBeInTheDocument();
        });

        it('does not offer the edit icon when the progress note is locked', () => {
          mockUseGetAppointmentAccessibility.mockReturnValue({
            isAppointmentReadOnly: true,
            isPractitionerLicensedInState: true,
            isEncounterAssignedToCurrentPractitioner: true,
            visitType: 'main',
          } as any);
          mockUsePatientRadiologyOrders.mockReturnValue(
            makeHookResult({ orders: [makeMockOrder({ preliminaryReport: btoa(PRELIM_TEXT) })] })
          );
          renderPage();
          expect(editPrelimButton()).not.toBeInTheDocument();
        });

        it('opens a field seeded with the saved read, with <br> back as newlines', async () => {
          const user = userEvent.setup();
          mockUsePatientRadiologyOrders.mockReturnValue(
            makeHookResult({ orders: [makeMockOrder({ preliminaryReport: btoa('Line one<br>Line two') })] })
          );
          renderPage();

          await user.click(editPrelimButton()!);

          expect(screen.getByTestId(dataTestIds.radiologyPage.editReportInput('preliminary'))).toBeInTheDocument();
          expect(editField('preliminary')).toHaveValue('Line one\nLine two');
        });

        it('saves the edited text and closes the field', async () => {
          const user = userEvent.setup();
          const mockHandleUpdateReport = vi.fn().mockResolvedValue(true);
          mockUsePatientRadiologyOrders.mockReturnValue(
            makeHookResult({
              orders: [makeMockOrder({ preliminaryReport: btoa(PRELIM_TEXT) })],
              handleUpdateReport: mockHandleUpdateReport,
            })
          );
          renderPage();

          await user.click(editPrelimButton()!);
          const field = editField('preliminary');
          await user.clear(field);
          await user.type(field, 'Corrected read');
          await user.click(screen.getByTestId(dataTestIds.radiologyPage.saveEditedReportButton('preliminary')));

          expect(mockHandleUpdateReport).toHaveBeenCalledWith(SERVICE_REQUEST_ID, 'Corrected read', 'preliminary');
          await waitFor(() =>
            expect(
              screen.queryByTestId(dataTestIds.radiologyPage.editReportInput('preliminary'))
            ).not.toBeInTheDocument()
          );
        });

        it('keeps the field open when the save fails', async () => {
          const user = userEvent.setup();
          mockUsePatientRadiologyOrders.mockReturnValue(
            makeHookResult({
              orders: [makeMockOrder({ preliminaryReport: btoa(PRELIM_TEXT) })],
              handleUpdateReport: vi.fn().mockResolvedValue(false),
            })
          );
          renderPage();

          await user.click(editPrelimButton()!);
          // Saving is only offered once the text differs from what is stored.
          await user.type(editField('preliminary'), ' corrected');
          await user.click(screen.getByTestId(dataTestIds.radiologyPage.saveEditedReportButton('preliminary')));

          await waitFor(() =>
            expect(screen.getByTestId(dataTestIds.radiologyPage.editReportInput('preliminary'))).toBeInTheDocument()
          );
        });

        it('abandons the edit on Escape, leaving the saved read untouched', async () => {
          const user = userEvent.setup();
          const mockHandleUpdateReport = vi.fn();
          mockUsePatientRadiologyOrders.mockReturnValue(
            makeHookResult({
              orders: [makeMockOrder({ preliminaryReport: btoa(PRELIM_TEXT) })],
              handleUpdateReport: mockHandleUpdateReport,
            })
          );
          renderPage();

          await user.click(editPrelimButton()!);
          await user.type(editField('preliminary'), ' and more{Escape}');

          expect(mockHandleUpdateReport).not.toHaveBeenCalled();
          expect(screen.getByText(PRELIM_TEXT)).toBeInTheDocument();
        });
      });

      describe('final read', () => {
        it('offers the edit icon when the order says this user may correct the read', () => {
          mockUsePatientRadiologyOrders.mockReturnValue(makeHookResult({ orders: [ownFinalOrder()] }));
          renderPage();
          expect(editFinalButton()).toBeInTheDocument();
        });

        it('does not offer it when the order says otherwise', () => {
          mockUsePatientRadiologyOrders.mockReturnValue(
            makeHookResult({ orders: [ownFinalOrder({ canEditFinalReport: false })] })
          );
          renderPage();
          expect(editFinalButton()).not.toBeInTheDocument();
        });

        it('saves the edited text as a final read', async () => {
          const user = userEvent.setup();
          const mockHandleUpdateReport = vi.fn().mockResolvedValue(true);
          mockUsePatientRadiologyOrders.mockReturnValue(
            makeHookResult({ orders: [ownFinalOrder()], handleUpdateReport: mockHandleUpdateReport })
          );
          renderPage();

          await user.click(editFinalButton()!);
          const field = editField('final');
          await user.clear(field);
          await user.type(field, 'Corrected final');
          await user.click(screen.getByTestId(dataTestIds.radiologyPage.saveEditedReportButton('final')));

          expect(mockHandleUpdateReport).toHaveBeenCalledWith(SERVICE_REQUEST_ID, 'Corrected final', 'final');
        });
      });

      describe('with both reads open at once', () => {
        const orderWithBothReads = (): GetRadiologyOrderListZambdaOrder =>
          ownFinalOrder({ preliminaryReport: btoa(PRELIM_TEXT) });

        it('saves only the read whose checkmark was clicked', async () => {
          const user = userEvent.setup();
          const mockHandleUpdateReport = vi.fn().mockResolvedValue(true);
          mockUsePatientRadiologyOrders.mockReturnValue(
            makeHookResult({ orders: [orderWithBothReads()], handleUpdateReport: mockHandleUpdateReport })
          );
          renderPage();

          await user.click(editPrelimButton()!);
          await user.type(editField('preliminary'), ' edited prelim');
          await user.click(editFinalButton()!);
          await user.type(editField('final'), ' edited final');

          await user.click(screen.getByTestId(dataTestIds.radiologyPage.saveEditedReportButton('preliminary')));

          expect(mockHandleUpdateReport).toHaveBeenCalledTimes(1);
          expect(mockHandleUpdateReport).toHaveBeenCalledWith(
            SERVICE_REQUEST_ID,
            `${PRELIM_TEXT} edited prelim`,
            'preliminary'
          );
        });

        // Saving refetches the order, and the hook reports `loading` during that reload. The card must stay
        // mounted through it, or the other read's unsaved draft goes with it.
        it('keeps an open edit through the reload that follows a save', async () => {
          const user = userEvent.setup();
          mockUsePatientRadiologyOrders.mockReturnValue(makeHookResult({ orders: [orderWithBothReads()] }));
          const { rerender } = renderPage();

          await user.click(editFinalButton()!);
          await user.type(editField('final'), ' edited final');

          mockUsePatientRadiologyOrders.mockReturnValue(
            makeHookResult({ orders: [orderWithBothReads()], loading: true })
          );
          rerender(
            <BrowserRouter>
              <RadiologyOrderDetailsPage />
            </BrowserRouter>
          );

          expect(editField('final')).toHaveValue(`${FINAL_TEXT} edited final`);
        });

        it('leaves the other read open and untouched while one saves', async () => {
          const user = userEvent.setup();
          mockUsePatientRadiologyOrders.mockReturnValue(
            makeHookResult({ orders: [orderWithBothReads()], handleUpdateReport: vi.fn().mockResolvedValue(true) })
          );
          renderPage();

          await user.click(editPrelimButton()!);
          await user.click(editFinalButton()!);
          await user.type(editField('final'), ' edited final');
          await user.click(screen.getByTestId(dataTestIds.radiologyPage.saveEditedReportButton('final')));

          // The preliminary field is still open, still holding what it held.
          await waitFor(() => expect(editField('preliminary')).toHaveValue(PRELIM_TEXT));
        });
      });

      describe('saving an unchanged read', () => {
        it('keeps the checkmark disabled until the text actually changes', async () => {
          const user = userEvent.setup();
          mockUsePatientRadiologyOrders.mockReturnValue(
            makeHookResult({ orders: [makeMockOrder({ preliminaryReport: btoa(PRELIM_TEXT) })] })
          );
          renderPage();

          await user.click(editPrelimButton()!);
          const save = screen.getByTestId(dataTestIds.radiologyPage.saveEditedReportButton('preliminary'));
          expect(save).toBeDisabled();

          await user.type(editField('preliminary'), '!');
          expect(save).toBeEnabled();
        });
      });
    });

    describe('order details', () => {
      it('shows study type and laterality alongside the other order fields', () => {
        mockUsePatientRadiologyOrders.mockReturnValue(
          makeHookResult({
            orders: [makeMockOrder({ studyType: '73600 — Ankle, left, 2 views', laterality: 'LT' })],
          })
        );
        renderPage();

        // Scoped to the row: the study type also appears in the page title and breadcrumbs.
        const studyTypeRow = screen.getByText('Study Type:').closest('div')!;
        expect(within(studyTypeRow).getByText('73600 — Ankle, left, 2 views')).toBeInTheDocument();

        const lateralityRow = screen.getByText('Laterality:').closest('div')!;
        expect(within(lateralityRow).getByText('LT (left side)')).toBeInTheDocument();
      });
    });

    describe('marking as reviewed', () => {
      const reviewTask = (assignee?: {
        id: string;
        name: string;
        date: string;
      }): GetRadiologyOrderListZambdaOrder['task'] => ({
        id: 'task-1',
        category: 'radiology',
        createdDate: '2024-12-20T11:00:00Z',
        title: 'Review Radiology Final Results',
        subtitle: 'Ordered by Dr. Test',
        status: 'ready',
        completable: true,
        assignee,
      });

      const orderAwaitingReview = (
        overrides: Partial<GetRadiologyOrderListZambdaOrder> = {}
      ): GetRadiologyOrderListZambdaOrder =>
        makeMockOrder({
          status: RadiologyOrderStatus.final,
          finalReport: btoa('Final: no acute findings.'),
          task: reviewTask(),
          ...overrides,
        });

      it('offers the button on the order card once a final read is awaiting review', () => {
        mockUsePatientRadiologyOrders.mockReturnValue(makeHookResult({ orders: [orderAwaitingReview()] }));
        renderPage();

        expect(screen.getByTestId(dataTestIds.radiologyPage.markAsReviewedButton)).toBeInTheDocument();
      });

      it('does not offer it when there is no review task', () => {
        mockUsePatientRadiologyOrders.mockReturnValue(
          makeHookResult({ orders: [orderAwaitingReview({ task: undefined })] })
        );
        renderPage();

        expect(screen.queryByTestId(dataTestIds.radiologyPage.markAsReviewedButton)).not.toBeInTheDocument();
      });

      // Teleradiology's review task arrives unassigned; signing off has to claim it, or the "reviewed"
      // history row would have nobody to credit.
      it('claims an unassigned task as it completes it, then refetches', async () => {
        const user = userEvent.setup();
        const mockFetchOrders = vi.fn();
        mockUsePatientRadiologyOrders.mockReturnValue(
          makeHookResult({ orders: [orderAwaitingReview()], fetchOrders: mockFetchOrders })
        );
        renderPage();

        await user.click(screen.getByTestId(dataTestIds.radiologyPage.markAsReviewedButton));

        expect(mockCompleteTask).toHaveBeenCalledWith(
          expect.objectContaining({
            taskId: 'task-1',
            owner: expect.objectContaining({ reference: `Practitioner/${CURRENT_USER_ID}` }),
          })
        );
        await waitFor(() => expect(mockFetchOrders).toHaveBeenCalledWith({ serviceRequestId: SERVICE_REQUEST_ID }));
      });

      // The task is assigned when the final read is *written*, so its owner dates the write, not the review.
      // Signing off has to restamp it, or the "reviewed" history row shows the wrong person and time.
      it('records the signer as reviewer even when the task was assigned to someone else', async () => {
        const user = userEvent.setup();
        mockUsePatientRadiologyOrders.mockReturnValue(
          makeHookResult({
            orders: [
              orderAwaitingReview({
                task: reviewTask({ id: ORDERING_PROVIDER_ID, name: 'Dr. Test', date: '2024-12-20T11:00:00Z' }),
              }),
            ],
          })
        );
        renderPage();

        await user.click(screen.getByTestId(dataTestIds.radiologyPage.markAsReviewedButton));

        expect(mockCompleteTask).toHaveBeenCalledWith(
          expect.objectContaining({
            taskId: 'task-1',
            owner: expect.objectContaining({ reference: `Practitioner/${CURRENT_USER_ID}` }),
          })
        );
        const { owner } = mockCompleteTask.mock.calls[0][0];
        expect(owner.extension[0].valueDateTime).not.toBe('2024-12-20T11:00:00Z');
      });

      it('refuses to sign off when the current user has no practitioner profile', async () => {
        const user = userEvent.setup();
        mockUseEvolveUser.mockReturnValue({ userName: CURRENT_USER_NAME, profileResource: undefined } as any);
        mockUsePatientRadiologyOrders.mockReturnValue(makeHookResult({ orders: [orderAwaitingReview()] }));
        renderPage();

        await user.click(screen.getByTestId(dataTestIds.radiologyPage.markAsReviewedButton));

        // Better to refuse than to write `Practitioner/undefined` as the reviewer.
        expect(mockCompleteTask).not.toHaveBeenCalled();
        expect(mockEnqueueSnackbar).toHaveBeenCalledWith(expect.stringContaining('Could not identify you'), {
          variant: 'error',
        });
      });
    });
  });
});
