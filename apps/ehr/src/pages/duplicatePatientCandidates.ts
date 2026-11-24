import { DuplicatePatientCandidate } from 'utils/lib/types/api/check-duplicate-patients.types';

/** Why a candidate cannot be booked against from Add Visit, or undefined when it is ready. */
export const getCandidateBlockedReason = (candidate: DuplicatePatientCandidate): string | undefined => {
  switch (candidate.phone?.status) {
    case 'verified':
      return undefined;
    case 'no-account':
      return 'No linked account with a verified phone, so a visit booked here would have no contact number.';
    case 'ambiguous':
      return 'Linked accounts have different verified phones, so the visit contact is ambiguous.';
    default:
      return "Couldn't check this patient's linked account.";
  }
};
