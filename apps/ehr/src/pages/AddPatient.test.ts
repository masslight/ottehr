/**
 * @vitest-environment node
 */

import { describe, expect, it } from 'vitest';
import { getPostAppointmentSnackbar } from './AddPatient';

describe('getPostAppointmentSnackbar', () => {
  it('returns warning when any client-side copy field failed', () => {
    expect(
      getPostAppointmentSnackbar({ hasClientCopyFailures: true, isScheduledFollowUp: true, copyAttempted: true })
    ).toEqual({
      message: "Visit created, but some fields couldn't be copied from the previous visit.",
      variant: 'warning',
    });
  });

  it('reports a successful copy when the follow-up flow attempted to copy fields', () => {
    expect(
      getPostAppointmentSnackbar({ hasClientCopyFailures: false, isScheduledFollowUp: true, copyAttempted: true })
    ).toEqual({
      message: 'Visit added; notes copied from the previous visit.',
      variant: 'success',
    });
  });

  it('falls back to plain success for a scheduled follow-up with nothing to copy', () => {
    expect(
      getPostAppointmentSnackbar({ hasClientCopyFailures: false, isScheduledFollowUp: true, copyAttempted: false })
    ).toEqual({
      message: 'Visit added successfully',
      variant: 'success',
    });
  });

  it('reports plain success for a non-follow-up visit', () => {
    expect(
      getPostAppointmentSnackbar({ hasClientCopyFailures: false, isScheduledFollowUp: false, copyAttempted: false })
    ).toEqual({
      message: 'Visit added successfully',
      variant: 'success',
    });
  });

  it('prioritizes the failure warning over success even when copy was attempted', () => {
    // If both conditions hold, the warning wins — the provider needs to know something failed.
    expect(
      getPostAppointmentSnackbar({ hasClientCopyFailures: true, isScheduledFollowUp: true, copyAttempted: true })
        .variant
    ).toBe('warning');
  });
});
