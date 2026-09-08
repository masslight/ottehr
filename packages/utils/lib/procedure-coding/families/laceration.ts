import { procedureTypeMatchesFamily } from '../family-routing';
import { familyDetection, ProcedureFamilyModel, ProcedureStructuredField } from '../model.types';
import { defendLacerationCodes } from './laceration.defend';
import { isComplexRepairCode, isLacerationRepairCode } from './laceration.rules';
import { suggestLacerationCode } from './laceration.suggest';

export { isRepairDepthSelection, REPAIR_DEPTH_OPTIONS, repairDepthDisplayLabel } from '../format';
export type {
  ComplexRepairElement,
  ComplexRepairSiteGroup,
  LacerationFacts,
  LacerationRepairClass,
  LacerationSiteGroup,
  LacerationWound,
} from './laceration.extract';
export { extractLacerationFacts } from './laceration.extract';
export { COMPLEX_REPAIR_MIN_CM, isComplexRepairCode, isLacerationRepairCode } from './laceration.rules';

export {
  LACERATION_CONTAMINATION_PAYER_NOTE,
  LACERATION_TISSUE_ADHESIVE_PAYER_NOTE,
  complexRepairSiteGroup,
  lacerationSiteGroup,
  resolveRepairClass,
} from './laceration.shared';

export type {
  OutsideScopeRepair,
  RepairClassOutcome,
  RepairClassResolution,
  ResolvedRepairClass,
  UndeterminedRepairClass,
} from './laceration.shared';

export const lacerationFamily: ProcedureFamilyModel = {
  id: 'laceration',
  displayName: 'Laceration Repair (Wound Closure)',
  structuredFieldsFor: () => [ProcedureStructuredField.Length, ProcedureStructuredField.RepairDepth],
  ...familyDetection(
    (input) => procedureTypeMatchesFamily('laceration', input.procedureType),
    (input) => (input.cptCodes ?? []).some((c) => isLacerationRepairCode(c.code) || isComplexRepairCode(c.code))
  ),
  suggestCode: suggestLacerationCode,
  defendCodes: defendLacerationCodes,
};
