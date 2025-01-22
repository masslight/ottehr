import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { zustandDevtools } from '../../utils';

export interface CallSettingsState {
  videoInput: string;
  audioInput: string;
  audioOutput: string;
}

const CALL_SETTINGS_STATE_INITIAL: CallSettingsState = {
  videoInput: '',
  audioInput: '',
  audioOutput: '',
};

export const useCallSettingsStore = create<CallSettingsState>()(
  persist(
    () => ({
      ...CALL_SETTINGS_STATE_INITIAL,
    }),
    { name: 'telemed-call-settings-storage' },
  ),
);

zustandDevtools('Telemed call settings', useCallSettingsStore);
