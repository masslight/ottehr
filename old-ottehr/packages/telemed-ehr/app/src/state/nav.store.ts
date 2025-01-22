import { create } from 'zustand';

export type AppTab = 'In Person' | 'Telemedicine' | 'Schedules' | 'Employees' | 'Patients' | 'Admin';

interface NavState {
  currentTab?: string;
}

export const useNavStore = create<NavState>()(() => ({}));
