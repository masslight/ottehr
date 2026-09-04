import { procedureTypeMatchesFamily } from '../family-routing';
import { familyDetection, ProcedureFamilyModel } from '../model.types';
import { defendCerumenCodes } from './cerumen.defend';
import { isCerumenRemovalCode } from './cerumen.rules';
import { suggestCerumenCode } from './cerumen.suggest';

export { extractCerumenFacts } from './cerumen.extract';
export { isCerumenRemovalCode } from './cerumen.rules';
export { CERUMEN_BILATERAL_PAYER_NOTE, CERUMEN_IRRIGATION_PAYER_NOTE } from './cerumen.shared';

export const cerumenFamily: ProcedureFamilyModel = {
  id: 'cerumen',
  displayName: 'Impacted Cerumen Removal',
  structuredFieldsFor: () => [],
  ...familyDetection(
    (input) => procedureTypeMatchesFamily('cerumen', input.procedureType),
    (input) => (input.cptCodes ?? []).some((c) => isCerumenRemovalCode(c.code))
  ),
  suggestCode: suggestCerumenCode,
  defendCodes: defendCerumenCodes,
};
