import { create } from 'zustand';
import { persist } from 'zustand/middleware';
interface IntakeCommonState {
  selectedLocationState: string;
  supportDialogOpen: boolean;
}

const initialIntakeCommonState: IntakeCommonState = {
  selectedLocationState: '',
  supportDialogOpen: false,
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
