import { zustandDevtools } from 'src/telemed/utils/zustandDevtools';
import { PatientInfo } from 'utils/lib/types/data/telemed/appointments/create-appointment.types';
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
    { name: 'telemed-patients-storage' }
  )
);

zustandDevtools('Telemed patients', usePatientsStore);
