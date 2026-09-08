import { TO_DETAILS, whereClauseFor } from '../family-support';
import { ifPerformedClause, WhereToDocument } from '../model.types';
import { BurnDepthClass, BurnExtentClass, BurnFacts } from './burn-treatment.extract';
import { BURN_CODE_RANGE } from './burn-treatment.rules';

export type { BurnDepthClass, BurnExtentClass, BurnFacts };

export const DEPTH_LABELS: Record<BurnDepthClass, string> = {
  'first-degree': 'a first-degree (superficial epidermal) burn',
  'partial-thickness': 'a partial-thickness (second-degree) burn',
  'full-thickness': 'a full-thickness (third-degree) burn',
};

export function extentPhrase(facts: BurnFacts): string {
  if (facts.tbsaPercent !== undefined) return `${facts.tbsaPercent}% TBSA`;
  const cls = facts.extentClass?.value;
  return cls !== undefined ? `a ${cls} burn` : 'the burn extent';
}

export const EXTENT_ASK_CLAUSE =
  'the treated extent selects the code (16020 small, <5% TBSA; 16025 medium, 5–10%; 16030 large, >10%)';

export const PARTIAL_THICKNESS_CLAUSE = `${BURN_CODE_RANGE} are the dressing and/or debridement codes for partial-thickness burns`;

export const WHERE_TO_DOCUMENT = {
  extent: { destination: TO_DETAILS, example: '"~7% TBSA partial-thickness burn"' },
  site: { destination: 'in the Site/location field' },
  laterality: { destination: 'in the Side of body field' },
  degree: { destination: TO_DETAILS, example: '"partial-thickness (second-degree)"' },
  treatment: { destination: TO_DETAILS, example: '"cleansed, bacitracin and non-adherent dressing applied"' },
} satisfies Record<string, WhereToDocument>;

export const whereClause = whereClauseFor(WHERE_TO_DOCUMENT);

export function firstDegreeMessage(subject: string): string {
  return `${subject} — ${PARTIAL_THICKNESS_CLAUSE}, and the note documents ${
    DEPTH_LABELS['first-degree']
  }. Initial treatment of a first-degree burn is 16000, which is outside this model's scope and is not assessed. ${whereClause(
    'degree',
    ifPerformedClause('dressed or debrided', 'record that depth', 'a partial-thickness burn')
  )}`;
}

export function fullThicknessMessage(subject: string): string {
  return `${subject} — ${PARTIAL_THICKNESS_CLAUSE}, and the note documents ${
    DEPTH_LABELS['full-thickness']
  }. Care directed at a full-thickness burn is coded outside this model's scope and is not assessed. ${whereClause(
    'degree',
    ifPerformedClause('also dressed or debrided', 'record that depth', 'partial-thickness burn')
  )}`;
}

export const MIXED_DEPTH_MESSAGE = `The note documents ${DEPTH_LABELS['partial-thickness']} with full-thickness areas — ${BURN_CODE_RANGE} describe the partial-thickness dressings and/or debridement, and any care directed at the full-thickness areas is coded outside this model's scope (not assessed).`;

export function depthAskMessage(subject: string): string {
  return `The burn depth is not documented${subject} — ${PARTIAL_THICKNESS_CLAUSE}, so the note should record the depth treated (initial treatment of a first-degree burn is 16000 instead). ${whereClause(
    'degree'
  )}`;
}

export function implausibleExtentMessage(subject: string, percent: number): string {
  return `The documented extent (${percent}%) is not a possible share of total body surface area${subject} — TBSA cannot exceed 100%, so the figure is not read as the treated extent and ${EXTENT_ASK_CLAUSE}. ${whereClause(
    'extent',
    'Re-record the extent'
  )}`;
}

export function outOfScopeDepthMessage(depth: BurnDepthClass, subject: string): string | undefined {
  if (depth === 'first-degree') return firstDegreeMessage(subject);
  if (depth === 'full-thickness') return fullThicknessMessage(subject);
  return undefined;
}
