import { procedureTypeMatchesFamily } from '../family-routing';
import { familyDetection, ProcedureFamilyModel } from '../model.types';
import { defendSplintingCodes } from './splinting.defend';
import { isSplintingCode } from './splinting.rules';
import { suggestSplintingCode } from './splinting.suggest';

export { extractSplintingFacts } from './splinting.extract';
export type { SplintingFacts, SplintRegion, StrappingRegion, StrapSiteRegion } from './splinting.extract';
export { isSplintingCode } from './splinting.rules';

export const splintingFamily: ProcedureFamilyModel = {
  id: 'splinting',
  displayName: 'Splinting & Strapping',
  structuredFieldsFor: () => [],
  ...familyDetection(
    (input) => procedureTypeMatchesFamily('splinting', input.procedureType),
    (input) => (input.cptCodes ?? []).some((c) => isSplintingCode(c.code))
  ),
  suggestCode: suggestSplintingCode,
  defendCodes: defendSplintingCodes,
};
