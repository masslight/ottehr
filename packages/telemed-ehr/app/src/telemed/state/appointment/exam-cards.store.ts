import { create } from 'zustand';
import { ExamTabCardNames } from '../../../types/types';

type ExamCardsState = { [name in ExamTabCardNames]: boolean };

export const EXAM_CARDS_INITIAL: ExamCardsState = {
  vitals: true,
  general: false,
  head: false,
  eyes: false,
  nose: true,
  ears: true,
  mouth: true,
  neck: true,
  chest: false,
  back: true,
  skin: false,
  abdomen: true,
  musculoskeletal: false,
  neurological: false,
  psych: true,
};

export const useExamCardsStore = create<ExamCardsState>()(() => ({
  ...EXAM_CARDS_INITIAL,
}));
