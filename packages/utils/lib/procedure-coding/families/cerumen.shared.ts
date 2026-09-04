import { DETAILS_FIELD_LABEL, TO_DETAILS, whereClauseFor } from '../family-support';
import { citing, ENTRY_SCOPE, FamilyEvaluation, WhereToDocument } from '../model.types';
import { CerumenFacts } from './cerumen.extract';
import { CERUMEN_CODE_RULES, CerumenMethod } from './cerumen.rules';

export const CERUMEN_IRRIGATION_PAYER_NOTE =
  'Payer note: cerumen removal by irrigation/lavage alone is reported with 69209, not 69210; coverage for 69209 varies by payer.';

export const CERUMEN_BILATERAL_PAYER_NOTE =
  'Payer note: 69209 and 69210 are unilateral per current CPT; how bilateral removal is billed varies by payer.';

export const CERUMEN_BILATERAL_MESSAGE =
  'Bilateral cerumen removal is documented — 69209 and 69210 are unilateral codes, so how the second side is reported is a payer question.';

export const INSTRUMENTATION_MENU = 'curette, cerumen loop, micro-suction, or forceps';

export const WHERE_TO_DOCUMENT = {
  method: { destination: TO_DETAILS, example: '"cerumen removed with curette under direct visualization"' },
  impaction: {
    destination: `as an impacted-cerumen diagnosis (H61.2x), or describe the impaction in ${DETAILS_FIELD_LABEL}`,
    example: '"canal completely occluded by impacted cerumen"',
  },
  laterality: { destination: 'in the Side of body field' },
  postExam: { destination: TO_DETAILS, example: '"canal clear, TM intact"' },
} satisfies Record<string, WhereToDocument>;

export const whereClause = whereClauseFor(WHERE_TO_DOCUMENT);

export function methodAskMessage(code?: string): string {
  if (code === CERUMEN_CODE_RULES.irrigation.code) {
    return `The removal method is not documented for 69209 — it is defined by removal using irrigation/lavage, while removal requiring instrumentation (${INSTRUMENTATION_MENU}) is 69210. ${whereClause(
      'method'
    )}`;
  }
  const subject = code === undefined ? '' : ` for ${code}`;
  return `The removal method is not documented${subject} — 69210 requires removal by instrumentation (${INSTRUMENTATION_MENU}), while irrigation/lavage alone is 69209. ${whereClause(
    'method'
  )}`;
}

export function impactionAskMessage(subject: string): string {
  return `Cerumen impaction is not documented — payers require documented impaction, not routine wax removal, to support ${subject}. ${whereClause(
    'impaction'
  )}`;
}

export function impactionDeniedMessage(subject: string): string {
  return `The note states that the cerumen was not impacted — ${subject} covers removal of impacted cerumen, and routine wax removal is part of the visit (E/M) charge. ${whereClause(
    'impaction',
    'If it was impacted, record it'
  )}`;
}

export function resolveMethod(facts: CerumenFacts): CerumenMethod | undefined {
  if (facts.instrumentationDocumented) return 'instrumentation';
  if (facts.irrigationDocumented) return 'irrigation';
  return undefined;
}

export function addPayerNote(evaluation: FamilyEvaluation, note: string): void {
  if (!evaluation.payerNotes.includes(note)) evaluation.payerNotes.push(note);
}

export function noteBilateralRemoval(evaluation: FamilyEvaluation, facts: CerumenFacts): void {
  if (!facts.bilateralDocumented) return;
  evaluation.findings.push({
    level: 'bestPractice',
    scope: ENTRY_SCOPE,
    message: CERUMEN_BILATERAL_MESSAGE,
    evidence: citing(facts.bilateralDocumented),
    payerNote: CERUMEN_BILATERAL_PAYER_NOTE,
  });
  addPayerNote(evaluation, CERUMEN_BILATERAL_PAYER_NOTE);
}
