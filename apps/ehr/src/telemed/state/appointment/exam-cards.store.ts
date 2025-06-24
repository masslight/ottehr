import { ExamTabCardNames, InPersonExamTabProviderCardNames } from 'utils';
import { create } from 'zustand';

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

type InPersonExamCardsState = { [name in InPersonExamTabProviderCardNames]: boolean };

export const IN_PERSON_EXAM_CARDS_INITIAL: InPersonExamCardsState = {
  general: false,
  skin: false,
  hair: false,
  nails: false,
  head: false,
  eyes: false,
  ears: false,
  nose: false,
  mouth: false,
  teeth: false,
  pharynx: false,
  neck: false,
  heart: false,
  lungs: false,
  abdomen: false,
  back: false,
  rectal: false,
  extremities: false,
  musculoskeletal: false,
  neurologic: false,
  psychiatric: false,
};

export const useInPersonExamCardsStore = create<InPersonExamCardsState>()(() => ({
  ...IN_PERSON_EXAM_CARDS_INITIAL,
}));
