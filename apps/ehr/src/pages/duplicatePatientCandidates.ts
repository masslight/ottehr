import { DuplicatePatientCandidate } from 'utils/lib/types/api/check-duplicate-patients.types';
import { PersonSex } from 'utils/lib/types/common';
import { isFullFhirDateString } from 'utils/lib/utils/date';

const DEMOGRAPHICS_FIX = 'Correct it on the patient record before booking.';

/**
 * Why a candidate cannot be booked against from Add Visit, or undefined when it is ready.
 *
 * Booking a visit for an existing patient needs a name, a full date of birth, a sex create-appointment
 * accepts (PersonSex: not missing or FHIR "unknown") and a verified phone on exactly one login account.
 */
export const getCandidateBlockedReason = (candidate: DuplicatePatientCandidate): string | undefined => {
  const reasons: string[] = [];

  if (!candidate.firstName?.trim() || !candidate.lastName?.trim()) {
    reasons.push(`This record is missing a first or last name. ${DEMOGRAPHICS_FIX}`);
  }
  if (!candidate.dateOfBirth || !isFullFhirDateString(candidate.dateOfBirth)) {
    reasons.push(`This record's date of birth is missing or incomplete. ${DEMOGRAPHICS_FIX}`);
  }
  if (!Object.values(PersonSex).includes(candidate.sex as PersonSex)) {
    reasons.push(`This record's sex is missing or unknown, so a visit cannot be created. ${DEMOGRAPHICS_FIX}`);
  }

  switch (candidate.phone?.status) {
    case 'verified':
      break;
    case 'no-account':
      reasons.push('No linked account with a verified phone, so a visit booked here would have no contact number.');
      break;
    case 'ambiguous':
      reasons.push('Linked accounts have different verified phones, so the visit contact is ambiguous.');
      break;
    default:
      reasons.push("Couldn't check this patient's linked account.");
  }

  return reasons.length > 0 ? reasons.join(' ') : undefined;
};
