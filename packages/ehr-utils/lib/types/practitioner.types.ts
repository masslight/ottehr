export const PractitionerQualificationCodesLabels: Record<PractitionerQualificationCode, string> = {
  MD: 'Doctor of Medicine',
  PA: 'Physician Assistant',
  DO: 'Doctor of Osteopathy',
  NP: 'Nurse Practitioner',
};
export const PractitionerQualificationCodesDisplay = Object.keys(PractitionerQualificationCodesLabels).map((key) => ({
  value: key,
  label: `${key} (${PractitionerQualificationCodesLabels[key as PractitionerQualificationCode]})`,
}));

export type PractitionerQualificationCode = 'MD' | 'PA' | 'DO' | 'NP';

export interface PractitionerLicense {
  state: string;
  code: PractitionerQualificationCode;
}
