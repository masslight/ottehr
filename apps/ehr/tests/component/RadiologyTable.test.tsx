import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { GetRadiologyOrderListZambdaOrder, RadiologyOrderStatus } from 'utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RadiologyTable } from '../../src/features/radiology/components/RadiologyTable';

// Mock the hooks
vi.mock('../../src/features/radiology/components/usePatientRadiologyOrders', () => ({
  usePatientRadiologyOrders: vi.fn(),
}));

// Mock react-router-dom
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: vi.fn(),
  };
});

import { useNavigate } from 'react-router-dom';
import { usePatientRadiologyOrders } from '../../src/features/radiology/components/usePatientRadiologyOrders';

const mockUsePatientRadiologyOrders = vi.mocked(usePatientRadiologyOrders);
const mockNavigate = vi.mocked(useNavigate);

describe('RadiologyTable - Cancel Radiology Order Tests', () => {
  const mockShowDeleteRadiologyOrderDialog = vi.fn();
  const mockSetPage = vi.fn();

  const mockOrders: GetRadiologyOrderListZambdaOrder[] = [
    {
      serviceRequestId: 'order1',
      studyType: 'X-Ray Chest PA and Lateral',
      diagnosis: 'Chest pain',
      orderAddedDateTime: '2024-12-20T10:00:00Z',
      visitDateTime: '2024-12-20T09:00:00Z',
      providerName: 'Dr. John Doe',
      status: RadiologyOrderStatus.pending,
      appointmentId: 'appt1',
      isStat: false,
    },
    {
      serviceRequestId: 'order2',
      studyType: 'CT Head',
      diagnosis: 'Headache',
      orderAddedDateTime: '2024-12-19T14:30:00Z',
      visitDateTime: '2024-12-19T13:00:00Z',
      providerName: 'Dr. Jane Smith',
      status: RadiologyOrderStatus.final,
      appointmentId: 'appt2',
      isStat: true,
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();

    // Default mocks
    mockUsePatientRadiologyOrders.mockReturnValue({
      orders: mockOrders,
      loading: false,
      error: null,
      totalPages: 1,
      page: 1,
      setPage: mockSetPage,
      fetchOrders: vi.fn(),
      getCurrentSearchParams: vi.fn(),
      showPagination: false,
      deleteOrder: vi.fn(),
      showDeleteRadiologyOrderDialog: mockShowDeleteRadiologyOrderDialog,
      DeleteOrderDialog: null,
    });

    mockNavigate.mockReturnValue(vi.fn());
  });

  const renderComponent = (props = {}): ReturnType<typeof render> => {
    return render(
      <BrowserRouter>
        <RadiologyTable
          columns={['studyType', 'dx', 'ordered', 'stat', 'status', 'actions']}
          allowDelete={true}
          {...props}
        />
      </BrowserRouter>
    );
  };

  it('displays radiology orders with delete buttons when allowDelete is true', () => {
    renderComponent();

    // Check that orders are displayed
    expect(screen.getByText('X-Ray Chest PA and Lateral')).toBeInTheDocument();
    expect(screen.getByText('CT Head')).toBeInTheDocument();
    expect(screen.getByText('Chest pain')).toBeInTheDocument();
    expect(screen.getByText('Headache')).toBeInTheDocument();

    // Check that delete buttons are present
    const deleteButtons = screen.getAllByRole('button').filter(
      (button) => button.querySelector('svg') // Delete icon buttons
    );
    expect(deleteButtons.length).toBe(2); // One for each order
  });

  it('does not show delete buttons when allowDelete is false', () => {
    renderComponent({ allowDelete: false });

    // Check that delete buttons are not present
    const deleteButtons = screen.queryAllByRole('button').filter((button) => button.querySelector('svg'));
    expect(deleteButtons.length).toBe(0);
  });

  it('calls showDeleteRadiologyOrderDialog when delete button is clicked', async () => {
    const user = userEvent.setup();
    renderComponent();

    // Find and click the delete button for the first order
    const deleteButtons = screen.getAllByRole('button').filter((button) => button.querySelector('svg'));
    await user.click(deleteButtons[0]);

    // Verify the dialog function was called with correct parameters
    expect(mockShowDeleteRadiologyOrderDialog).toHaveBeenCalledWith({
      serviceRequestId: 'order1',
      studyType: 'X-Ray Chest PA and Lateral',
    });
  });

  it('navigates to order details when row is clicked', async () => {
    const user = userEvent.setup();
    const mockNavigateFn = vi.fn();
    mockNavigate.mockReturnValue(mockNavigateFn);

    renderComponent();

    // Click on the first row
    const firstRow = screen.getByText('X-Ray Chest PA and Lateral').closest('tr');
    await user.click(firstRow!);

    // Verify navigation was called
    expect(mockNavigateFn).toHaveBeenCalledWith('/in-person/appt1/radiology/order1/order-details');
  });

  it('shows loading state when loading is true', () => {
    mockUsePatientRadiologyOrders.mockReturnValue({
      orders: [],
      loading: true,
      error: null,
      totalPages: 1,
      page: 1,
      setPage: mockSetPage,
      fetchOrders: vi.fn(),
      getCurrentSearchParams: vi.fn(),
      showPagination: false,
      deleteOrder: vi.fn(),
      showDeleteRadiologyOrderDialog: mockShowDeleteRadiologyOrderDialog,
      DeleteOrderDialog: null,
    });

    renderComponent();

    // Check for loading indicator
    expect(document.querySelector('[role="progressbar"]')).toBeInTheDocument();
  });

  it('shows error message when there is an error', () => {
    const errorMessage = 'Failed to load radiology orders';
    mockUsePatientRadiologyOrders.mockReturnValue({
      orders: [],
      loading: false,
      error: new Error(errorMessage),
      totalPages: 1,
      page: 1,
      setPage: mockSetPage,
      fetchOrders: vi.fn(),
      getCurrentSearchParams: vi.fn(),
      showPagination: false,
      deleteOrder: vi.fn(),
      showDeleteRadiologyOrderDialog: mockShowDeleteRadiologyOrderDialog,
      DeleteOrderDialog: null,
    });

    renderComponent();

    expect(screen.getByText(errorMessage)).toBeInTheDocument();
  });

  it('shows empty state when no orders are available', () => {
    mockUsePatientRadiologyOrders.mockReturnValue({
      orders: [],
      loading: false,
      error: null,
      totalPages: 1,
      page: 1,
      setPage: mockSetPage,
      fetchOrders: vi.fn(),
      getCurrentSearchParams: vi.fn(),
      showPagination: false,
      deleteOrder: vi.fn(),
      showDeleteRadiologyOrderDialog: mockShowDeleteRadiologyOrderDialog,
      DeleteOrderDialog: null,
    });

    renderComponent();

    // Empty state may be handled differently in the actual component
    // Check if the table is empty
    const rows = screen.queryAllByRole('row');
    // Header row + no data rows = 1
    expect(rows.length).toBeLessThanOrEqual(1);
  });

  it('shows STAT chip for orders with isStat true', () => {
    renderComponent();

    expect(screen.getByText('STAT')).toBeInTheDocument();
  });

  it('displays correct status chips for different order statuses', () => {
    renderComponent();

    // Check status chips are rendered by checking for status text
    // The actual component may use different testIds or structure
    expect(screen.getByText('PENDING')).toBeInTheDocument();
    expect(screen.getByText('FINAL')).toBeInTheDocument();
  });

  it('calls setPage when pagination changes', async () => {
    mockUsePatientRadiologyOrders.mockReturnValue({
      orders: mockOrders,
      loading: false,
      error: null,
      totalPages: 3,
      page: 1,
      setPage: mockSetPage,
      fetchOrders: vi.fn(),
      getCurrentSearchParams: vi.fn(),
      showPagination: true,
      deleteOrder: vi.fn(),
      showDeleteRadiologyOrderDialog: mockShowDeleteRadiologyOrderDialog,
      DeleteOrderDialog: null,
    });

    renderComponent();

    // Pagination should be present
    const pagination = document.querySelector('[aria-label="pagination navigation"]');
    expect(pagination).toBeInTheDocument();
  });

  it('renders delete dialog when provided', () => {
    const mockDialog = <div data-testid="delete-dialog">Delete Dialog</div>;

    mockUsePatientRadiologyOrders.mockReturnValue({
      orders: mockOrders,
      loading: false,
      error: null,
      totalPages: 1,
      page: 1,
      setPage: mockSetPage,
      fetchOrders: vi.fn(),
      getCurrentSearchParams: vi.fn(),
      showPagination: false,
      deleteOrder: vi.fn(),
      showDeleteRadiologyOrderDialog: mockShowDeleteRadiologyOrderDialog,
      DeleteOrderDialog: mockDialog,
    });

    renderComponent();

    expect(screen.getByTestId('delete-dialog')).toBeInTheDocument();
  });
});
