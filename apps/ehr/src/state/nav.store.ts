import { create } from 'zustand';

export type AppTab =
  | 'In Person'
  | 'Telemedicine'
  | 'Schedules'
  | 'Employees'
  | 'Patients'
  | 'Telemedicine:Admin'
  | 'Tasks';

interface NavState {
  currentTab?: string;
}

export const useNavStore = create<NavState>()(() => ({
  currentTab: undefined,
}));
