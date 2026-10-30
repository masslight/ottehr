import { FormPlacement } from 'utils/lib/helpers/practice-managed-questionnaires';
import { TaggedFormPlacement } from 'utils/lib/types/data/practice-managed-questionnaires/practice-managed-questionnaire.types';

/** Navigation state asking the destination page to open this response in its edit dialog. */
export type OpenFormResponseState = { openFormResponseId?: string };

// Literal in-person route segments (ROUTER_PATH.SCREENING / QUESTIONNAIRES): importing the route table
// here would cycle through the pages that render these forms.
const IN_PERSON_SEGMENT: Record<TaggedFormPlacement, string> = {
  screening: 'screening-questions',
  questionnaires: 'questionnaires',
};

/**
 * The page where a form of this type is filled out for the visit. A follow-up note's chart pages carry its
 * encounter id so the user stays on the follow-up; Visit Details always shows the visit itself.
 */
export const formPagePath = (placement: FormPlacement, appointmentId: string, followUpEncounterId?: string): string =>
  placement === 'visit-details'
    ? `/visit/${appointmentId}`
    : `/in-person/${appointmentId}/${IN_PERSON_SEGMENT[placement]}${
        followUpEncounterId ? `?encounterId=${followUpEncounterId}` : ''
      }`;
