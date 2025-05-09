import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { zustandDevtools } from '../../utils';

interface AppointmentState {
  appointmentID?: string;
  appointmentDate?: string;
  // appointmentSlot?: string;
}

const APPOINTMENT_STATE_INITIAL: AppointmentState = {};

interface AppointmentStateActions {
  setState: (state: Partial<AppointmentState>) => void;
}

export const useAppointmentStore = create<AppointmentState & AppointmentStateActions>()(
  persist((set) => ({ ...APPOINTMENT_STATE_INITIAL, setState: (state) => set({ ...state }) }), {
    name: 'telemed-appointment-storage',
  })
);

zustandDevtools('Telemed appointment', useAppointmentStore);
