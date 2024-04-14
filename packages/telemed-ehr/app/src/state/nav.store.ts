import { create } from 'zustand';

export type AppTab = 'Urgent Care' | 'Telemed' | 'Offices' | 'Employees' | 'Patients';

interface NavState {
  currentTab?: string;
}

export const useNavStore = create<NavState>()(() => ({}));
