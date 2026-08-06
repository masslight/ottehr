import { useEffect, useRef, useState } from 'react';
import {
  CPT_RULES_VINTAGE,
  defendCodes,
  detectProcedureFamily,
  EvaluationResult,
  ProcedureFactsInput,
  suggestCode,
} from 'utils';

// Deterministic evaluations are pure and instant; the debounce only keeps them from
// running on every keystroke in the details text (design §5, requirement A3/E1).
const EVALUATION_DEBOUNCE_MS = 500;

interface ProcedureEvaluations {
  suggestion: EvaluationResult;
  defense: EvaluationResult;
}

export interface UseProcedureCodingResult {
  /** Forward evaluation: documented facts → determined code or open candidate set. */
  suggestion: EvaluationResult | undefined;
  /** Inverse evaluation: selected codes → per-code missing elements and contradictions. */
  defense: EvaluationResult | undefined;
  /** Provenance stamp of the rule tables (requirement C4). */
  rulesVintage: string;
  /** True when the detected procedure family uses the structured length/size (cm) input. */
  showLengthInput: boolean;
  /** True when the detected procedure family uses the structured Repair depth select. */
  showRepairDepthSelect: boolean;
  /** True when the detected procedure family uses the structured infusion Start/Stop time inputs. */
  showInfusionTimeInputs: boolean;
}

/**
 * Runs the deterministic procedure-coding engine (suggestCode/defendCodes) over the page's
 * form snapshot on a short debounce. Client-side and synchronous — separate from (and never
 * a trigger of) the recommend-billing-codes AI call.
 */
export function useProcedureCoding(facts: ProcedureFactsInput): UseProcedureCodingResult {
  const [evaluations, setEvaluations] = useState<ProcedureEvaluations | undefined>(undefined);

  // Re-evaluate on content changes only; the ref keeps unrelated re-renders (which produce a
  // new facts object each time) from resetting the debounce timer.
  const factsRef = useRef(facts);
  factsRef.current = facts;
  const factsKey = JSON.stringify(facts);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      const input = factsRef.current;
      setEvaluations({ suggestion: suggestCode(input), defense: defendCodes(input) });
    }, EVALUATION_DEBOUNCE_MS);
    return () => clearTimeout(timeoutId);
  }, [factsKey]);

  // Family detection is cheap, so it runs synchronously: the conditional length and repair-depth
  // inputs appear as soon as the selected procedure type maps to a family that uses them.
  const family = detectProcedureFamily(facts);
  const showLengthInput = family?.usesStructuredLength === true;
  const showRepairDepthSelect = family?.usesStructuredRepairDepth === true;
  const showInfusionTimeInputs = family?.usesStructuredInfusionTimes === true;

  return {
    suggestion: evaluations?.suggestion,
    defense: evaluations?.defense,
    rulesVintage: CPT_RULES_VINTAGE,
    showLengthInput,
    showRepairDepthSelect,
    showInfusionTimeInputs,
  };
}
