import { PatientInfo } from 'utils';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { zustandDevtools } from '../../utils';

type PatientsState = {
  patients: PatientInfo[];
};

const PATIENTS_INITIAL: PatientsState = {
  patients: [],
};

export const usePatientsStore = create<PatientsState>()(
  persist(
    () => ({
      ...PATIENTS_INITIAL,
    }),
    { name: 'telemed-patients-storage' }
  )
);

zustandDevtools('Telemed patients', usePatientsStore);
