import { FhirResource, List, MedicationAdministration, ServiceRequest } from 'fhir/r4b';
import { CODE_SYSTEM_ICD_10, DiagnosisDTO, FHIR_IDC10_VALUESET_SYSTEM, TemplateSectionAction } from 'utils';

// Local const so that DEPRECATED system doesn't get imported from utils
const ICD_10_CODE_SYSTEM = 'http://hl7.org/fhir/sid/icd-10';

// Reverse the conversion the create flow does when it writes reasonCode from
// DiagnosisDTOs. We lose `isPrimary` here, which is fine - the saved order
// doesn't carry that flag.
export const diagnosesFromReasonCode = (plan: ServiceRequest | MedicationAdministration): DiagnosisDTO[] => {
  return (plan.reasonCode ?? [])
    .map((rc) => {
      const icd =
        rc.coding?.find(
          (c) =>
            c.system === CODE_SYSTEM_ICD_10 ||
            // legacy system
            c.system === FHIR_IDC10_VALUESET_SYSTEM ||
            // legacy system
            c.system === ICD_10_CODE_SYSTEM
        ) ?? rc.coding?.[0];
      return {
        code: icd?.code ?? '',
        display: icd?.display ?? rc.text ?? '',
        isPrimary: false,
      };
    })
    .filter((d) => d.code || d.display);
};

export const noteFromPlan = (plan: ServiceRequest): string | undefined => {
  const joined = (plan.note ?? [])
    .map((n) => n.text ?? '')
    .filter((t) => t.length > 0)
    .join('\n\n');
  return joined.length > 0 ? joined : undefined;
};

/**
 * For both external and in house labs
 * @param templateList
 * @param action
 * @returns
 */
export const collectDxClaimedByLabPlans = (
  templateList: List,
  action: TemplateSectionAction,
  planDiscrimator: (maybePlan: FhirResource) => maybePlan is ServiceRequest
): DiagnosisDTO[] => {
  if (action === 'skip') return [];
  // to de-deupe across many plans with the same dx
  const seen = new Set<string>();
  const out: DiagnosisDTO[] = [];
  const plans = (templateList.contained ?? []).filter(planDiscrimator);
  for (const plan of plans) {
    for (const dx of diagnosesFromReasonCode(plan)) {
      if (dx.code && !seen.has(dx.code)) {
        seen.add(dx.code);
        out.push(dx);
      }
    }
  }
  return out;
};
