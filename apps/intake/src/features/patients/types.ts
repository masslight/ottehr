import { PatientInfo } from 'utils';

export const ReasonForVisitOptions: string[] = [
  'Cough and/or congestion',
  'Throat pain',
  'Eye concern',
  'Fever',
  'Ear pain',
  'Vomiting and/or diarrhea',
  'Abdominal (belly) pain',
  'Rash or skin issue',
  'Urinary problem',
  'Breathing problem',
  'Injury to arm',
  'Injury to leg',
  'Injury to head',
  'Injury (Other)',
  'Cut to arm or leg',
  'Cut to face or head',
  'Removal of sutures/stitches/staples',
  'Choked or swallowed something',
  'Allergic reaction to medication or food',
  'Other',
];

export const PatientSexOptions: string[] = ['male', 'female', 'other'];

export interface PatientInfoInProgress extends Omit<PatientInfo, 'patientDateOfBirth'> {
  dobYear: string | undefined;
  dobMonth: string | undefined;
  dobDay: string | undefined;
}
