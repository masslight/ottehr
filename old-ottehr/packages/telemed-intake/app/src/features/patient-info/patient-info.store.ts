import { PatientInfo } from 'ottehr-utils';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type PatientInfoState = {
  patientInfo: PatientInfo;
  pendingPatientInfoUpdates?: PatientInfo;
};

type PatientInfoActions = {
  setNewPatient: () => void;
};

const BLANK_PATIENT_INFO: PatientInfo = {
  id: undefined,
  newPatient: false,
  pointOfDiscovery: false,
  firstName: undefined,
  lastName: undefined,
  dateOfBirth: undefined,
  sex: undefined,
  email: undefined,
  emailUser: 'Patient',
};

const NEW_PATIENT_INFO: PatientInfo = {
  ...BLANK_PATIENT_INFO,
  newPatient: true,
  emailUser: undefined,
};

const PATIENT_INFO_INITIAL: PatientInfoState = {
  patientInfo: BLANK_PATIENT_INFO,
};

export const usePatientInfoStore = create<PatientInfoState & PatientInfoActions>()(
  persist(
    (set) => ({
      ...PATIENT_INFO_INITIAL,
      setNewPatient: () =>
        set({
          patientInfo: { ...NEW_PATIENT_INFO },
          pendingPatientInfoUpdates: undefined,
        }),
    }),
    { name: 'telemed-patient-info-storage' },
  ),
);
