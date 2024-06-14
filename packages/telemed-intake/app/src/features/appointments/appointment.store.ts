import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AppointmentState {
  appointmentID?: string;
  appointmentDate?: string;
}

interface AppointmentSlotState {
  visitType?: string;
  selectedSlot?: string;
}

const APOINTMENT_STATE_INITIAL: AppointmentState = {};

interface AppointmentStateActions {
  setState: (state: Partial<AppointmentState>) => void;
}

interface AppointmentSlotStateActions {
  setSlotAndVisitType: (state: Partial<AppointmentSlotState>) => void;
}

export const useAppointmentStore = create<AppointmentState & AppointmentStateActions>()(
  persist((set) => ({ ...APOINTMENT_STATE_INITIAL, setState: (state) => set({ ...state }) }), {
    name: 'telemed-appointment-storage',
  }),
);

export const useSlotsStore = create<AppointmentSlotState & AppointmentSlotStateActions>()(
  persist((set) => ({ setSlotAndVisitType: (slot) => set({ ...slot }) }), {
    name: 'telemed-appointment-slot-storage',
  }),
);

export const usePastVisitsStore = create<AppointmentState & AppointmentStateActions>()(
  persist((set) => ({ ...APOINTMENT_STATE_INITIAL, setState: (state) => set({ ...state }) }), {
    name: 'telemed-past-visits-storage',
  }),
);
