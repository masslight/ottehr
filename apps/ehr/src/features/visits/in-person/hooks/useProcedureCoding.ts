import { hashKey } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';
import { aiDefense, aiProcedureInput } from 'utils/lib/procedure-coding/ai';
import { defendCodes, detectProcedureFamily, suggestCode } from 'utils/lib/procedure-coding/evaluate';
import { ProcedureFieldVisibility, procedureFieldVisibility } from 'utils/lib/procedure-coding/fields';
import {
  CodeAssessmentKind,
  EvaluationFamilyMatchKind,
  EvaluationResult,
  ProcedureFactsInput,
} from 'utils/lib/procedure-coding/model.types';
import { CodeOutcomeKind } from 'utils/lib/procedure-coding/model.types';
import { CPT_RULES_VINTAGE } from 'utils/lib/procedure-coding/provenance';
import { useOystehrAPIClient } from '../../shared/hooks/useOystehrAPIClient';

const ENGINE_DEBOUNCE_MS = 500;
const AI_DEBOUNCE_MS = 5000; // common debounce time for AI to return a response (keystrokes and form changes).

interface ProcedureEvaluations {
  factsKey: string;
  procedureType: string | undefined;
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
  retrySuggestions: () => void;
}

export function useProcedureCoding(facts: ProcedureFactsInput): UseProcedureCodingResult {
  const api = useOystehrAPIClient();
  // Form-local promises reuse both pending and completed requests, including A → B → A edits.
  // Keep failures too: changing a billing code or an unrelated field must not retry a failed AI call.
  const aiCache = useRef(new Map<string, Promise<EvaluationResult>>());
  const [evaluations, setEvaluations] = useState<ProcedureEvaluations | undefined>(undefined);
  const [retryAttempt, setRetryAttempt] = useState(0);

  const factsKey = useMemo(() => hashKey([facts]), [facts]);
  const family = useMemo(() => detectProcedureFamily(facts), [facts]);

  const factsRef = useRef(facts);
  useEffect(() => {
    factsRef.current = facts;
  }, [facts]);

  useEffect(() => {
    const pending = factsRef.current;
    // Only a procedure type the engine does not cover reaches the model. A clinical input already in the
    // cache costs nothing, so an A → B → A edit does not have to sit through the long wait again.
    const usesAi = !detectProcedureFamily(pending) && Boolean(pending.procedureType?.trim());
    const cached = usesAi && aiCache.current.has(hashKey([aiProcedureInput(pending)]));
    const debounceMs = usesAi && !cached ? AI_DEBOUNCE_MS : ENGINE_DEBOUNCE_MS;

    let active = true;
    const timeoutId = setTimeout(async () => {
      const input = factsRef.current;
      let suggestion: EvaluationResult;
      let defense: EvaluationResult;

      // A throw from the rules engine must not leave the panel stuck on "Checking your documentation…".
      try {
        suggestion = suggestCode(input);
        defense = defendCodes(input, suggestion);
      } catch (error) {
        console.error('Procedure coding engine failed', error);

        const unavailable: EvaluationResult = {
          source: 'rules',
          family: { kind: EvaluationFamilyMatchKind.Unmatched },
          rulesVintage: CPT_RULES_VINTAGE,
          findings: [],
          payerNotes: [],
          codeAssessments: Object.fromEntries(
            (input.cptCodes ?? []).map((line) => [line.code, { kind: CodeAssessmentKind.NotAssessed }])
          ),
          outcome: {
            kind: CodeOutcomeKind.NotAssessed,
            reason: 'Code suggestions are currently unavailable. You can still add codes manually.',
          },
        };

        if (active)
          setEvaluations({
            factsKey,
            procedureType: input.procedureType,
            suggestion: unavailable,
            defense: unavailable,
          });
        return;
      }

      if (!detectProcedureFamily(input) && input.procedureType?.trim()) {
        defense = aiDefense(input);
        try {
          if (!api) throw new Error('AI service unavailable');
          const clinicalInput = aiProcedureInput(input);
          const key = hashKey([clinicalInput]);
          let request = aiCache.current.get(key);
          if (!request) {
            request = api.recommendBillingCodes(clinicalInput);
            aiCache.current.set(key, request);
          }
          suggestion = await request;
        } catch {
          suggestion = {
            ...defense,
            outcome: {
              kind: CodeOutcomeKind.NotAssessed,
              reason: 'Code suggestions are currently unavailable. You can still add codes manually.',
            },
          };
        }
      }
      // A response for an earlier name or earlier answers must never overwrite the current form.
      if (active) setEvaluations({ factsKey, procedureType: input.procedureType, suggestion, defense });
    }, debounceMs);
    return () => {
      active = false;
      clearTimeout(timeoutId);
    };
  }, [factsKey, api, retryAttempt]);

  const landedFamilyId =
    evaluations?.suggestion.family.kind === EvaluationFamilyMatchKind.Matched ? evaluations.suggestion.family.id : null;
  const currentFamilyId = family?.id ?? null;
  const landed =
    evaluations != null && landedFamilyId === currentFamilyId && evaluations.procedureType === facts.procedureType
      ? evaluations
      : undefined;
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
    retrySuggestions: () => {
      aiCache.current.delete(hashKey([aiProcedureInput(factsRef.current)]));
      setEvaluations(undefined);
      setRetryAttempt((attempt) => attempt + 1);
    },
  };
}
