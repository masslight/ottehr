import { create } from 'zustand';
import { DateTime } from 'luxon';
import { PatientFilterType, TelemedAppointmentInformation } from 'utils';
import { UnsignedFor } from '../../utils';

type TrackingBoardState = {
  appointments: TelemedAppointmentInformation[];
  isAppointmentsLoading: boolean;
  alignment: PatientFilterType;
  date: DateTime | null;
  selectedStates: string[] | null;
  providers: string[] | null;
  groups: string[] | null;
  unsignedFor: UnsignedFor;
  availableStates: string[];
  showOnlyNext: boolean;
};

type TrackingBoardStoreActions = {
  setAlignment: (_: any, alignment: PatientFilterType | null) => void;
  setAppointments: (appointments: TelemedAppointmentInformation[]) => void;
};

const TRACKING_BOARD_INITIAL: TrackingBoardState = {
  appointments: [],
  isAppointmentsLoading: false,
  alignment: 'my-patients',
  date: DateTime.local(),
  selectedStates: null,
  providers: null,
  groups: null,
  unsignedFor: UnsignedFor.under12,
  availableStates: [],
  showOnlyNext: false,
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
  setAppointments: (appointments) => {
    set(() => ({
      appointments,
    }));
  },
}));
