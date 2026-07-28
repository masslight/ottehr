import { useEffect, useMemo, useRef, useState } from 'react';
import {
  CPT_RULES_VINTAGE,
  defendCodes,
  detectProcedureFamily,
  EvaluationFamilyMatchKind,
  EvaluationResult,
  ProcedureFactsInput,
  suggestCode,
} from 'utils';
import { ProcedureFieldVisibility, procedureFieldVisibility } from '../components/procedures/procedureFieldVisibility';

const EVALUATION_DEBOUNCE_MS = 500;

interface ProcedureEvaluations {
  factsKey: string;
  suggestion: EvaluationResult;
  defense: EvaluationResult;
}

export interface ProcedureCodingEvaluationPair {
  suggestion: EvaluationResult;
  defense: EvaluationResult;
}

export enum ProcedureCodingEvaluationStateKind {
  Evaluating = 'evaluating',
  Ready = 'ready',
}

export interface EvaluatingProcedureCodingState {
  kind: ProcedureCodingEvaluationStateKind.Evaluating;
  previous: ProcedureCodingEvaluationPair | null;
}

export interface ReadyProcedureCodingState {
  kind: ProcedureCodingEvaluationStateKind.Ready;
  current: ProcedureCodingEvaluationPair;
}

export type ProcedureCodingEvaluationState = EvaluatingProcedureCodingState | ReadyProcedureCodingState;

export interface UseProcedureCodingResult {
  evaluationState: ProcedureCodingEvaluationState;
  rulesVintage: string;
  fieldVisibility: ProcedureFieldVisibility;
}

export function useProcedureCoding(facts: ProcedureFactsInput): UseProcedureCodingResult {
  const [evaluations, setEvaluations] = useState<ProcedureEvaluations | undefined>(undefined);

  const factsKey = useMemo(() => JSON.stringify(facts), [facts]);
  const family = useMemo(() => detectProcedureFamily(facts), [facts]);

  const factsRef = useRef(facts);
  useEffect(() => {
    factsRef.current = facts;
  }, [facts]);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      const input = factsRef.current;
      setEvaluations({ factsKey, suggestion: suggestCode(input), defense: defendCodes(input) });
    }, EVALUATION_DEBOUNCE_MS);
    return () => clearTimeout(timeoutId);
  }, [factsKey]);

  const landedFamilyId =
    evaluations?.suggestion.family.kind === EvaluationFamilyMatchKind.Matched ? evaluations.suggestion.family.id : null;
  const currentFamilyId = family?.id ?? null;
  const landed = evaluations != null && landedFamilyId === currentFamilyId ? evaluations : undefined;
  const pair = landed == null ? null : { suggestion: landed.suggestion, defense: landed.defense };
  const evaluationState: ProcedureCodingEvaluationState =
    landed != null && landed.factsKey === factsKey
      ? {
          kind: ProcedureCodingEvaluationStateKind.Ready,
          current: { suggestion: landed.suggestion, defense: landed.defense },
        }
      : { kind: ProcedureCodingEvaluationStateKind.Evaluating, previous: pair };

  return {
    evaluationState,
    rulesVintage: CPT_RULES_VINTAGE,
    fieldVisibility: procedureFieldVisibility(family, facts),
  };
}
