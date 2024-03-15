import { PatientInfo } from 'ottehr-utils';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type PatientInfoState = {
  patientInfo: PatientInfo;
};

type PatientInfoActions = {
  clearPatientInfo: () => void;
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
  reasonForVisit: undefined,
};

const NEW_PATIENT_INFO: PatientInfo = {
  ...BLANK_PATIENT_INFO,
  id: 'new-patient',
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
      clearPatientInfo: () => {
        set(() => ({
          patientInfo: { ...BLANK_PATIENT_INFO },
        }));
      },
      setNewPatient: () =>
        set({
          patientInfo: { ...NEW_PATIENT_INFO },
        }),
    }),
    { name: 'telemed-patient-info-storage' },
  ),
);
