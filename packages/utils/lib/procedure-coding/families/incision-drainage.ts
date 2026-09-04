import { procedureTypeMatchesFamily } from '../family-routing';
import { familyDetection, ProcedureFamilyModel, ProcedureStructuredField } from '../model.types';
import { defendIncisionDrainageCodes } from './incision-drainage.defend';
import { isIncisionDrainageCode } from './incision-drainage.rules';
import { suggestIncisionDrainageCode } from './incision-drainage.suggest';

export { extractIncisionDrainageFacts } from './incision-drainage.extract';
export type {
  IncisionDrainageComplexityElement,
  IncisionDrainageFacts,
  IncisionDrainageOutOfScopeSite,
} from './incision-drainage.extract';
export { isIncisionDrainageCode } from './incision-drainage.rules';

export const incisionDrainageFamily: ProcedureFamilyModel = {
  id: 'incision-drainage',
  displayName: 'Incision & Drainage of Abscess',
  structuredFieldsFor: () => [ProcedureStructuredField.Length],
  ...familyDetection(
    (input) => procedureTypeMatchesFamily('incision-drainage', input.procedureType),
    (input) => (input.cptCodes ?? []).some((c) => isIncisionDrainageCode(c.code))
  ),
  suggestCode: suggestIncisionDrainageCode,
  defendCodes: defendIncisionDrainageCodes,
};
