import { create } from 'zustand';

export type AppTab = 'Tracking Board' | 'Patients' | 'Admin' | 'Tasks' | 'Reports' | 'Schedule';

interface NavState {
  currentTab?: string;
}

export const useNavStore = create<NavState>()(() => ({
  currentTab: undefined,
}));
