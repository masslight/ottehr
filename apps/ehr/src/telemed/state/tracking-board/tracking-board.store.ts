import { DateTime } from 'luxon';
import { PatientFilterType, TelemedAppointmentInformation } from 'utils';
import { create } from 'zustand';
import { VisitType } from '../../../types/types';
import { UnsignedFor } from '../../utils';

type TrackingBoardState = {
  appointments: TelemedAppointmentInformation[];
  isAppointmentsLoading: boolean;
  alignment: PatientFilterType;
  date: DateTime | null;
  selectedStates: string[] | null;
  providers: string[] | null;
  groups: string[] | null;
  locationsIds: string[] | null;
  unsignedFor: UnsignedFor;
  availableStates: string[];
  showOnlyNext: boolean;
  visitTypes: VisitType[] | null;
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
  locationsIds: null,
  groups: null,
  unsignedFor: UnsignedFor.under12,
  availableStates: [],
  visitTypes: [],
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
