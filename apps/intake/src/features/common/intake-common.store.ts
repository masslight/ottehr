import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { AvailableLocationInformation } from '../../api/zapehrApi';

interface IntakeCommonState {
  networkError: boolean;
  redirectDestination?: string;
  lastUsedLocationPath?: string;
}

interface CommonStoreActions {
  clear: (redirect?: string) => void;
  setLastUsedLocationPath: (location: AvailableLocationInformation) => void;
}

export const useIntakeCommonStore = create<IntakeCommonState & CommonStoreActions>()(
  persist(
    (set) => ({
      networkError: false,
      clear: (redirect?: string) => {
        set({
          networkError: false,
          redirectDestination: redirect,
        });
      },
      setLastUsedLocationPath: (location: AvailableLocationInformation) => {
        const locationState = location.address?.state;
        if (locationState) {
          set((state) => ({
            ...state,
            lastUsedLocationPath: `location/${locationState}/${location.slug}/prebook`,
          }));
        }
      },
    }),
    { name: 'ip-intake-common-state' }
  )
);
