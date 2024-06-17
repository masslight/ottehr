import { create } from 'zustand';
import { persist } from 'zustand/middleware';
interface IntakeCommonState {
  supportDialogOpen: boolean;
}

const initialIntakeCommonState: IntakeCommonState = {
  supportDialogOpen: false,
};

export const useIntakeCommonStore = create<IntakeCommonState>()(
  persist(
    () => ({
      ...initialIntakeCommonState,
    }),
    {
      name: 'telemed-intake-common-storage',
    },
  ),
);
