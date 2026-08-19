import { Organization } from 'fhir/r4b';

/** Free-text notes staff capture for an employer in Billing Configurations -> Employers -> Contact Details. */
export const EMPLOYER_NOTES_EXTENSION_URL = 'https://extensions.ottehr.com/fhir/StructureDefinition/employer-notes';

/** Notes recorded on an employer Organization, or undefined when it has none. */
export const getEmployerNotes = (organization: Organization | undefined): string | undefined =>
  organization?.extension?.find((ext) => ext.url === EMPLOYER_NOTES_EXTENSION_URL)?.valueString || undefined;
