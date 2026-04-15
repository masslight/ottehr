import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Patient } from 'fhir/r4b';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockGetFriendlyPatientId = vi.fn();

vi.mock('../../src/features/visits/shared/utils/friendly-patient-id.helper', () => ({
  getFriendlyPatientId: (...args: any[]) => mockGetFriendlyPatientId(...args),
}));

import { IdentifiersRow } from '../../src/features/visits/shared/components/patient/info/IdentifiersRow';

const createPatient = (id: string): Patient => ({
  resourceType: 'Patient',
  id,
});

describe('IdentifiersRow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('when patient has a friendly ID', () => {
    const patient = createPatient('abc-123-uuid');

    beforeEach(() => {
      mockGetFriendlyPatientId.mockReturnValue('42');
    });

    it('should display the friendly ID with PID prefix by default', () => {
      render(<IdentifiersRow patient={patient} />);

      const el = screen.getByTestId('header-patient-id');
      expect(el).toHaveTextContent('PID: 42');
    });

    it('should display the friendly ID without prefix when showPidPrefix is false', () => {
      render(<IdentifiersRow patient={patient} showPidPrefix={false} />);

      const el = screen.getByTestId('header-patient-id');
      expect(el).toHaveTextContent('42');
      expect(el).not.toHaveTextContent('PID:');
    });

    it('should render an info icon for the tooltip', () => {
      render(<IdentifiersRow patient={patient} />);

      expect(screen.getByTestId('InfoOutlinedIcon')).toBeInTheDocument();
    });

    it('should show both PID and UUID labels with their values in the tooltip on hover', async () => {
      const user = userEvent.setup();
      render(<IdentifiersRow patient={patient} />);

      await user.hover(screen.getByTestId('InfoOutlinedIcon'));

      const tooltip = await screen.findByRole('tooltip');
      expect(tooltip).toHaveTextContent('PID: 42');
      expect(tooltip).toHaveTextContent('UUID: abc-123-uuid');
    });

    it('should copy PID to clipboard when the first copy button in the tooltip is clicked', async () => {
      const user = userEvent.setup();
      const writeText = vi.fn().mockResolvedValue(undefined);
      Object.defineProperty(navigator, 'clipboard', { value: { writeText }, writable: true, configurable: true });

      render(<IdentifiersRow patient={patient} />);
      await user.hover(screen.getByTestId('InfoOutlinedIcon'));

      const copyIcons = await screen.findAllByTestId('ContentCopyIcon');
      await user.click(copyIcons[0].closest('button')!);

      expect(writeText).toHaveBeenCalledWith('42');
    });

    it('should copy UUID to clipboard when the second copy button in the tooltip is clicked', async () => {
      const user = userEvent.setup();
      const writeText = vi.fn().mockResolvedValue(undefined);
      Object.defineProperty(navigator, 'clipboard', { value: { writeText }, writable: true, configurable: true });

      render(<IdentifiersRow patient={patient} />);
      await user.hover(screen.getByTestId('InfoOutlinedIcon'));

      const copyIcons = await screen.findAllByTestId('ContentCopyIcon');
      await user.click(copyIcons[1].closest('button')!);

      expect(writeText).toHaveBeenCalledWith('abc-123-uuid');
    });
  });

  describe('when patient has no friendly ID', () => {
    const patient = createPatient('abc-123-uuid');

    beforeEach(() => {
      mockGetFriendlyPatientId.mockReturnValue('');
    });

    it('should display the patient UUID with PID prefix by default', () => {
      render(<IdentifiersRow patient={patient} />);

      const el = screen.getByTestId('header-patient-id');
      expect(el).toHaveTextContent('PID: abc-123-uuid');
    });

    it('should display the patient UUID without prefix when showPidPrefix is false', () => {
      render(<IdentifiersRow patient={patient} showPidPrefix={false} />);

      const el = screen.getByTestId('header-patient-id');
      expect(el).toHaveTextContent('abc-123-uuid');
      expect(el).not.toHaveTextContent('PID:');
    });

    it('should not render the info icon tooltip', () => {
      render(<IdentifiersRow patient={patient} />);

      expect(screen.queryByTestId('InfoOutlinedIcon')).not.toBeInTheDocument();
    });

    it('should copy patient UUID to clipboard when the copy button is clicked', async () => {
      const user = userEvent.setup();
      const writeText = vi.fn().mockResolvedValue(undefined);
      Object.defineProperty(navigator, 'clipboard', { value: { writeText }, writable: true, configurable: true });

      render(<IdentifiersRow patient={patient} />);

      const copyIcon = screen.getByTestId('ContentCopyIcon');
      await user.click(copyIcon.closest('button')!);

      expect(writeText).toHaveBeenCalledWith('abc-123-uuid');
    });
  });

  describe('when patient is undefined', () => {
    beforeEach(() => {
      mockGetFriendlyPatientId.mockReturnValue('');
    });

    it('should display empty PID prefix when no patient and no friendly ID', () => {
      render(<IdentifiersRow patient={undefined} />);

      // getFriendlyPatientId is not called because patient is undefined
      // The component renders the no-friendlyId branch with patient?.id ?? ''
      // which is ''
      const el = screen.getByTestId('header-patient-id');
      expect(el).toHaveTextContent('PID:');
    });
  });

  describe('when loading', () => {
    it('should render a skeleton when loading is true', () => {
      const { container } = render(<IdentifiersRow loading />);

      // MUI Skeleton renders with a specific class
      const skeleton = container.querySelector('.MuiSkeleton-root');
      expect(skeleton).toBeInTheDocument();
    });

    it('should not render the patient ID when loading', () => {
      render(<IdentifiersRow loading />);

      expect(screen.queryByTestId('header-patient-id')).not.toBeInTheDocument();
    });
  });
});
