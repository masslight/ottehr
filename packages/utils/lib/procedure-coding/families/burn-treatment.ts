import { procedureTypeMatchesFamily } from '../family-routing';
import { familyDetection, ProcedureFamilyModel } from '../model.types';
import { defendBurnTreatmentCodes } from './burn-treatment.defend';
import { isBurnTreatmentCode } from './burn-treatment.rules';
import { suggestBurnTreatmentCode } from './burn-treatment.suggest';

export { extractBurnFacts } from './burn-treatment.extract';
export type { BurnDepthClass, BurnExtentClass, BurnFacts } from './burn-treatment.extract';
export { burnClassForPercent, isBurnTreatmentCode } from './burn-treatment.rules';

export const burnTreatmentFamily: ProcedureFamilyModel = {
  id: 'burn-treatment',
  displayName: 'Burn Treatment / Dressing',
  structuredFieldsFor: () => [],
  ...familyDetection(
    (input) => procedureTypeMatchesFamily('burn-treatment', input.procedureType),
    (input) => (input.cptCodes ?? []).some((c) => isBurnTreatmentCode(c.code))
  ),
  suggestCode: suggestBurnTreatmentCode,
  defendCodes: defendBurnTreatmentCodes,
};
