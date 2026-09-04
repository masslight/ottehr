import { TO_DETAILS, whereClauseFor } from '../family-support';
import { WhereToDocument } from '../model.types';
import { UrinaryCatheterizationFacts, UrinaryCatheterType } from './urinary-catheterization.extract';

export type { UrinaryCatheterizationFacts, UrinaryCatheterType };

export const TYPE_LABELS: Record<UrinaryCatheterType, string> = {
  straight: 'a straight (in-and-out) catheterization',
  indwelling: 'an indwelling (Foley) catheter',
};

export const TYPE_ASK_CLAUSE =
  'the catheter type selects the code (51701 straight/in-and-out; 51702 indwelling, e.g. Foley)';

export const TYPE_CONFLICT_CLAUSE =
  'the note documents both straight-catheterization and indwelling-catheter language — please reconcile them';

export const WHERE_TO_DOCUMENT = {
  type: { destination: TO_DETAILS, example: '"straight catheterization" or "Foley catheter placed"' },
  size: { destination: TO_DETAILS, example: '"8 Fr catheter"' },
  indication: { destination: TO_DETAILS, example: '"unable to void; bladder distended"' },
  outcome: { destination: TO_DETAILS, example: '"300 mL clear yellow urine obtained; tolerated well"' },
} satisfies Record<string, WhereToDocument>;

export const whereClause = whereClauseFor(WHERE_TO_DOCUMENT);
