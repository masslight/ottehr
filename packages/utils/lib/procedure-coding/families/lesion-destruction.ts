import { procedureTypeMatchesFamily } from '../family-routing';
import { familyDetection, ProcedureFamilyModel } from '../model.types';
import { defendLesionDestructionCodes } from './lesion-destruction.defend';
import { isLesionDestructionCode } from './lesion-destruction.rules';
import { suggestLesionDestructionCode } from './lesion-destruction.suggest';

export { extractLesionDestructionFacts } from './lesion-destruction.extract';
export type { ExcludedLesionType, LesionDestructionFacts } from './lesion-destruction.extract';
export { isLesionDestructionCode, LESION_COUNT_BOUNDARY } from './lesion-destruction.rules';

export const lesionDestructionFamily: ProcedureFamilyModel = {
  id: 'lesion-destruction',
  displayName: 'Wart / Benign Lesion Destruction',
  structuredFieldsFor: () => [],
  ...familyDetection(
    (input) => procedureTypeMatchesFamily('lesion-destruction', input.procedureType),
    (input) => (input.cptCodes ?? []).some((c) => isLesionDestructionCode(c.code))
  ),
  suggestCode: suggestLesionDestructionCode,
  defendCodes: defendLesionDestructionCodes,
};
