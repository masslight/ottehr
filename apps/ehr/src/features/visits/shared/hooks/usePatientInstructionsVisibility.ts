import { useReferralsQuery } from 'src/features/referrals/referrals.queries';
import { useExcusePresignedFiles } from 'src/shared/hooks/useExcusePresignedFiles';
import { NOTHING_TO_EAT_OR_DRINK_FIELD } from 'utils/lib/types/api/chart-data/chart-data.types';
import { useVisitNote } from './useVisitNote';

export const usePatientInstructionsVisibility = (): {
  showInstructions: boolean;
  showDischargeInstructions: boolean;
  showFollowUp: boolean;
  showSchoolWorkExcuse: boolean;
  showReferrals: boolean;
  showPatientInstructions: boolean;
} => {
  const { data: note, encounterId } = useVisitNote();
  const instructions = note?.plan.instructions;
  const disposition = note?.plan.disposition;
  // Entries whose presigning failed come back without a URL and cannot be linked.
  const schoolWorkExcuses = useExcusePresignedFiles(note?.plan.schoolWorkNotes).filter((excuse) => excuse.presignedUrl);
  const { data: referralsData } = useReferralsQuery(encounterId ? { encounterId } : undefined);
  const showInstructions = !!(instructions && instructions.length > 0);

  const showDischargeInstructions = !!(
    (disposition?.note && disposition?.note.length > 0) ||
    disposition?.[NOTHING_TO_EAT_OR_DRINK_FIELD] ||
    (disposition?.labService && disposition.labService.length > 0) ||
    (disposition?.virusTest && disposition.virusTest.length > 0)
  );

  const showFollowUp = !!(disposition?.followUp && disposition.followUp.length > 0);
  const showSchoolWorkExcuse = !!(schoolWorkExcuses.length > 0);
  const showReferrals = !!referralsData?.referrals.some((referral) => referral.status !== 'cancelled');

  const showPatientInstructions =
    showInstructions || showDischargeInstructions || showFollowUp || showSchoolWorkExcuse || showReferrals;

  return {
    showInstructions,
    showDischargeInstructions,
    showFollowUp,
    showSchoolWorkExcuse,
    showReferrals,
    showPatientInstructions,
  };
};
