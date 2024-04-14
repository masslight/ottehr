import { create } from 'zustand';
import { DateTime } from 'luxon';
import { PatientFilterType, TelemedAppointmentInformation } from 'ehr-utils';

type TrackingBoardState = {
  appointments: TelemedAppointmentInformation[];
  alignment: PatientFilterType;
  date: DateTime | null;
  state: string | null;
  availableStates: string[];
};

type TrackingBoardStoreActions = {
  setAlignment: (_: any, alignment: PatientFilterType | null) => void;
  setDate: (date: DateTime | null) => void;
  setAppointments: (appointments: TelemedAppointmentInformation[]) => void;
};

const TRACKING_BOARD_INITIAL: TrackingBoardState = {
  appointments: [],
  alignment: 'my-patients',
  date: DateTime.local(),
  state: null,
  availableStates: [],
};

export const useTrackingBoardStore = create<TrackingBoardState & TrackingBoardStoreActions>()((set) => ({
  ...TRACKING_BOARD_INITIAL,
  setAlignment: (_, alignment) => {
    if (alignment !== null) {
      set(() => ({
        alignment,
      }));
    }
  },
  setDate: (date) => {
    set(() => ({
      date,
    }));
  },
  setAppointments: (appointments) => {
    set(() => ({
      appointments,
    }));
  },
}));
