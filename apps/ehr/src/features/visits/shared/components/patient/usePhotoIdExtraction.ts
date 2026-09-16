import Oystehr from '@oystehr/sdk';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { DocumentReference, QuestionnaireResponse } from 'fhir/r4b';
import { useEffect, useRef } from 'react';
import { extractPhotoId } from 'src/api/api';
import { useApiClients } from 'src/hooks/useAppClients';
import { LOINC_SYSTEM } from 'utils/lib/fhir/vitals';
import {
  DocumentType,
  PHOTO_ID_EXTRACTION_EXTENSION_URL,
  PhotoIdExtraction,
  PhotoIdExtractionFields,
} from 'utils/lib/types/data/documents';
import { PHOTO_ID_CARD_CODE } from 'utils/lib/types/data/paperwork/paperwork.constants';
import { findQuestionnaireResponseItemLinkId } from 'utils/lib/types/data/paperwork/paperwork.types';
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

const CONSENT_SIGNER_RELATIONSHIP_LINK_ID = 'consent-form-signer-relationship';
const SELF_RELATIONSHIP = 'self';
const CONSENT_SIGNER_PAPERWORK_PAGE_SIZE = 5;

/**
 * The most recently recorded answer to "Relationship to the patient" across the patient's
 * paperwork, or undefined when none of these responses answered it. Input is expected newest-first.
 * Only intake paperwork carries this linkId, so non-paperwork responses are skipped without having
 * to identify them. Exported for tests.
 */
export const readConsentSignerRelationship = (
  questionnaireResponsesNewestFirst: QuestionnaireResponse[]
): string | undefined => {
  for (const questionnaireResponse of questionnaireResponsesNewestFirst) {
    const answer = findQuestionnaireResponseItemLinkId(
      CONSENT_SIGNER_RELATIONSHIP_LINK_ID,
      questionnaireResponse.item ?? []
    )?.answer?.[0]?.valueString?.trim();
    if (answer) return answer;
  }
  return undefined;
};

export const photoIdBelongsToPatient = (relationship: string | undefined): boolean =>
  !relationship || normalizeForComparison(relationship) === SELF_RELATIONSHIP;

export const withoutPhotoIdName = (fields: PhotoIdExtractionFields | null): PhotoIdExtractionFields | null =>
  fields ? { ...fields, firstName: null, middleName: null, lastName: null } : null;

const hasName = (fields: PhotoIdExtractionFields | null): boolean =>
  Boolean(fields && (fields.firstName || fields.middleName || fields.lastName));

const resolvePhotoIdBelongsToPatient = async (oystehr: Oystehr, patientId: string): Promise<boolean> => {
  try {
    const bundle = await oystehr.fhir.search<QuestionnaireResponse>({
      resourceType: 'QuestionnaireResponse',
      params: [
        { name: 'subject', value: `Patient/${patientId}` },
        { name: '_sort', value: '-_lastUpdated' },
        { name: '_count', value: `${CONSENT_SIGNER_PAPERWORK_PAGE_SIZE}` },
      ],
    });
    return photoIdBelongsToPatient(readConsentSignerRelationship(bundle.unbundle()));
  } catch (error) {
    console.error(`Failed to read the consent signer relationship for Patient/${patientId}:`, error);
    return false;
  }
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
      const fields = readNewestFrontExtractionFields(docRefsNewestFirst);
      // Only the name is gated on who signed consent, so an ID that read no name needs no paperwork
      // lookup at all. Resolved inside this query rather than as a second hook so the fields land
      // already gated — a name chip must never render and then disappear once paperwork comes back.
      if (!hasName(fields) || (await resolvePhotoIdBelongsToPatient(oystehr!, patientId!))) {
        return { front, fields };
      }
      return { front, fields: withoutPhotoIdName(fields) };
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
