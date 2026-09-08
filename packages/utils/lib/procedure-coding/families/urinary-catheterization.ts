import { procedureTypeMatchesFamily } from '../family-routing';
import { familyDetection, ProcedureFamilyModel } from '../model.types';
import { defendUrinaryCatheterizationCodes } from './urinary-catheterization.defend';
import { isUrinaryCatheterizationCode } from './urinary-catheterization.rules';
import { suggestUrinaryCatheterizationCode } from './urinary-catheterization.suggest';

export { extractUrinaryCatheterizationFacts } from './urinary-catheterization.extract';
export type { UrinaryCatheterizationFacts, UrinaryCatheterType } from './urinary-catheterization.extract';
export { isUrinaryCatheterizationCode } from './urinary-catheterization.rules';

export const urinaryCatheterizationFamily: ProcedureFamilyModel = {
  id: 'urinary-catheterization',
  displayName: 'Urinary Catheterization',
  structuredFieldsFor: () => [],
  ...familyDetection(
    (input) => procedureTypeMatchesFamily('urinary-catheterization', input.procedureType),
    (input) => (input.cptCodes ?? []).some((c) => isUrinaryCatheterizationCode(c.code))
  ),
  suggestCode: suggestUrinaryCatheterizationCode,
  defendCodes: defendUrinaryCatheterizationCodes,
};
