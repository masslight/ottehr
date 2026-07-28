import { extractSite, textFlag, textMention } from '../extract';
import { procedureTypeMatchesFamily } from '../family-routing';
import {
  blocksSupport,
  MEDICATION_FIELD_LABEL,
  PATIENT_RESPONSE_FIELD_LABEL,
  SIDE_FIELD_LABEL,
  SITE_FIELD_LABEL,
  TO_DETAILS,
} from '../family-support';
import {
  citing,
  CodeAssessmentKind,
  codeScope,
  determinedCode,
  emptyDefenseEvaluation,
  emptySuggestionEvaluation,
  ENTRY_SCOPE,
  FactValue,
  familyDetection,
  FamilyEvaluation,
  fieldEvidence,
  Finding,
  notAssessedCode,
  NOTHING_TO_CITE,
  ProcedureFactsInput,
  ProcedureFamilyModel,
  setCodeAssessment,
  WhereToDocument,
  whereToDocumentClause,
} from '../model.types';

type TextMatcher = (text: string, pattern: RegExp) => FactValue<true> | undefined;

interface FixedCodeRequirement {
  key: string;
  documented: (input: ProcedureFactsInput, text: string) => FactValue<true> | undefined;
  missing: string;
  where: WhereToDocument;
}

interface FixedCodeNote {
  key: string;
  detect: (input: ProcedureFactsInput, text: string) => FactValue<true> | undefined;
  message: string;
}

interface FixedCodeScopeExit {
  key: string;
  detect: (input: ProcedureFactsInput, text: string) => FactValue<true> | undefined;
  reason: string;
}

const FIXED_PROCEDURE_CODES = {
  nursemaidElbowReduction: '24640',
  nailTrephination: '11740',
  nebulizerTreatment: '94640',
  ivCatheterPlacement: '36000',
} as const;

type FixedProcedureCode = (typeof FIXED_PROCEDURE_CODES)[keyof typeof FIXED_PROCEDURE_CODES];

interface FixedCodeSpec {
  id: string;
  displayName: string;
  code: FixedProcedureCode;
  codeDisplay: string;
  procedureLabel: string;
  requirements: FixedCodeRequirement[];
  notes?: FixedCodeNote[];
  scopeExits?: FixedCodeScopeExit[];
  payerNote?: string;
}

function structuredFact(field: string): FactValue<true> {
  return { value: true, evidence: fieldEvidence(field) };
}

function outcomeDocumented(
  input: ProcedureFactsInput,
  text: string,
  pattern: RegExp,
  match: TextMatcher = textFlag
): FactValue<true> | undefined {
  return (
    match(text, pattern) ?? (input.patientResponse?.trim() ? structuredFact(PATIENT_RESPONSE_FIELD_LABEL) : undefined)
  );
}

function siteDocumented(input: ProcedureFactsInput, text: string): FactValue<true> | undefined {
  if (input.bodySite?.trim() || input.otherBodySite?.trim()) return structuredFact(SITE_FIELD_LABEL);
  const site = extractSite(input, text);
  if (site === undefined) return undefined;
  return { value: true, evidence: site.evidence };
}

function buildFixedCodeFamily(spec: FixedCodeSpec): ProcedureFamilyModel {
  const firstScopeExit = (
    input: ProcedureFactsInput,
    text: string
  ): { exit: FixedCodeScopeExit; fact: FactValue<true> } | undefined => {
    for (const exit of spec.scopeExits ?? []) {
      const fact = exit.detect(input, text);
      if (fact) return { exit, fact };
    }
    return undefined;
  };

  const noteFindings = (input: ProcedureFactsInput, text: string, code: string): Finding[] =>
    (spec.notes ?? []).flatMap((note) => {
      const fact = note.detect(input, text);
      return fact
        ? [
            {
              level: 'bestPractice' as const,
              scope: codeScope(code),
              message: note.message,
              evidence: citing(fact),
            },
          ]
        : [];
    });

  const suggest = (input: ProcedureFactsInput): FamilyEvaluation => {
    const evaluation = emptySuggestionEvaluation();
    const text = input.procedureDetails ?? '';
    if (spec.payerNote) evaluation.payerNotes = [spec.payerNote];

    const scopeExit = firstScopeExit(input, text);
    if (scopeExit) {
      evaluation.findings.push({
        level: 'bestPractice',
        scope: ENTRY_SCOPE,
        message: scopeExit.exit.reason,
        evidence: citing(scopeExit.fact),
      });
      evaluation.outcome = notAssessedCode(scopeExit.exit.reason);
      return evaluation;
    }

    evaluation.outcome = determinedCode({
      code: spec.code,
      display: `${spec.code} — ${spec.codeDisplay}`,
      justification: `${spec.procedureLabel} bills a single code → ${spec.code}.`,
    });
    evaluation.findings.push(...noteFindings(input, text, spec.code));
    return evaluation;
  };

  const defend = (input: ProcedureFactsInput): FamilyEvaluation => {
    const evaluation = emptyDefenseEvaluation();
    const { findings } = evaluation;
    const selected = input.cptCodes ?? [];
    if (selected.length === 0) return evaluation;

    const text = input.procedureDetails ?? '';
    const scopeExit = firstScopeExit(input, text);
    for (const selectedCode of selected) {
      const code = selectedCode.code;

      if (code !== spec.code) {
        setCodeAssessment(evaluation, code, CodeAssessmentKind.NotAssessed);
        continue;
      }

      if (spec.payerNote) evaluation.payerNotes = [spec.payerNote];

      if (scopeExit) {
        findings.push({
          level: 'bestPractice',
          scope: codeScope(code),
          message: scopeExit.exit.reason,
          evidence: citing(scopeExit.fact),
        });
        setCodeAssessment(evaluation, code, CodeAssessmentKind.NotAssessed);
        evaluation.outcome = notAssessedCode(scopeExit.exit.reason);
        continue;
      }

      const codeFindings: Finding[] = [];
      for (const requirement of spec.requirements) {
        if (requirement.documented(input, text) === undefined) {
          codeFindings.push({
            level: 'required',
            scope: codeScope(code),
            message: `${requirement.missing} for ${code}. ${whereToDocumentClause(requirement.where)}`,
            evidence: NOTHING_TO_CITE,
          });
        }
      }
      codeFindings.push(...noteFindings(input, text, code));

      if (!blocksSupport(codeFindings)) {
        setCodeAssessment(evaluation, code, CodeAssessmentKind.Supported);
      } else {
        setCodeAssessment(evaluation, code, CodeAssessmentKind.Unsupported);
      }
      findings.push(...codeFindings);
    }
    return evaluation;
  };

  return {
    id: spec.id,
    displayName: spec.displayName,
    structuredFieldsFor: () => [],
    ...familyDetection(
      (input) => procedureTypeMatchesFamily(spec.id, input.procedureType),
      (input) => (input.cptCodes ?? []).some((c) => c.code === spec.code)
    ),
    suggestCode: suggest,
    defendCodes: defend,
  };
}

const ELBOW_LATERALITY_PATTERN =
  /\b(?:left|right|bilateral)\b[^.;,\n]{0,16}\b(?:elbow|arm|forearm|radial\s+head)\b|\b(?:elbow|arm|forearm|radial\s+head)\b[^.;,\n]{0,16}\b(?:left|right)\b/i;

const REDUCTION_MANEUVER_PATTERN =
  /hyperpronat\w*|supinat\w*|pronat\w*|manipulat\w*|reduc\w*[^.;\n]{0,24}\b(?:maneuver|manoeuvre|click|clunk)\b|\b(?:maneuver|manoeuvre)\b[^.;\n]{0,24}reduc\w*/i;

export const nursemaidElbowFamily = buildFixedCodeFamily({
  id: 'nursemaid-elbow',
  displayName: "Reduction of Nursemaid's Elbow",
  code: FIXED_PROCEDURE_CODES.nursemaidElbowReduction,
  codeDisplay: 'Closed treatment of radial head subluxation in child (nursemaid elbow), with manipulation',
  procedureLabel: "Reduction of a nursemaid's elbow",
  requirements: [
    {
      key: 'lateralityDocumented',
      documented: (input, text) =>
        input.bodySide?.trim() ? structuredFact(SIDE_FIELD_LABEL) : textFlag(text, ELBOW_LATERALITY_PATTERN),
      missing: 'Laterality is not documented',
      where: { destination: 'in the Side of body field' },
    },
    {
      key: 'maneuverDocumented',
      documented: (_input, text) => textFlag(text, REDUCTION_MANEUVER_PATTERN),
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

const MULTIPLE_NAILS_PATTERN =
  /\b(?:two|three|four|both|multiple|several)\s+(?:finger|toe)?\s?nails?\b|\b(?:two|three|four|multiple)\s+(?:digits|fingers|toes)\b/i;

export const nailTrephinationFamily = buildFixedCodeFamily({
  id: 'nail-trephination',
  displayName: 'Nail Trephination (Subungual Hematoma Drainage)',
  code: FIXED_PROCEDURE_CODES.nailTrephination,
  codeDisplay: 'Evacuation of subungual hematoma',
  procedureLabel: 'Subungual hematoma evacuation',
  requirements: [
    {
      key: 'siteDocumented',
      documented: (input, text) => siteDocumented(input, text) ?? textFlag(text, /\bnails?\b|\bdigit\b/i),
      missing: 'The affected digit is not documented',
      where: { destination: 'in the Site/location field' },
    },
    {
      key: 'methodDocumented',
      documented: (_input, text) =>
        textFlag(
          text,
          /trephin\w*|cauter\w*|(?:heated|hot)\s+paper\s*clip|electrocautery|\bdrill\w*|\bneedle\b|punctur\w*/i
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
  notes: [
    {
      key: 'multipleNailsDocumented',
      detect: (_input, text) => textFlag(text, MULTIPLE_NAILS_PATTERN),
      message: `11740 is reported per nail, and the note describes more than one nail — the number of units follows the number of nails trephinated, so name each one. ${whereToDocumentClause(
        { destination: TO_DETAILS, example: '"left index and left middle fingernails each trephinated"' },
        'Record them'
      )}`,
    },
  ],
});

const NEBULIZER_MEDICATION_PATTERN =
  /albuterol|salbutamol|levalbuterol|xopenex|duoneb|ipratropium|atrovent|racemic\s+epinephrine|budesonide|pulmicort|(?:hypertonic|[357]\s*%)\s+saline/i;

const MULTIPLE_TREATMENTS_PATTERN =
  /\b(?:two|three|four|2|3|4)\s+(?:back[-\s]?to[-\s]?back\s+)?(?:\w+\s+){0,2}?(?:neb\w*|treatments?|duonebs?)\b|back[-\s]?to[-\s]?back\s+(?:neb\w*|treatments?)|(?:second|third|repeat(?:ed)?|additional)\s+(?:neb\w*|treatments?)|\bnebs\b[^.;\n]{0,20}\bx\s*[2-9]\b|\bq\s*20\s*min/i;

const CONTINUOUS_TREATMENT_PATTERN =
  /continuous(?:ly)?\s+(?:neb\w*|inhalation|albuterol|treatment)|(?:neb\w*|inhalation|albuterol)[^.;\n]{0,20}\bcontinuous(?:ly)?\b/i;

export const nebulizerFamily = buildFixedCodeFamily({
  id: 'nebulizer',
  displayName: 'Nebulizer Treatment',
  code: FIXED_PROCEDURE_CODES.nebulizerTreatment,
  codeDisplay: 'Pressurized or nonpressurized inhalation treatment for acute airway obstruction (nebulizer)',
  procedureLabel: 'A nebulizer treatment',
  requirements: [
    {
      key: 'medicationDocumented',
      documented: (input, text) =>
        textFlag(text, NEBULIZER_MEDICATION_PATTERN) ??
        (input.medicationUsed?.trim() ? structuredFact(MEDICATION_FIELD_LABEL) : undefined),
      missing: 'The medication is not documented',
      where: { destination: 'in the Anaesthesia / medication used field', example: '"albuterol 2.5 mg nebulized"' },
    },
    {
      key: 'responseDocumented',
      documented: (input, text) =>
        outcomeDocumented(
          input,
          text,
          /post[-\s]?treatment|re-?exam\w*|re-?assess\w*|improv\w*|decreased\s+work\s+of\s+breathing|air\s+entry|breath\s+sounds|wheez\w*|tolerat\w*/i,
          textMention
        ),
      missing: 'The post-treatment response is not documented',
      where: { destination: TO_DETAILS, example: '"post-treatment: improved air entry, minimal wheezing"' },
    },
  ],
  notes: [
    {
      key: 'multipleTreatmentsDocumented',
      detect: (_input, text) => textFlag(text, MULTIPLE_TREATMENTS_PATTERN),
      message:
        '94640 is reported once per encounter, and the note describes more than one treatment — repeat treatments in the same encounter are reported with modifier 76 rather than as extra units of 94640, and how the payer wants them reported is a billing question this model does not resolve. Record each treatment with its time and medication so the repeats can be supported.',
    },
  ],
  scopeExits: [
    {
      key: 'continuousTreatmentDocumented',
      detect: (_input, text) => textFlag(text, CONTINUOUS_TREATMENT_PATTERN),
      reason:
        "The note documents a continuous inhalation treatment, and 94640 covers a discrete treatment — continuous inhalation treatment is timed and reported as 94644 (first hour) plus 94645 (each additional hour), which is outside this model's scope and is not assessed.",
    },
  ],
});

export const IV_CATHETER_BUNDLING_PAYER_NOTE =
  '36000 is bundled (NCCI) into the infusion and injection administration codes 96360-96379: when an infusion or an injection administration is reported for the same encounter, 36000 is generally not separately payable and the access is included in that service. Whether a separate report is ever appropriate here is a payer question this model does not resolve.';

export const ivCatheterPlacementFamily = buildFixedCodeFamily({
  id: 'iv-catheter-placement',
  displayName: 'Intravenous (IV) Catheter Placement',
  code: FIXED_PROCEDURE_CODES.ivCatheterPlacement,
  codeDisplay: 'Introduction of needle or intracatheter, vein',
  procedureLabel: 'IV catheter placement',
  requirements: [
    {
      key: 'siteDocumented',
      documented: (input, text) => siteDocumented(input, text) ?? textFlag(text, /antecubital|\bvein\b/i),
      missing: 'The insertion site is not documented',
      where: { destination: 'in the Site/location field' },
    },
    {
      key: 'whatWasDoneDocumented',
      documented: (_input, text) =>
        textFlag(text, /\d{2}\s*(?:g|ga|gauge)\b|angiocath|catheter\s+(?:inserted|placed|advanced)|attempts?\b/i),
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
  payerNote: IV_CATHETER_BUNDLING_PAYER_NOTE,
});

export const FIXED_CODE_FAMILIES: ProcedureFamilyModel[] = [
  nursemaidElbowFamily,
  nailTrephinationFamily,
  nebulizerFamily,
  ivCatheterPlacementFamily,
];
