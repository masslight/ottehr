import { procedureTypeMatchesFamily } from '../family-routing';
import { familyDetection, ProcedureFamilyModel } from '../model.types';
import { defendEkgCodes } from './ekg.defend';
import { isEkgCode } from './ekg.rules';
import { suggestEkgCode } from './ekg.suggest';

export { extractEkgFacts } from './ekg.extract';
export type { EkgFacts, EkgInterpretationElement } from './ekg.extract';
export { isEkgCode } from './ekg.rules';

export const ekgFamily: ProcedureFamilyModel = {
  id: 'ekg',
  displayName: 'Diagnostic EKG',
  structuredFieldsFor: () => [],
  ...familyDetection(
    (input) => procedureTypeMatchesFamily('ekg', input.procedureType),
    (input) => (input.cptCodes ?? []).some((c) => isEkgCode(c.code))
  ),
  suggestCode: suggestEkgCode,
  defendCodes: defendEkgCodes,
};
