import { create } from 'zustand';

export type AppTab = 'Urgent Care' | 'Telemedicine' | 'Offices' | 'Employees' | 'Patients' | 'Telemedicine:Admin';

interface NavState {
  currentTab?: string;
}

export const useNavStore = create<NavState>()(() => ({}));
