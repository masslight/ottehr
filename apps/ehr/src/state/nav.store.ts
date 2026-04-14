import { create } from 'zustand';

export type AppTab = 'Tracking Board' | 'Schedules' | 'Employees' | 'Patients' | 'Admin' | 'Tasks';

interface NavState {
  currentTab?: string;
}

export const useNavStore = create<NavState>()(() => ({
  currentTab: undefined,
}));
