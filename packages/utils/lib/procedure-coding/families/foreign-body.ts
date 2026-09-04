import { procedureTypeMatchesFamily } from '../family-routing';
import { familyDetection, ProcedureFamilyModel, ProcedureStructuredField } from '../model.types';
import { defendForeignBodyCodes } from './foreign-body.defend';
import { isForeignBodyRemovalCode } from './foreign-body.rules';
import { suggestForeignBodyCode } from './foreign-body.suggest';

export { extractForeignBodyFacts } from './foreign-body.extract';
export type {
  EyeStructure,
  ForeignBodyComplicationElement,
  ForeignBodyFacts,
  ForeignBodySite,
} from './foreign-body.extract';
export { isForeignBodyRemovalCode } from './foreign-body.rules';

export const foreignBodyFamily: ProcedureFamilyModel = {
  id: 'foreign-body',
  displayName: 'Foreign Body Removal',
  structuredFieldsFor: () => [ProcedureStructuredField.Length],
  ...familyDetection(
    (input) => procedureTypeMatchesFamily('foreign-body', input.procedureType),
    (input) => (input.cptCodes ?? []).some((c) => isForeignBodyRemovalCode(c.code))
  ),
  suggestCode: suggestForeignBodyCode,
  defendCodes: defendForeignBodyCodes,
};
