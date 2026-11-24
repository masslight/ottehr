import { z } from 'zod';

// Practitioners one lookup may name
export const MAX_PRACTITIONER_NAMES_IDS = 100;

/**
 * Input of the EHR's get-practitioner-names zambda: the Practitioners whose names a caller with no
 * access to clinical FHIR, such as the billing app, needs to show who did something.
 */
export const GetPractitionerNamesInputSchema = z.object({
  practitionerIds: z.array(z.string().trim().uuid()).min(1).max(MAX_PRACTITIONER_NAMES_IDS),
});

export type GetPractitionerNamesInput = z.output<typeof GetPractitionerNamesInputSchema>;

export interface GetPractitionerNamesResponse {
  // first + last name by Practitioner id; a Practitioner that is unknown or has no name is absent
  names: Record<string, string>;
}
