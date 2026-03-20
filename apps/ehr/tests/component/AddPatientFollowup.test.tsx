import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReactNode } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AddPatientFollowup from '../../src/features/visits/shared/components/patient/AddPatientFollowup';

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useParams: vi.fn().mockReturnValue({ id: 'test-patient-123' }),
    useNavigate: vi.fn().mockReturnValue(vi.fn()),
    useLocation: vi.fn().mockReturnValue({ state: null, pathname: '', search: '', hash: '', key: '' }),
  };
});

vi.mock('../../src/hooks/useGetPatient', () => ({
  useGetPatient: () => ({
    patient: {
      resourceType: 'Patient',
      id: 'test-patient-123',
      name: [{ given: ['Test'], family: 'Patient' }],
      birthDate: '1990-01-01',
      gender: 'male',
    },
  }),
}));

// Mock the child form components to avoid deep dependency issues
vi.mock('../../src/features/visits/shared/components/patient/PatientFollowupForm', () => ({
  default: () => <div data-testid="annotation-form">Annotation Form</div>,
}));

vi.mock('../../src/features/visits/shared/components/patient/ScheduledFollowupParentSelector', () => ({
  default: () => <div data-testid="scheduled-form">Scheduled Form</div>,
}));

vi.mock('../../src/layout/PageContainer', () => ({
  default: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock('../../src/components/CustomBreadcrumbs', () => ({
  default: () => <div data-testid="breadcrumbs">Breadcrumbs</div>,
}));

describe('AddPatientFollowup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the page title', () => {
    render(
      <BrowserRouter>
        <AddPatientFollowup />
      </BrowserRouter>
    );
    expect(screen.getByText('Add Follow-up Visit')).toBeVisible();
  });

  it('renders Annotation and Scheduled Visit radio buttons', () => {
    render(
      <BrowserRouter>
        <AddPatientFollowup />
      </BrowserRouter>
    );
    expect(screen.getByLabelText('Annotation')).toBeInTheDocument();
    expect(screen.getByLabelText('Scheduled Visit')).toBeInTheDocument();
    // Labels should be visible even though the radio input itself is visually hidden by MUI
    expect(screen.getByText('Annotation')).toBeVisible();
    expect(screen.getByText('Scheduled Visit')).toBeVisible();
  });

  it('defaults to Annotation mode and shows annotation form', () => {
    render(
      <BrowserRouter>
        <AddPatientFollowup />
      </BrowserRouter>
    );
    expect(screen.getByLabelText('Annotation')).toBeChecked();
    expect(screen.getByTestId('annotation-form')).toBeVisible();
    expect(screen.queryByTestId('scheduled-form')).not.toBeInTheDocument();
  });

  it('switches to Scheduled form when Scheduled Visit is selected', async () => {
    const user = userEvent.setup();
    render(
      <BrowserRouter>
        <AddPatientFollowup />
      </BrowserRouter>
    );

    await user.click(screen.getByLabelText('Scheduled Visit'));

    expect(screen.getByTestId('scheduled-form')).toBeVisible();
    expect(screen.queryByTestId('annotation-form')).not.toBeInTheDocument();
  });

  it('switches back to Annotation form when Annotation is re-selected', async () => {
    const user = userEvent.setup();
    render(
      <BrowserRouter>
        <AddPatientFollowup />
      </BrowserRouter>
    );

    await user.click(screen.getByLabelText('Scheduled Visit'));
    expect(screen.getByTestId('scheduled-form')).toBeVisible();

    await user.click(screen.getByLabelText('Annotation'));
    expect(screen.getByTestId('annotation-form')).toBeVisible();
    expect(screen.queryByTestId('scheduled-form')).not.toBeInTheDocument();
  });

  it('renders breadcrumbs', () => {
    render(
      <BrowserRouter>
        <AddPatientFollowup />
      </BrowserRouter>
    );
    expect(screen.getByTestId('breadcrumbs')).toBeVisible();
  });
});
