import { create } from 'zustand';
import { persist } from 'zustand/middleware';
interface IntakeCommonState {
  selectedLocationState: string;
}

const initialIntakeCommonState: IntakeCommonState = {
  selectedLocationState: '',
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
