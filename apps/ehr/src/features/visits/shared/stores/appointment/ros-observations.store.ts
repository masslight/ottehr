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

let rosStoreGeneration = 0;

/** Bumped on every store reset, so writes started for a previous chart can tell they are stale. */
export const getRosStoreGeneration = (): number => rosStoreGeneration;

export const bumpRosStoreGeneration = (): void => {
  rosStoreGeneration += 1;
};
