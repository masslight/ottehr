// Fixed-code procedure types — functional requirements §12 (the lighter treatment).
// Each of these types maps to exactly one code with nothing for documentation to determine:
// nursemaid's-elbow reduction (24640), nail trephination / subungual hematoma (11740),
// nebulizer treatment (94640), and IV catheter placement (36000). The forward assist
// confirms the type's single code; the defense supports it when its few basic [R] elements
// are documented and reports any OTHER selected code "not assessed" — these types have
// legitimate edge billing the model does not cover, so it never contradicts.
//
// The remaining no-code types (staple/suture removal, oral rehydration, nasal lavage —
// captured by the visit charge) are deliberately NOT registered here: leaving them without
// a family keeps the honest default (no suggestion; any selected code gets the standard
// not-assessed line) instead of inventing a "covered by the visit" verdict.
//
// These families register AFTER every full family so they can never shadow one.

import { extractSite } from '../extract';
import {
  emptyFamilyEvaluation,
  FamilyEvaluation,
  Finding,
  ProcedureFactsInput,
  ProcedureFamilyModel,
  WhereToDocument,
  whereToDocumentClause,
} from '../model.types';

// ── Spec and generator ─────────────────────────────────────────────────────────

interface FixedCodeRequirement {
  /** Facts key, also used for the extractFacts snapshot. */
  key: string;
  /** True when the element is documented (structured fields first, then details text). */
  documented: (input: ProcedureFactsInput, text: string) => boolean;
  /** What is missing, phrased as documentation completeness ("«Element» is not documented"). */
  missing: string;
  where: WhereToDocument;
}

interface FixedCodeSpec {
  id: string;
  displayName: string;
  code: string;
  codeDisplay: string;
  /** Matches the product procedure type display and slug (and CPT-descriptor type shapes). */
  typePattern: RegExp;
  /** Names the procedure in the one-line justification. */
  procedureLabel: string;
  /** The minimal per-type [R] set (2–3 basics an auditor expects; everything else stays [B] territory). */
  requirements: FixedCodeRequirement[];
}

/** Outcome/tolerance: the structured Patient response field, or outcome language in the text. */
function outcomeDocumented(input: ProcedureFactsInput, text: string, pattern: RegExp): boolean {
  return Boolean(input.patientResponse?.trim()) || pattern.test(text);
}

/** Site: the structured body-site fields, or a recognized site keyword in the text. */
function siteDocumented(input: ProcedureFactsInput, text: string): boolean {
  return Boolean(input.bodySite?.trim() || input.otherBodySite?.trim()) || extractSite(input, text) !== undefined;
}

function buildFixedCodeFamily(spec: FixedCodeSpec): ProcedureFamilyModel {
  const suggest = (_input: ProcedureFactsInput): FamilyEvaluation => {
    const evaluation = emptyFamilyEvaluation();
    evaluation.suggestion = {
      code: spec.code,
      display: `${spec.code} — ${spec.codeDisplay}`,
      justification: `${spec.procedureLabel} bills a single code → ${spec.code}.`,
    };
    return evaluation;
  };

  const defend = (input: ProcedureFactsInput): FamilyEvaluation => {
    const evaluation = emptyFamilyEvaluation();
    const { findings, supportedCodes, notAssessedCodes } = evaluation;
    const selected = input.cptCodes ?? [];
    if (selected.length === 0) return evaluation;

    const text = input.procedureDetails ?? '';
    for (const selectedCode of selected) {
      const code = selectedCode.code;
      if (code !== spec.code) {
        // Never contradicted: edge billing beyond the fixed code is outside this model's scope.
        notAssessedCodes.push(code);
        continue;
      }
      const codeFindings: Finding[] = [];
      for (const requirement of spec.requirements) {
        if (!requirement.documented(input, text)) {
          codeFindings.push({
            level: 'required',
            cptCode: code,
            message: `${requirement.missing} for ${code}. ${whereToDocumentClause(requirement.where)}`,
          });
        }
      }
      if (codeFindings.length === 0) {
        supportedCodes.push(code);
      }
      findings.push(...codeFindings);
    }
    return evaluation;
  };

  return {
    id: spec.id,
    displayName: spec.displayName,
    detect(input: ProcedureFactsInput): boolean {
      const typeMatches = spec.typePattern.test(input.procedureType ?? '');
      const codeMatches = (input.cptCodes ?? []).some((c) => c.code === spec.code);
      return typeMatches || codeMatches;
    },
    extractFacts(input: ProcedureFactsInput): unknown {
      const text = input.procedureDetails ?? '';
      return Object.fromEntries(spec.requirements.map((r) => [r.key, r.documented(input, text)]));
    },
    suggestCode: suggest,
    defendCodes: defend,
  };
}

// ── The fixed-code specs ───────────────────────────────────────────────────────

const DETAILS_FIELD_LABEL = 'Procedure details';
const TO_DETAILS = `to ${DETAILS_FIELD_LABEL}`;

// "Reduction of Nursemaid's Elbow" (slug "elbow-reduction").
export const nursemaidElbowFamily = buildFixedCodeFamily({
  id: 'nursemaid-elbow',
  displayName: "Reduction of Nursemaid's Elbow",
  code: '24640',
  codeDisplay: 'Closed treatment of radial head subluxation in child (nursemaid elbow), with manipulation',
  typePattern: /nursemaid|radial\s+head\s+subluxation|elbow[\s-]reduction/i,
  procedureLabel: "Reduction of a nursemaid's elbow",
  requirements: [
    {
      key: 'lateralityDocumented',
      documented: (input, text) => Boolean(input.bodySide) || /\b(?:left|right)\b/i.test(text),
      missing: 'Laterality is not documented',
      where: { destination: 'in the Side of body field' },
    },
    {
      key: 'maneuverDocumented',
      documented: (_input, text) => /reduc\w*|manipulat\w*|supinat\w*|hyperpronat\w*|pronat\w*/i.test(text),
      missing: 'The reduction maneuver is not documented',
      where: { destination: TO_DETAILS, example: '"hyperpronation maneuver with palpable click"' },
    },
    {
      key: 'outcomeDocumented',
      documented: (input, text) =>
        outcomeDocumented(
          input,
          text,
          /(?:using|moving|resumed\s+use\s+of|full\s+use\s+of|normal\s+use\s+of)[^.;\n]{0,16}\barm|palpable\s+(?:click|clunk)|\bclick\b|tolerat\w*/i
        ),
      missing: 'The outcome is not documented',
      where: { destination: TO_DETAILS, example: '"child using the arm normally within minutes"' },
    },
  ],
});

// "Nail Trephination (Subungual Hematoma Drainage)" (slug "nail-trephination") — also written
// as subungual hematoma evacuation.
export const nailTrephinationFamily = buildFixedCodeFamily({
  id: 'nail-trephination',
  displayName: 'Nail Trephination (Subungual Hematoma Drainage)',
  code: '11740',
  codeDisplay: 'Evacuation of subungual hematoma',
  typePattern: /trephinat\w*|subungual\s+hematoma/i,
  procedureLabel: 'Subungual hematoma evacuation',
  requirements: [
    {
      key: 'siteDocumented',
      documented: (input, text) => siteDocumented(input, text) || /\bnail\b|\bdigit\b/i.test(text),
      missing: 'The affected digit is not documented',
      where: { destination: 'in the Site/location field' },
    },
    {
      key: 'methodDocumented',
      documented: (_input, text) =>
        /trephin\w*|cauter\w*|(?:heated|hot)\s+paper\s*clip|electrocautery|\bdrill\w*|\bneedle\b|punctur\w*/i.test(
          text
        ),
      missing: 'The trephination method is not documented',
      where: { destination: TO_DETAILS, example: '"nail plate trephinated with electrocautery"' },
    },
    {
      key: 'outcomeDocumented',
      documented: (input, text) =>
        outcomeDocumented(input, text, /drain\w*|evacuat\w*|expressed|decompress\w*|relie(?:f|ved)|tolerat\w*/i),
      missing: 'The outcome is not documented',
      where: { destination: TO_DETAILS, example: '"old blood expressed with immediate relief"' },
    },
  ],
});

// "Nebulizer Treatment (e.g., Albuterol)" (slug "nebulizer-treatment") — also recognized from
// the 94640 CPT descriptor shape ("… inhalation treatment … nebulizer …").
export const nebulizerFamily = buildFixedCodeFamily({
  id: 'nebulizer',
  displayName: 'Nebulizer Treatment',
  code: '94640',
  codeDisplay: 'Pressurized or nonpressurized inhalation treatment for acute airway obstruction (nebulizer)',
  typePattern: /nebuliz\w*|inhalation\s+treatment/i,
  procedureLabel: 'A nebulizer treatment',
  requirements: [
    {
      key: 'medicationDocumented',
      documented: (input, text) =>
        Boolean(input.medicationUsed?.trim()) ||
        /albuterol|levalbuterol|xopenex|duoneb|ipratropium|atrovent|racemic\s+epinephrine|saline/i.test(text),
      missing: 'The medication is not documented',
      where: { destination: 'in the Anaesthesia / medication used field', example: '"albuterol 2.5 mg nebulized"' },
    },
    {
      key: 'responseDocumented',
      documented: (input, text) =>
        outcomeDocumented(
          input,
          text,
          /post[-\s]?treatment|re-?exam\w*|re-?assess\w*|improv\w*|decreased\s+work\s+of\s+breathing|air\s+entry|breath\s+sounds|wheez\w*|tolerat\w*/i
        ),
      missing: 'The post-treatment response is not documented',
      where: { destination: TO_DETAILS, example: '"post-treatment: improved air entry, minimal wheezing"' },
    },
  ],
});

// "Intravenous (IV) Catheter Placement" (slug "iv-catheter-placement") — a different service
// from IV fluid administration, which the injection/infusion family owns.
export const ivCatheterPlacementFamily = buildFixedCodeFamily({
  id: 'iv-catheter-placement',
  displayName: 'Intravenous (IV) Catheter Placement',
  code: '36000',
  codeDisplay: 'Introduction of needle or intracatheter, vein',
  typePattern: /iv[\s-]*catheter|intravenous[^.;\n]{0,24}catheter/i,
  procedureLabel: 'IV catheter placement',
  requirements: [
    {
      key: 'siteDocumented',
      documented: (input, text) => siteDocumented(input, text) || /antecubital|\bvein\b/i.test(text),
      missing: 'The insertion site is not documented',
      where: { destination: 'in the Site/location field' },
    },
    {
      key: 'whatWasDoneDocumented',
      documented: (_input, text) =>
        /\d{2}\s*(?:g|ga|gauge)\b|angiocath|catheter\s+(?:inserted|placed|advanced)|attempts?\b/i.test(text),
      missing: 'The catheter placement is not described',
      where: { destination: TO_DETAILS, example: '"22 g catheter placed in the left antecubital vein, first attempt"' },
    },
    {
      key: 'outcomeDocumented',
      documented: (input, text) =>
        outcomeDocumented(
          input,
          text,
          /flush\w*|patent|blood\s+return|flash(?:back)?\b|saline\s+lock|secured|tolerat\w*/i
        ),
      missing: 'The outcome is not documented',
      where: { destination: TO_DETAILS, example: '"flushes easily, secured with tegaderm"' },
    },
  ],
});

/** Registered after every full family (order preserved here) so fixed codes never shadow one. */
export const FIXED_CODE_FAMILIES: ProcedureFamilyModel[] = [
  nursemaidElbowFamily,
  nailTrephinationFamily,
  nebulizerFamily,
  ivCatheterPlacementFamily,
];
