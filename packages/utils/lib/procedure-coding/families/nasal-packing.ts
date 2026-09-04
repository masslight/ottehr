import { procedureTypeMatchesFamily } from '../family-routing';
import { familyDetection, ProcedureFamilyModel } from '../model.types';
import { defendNasalPackingCodes } from './nasal-packing.defend';
import { isNasalPackingCode } from './nasal-packing.rules';
import { suggestNasalPackingCode } from './nasal-packing.suggest';

export { extractNasalPackingFacts } from './nasal-packing.extract';
export type { NasalPackingComplexityElement, NasalPackingFacts, NasalPackingLocation } from './nasal-packing.extract';
export { isNasalPackingCode } from './nasal-packing.rules';

export const nasalPackingFamily: ProcedureFamilyModel = {
  id: 'nasal-packing',
  displayName: 'Nasal Packing (Epistaxis Control)',
  structuredFieldsFor: () => [],
  ...familyDetection(
    (input) => procedureTypeMatchesFamily('nasal-packing', input.procedureType),
    (input) => (input.cptCodes ?? []).some((c) => isNasalPackingCode(c.code))
  ),
  suggestCode: suggestNasalPackingCode,
  defendCodes: defendNasalPackingCodes,
};
