// Core types for the procedure coding model (see procedure-coding-assist-design.md §2/§3).
// Pure data types — no React, no FHIR SDK, no network.

/**
 * Requirement level of a documentation element, per the functional requirements §4:
 * - 'determines'    [D] — without it the correct code within the family cannot be known
 * - 'required'      [R] — an auditor expects it to defend the selected code
 * - 'contradiction' [C] — the documented value actively disqualifies the selected code
 * - 'bestPractice'  [B] — clinically expected, not code-critical
 */
export type RequirementLevel = 'determines' | 'required' | 'contradiction' | 'bestPractice';

/** How a fact was established: a structured form field, deterministic text parsing, or AI extraction. */
export type FactConfidence = 'structured' | 'text' | 'ai';

/** A single fact with its provenance: where it came from and (for text) the verbatim snippet it cites. */
export interface FactValue<T> {
  value: T;
  confidence: FactConfidence;
  /** Verbatim snippet from the provider's documentation that establishes this fact (requirement C1). */
  sourceText?: string;
}

/** One evaluation finding, shown in either the suggestion or the defense section. */
export interface Finding {
  level: RequirementLevel;
  /** Plain-language message, phrased as documentation completeness (requirement C2). */
  message: string;
  /** The selected CPT code this finding concerns; absent for entry-level findings. */
  cptCode?: string;
  /** Verbatim snippet from the provider's documentation the finding cites (requirement C1). */
  sourceText?: string;
  /** Provenance of the fact(s) behind this finding. */
  confidence?: FactConfidence;
  /** Payer-specific informational footnote attached to the rule (requirement C3) — rendered separately. */
  payerNote?: string;
}

/** A CPT code reference as captured on the procedure form. */
export interface CptCodeRef {
  code: string;
  display: string;
}

/** A candidate code presented when determinants are missing (the genuinely open options). */
export interface CodeCandidate {
  code: string;
  display: string;
}

/** A determined code suggestion with its plain-language justification (requirement A1). */
export interface CodeSuggestion {
  code: string;
  display: string;
  /** Names the determinants, e.g. "Intermediate repair — layered closure documented; hand; 3.2 cm → 12042". */
  justification: string;
}

/** The family-agnostic result of one evaluation direction (forward suggest / inverse defend). */
export interface FamilyEvaluation {
  /** Present only when the documented facts determine a single code. */
  suggestion?: CodeSuggestion;
  /** Present when determinants are missing: the genuinely open options (requirement A2). */
  openCandidates?: CodeCandidate[];
  findings: Finding[];
  /** Selected codes whose [D]/[R] elements are all documented with no contradictions. */
  supportedCodes: string[];
  /** Selected codes the engine will not judge (outside scope) — reported, never guessed (requirement B7). */
  notAssessedCodes: string[];
  /** True when the whole entry could not be assessed (e.g. outside-scope documentation). */
  notAssessed?: boolean;
  notAssessedReason?: string;
  /** Entry-level payer footnotes (requirement C3). */
  payerNotes?: string[];
}

export interface EvaluationResult extends FamilyEvaluation {
  /** Detected family id (e.g. 'laceration'); undefined when no family matched. */
  family?: string;
  /** Provenance stamp for the rule tables, e.g. 'CPT 2026' (requirement C4). */
  rulesVintage: string;
}

/**
 * Plain snapshot of the procedure form used as evaluation input.
 * All fields optional — absence is meaningful (it drives "missing" findings).
 */
export interface ProcedureFactsInput {
  procedureType?: string;
  bodySite?: string;
  otherBodySite?: string;
  bodySide?: string;
  technique?: string[];
  suppliesUsed?: string[];
  otherSuppliesUsed?: string;
  medicationUsed?: string;
  procedureDetails?: string;
  specimenSent?: boolean;
  timeSpent?: string;
  cptCodes?: CptCodeRef[];
  diagnoses?: CptCodeRef[];
  /** Structured wound length in cm (conditional input); extraction prefers it over text-derived lengths. */
  lengthCm?: number;
}

/**
 * One procedure family model. Every family exports the same interface so the
 * evaluators and the UI stay family-agnostic.
 */
export interface ProcedureFamilyModel {
  id: string;
  displayName: string;
  /** Family detection from the procedureType string and/or selected CPT codes. */
  detect(input: ProcedureFactsInput): boolean;
  /** Deterministic fact extraction (structured fields first, then details-text patterns). */
  extractFacts(input: ProcedureFactsInput): unknown;
  /** Forward: facts → code (or open candidate set + missing-determinant findings). */
  suggestCode(input: ProcedureFactsInput): FamilyEvaluation;
  /** Inverse: selected codes → per-code gaps and contradictions. */
  defendCodes(input: ProcedureFactsInput): FamilyEvaluation;
}
