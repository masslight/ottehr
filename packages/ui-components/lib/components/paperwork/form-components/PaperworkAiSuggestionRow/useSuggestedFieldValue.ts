import { useQuery } from '@tanstack/react-query';
import { GetInsuranceCardSuggestionsResponse, GetPhotoIdSuggestionsResponse } from 'utils';

interface FieldSuggestionConfig {
  source: 'insurance' | 'photoId';
  ocrKey: string;
  /** insurance only: which card (primary vs secondary) this field belongs to; defaults to 1 */
  ordinal?: 1 | 2;
}

/**
 * The intake paperwork fields we can suggest a value for, and which OCR'd card field feeds each
 * one. Deliberately small: intake's paperwork has no destination field for most extracted card
 * fields (group number, payer ID, rx fields, plan type, effective date, license number,
 * expiration date).
 *
 * Photo-ID name/DOB/sex are NOT included here even though the backend extracts them: their only
 * candidate destinations (contact-information-page's patientFirstName/patientLastName/
 * patientBirthDate/patientBirthSex) are `logicalItems`, permanently hidden by
 * useStyleItems.tsx's filterHiddenItems, so a suggestion row there can never render — the real
 * editable versions of those fields live on the booking-time PatientInformation page, which
 * happens before paperwork (and any upload) even starts. Address fields don't have that problem:
 * patient-street-address/street-address-2/city/state/zip are real, visible, editable items on the
 * SAME page as the photo-ID upload, so a suggestion there is actually reachable.
 */
export const PAPERWORK_AI_SUGGESTION_FIELDS: Record<string, FieldSuggestionConfig> = {
  'insurance-member-id': { source: 'insurance', ocrKey: 'memberId', ordinal: 1 },
  'insurance-member-id-2': { source: 'insurance', ocrKey: 'memberId', ordinal: 2 },
  'policy-holder-first-name': { source: 'insurance', ocrKey: 'memberFirstName', ordinal: 1 },
  'policy-holder-middle-name': { source: 'insurance', ocrKey: 'memberMiddleName', ordinal: 1 },
  'policy-holder-last-name': { source: 'insurance', ocrKey: 'memberLastName', ordinal: 1 },
  'policy-holder-first-name-2': { source: 'insurance', ocrKey: 'memberFirstName', ordinal: 2 },
  'policy-holder-middle-name-2': { source: 'insurance', ocrKey: 'memberMiddleName', ordinal: 2 },
  'policy-holder-last-name-2': { source: 'insurance', ocrKey: 'memberLastName', ordinal: 2 },
  'patient-street-address': { source: 'photoId', ocrKey: 'addressLine1' },
  'patient-street-address-2': { source: 'photoId', ocrKey: 'addressLine2' },
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

  return rawValue;
}
