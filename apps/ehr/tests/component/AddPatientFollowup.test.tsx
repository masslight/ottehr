import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Patient } from 'fhir/r4b';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AddPatientFollowup from '../../src/features/visits/shared/components/patient/AddPatientFollowup';

let locationState: unknown = undefined;

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useParams: () => ({ id: 'pat-1' }),
    useLocation: () => ({ state: locationState }),
  };
});

const patient: Patient = {
  resourceType: 'Patient',
  id: 'pat-1',
  name: [{ given: ['Test'], family: 'Patient' }],
};

vi.mock('../../src/hooks/useGetPatient', () => ({
  useGetPatient: () => ({ patient, person: undefined }),
}));

vi.mock('../../src/layout/PageContainer', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('../../src/components/CustomBreadcrumbs', () => ({
  default: () => <nav data-testid="breadcrumbs" />,
}));

vi.mock('../../src/features/visits/shared/components/patient/PatientFollowupForm', () => ({
  default: () => <div data-testid="annotation-form" />,
}));

vi.mock('../../src/features/visits/shared/components/patient/ScheduledFollowupParentSelector', () => ({
  default: ({ convertFrom }: { convertFrom?: { encounterId: string } }) => (
    <div data-testid="scheduled-selector" data-convert-from={convertFrom?.encounterId ?? ''} />
  ),
}));

describe('AddPatientFollowup', () => {
  beforeEach(() => {
    locationState = undefined;
  });

  describe('creating a new follow-up', () => {
    it('starts on the annotation branch with both subtypes selectable', () => {
      render(<AddPatientFollowup />);

      expect(screen.getByText('Add Follow-up Visit')).toBeVisible();
      expect(screen.getByRole('radio', { name: 'Annotation' })).toBeEnabled();
      expect(screen.getByRole('radio', { name: 'Annotation' })).toBeChecked();
      expect(screen.getByTestId('annotation-form')).toBeInTheDocument();
    });

    it('switches to the scheduled branch when picked', async () => {
      const user = userEvent.setup();
      render(<AddPatientFollowup />);

      await user.click(screen.getByRole('radio', { name: 'Scheduled Visit' }));

      expect(screen.getByTestId('scheduled-selector')).toBeInTheDocument();
      expect(screen.queryByTestId('annotation-form')).not.toBeInTheDocument();
    });
  });

  describe('converting an existing visit', () => {
    beforeEach(() => {
      locationState = { convertFrom: { appointmentId: 'appt-9', encounterId: 'enc-target' } };
    });

    it('forces the scheduled branch and disables the annotation option', () => {
      render(<AddPatientFollowup />);

      expect(screen.getByText('Convert to Follow-up Visit')).toBeVisible();
      // Only scheduled follow-ups can be converted to, so annotation is closed off entirely.
      expect(screen.getByRole('radio', { name: 'Annotation' })).toBeDisabled();
      expect(screen.getByRole('radio', { name: 'Scheduled Visit' })).toBeChecked();
      expect(screen.getByTestId('scheduled-selector')).toBeInTheDocument();
      expect(screen.queryByTestId('annotation-form')).not.toBeInTheDocument();
    });

    it('cannot be switched onto the annotation branch by clicking', async () => {
      // The disabled radio sets pointer-events: none, so a real click can't land at all; skip
      // that guard to prove a forced click still doesn't flip the branch.
      const user = userEvent.setup({ pointerEventsCheck: 0 });
      render(<AddPatientFollowup />);

      await user.click(screen.getByRole('radio', { name: 'Annotation' }));

      expect(screen.getByTestId('scheduled-selector')).toBeInTheDocument();
      expect(screen.queryByTestId('annotation-form')).not.toBeInTheDocument();
    });

    it('hands the visit being converted to the scheduled selector', () => {
      render(<AddPatientFollowup />);
      expect(screen.getByTestId('scheduled-selector')).toHaveAttribute('data-convert-from', 'enc-target');
    });
  });
});
