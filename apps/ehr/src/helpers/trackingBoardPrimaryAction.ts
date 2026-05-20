import { dataTestIds } from 'src/constants/data-test-ids';
import { VisitStatusLabel, VisitStatusWithoutUnknown } from 'utils';

export interface TrackingBoardPrimaryAction {
  dataTestId: string;
  label: string;
  missingUserMessage: string;
  navigateToChart?: boolean;
  successMessage?: string;
  updatedStatus: VisitStatusWithoutUnknown;
}

type ActionableVisitStatus = 'arrived' | 'ready' | 'intake' | 'ready for provider' | 'provider';

const trackingBoardPrimaryActions = {
  arrived: {
    dataTestId: dataTestIds.dashboard.readyButton,
    label: 'Ready',
    missingUserMessage: 'User is not available. Cannot mark patient as ready.',
    successMessage: 'Patient marked ready',
    updatedStatus: 'ready',
  },
  ready: {
    dataTestId: dataTestIds.dashboard.intakeButton,
    label: 'Start Intake',
    missingUserMessage: 'User is not available. Cannot start intake.',
    navigateToChart: true,
    updatedStatus: 'intake',
  },
  intake: {
    dataTestId: dataTestIds.dashboard.completeIntakeButton,
    label: 'Complete Intake',
    missingUserMessage: 'User is not available. Cannot complete intake.',
    successMessage: 'Intake completed',
    updatedStatus: 'ready for provider',
  },
  'ready for provider': {
    dataTestId: dataTestIds.dashboard.startProviderButton,
    label: 'Start Provider',
    missingUserMessage: 'User is not available. Cannot start provider visit.',
    successMessage: 'Provider visit started',
    updatedStatus: 'provider',
  },
  provider: {
    dataTestId: dataTestIds.dashboard.dischargeButton,
    label: 'Discharge',
    missingUserMessage: 'User is not available. Cannot discharge patient.',
    successMessage: 'Patient discharged successfully',
    updatedStatus: 'discharged',
  },
} satisfies Record<ActionableVisitStatus, TrackingBoardPrimaryAction>;

export const getTrackingBoardPrimaryAction = (status: VisitStatusLabel): TrackingBoardPrimaryAction | undefined =>
  status in trackingBoardPrimaryActions ? trackingBoardPrimaryActions[status as ActionableVisitStatus] : undefined;
