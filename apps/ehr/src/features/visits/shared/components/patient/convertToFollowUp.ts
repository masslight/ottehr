import { Encounter } from 'fhir/r4b';
import { isFollowupEncounter } from 'utils/lib/fhir/encounter';

export const getConvertToFollowUpDisabledReason = (input: {
  encounter: Encounter | undefined;
  isLoading: boolean;
  hasOwnFollowUps: boolean;
  /** `undefined` while the patient's other visits are still being looked up. */
  hasOtherInitialVisits: boolean | undefined;
}): string | undefined => {
  const { encounter, isLoading, hasOwnFollowUps, hasOtherInitialVisits } = input;
  if (!encounter || isLoading) return 'Loading the visit…';
  if (isFollowupEncounter(encounter)) return 'This visit is already a follow-up';
  if (hasOwnFollowUps) return 'This visit already has its own follow-ups';
  if (hasOtherInitialVisits === undefined) return 'Loading the visit…';
  if (!hasOtherInitialVisits) return 'The patient has no other visit to follow up on';
  return undefined;
};
