import { ExamObservationDTO } from 'utils';
import { create } from 'zustand';

type ExamObservationsState = { [field: string]: ExamObservationDTO };

export const useExamObservationsStore = create<ExamObservationsState>()(() => ({}));
