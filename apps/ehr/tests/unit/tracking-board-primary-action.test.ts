import { visitStatusArray, VisitStatusLabel } from 'utils';
import { describe, expect, test } from 'vitest';
import { dataTestIds } from '../../src/constants/data-test-ids';
import { getTrackingBoardPrimaryAction } from '../../src/helpers/trackingBoardPrimaryAction';

const actionableStatuses = new Set<VisitStatusLabel>(['arrived', 'ready', 'intake', 'ready for provider', 'provider']);
const nonActionableStatuses = visitStatusArray.filter((status) => !actionableStatuses.has(status));

describe('getTrackingBoardPrimaryAction', () => {
  test.each([
    [
      'arrived',
      {
        dataTestId: dataTestIds.dashboard.readyButton,
        label: 'Ready',
        missingUserMessage: 'User is not available. Cannot mark patient as ready.',
        successMessage: 'Patient marked ready',
        updatedStatus: 'ready',
      },
    ],
    [
      'ready',
      {
        dataTestId: dataTestIds.dashboard.intakeButton,
        label: 'Start Intake',
        missingUserMessage: 'User is not available. Cannot start intake.',
        navigateToChart: true,
        updatedStatus: 'intake',
      },
    ],
    [
      'intake',
      {
        dataTestId: dataTestIds.dashboard.completeIntakeButton,
        label: 'Complete Intake',
        missingUserMessage: 'User is not available. Cannot complete intake.',
        successMessage: 'Intake completed',
        updatedStatus: 'ready for provider',
      },
    ],
    [
      'ready for provider',
      {
        dataTestId: dataTestIds.dashboard.startProviderButton,
        label: 'Start Provider',
        missingUserMessage: 'User is not available. Cannot start provider visit.',
        successMessage: 'Provider visit started',
        updatedStatus: 'provider',
      },
    ],
    [
      'provider',
      {
        dataTestId: dataTestIds.dashboard.dischargeButton,
        label: 'Discharge',
        missingUserMessage: 'User is not available. Cannot discharge patient.',
        successMessage: 'Patient discharged successfully',
        updatedStatus: 'discharged',
      },
    ],
  ])('returns the expected board action for %s', (status, expectedAction) => {
    expect(getTrackingBoardPrimaryAction(status as VisitStatusLabel)).toEqual(expectedAction);
  });

  test('returns a navigate-only start provider action for virtual ready for provider visits', () => {
    expect(getTrackingBoardPrimaryAction('ready for provider', { isVirtualVisit: true })).toEqual({
      dataTestId: dataTestIds.dashboard.startProviderButton,
      label: 'Start Provider',
      missingUserMessage: 'User is not available. Cannot start provider visit.',
      navigateToChart: true,
      skipStatusUpdate: true,
      successMessage: undefined,
      updatedStatus: 'provider',
    });
  });

  test.each(nonActionableStatuses)('returns no board action for %s', (status) => {
    expect(getTrackingBoardPrimaryAction(status)).toBeUndefined();
  });
});
