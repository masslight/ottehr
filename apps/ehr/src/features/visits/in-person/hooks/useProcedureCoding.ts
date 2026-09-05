import { useQueries } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { useApiClients } from 'src/hooks/useAppClients';
import { codingDispatch, detectProcedureCodingFamily, ProcedureFamilyFactsMap } from 'utils/lib/procedure-coding';
import { FamilyManifest, PROCEDURE_FAMILY_MANIFESTS } from 'utils/lib/procedure-coding/manifests';
import {
  DefendResult,
  ProcedureCodingFamilyId,
  ProcedureDocInput,
  StructuredProcedureFacts,
  SuggestResult,
} from 'utils/lib/procedure-coding/model.types';

// Deterministic evaluations are pure and instant; the debounce only keeps them
// from running on every keystroke in the free-text fields.
const EVALUATION_DEBOUNCE_MS = 500;

// TODO(payer): derive from the encounter's coverage instead of stubbing 'other'.
const PAYER_TYPE_STUB = 'other' as const;

export interface UseProcedureCodingInput {
  /** The selected procedure type's ValueSet code (not its display name). */
  procedureTypeCode: string | undefined;
  structuredFacts: StructuredProcedureFacts | undefined;
  doc: ProcedureDocInput;
  selectedCptCodes: string[];
}

export interface UseProcedureCodingResult {
  /** Coding family for the selected procedure type (synchronous, not debounced). */
  family: ProcedureCodingFamilyId | undefined;
  /** Field manifest driving the structured-facts inputs for that family. */
  manifest: FamilyManifest | undefined;
  /** Forward evaluation: structured facts → suggested claim lines / flags. */
  suggestion: SuggestResult | undefined;
  /** Inverse evaluation: selected codes → per-code supported / not-supported / not-assessed. */
  defense: DefendResult | undefined;
}

interface ProcedureEvaluations {
  suggestion: SuggestResult;
  defense: DefendResult;
}

/**
 * Resolves official descriptors for CPT/HCPCS codes through the Oystehr
 * terminology service (the same service the manual code search uses), so no
 * licensed descriptor text ships in this open-source package. Returns whatever
 * has resolved so far; callers fall back to the bare code.
 */
export function useCptDescriptors(codes: string[]): Record<string, string> {
  const { oystehr } = useApiClients();
  const uniqueCodes = [...new Set(codes)].sort();
  const results = useQueries({
    queries: uniqueCodes.map((code) => ({
      queryKey: ['cpt-descriptor', code],
      enabled: oystehr != null,
      staleTime: Infinity,
      queryFn: async (): Promise<{ code: string; display: string | undefined }> => {
        const search = code.match(/^[A-Z]/)
          ? await oystehr?.terminology.searchHcpcs({ query: code, searchType: 'all', limit: 10 })
          : await oystehr?.terminology.searchCpt({ query: code, searchType: 'all', limit: 10 });
        return { code, display: search?.codes.find((entry) => entry.code === code)?.display };
      },
    })),
  });
  return Object.fromEntries(
    results.flatMap((result) => (result.data?.display != null ? [[result.data.code, result.data.display]] : []))
  );
}

/**
 * Runs the declarative coding dispatch (suggest/defend) over the page's
 * structured facts on a short debounce. Client-side and synchronous — the sole
 * code-suggestion source on the procedure page.
 */
export function useProcedureCoding(input: UseProcedureCodingInput): UseProcedureCodingResult {
  const family = detectProcedureCodingFamily(input.procedureTypeCode);
  const [evaluations, setEvaluations] = useState<ProcedureEvaluations | undefined>(undefined);

  // Re-evaluate on content changes only; the ref keeps unrelated re-renders
  // (which produce a new input object each time) from resetting the debounce timer.
  const inputRef = useRef(input);
  inputRef.current = input;
  const evaluationKey = JSON.stringify({ family, ...input });

  useEffect(() => {
    if (family == null) {
      setEvaluations(undefined);
      return;
    }
    const timeoutId = setTimeout(() => {
      const { structuredFacts, doc, selectedCptCodes } = inputRef.current;
      // Facts from a different family (mid procedure-type switch) don't apply.
      const { family: _factsFamily, ...bareFacts } =
        structuredFacts?.family === family ? structuredFacts : ({ family } as StructuredProcedureFacts);
      const facts = {
        ...bareFacts,
        ...(family === 'iv-catheter-placement'
          ? { venous_payer_type: PAYER_TYPE_STUB }
          : { payer_type: PAYER_TYPE_STUB }),
      } as ProcedureFamilyFactsMap[typeof family];
      try {
        setEvaluations({
          suggestion: codingDispatch.suggest(family, facts, doc),
          defense: codingDispatch.defend(family, facts, doc, selectedCptCodes),
        });
      } catch (error) {
        // A bad table edit must fail visibly on the page, not silently kill suggestions.
        console.error('procedure coding dispatch failed', error);
        const flags = [`engine_error:${error instanceof Error ? error.message : String(error)}`];
        setEvaluations({
          suggestion: { codes: [], requiredDocumentation: [], payerNotes: [], flags, review: true },
          defense: { codes: [], payerNotes: [], flags },
        });
      }
    }, EVALUATION_DEBOUNCE_MS);
    return () => clearTimeout(timeoutId);
  }, [evaluationKey, family]);

  return {
    family,
    manifest: family != null ? PROCEDURE_FAMILY_MANIFESTS[family] : undefined,
    suggestion: family != null ? evaluations?.suggestion : undefined,
    defense: family != null ? evaluations?.defense : undefined,
  };
}
