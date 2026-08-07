import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { GetRadiologyOrderListZambdaOrder, RadiologyOrderStatus } from 'utils';
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

vi.mock('src/api/api', () => ({
  radiologyLaunchViewer: vi.fn(),
}));

vi.mock('src/features/tasks/components/DetailTaskCard', () => ({
  DetailTaskCard: () => <div data-testid="detail-task-card" />,
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
const FINAL_REPORT_TEXTBOX_LABEL = 'Final Report';
const FINAL_REPORT_REQUIRED_MESSAGE = 'Final report is required';
const SAVE_PRELIMINARY_REPORT_BTN_LABEL = 'Save Preliminary Report';
const PRELIMINARY_REPORT_TEXTBOX_LABEL = 'Preliminary Report';
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
  handleSendForFinalRead: vi.fn(),
  isSavingReport: false,
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
        await user.type(screen.getByRole('textbox', { name: 'Preliminary Report' }), 'No acute findings');
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
        await user.type(screen.getByRole('textbox', { name: 'Preliminary Report' }), 'No acute findings');
        await user.click(screen.getByRole('button', { name: 'Save Preliminary Report' }));

        expect(screen.getByText(PERFORMED_BY_REQUIRED_MESSAGE)).toBeInTheDocument();
        expect(mockHandleSaveReport).not.toHaveBeenCalled();
      });

      it.each([
        RadiologyOrderStatus.preliminary,
        RadiologyOrderStatus.pendingFinal,
        RadiologyOrderStatus.final,
        RadiologyOrderStatus.reviewed,
      ])('shows the recorded performer read-only for status "%s"', (status) => {
        mockUsePatientRadiologyOrders.mockReturnValue(
          makeHookResult({
            orders: [makeMockOrder({ status, performedBy: { id: CURRENT_USER_ID, name: CURRENT_USER_NAME } })],
          })
        );
        renderPage();

        expect(screen.queryByRole('combobox', { name: PERFORMED_BY_LABEL })).not.toBeInTheDocument();
        expect(screen.getByText(PERFORMED_BY_LABEL)).toBeInTheDocument();
        expect(screen.getByText(CURRENT_USER_NAME)).toBeInTheDocument();
      });

      it('renders nothing when the order has no recorded performer and is past performed', () => {
        mockUsePatientRadiologyOrders.mockReturnValue(
          makeHookResult({ orders: [makeMockOrder({ status: RadiologyOrderStatus.final })] })
        );
        renderPage();

        expect(screen.queryByText(PERFORMED_BY_LABEL)).not.toBeInTheDocument();
      });

      it('is not editable once a preliminary report exists on a performed order', () => {
        mockUsePatientRadiologyOrders.mockReturnValue(
          makeHookResult({ orders: [makePerformedOrder({ preliminaryReport: btoa('Prelim') })] })
        );
        renderPage();

        expect(screen.queryByRole('combobox', { name: PERFORMED_BY_LABEL })).not.toBeInTheDocument();
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
  });
});
