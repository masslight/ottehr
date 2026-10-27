import { SentencePicks, SuggestedSentence } from 'src/components/SuggestedSentences';
import { SuggestedPrescriptionFields } from 'utils/lib/helpers/medications/prescription-suggestions';
import { MedicationSearchDrug, MedicationSearchResult } from 'utils/lib/types/api/erx-search.types';

/** One suggested prescription: the sentence as it reads, and what "+" writes into the line. */
export interface PrescriptionSuggestionRow extends SuggestedSentence {
  /** The line's fields with the row's blanks as picked. */
  fill: (picks: SentencePicks) => SuggestedPrescriptionFields;
  /** Where a blank that picks the diagnosis by search sits ("— for [acute otitis media]"). Its value, as
   * "Display CODE", goes on the line with the row; an empty one leaves the line's. */
  diagnosisAt?: number;
}

/** What the suggestions are chosen by. */
export interface PrescriptionSuggestionQuery {
  drug: MedicationSearchDrug | null;
  medication: MedicationSearchResult;
  ageMonths?: number;
  weightKg?: number;
  /** The line's own diagnosis code, then the visit's, primary first. */
  diagnosisCodes: string[];
}

/** The suggestions for a product: none yet, so the box offers only "Other" (Write my own). Where suggestion data
 * plugs in. */
export const prescriptionSuggestionsFor = (_query: PrescriptionSuggestionQuery): PrescriptionSuggestionRow[] => [];
