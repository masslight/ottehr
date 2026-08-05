// Core types for the procedure coding model (see procedure-coding-assist-design.md §2/§3).
// Pure data types (plus small composition helpers) — no React, no FHIR SDK, no network.

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

/**
 * Stored codes for the structured "Repair depth" select (conditional input for
 * repair-class-banded families, design §6). The first four determine the repair class
 * (simple vs intermediate); the adhesive selections mean no sutures/staples were used —
 * tissue adhesive alone still bills as a simple repair, adhesive strips alone do not
 * support a repair code.
 */
export type RepairDepthSelection =
  | 'superficial-single'
  | 'subcutaneous-single'
  | 'subcutaneous-layered'
  | 'fascia-muscle-layered'
  | 'tissue-adhesive-only'
  | 'strips-only';

/** A single fact with its provenance: where it came from and (for text) the verbatim snippet it cites. */
export interface FactValue<T> {
  value: T;
  confidence: FactConfidence;
  /** Verbatim snippet from the provider's documentation that establishes this fact (requirement C1). */
  sourceText?: string;
}

/**
 * Where a documentation element belongs on the procedure form: a named form field, or the
 * free-text Procedure details with a micro-example of what to write. Each family keeps a
 * table of these so every missing-element finding tells the provider where to record the
 * element (folded into the finding message — the UI renders a single string).
 */
export interface WhereToDocument {
  /** Destination phrase with its preposition, e.g. 'in the Site/location field' or 'to Procedure details'. */
  destination: string;
  /** Micro-example of what to write there, e.g. `"Layered closure" or "Single-layer closure"`. */
  example?: string;
}

/** Composes the "where to record it" sentence appended to a missing-element finding message. */
export function whereToDocumentClause(where: WhereToDocument, verb = 'Add it'): string {
  return `${verb} ${where.destination}${where.example ? `, e.g. ${where.example}` : ''}.`;
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

/** An add-on code billed alongside a primary suggestion (e.g. +13133 × 2 for length beyond 7.5 cm). */
export interface CodeSuggestionAddOn {
  code: string;
  /** How many units of the add-on code the documented facts support. */
  units: number;
  display: string;
  justification: string;
}

/** A determined code suggestion with its plain-language justification (requirement A1). */
export interface CodeSuggestion {
  code: string;
  display: string;
  /** Names the determinants, e.g. "Intermediate repair — layered closure documented; hand; 3.2 cm → 12042". */
  justification: string;
  /**
   * Add-on codes billed alongside `code` (compound suggestions, e.g. 13132 + 13133 × 2).
   * The primary `display` string also carries the add-on so a single suggestion row reads complete.
   */
  addOns?: CodeSuggestionAddOn[];
}

/** The family-agnostic result of one evaluation direction (forward suggest / inverse defend). */
export interface FamilyEvaluation {
  /** Present only when the documented facts determine a single code. */
  suggestion?: CodeSuggestion;
  /** Present when determinants are missing: the genuinely open options (requirement A2). */
  openCandidates?: CodeCandidate[];
  /**
   * Compact engine-composed line for the open set, present only when the candidates narrow to a
   * single code table (e.g. "12041–12047 — wound length (cm) determines the exact code"). The UI renders it verbatim.
   */
  openCandidatesSummary?: string;
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

/** A fresh, empty per-direction evaluation for a family model to fill in. */
export function emptyFamilyEvaluation(): FamilyEvaluation {
  return { findings: [], supportedCodes: [], notAssessedCodes: [] };
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
  /** Structured repair depth (conditional select); extraction prefers it over text-derived class/adhesive facts. */
  repairDepth?: RepairDepthSelection;
}

/**
 * One procedure family model. Every family exports the same interface so the
 * evaluators and the UI stay family-agnostic.
 */
export interface ProcedureFamilyModel {
  id: string;
  displayName: string;
  /** True when this family's code selection uses the structured length/size (cm) input (design §6). */
  usesStructuredLength?: boolean;
  /** True when this family's code selection uses the structured Repair depth select (design §6). */
  usesStructuredRepairDepth?: boolean;
  /** Family detection from the procedureType string and/or selected CPT codes. */
  detect(input: ProcedureFactsInput): boolean;
  /** Deterministic fact extraction (structured fields first, then details-text patterns). */
  extractFacts(input: ProcedureFactsInput): unknown;
  /** Forward: facts → code (or open candidate set + missing-determinant findings). */
  suggestCode(input: ProcedureFactsInput): FamilyEvaluation;
  /** Inverse: selected codes → per-code gaps and contradictions. */
  defendCodes(input: ProcedureFactsInput): FamilyEvaluation;
}
