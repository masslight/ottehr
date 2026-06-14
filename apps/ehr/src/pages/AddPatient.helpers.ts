// Pure presentation helpers for the Add Patient flow.
//
// Kept in a standalone module (no React / api.ts / env-guarded imports) so the
// logic can be unit-tested without dragging in the heavy AddPatient component
// graph — several of those modules throw at import time when VITE_* env vars
// are absent (e.g. in the node unit-test environment).
export const getPostAppointmentSnackbar = ({
  hasClientCopyFailures,
  isScheduledFollowUp,
  copyAttempted,
}: {
  hasClientCopyFailures: boolean;
  isScheduledFollowUp: boolean;
  copyAttempted: boolean;
}): { message: string; variant: 'warning' | 'success' } => {
  if (hasClientCopyFailures) {
    return {
      message: "Visit created, but some fields couldn't be copied from the previous visit.",
      variant: 'warning',
    };
  }
  if (isScheduledFollowUp && copyAttempted) {
    return { message: 'Visit added; notes copied from the previous visit.', variant: 'success' };
  }
  return { message: 'Visit added successfully', variant: 'success' };
};
