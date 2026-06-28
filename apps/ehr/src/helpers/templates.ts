import { TemplateCptCodeInfo, TemplateProcedurePlan } from 'utils';

export const formatCptCodeAndModifiersForDisplay = (info: TemplateCptCodeInfo): string => {
  return `${info.code}${info.modifiers.length ? `-${info.modifiers.map((mod) => mod.display).join(',-')}` : ''}`;
};

export interface ProcedureDisplayField {
  label: string;
  value: string;
  /** Whether the value can span multiple lines and should render with whiteSpace: pre-wrap. */
  multiline?: boolean;
}

// Picks the procedure form fields that have a non-empty value, in the order
// they should display. Used by the apply-template preview dialog and the admin
// detail page so the two surfaces stay in sync. Booleans render as Yes/No so
// the provider doesn't have to interpret 'true'/'false'.
export const getProcedureDisplayFields = (plan: TemplateProcedurePlan): ProcedureDisplayField[] => {
  const yesNo = (v: boolean | undefined): string | undefined => (v === undefined ? undefined : v ? 'Yes' : 'No');
  return [
    { label: 'Performer type', value: plan.performerType ?? '' },
    { label: 'Body site', value: plan.bodySite ?? '' },
    { label: 'Body side', value: plan.bodySide ?? '' },
    { label: 'Technique', value: plan.technique.join(', ') },
    { label: 'Medication used', value: plan.medicationUsed ?? '' },
    { label: 'Supplies used', value: plan.suppliesUsed ?? '' },
    { label: 'Specimen sent', value: yesNo(plan.specimenSent) ?? '' },
    { label: 'Complications', value: plan.complications ?? '' },
    { label: 'Patient response', value: plan.patientResponse ?? '' },
    { label: 'Time spent', value: plan.timeSpent ?? '' },
    { label: 'Documented by', value: plan.documentedBy ?? '' },
    { label: 'Consent obtained', value: yesNo(plan.consentObtained) ?? '' },
    { label: 'Procedure details', value: plan.procedureDetails ?? '', multiline: true },
    { label: 'Post-procedure instructions', value: plan.postInstructions ?? '', multiline: true },
  ].filter((f) => f.value.length > 0);
};
