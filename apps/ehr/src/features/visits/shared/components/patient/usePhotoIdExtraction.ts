import { useQuery, useQueryClient } from '@tanstack/react-query';
import { DocumentReference } from 'fhir/r4b';
import { useEffect, useRef } from 'react';
import { extractPhotoId } from 'src/api/api';
import { useApiClients } from 'src/hooks/useAppClients';
import {
  DocumentType,
  LOINC_SYSTEM,
  PHOTO_ID_CARD_CODE,
  PHOTO_ID_EXTRACTION_EXTENSION_URL,
  PhotoIdExtraction,
  PhotoIdExtractionFields,
} from 'utils';
import { CardFieldSuggestion, normalizeForComparison, readStoredExtension } from './useInsuranceCardExtraction';

export interface UsePhotoIdExtractionResult {
  fields: PhotoIdExtractionFields | null;
  isLoading: boolean;
}

const readStoredExtraction = (docRef: DocumentReference): PhotoIdExtraction | null =>
  readStoredExtension<PhotoIdExtraction>(docRef, PHOTO_ID_EXTRACTION_EXTENSION_URL, 'photo-id-extraction');

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
 * Reads the OCR extraction the extract-photo-id zambda stored on the patient's current photo-ID
 * front DocumentReference: an ID either has the extension (suggestions render), has a
 * notAPhotoId marker, or has no extension yet. That last case is backfilled below rather than
 * left to render nothing forever — see the matching comment on useInsuranceCardExtraction for why
 * (a card that arrives via intake's paperwork harvest, rather than a staff upload through the
 * EHR's own upload button, would otherwise never get OCR'd).
 */
export const usePhotoIdExtraction = (patientId: string | undefined): UsePhotoIdExtractionResult => {
  const { oystehr, oystehrZambda } = useApiClients();
  const queryClient = useQueryClient();
  const enabled = Boolean(oystehr && patientId);
  const { data, isLoading } = useQuery({
    queryKey: ['photo-id-extraction', patientId],
    queryFn: async (): Promise<{ front: DocumentReference | undefined; fields: PhotoIdExtractionFields | null }> => {
      const bundle = await oystehr!.fhir.search<DocumentReference>({
        resourceType: 'DocumentReference',
        params: [
          { name: 'status', value: 'current' },
          { name: 'related', value: `Patient/${patientId}` },
          { name: 'type', value: `${LOINC_SYSTEM}|${PHOTO_ID_CARD_CODE}` },
          { name: '_sort', value: '-_lastUpdated' },
        ],
      });
      const docRefsNewestFirst = bundle.unbundle();
      const front = docRefsNewestFirst.find(
        (docRef) => docRef.content?.[0]?.attachment?.title === DocumentType.PhotoIdFront
      );
      return { front, fields: readNewestFrontExtractionFields(docRefsNewestFirst) };
    },
    enabled,
  });

  // Try the not-yet-extracted front image once per mount — see useInsuranceCardExtraction's
  // matching effect for the retry/backfill rationale.
  const attemptedRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    const front = data?.front;
    if (!front?.id || !oystehrZambda) return;
    if (readStoredExtraction(front) != null) return;
    if (attemptedRef.current.has(front.id)) return;
    attemptedRef.current.add(front.id);
    void extractPhotoId(oystehrZambda, { documentReferenceId: front.id })
      .catch((error) =>
        console.error(`Failed to backfill photo-id extraction for DocumentReference/${front.id}:`, error)
      )
      .then(() => queryClient.invalidateQueries({ queryKey: ['photo-id-extraction', patientId] }));
  }, [data?.front, oystehrZambda, queryClient, patientId]);

  return { fields: data?.fields ?? null, isLoading: enabled && isLoading };
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
