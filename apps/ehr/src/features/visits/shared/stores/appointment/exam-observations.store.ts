import { ExamObservationDTO } from 'utils';
import { create } from 'zustand';

type ExamObservationsState = Record<string, ExamObservationDTO>;

export const useExamObservationsStore = create<ExamObservationsState>()(() => ({}));

type ExamObservationsInitializationState = {
  hasInitialData: boolean;
};

export const useExamObservationsInitializationStore = create<ExamObservationsInitializationState>()(() => ({
  hasInitialData: false,
}));
