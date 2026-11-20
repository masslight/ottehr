import { Basic } from 'fhir/r4b';
import { PRIVATE_EXTENSION_BASE_URL } from 'utils/lib/fhir/constants';
import { ErxSavedForm, ErxSavedFormResponse, ErxSavedFormSchema } from 'utils/lib/types/api/erx.types';

// A visit's saved eRx order form is one FHIR Basic about the Encounter: Basic.code classifies it, so it's never an
// eRx v4 MedicationRequest (whose `draft` means "Sending") and never in "Ordered prescriptions", and the form rides
// as one JSON blob in an extension, as a saved ad-hoc report does. Basic.author names whoever saved last.
export const ERX_SAVED_FORM_SYSTEM = `${PRIVATE_EXTENSION_BASE_URL}/erx-saved-form`;
export const ERX_SAVED_FORM_CODE = 'erx-saved-form';
const FORM_EXTENSION_URL = `${PRIVATE_EXTENSION_BASE_URL}/erx-saved-form-data`;

/** The search for the saved forms of these visits, by Encounter reference and the saved-form code only. */
export const erxSavedFormSearchParams = (encounterIds: string[]): { name: string; value: string }[] => [
  { name: 'subject', value: encounterIds.map((id) => `Encounter/${id}`).join(',') },
  { name: 'code', value: `${ERX_SAVED_FORM_SYSTEM}|${ERX_SAVED_FORM_CODE}` },
];

export const makeErxSavedFormBasic = (
  encounterId: string,
  form: ErxSavedForm,
  author: { reference?: string; display?: string }
): Basic => ({
  resourceType: 'Basic',
  code: { coding: [{ system: ERX_SAVED_FORM_SYSTEM, code: ERX_SAVED_FORM_CODE }] },
  subject: { reference: `Encounter/${encounterId}` },
  author,
  extension: [{ url: FORM_EXTENSION_URL, valueString: JSON.stringify(form) }],
});

/** The form a Basic holds; none when its blob doesn't parse or match the form's shape. */
export const parseErxSavedFormBasic = (basic: Basic): ErxSavedFormResponse['saved'] => {
  const raw = basic.extension?.find((extension) => extension.url === FORM_EXTENSION_URL)?.valueString;
  if (!raw) return null;
  try {
    const parsed = ErxSavedFormSchema.safeParse(JSON.parse(raw));
    if (!parsed.success) return null;
    return { form: parsed.data, savedBy: basic.author?.display, savedAt: basic.meta?.lastUpdated };
  } catch {
    return null;
  }
};

/** The Encounter a saved form is about. */
export const erxSavedFormEncounterId = (basic: Basic): string | undefined =>
  basic.subject?.reference?.startsWith('Encounter/') ? basic.subject.reference.slice('Encounter/'.length) : undefined;
