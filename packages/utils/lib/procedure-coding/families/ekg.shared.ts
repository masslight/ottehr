import { DETAILS_FIELD_LABEL, TO_DETAILS, whereClauseFor } from '../family-support';
import { codeScope, Finding, NOTHING_TO_CITE, WhereToDocument } from '../model.types';
import { EKG_INTERPRETATION_ELEMENTS, EkgFacts, EkgInterpretationElement } from './ekg.extract';

export type { EkgFacts, EkgInterpretationElement };

export const FULL_INTERPRETATION_MENU = 'rate, rhythm, axis, intervals, ST-T assessment, and an impression';

export function missingElements(facts: EkgFacts): typeof EKG_INTERPRETATION_ELEMENTS {
  return EKG_INTERPRETATION_ELEMENTS.filter(({ element }) => facts.elements[element] === undefined);
}

export const WHERE_TO_DOCUMENT = {
  interpretation: {
    destination: TO_DETAILS,
    example:
      '"Rate 82, NSR, normal axis, PR 160 / QRS 88 / QTc 410 ms, no acute ST-T changes. Impression: normal EKG."',
  },
  indication: {
    destination: `as a structured diagnosis, or describe the indication in ${DETAILS_FIELD_LABEL}`,
    example: '"chest pain"',
  },
  comparison: { destination: TO_DETAILS, example: '"compared to prior EKG — no change" or "no prior available"' },
} satisfies Record<string, WhereToDocument>;

export const whereClause = whereClauseFor(WHERE_TO_DOCUMENT);

export function missingElementFinding(entry: (typeof EKG_INTERPRETATION_ELEMENTS)[number], code: string): Finding {
  return {
    level: 'required',
    scope: codeScope(code),
    message: `The interpretation's ${entry.label} is not documented for ${code} — a complete interpretation & report records ${FULL_INTERPRETATION_MENU}. Add it ${TO_DETAILS}, e.g. ${entry.example}.`,
    evidence: NOTHING_TO_CITE,
  };
}

export function limitedLeadMessage(subject: string): string {
  return `${subject} — 93000, 93005 and 93010 are all the routine ECG with at least 12 leads, and the note documents a limited-lead tracing (a rhythm or monitor strip). That is 93040-93042 (rhythm ECG, 1-3 leads), which is outside this model's scope and is not assessed.`;
}
