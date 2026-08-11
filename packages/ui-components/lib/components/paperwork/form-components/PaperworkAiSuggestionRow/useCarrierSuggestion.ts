import { useQuery } from '@tanstack/react-query';
import { QuestionnaireItemAnswerOption, Reference } from 'fhir/r4b';
import { GetInsuranceCardSuggestionsResponse } from 'utils/lib/types/api/get-insurance-card-suggestions.types';
import { GetAnswerOptionsRequest } from 'utils/lib/types/data/telemed/appointments/appointments.types';
import { usePaperworkContext } from '../../context';
import { buildCarrierSuggestion, CarrierSuggestion } from './carrierMatching';

const PAYER_OPTIONS_INPUT: GetAnswerOptionsRequest = { answerSource: { zambdaId: 'get-patient-insurance-payers' } };

/**
 * Resolves a suggestion for the insurance-carrier reference field: reads the OCR'd payer/payerId
 * out of the same cache getInsuranceCardSuggestions writes to (see useSuggestedFieldValue), then
 * matches it against the SAME payer directory the carrier dropdown itself loads — same query key
 * (`[fieldId, PAYER_OPTIONS_INPUT]`) as FreeMultiSelectInput uses for this field, so this shares
 * that cache entry instead of re-fetching.
 */
export function useCarrierSuggestion(
  ordinal: 1 | 2,
  fieldId: string,
  appointmentId: string | undefined
): CarrierSuggestion | null {
  const { paperworkComponentHelpers } = usePaperworkContext();

  const cacheKey = appointmentId
    ? ['insurance-card-suggestions', appointmentId, ordinal]
    : ['paperwork-ai-suggestion-noop'];
  const { data: cardResponse } = useQuery<GetInsuranceCardSuggestionsResponse | undefined>({
    queryKey: cacheKey,
    queryFn: () => undefined,
    enabled: false,
    staleTime: Infinity,
  });

  const hasPayerSignal = Boolean(cardResponse?.fields?.payer || cardResponse?.fields?.payerId);
  const { data: payerOptions } = useQuery<QuestionnaireItemAnswerOption[]>({
    queryKey: [fieldId, PAYER_OPTIONS_INPUT],
    queryFn: () => paperworkComponentHelpers.getAnswerOptions?.(PAYER_OPTIONS_INPUT) ?? Promise.resolve([]),
    enabled: hasPayerSignal && paperworkComponentHelpers.getAnswerOptions !== undefined,
  });

  if (!appointmentId || !cardResponse?.fields) return null;

  const references: Reference[] = (payerOptions ?? [])
    .map((option) => option.valueReference)
    .filter((reference): reference is Reference => Boolean(reference));

  return buildCarrierSuggestion(cardResponse.fields.payer, cardResponse.fields.payerId, references);
}
