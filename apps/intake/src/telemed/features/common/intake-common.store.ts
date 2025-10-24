import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface IntakeCommonState extends LocationState {
  supportDialogOpen: boolean;
  error: string;
}

export interface LocationState {
  selectedLocationState: string;
}

export const initialLocationState: LocationState = {
  selectedLocationState: '',
};

const initialIntakeCommonState: IntakeCommonState = {
  supportDialogOpen: false,
  error: '',
  ...initialLocationState,
};

export const useIntakeCommonStore = create<IntakeCommonState>()(
  persist(
    () => ({
      ...initialIntakeCommonState,
    }),
    {
      name: 'telemed-intake-common-storage',
    }
  )
);
