import { PatientInfo } from 'ottehr-utils';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

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
    { name: 'telemed-patients-storage' },
  ),
);
