import { procedureTypeMatchesFamily } from '../family-routing';
import { familyDetection, ProcedureFamilyModel, ProcedureStructuredField } from '../model.types';
import { defendInjectionInfusionCodes } from './injection-infusion.defend';
import { INJECTION_CODE_INFO, isInjectionInfusionCode } from './injection-infusion.rules';
import { suggestInjectionInfusionCode } from './injection-infusion.suggest';

export { formatInfusionTimeRange } from '../format';
export type { InfusionDuration, InjectionInfusionFacts } from './injection-infusion.extract';
export {
  extractInfusionDuration,
  extractInjectionInfusionFacts,
  MAX_PLAUSIBLE_INFUSION_MINUTES,
} from './injection-infusion.extract';
export type { InfusionKind, InjectionRoute } from './injection-infusion.rules';
export {
  additionalHourUnits,
  HYDRATION_MINIMUM_MINUTES,
  isInjectionInfusionCode,
  IV_PUSH_MAXIMUM_MINUTES,
} from './injection-infusion.rules';
export { INFUSION_HIERARCHY_PAYER_NOTE, INJECTION_J_CODE_PAYER_NOTE } from './injection-infusion.shared';

export const injectionInfusionFamily: ProcedureFamilyModel = {
  id: 'injection-infusion',
  displayName: 'Therapeutic Injections & IV Infusions',
  structuredFieldsFor: (input) => {
    const procedureType = input.procedureType?.trim() ?? '';

    if (procedureType.length > 0) {
      return /iv[\s-]*(?:fluid|hydration)|\binfusion\b/i.test(procedureType)
        ? [ProcedureStructuredField.InfusionTimes]
        : [];
    }
    return (input.cptCodes ?? []).some(
      (candidate) => isInjectionInfusionCode(candidate.code) && INJECTION_CODE_INFO[candidate.code].route === 'infusion'
    )
      ? [ProcedureStructuredField.InfusionTimes]
      : [];
  },
  ...familyDetection(
    (input) => procedureTypeMatchesFamily('injection-infusion', input.procedureType),
    (input) => (input.cptCodes ?? []).some((c) => isInjectionInfusionCode(c.code))
  ),
  suggestCode: suggestInjectionInfusionCode,
  defendCodes: defendInjectionInfusionCodes,
};
