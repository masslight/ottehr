import { create } from 'zustand';

export type AppTab = 'In Person' | 'Telemedicine' | 'Offices' | 'Employees' | 'Patients' | 'Telemedicine:Admin';

interface NavState {
  currentTab?: string;
}

export const useNavStore = create<NavState>()(() => ({}));
