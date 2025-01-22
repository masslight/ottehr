import { PatientInfo } from 'utils';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { zustandDevtools } from '../../utils';

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
  middleName: undefined,
  lastName: undefined,
  chosenName: undefined,
  dateOfBirth: undefined,
  sex: undefined,
  email: undefined,
  weight: undefined,
  weightLastUpdated: undefined,
};

const NEW_PATIENT_INFO: PatientInfo = {
  ...BLANK_PATIENT_INFO,
  newPatient: true,
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
    { name: 'telemed-patient-info-storage' }
  )
);

zustandDevtools('Telemed patient info', usePatientInfoStore);
