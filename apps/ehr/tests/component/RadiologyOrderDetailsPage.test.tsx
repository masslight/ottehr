import { render, screen } from '@testing-library/react';
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

vi.mock('src/themes/ottehr/icons/mui-radiology.svg', () => ({
  default: 'radiology-icon.svg',
}));

vi.mock('../../src/features/visits/shared/components/PageTitle', () => ({
  PageTitleStyled: ({ children }: any) => <h1>{children}</h1>,
  PageTitle: ({ label, dataTestId }: any) => <h1 data-testid={dataTestId}>{label}</h1>,
}));

import { useNavigate, useParams } from 'react-router-dom';
import { usePatientRadiologyOrders } from '../../src/features/radiology/components/usePatientRadiologyOrders';
import { useRadiologyConsentExists } from '../../src/features/radiology/components/useRadiologyConsentExists';
import { RadiologyOrderDetailsPage } from '../../src/features/radiology/pages/RadiologyOrderDetails';

const mockUsePatientRadiologyOrders = vi.mocked(usePatientRadiologyOrders);
const mockUseRadiologyConsentExists = vi.mocked(useRadiologyConsentExists);
const mockUseNavigate = vi.mocked(useNavigate);
const mockUseParams = vi.mocked(useParams);

const SERVICE_REQUEST_ID = 'sr-001';
const WRITE_FINAL_REPORT_CHECKBOX_LABEL = "Don't send to teleradiology, I will write the final report myself";
const SEND_FOR_FINAL_READ_BTN_LABEL = 'Send for Final Read';
const SAVE_AS_FINAL_BTN_LABEL = 'Save as Final';
const FINAL_REPORT_TEXTBOX_LABEL = 'Final Report';
const FINAL_REPORT_REQUIRED_MESSAGE = 'Final report is required';

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
  studyType: 'X-Ray Chest PA',
  visitDateTime: '2024-12-20T09:00:00Z',
  orderAddedDateTime: '2024-12-20T10:00:00Z',
  providerName: 'Dr. Test',
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
  ...overrides,
});

describe('RadiologyOrderDetailsPage - final report', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseParams.mockReturnValue({ serviceRequestID: SERVICE_REQUEST_ID, id: 'appt-001' } as any);
    mockUseNavigate.mockReturnValue(vi.fn());
    mockUseRadiologyConsentExists.mockReturnValue(false);
    mockUsePatientRadiologyOrders.mockReturnValue(makeHookResult());
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
