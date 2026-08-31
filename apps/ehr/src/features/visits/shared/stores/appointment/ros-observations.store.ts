import { ExamObservationDTO } from 'utils/lib/types/api/chart-data/chart-data.types';
import { create } from 'zustand';

type RosObservationsState = Record<string, ExamObservationDTO>;

export const useRosObservationsStore = create<RosObservationsState>()(() => ({}));

type RosObservationsInitializationState = {
  hasInitialData: boolean;
};

export const useRosObservationsInitializationStore = create<RosObservationsInitializationState>()(() => ({
  hasInitialData: false,
}));
