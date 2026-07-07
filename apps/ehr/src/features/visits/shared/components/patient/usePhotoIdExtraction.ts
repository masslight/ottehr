import { useQuery } from '@tanstack/react-query';
import { DocumentReference } from 'fhir/r4b';
import { useApiClients } from 'src/hooks/useAppClients';
import {
  DocumentType,
  LOINC_SYSTEM,
  PHOTO_ID_CARD_CODE,
  PHOTO_ID_EXTRACTION_EXTENSION_URL,
  PhotoIdExtraction,
  PhotoIdExtractionFields,
} from 'utils';
import { CardFieldSuggestion, normalizeForComparison } from './useInsuranceCardExtraction';

export interface UsePhotoIdExtractionResult {
  fields: PhotoIdExtractionFields | null;
  isLoading: boolean;
}

const readStoredExtraction = (docRef: DocumentReference): PhotoIdExtraction | null => {
  const valueString = docRef.extension?.find((ext) => ext.url === PHOTO_ID_EXTRACTION_EXTENSION_URL)?.valueString;
  if (!valueString) return null;
  try {
    return JSON.parse(valueString) as PhotoIdExtraction;
  } catch (error) {
    // Malformed extension: ignore this DocRef rather than crash the form.
    console.error(`Malformed photo-id-extraction extension on DocumentReference/${docRef.id}; ignoring`, error);
    return null;
  }
};

/**
 * Picks the NEWEST photo-ID front DocRef (input is expected newest-first — the extraction
 * lives only on the front image slot) and returns its stored extraction fields. A newer
 * upload with no extraction yet (in flight / failed) or a notAPhotoId verdict yields null,
 * mirroring the insurance-card behavior of never letting an older card's data flag a newer
 * image. Exported for tests.
 */
export const readNewestFrontExtractionFields = (
  docRefsNewestFirst: DocumentReference[]
): PhotoIdExtractionFields | null => {
  const front = docRefsNewestFirst.find(
    (docRef) => docRef.content?.[0]?.attachment?.title === DocumentType.PhotoIdFront
  );
  if (!front) return null;
  const extraction = readStoredExtraction(front);
  if (!extraction || extraction.notAPhotoId || !extraction.fields) return null;
  return extraction.fields;
};

/**
 * Reads the OCR extraction the extract-photo-id zambda stored on the patient's current
 * photo-ID front DocumentReference. Read-only: OCR is never invoked here — an ID either
 * has the extension (suggestions render), has a notAPhotoId marker, or has no extension
 * yet (extraction in flight / failed), in which case nothing renders.
 */
export const usePhotoIdExtraction = (patientId: string | undefined): UsePhotoIdExtractionResult => {
  const { oystehr } = useApiClients();
  const enabled = Boolean(oystehr && patientId);
  const { data, isLoading } = useQuery({
    queryKey: ['photo-id-extraction', patientId],
    queryFn: async (): Promise<PhotoIdExtractionFields | null> => {
      const bundle = await oystehr!.fhir.search<DocumentReference>({
        resourceType: 'DocumentReference',
        params: [
          { name: 'status', value: 'current' },
          { name: 'related', value: `Patient/${patientId}` },
          { name: 'type', value: `${LOINC_SYSTEM}|${PHOTO_ID_CARD_CODE}` },
          { name: '_sort', value: '-_lastUpdated' },
        ],
      });
      return readNewestFrontExtractionFields(bundle.unbundle());
    },
    enabled,
  });
  return { fields: data ?? null, isLoading: enabled && isLoading };
};

/**
 * Maps an extracted photo-ID token to a dropdown option by case-insensitive exact match
 * against the option value or label (birth sex: "Male" → "Male"; state: "MA" → "MA").
 * No match → no suggestion.
 */
export const buildPhotoIdOptionSuggestion = (
  extracted: string | null | undefined,
  options: { label: string; value: string }[] | undefined
): CardFieldSuggestion | null => {
  if (!extracted || !options?.length) return null;
  const target = normalizeForComparison(extracted);
  const match = options.find(
    (option) => normalizeForComparison(option.value) === target || normalizeForComparison(option.label) === target
  );
  if (!match) return null;
  return { display: extracted, formValue: match.value, comparable: match.value };
};
