import { FC } from 'react';
import { CarrierSuggestionRow } from './CarrierSuggestionRow';
import { SimpleSuggestionRow } from './SimpleSuggestionRow';
import { PAPERWORK_AI_SUGGESTION_FIELDS } from './useSuggestedFieldValue';

interface PaperworkAiSuggestionRowProps {
  linkId: string;
  fieldId: string;
  appointmentId: string | undefined;
}

// Carrier is a reference field with a payer directory + picker, everything else is a plain-text
// one-click suggestion — see SimpleSuggestionRow vs CarrierSuggestionRow for why they can't share
// one component (a carrier match can be ambiguous; the others can't).
const CARRIER_LINK_ID_ORDINALS: Record<string, 1 | 2> = {
  'insurance-carrier': 1,
  'insurance-carrier-2': 2,
};

/** Whether any AI suggestion (simple or carrier) could apply to this linkId — used to decide
 * whether to mount a PaperworkAiSuggestionRow for a given field at all. */
export const hasPaperworkAiSuggestion = (linkId: string): boolean =>
  Boolean(CARRIER_LINK_ID_ORDINALS[linkId]) || Boolean(PAPERWORK_AI_SUGGESTION_FIELDS[linkId]);

export const PaperworkAiSuggestionRow: FC<PaperworkAiSuggestionRowProps> = ({ linkId, fieldId, appointmentId }) => {
  const carrierOrdinal = CARRIER_LINK_ID_ORDINALS[linkId];
  if (carrierOrdinal) {
    return (
      <CarrierSuggestionRow linkId={linkId} ordinal={carrierOrdinal} fieldId={fieldId} appointmentId={appointmentId} />
    );
  }
  return <SimpleSuggestionRow linkId={linkId} fieldId={fieldId} appointmentId={appointmentId} />;
};
