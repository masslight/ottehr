import { useQuery } from '@tanstack/react-query';
import { GetInsuranceCardSuggestionsResponse } from 'utils/lib/types/api/get-insurance-card-suggestions.types';
import { GetPhotoIdSuggestionsResponse } from 'utils/lib/types/api/get-photo-id-suggestions.types';

interface FieldSuggestionConfig {
  source: 'insurance' | 'photoId';
  ocrKey: string;
  /** insurance only: which card (primary vs secondary) this field belongs to; defaults to 1 */
  ordinal?: 1 | 2;
  /**
   * The card OCR only returns a single memberName string (e.g. "DOE, JANE" or "JANE DOE") — no
   * EHR precedent splits it, so this split is a new, simple heuristic, not a port.
   */
  derive?: 'memberNameFirst' | 'memberNameLast';
}

/**
 * Splits a printed member name into first/last. Handles "LAST, FIRST" (comma present — first
 * name is just the first word after the comma, ignoring any middle name) and "FIRST ... LAST"
 * (no comma — last word is the last name, everything else folds into "first"). Not foolproof for
 * unusual name formats, but good enough for a one-click suggestion the patient can still edit.
 */
function splitMemberName(memberName: string): { first: string | null; last: string | null } {
  const trimmed = memberName.trim();
  if (!trimmed) return { first: null, last: null };

  const commaIndex = trimmed.indexOf(',');
  if (commaIndex >= 0) {
    const last = trimmed.slice(0, commaIndex).trim();
    const first = trimmed
      .slice(commaIndex + 1)
      .trim()
      .split(/\s+/)[0];
    return { first: first || null, last: last || null };
  }

  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) return { first: parts[0], last: null };
  return { first: parts.slice(0, -1).join(' '), last: parts[parts.length - 1] };
}

/**
 * The intake paperwork fields we can suggest a value for, and which OCR'd card field feeds each
 * one. Deliberately small: intake's paperwork has no destination field for most extracted card
 * fields (group number, payer ID, rx fields, plan type, effective date, member name, suffix,
 * license number, expiration date).
 *
 * Photo-ID name/DOB/sex are NOT included here even though the backend extracts them: their only
 * candidate destinations (contact-information-page's patientFirstName/patientLastName/
 * patientBirthDate/patientBirthSex) are `logicalItems`, permanently hidden by
 * useStyleItems.tsx's filterHiddenItems, so a suggestion row there can never render — the real
 * editable versions of those fields live on the booking-time PatientInformation page, which
 * happens before paperwork (and any upload) even starts. Address fields don't have that problem:
 * patient-street-address/city/state/zip are real, visible, editable items on the SAME page as the
 * photo-ID upload, so a suggestion there is actually reachable.
 */
export const PAPERWORK_AI_SUGGESTION_FIELDS: Record<string, FieldSuggestionConfig> = {
  'insurance-member-id': { source: 'insurance', ocrKey: 'memberId', ordinal: 1 },
  'insurance-member-id-2': { source: 'insurance', ocrKey: 'memberId', ordinal: 2 },
  'policy-holder-first-name': { source: 'insurance', ocrKey: 'memberName', ordinal: 1, derive: 'memberNameFirst' },
  'policy-holder-last-name': { source: 'insurance', ocrKey: 'memberName', ordinal: 1, derive: 'memberNameLast' },
  'policy-holder-first-name-2': { source: 'insurance', ocrKey: 'memberName', ordinal: 2, derive: 'memberNameFirst' },
  'policy-holder-last-name-2': { source: 'insurance', ocrKey: 'memberName', ordinal: 2, derive: 'memberNameLast' },
  'patient-street-address': { source: 'photoId', ocrKey: 'addressLine1' },
  'patient-city': { source: 'photoId', ocrKey: 'addressCity' },
  'patient-state': { source: 'photoId', ocrKey: 'addressState' },
  'patient-zip': { source: 'photoId', ocrKey: 'addressZip' },
};

type SuggestionsResponse = GetInsuranceCardSuggestionsResponse | GetPhotoIdSuggestionsResponse;

/**
 * Reads a suggested value for `linkId` out of the React Query cache that
 * getInsuranceCardSuggestions/getPhotoIdSuggestions (in usePaperworkComponentHelpers) write into
 * right after a card upload — no fetch happens here. `enabled: false` only suppresses this
 * observer's own fetching; it still re-renders whenever that cache entry is written elsewhere,
 * which is what lets the chip appear as soon as OCR comes back, on whichever page is mounted.
 */
export function useSuggestedFieldValue(linkId: string, appointmentId: string | undefined): string | undefined {
  const config = PAPERWORK_AI_SUGGESTION_FIELDS[linkId];
  const cacheKey =
    config && appointmentId
      ? config.source === 'insurance'
        ? ['insurance-card-suggestions', appointmentId, config.ordinal ?? 1]
        : ['photo-id-suggestions', appointmentId]
      : ['paperwork-ai-suggestion-noop'];

  const { data: response } = useQuery<SuggestionsResponse | undefined>({
    queryKey: cacheKey,
    queryFn: () => undefined,
    enabled: false,
    staleTime: Infinity,
  });

  if (!config || !appointmentId) return undefined;

  const fields = response?.fields as Record<string, string | null> | null | undefined;
  const rawValue = fields?.[config.ocrKey];
  if (!rawValue) return undefined;

  if (config.derive) {
    const { first, last } = splitMemberName(rawValue);
    const derived = config.derive === 'memberNameFirst' ? first : last;
    return derived ?? undefined;
  }

  return rawValue;
}
