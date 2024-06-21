import { create } from 'zustand';

export type AppTab = 'In Person' | 'Telemedicine' | 'Schedules' | 'Employees' | 'Patients' | 'Telemedicine:Admin';

interface NavState {
  currentTab?: string;
}

export const useNavStore = create<NavState>()(() => ({}));
