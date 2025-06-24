import {
  ExamCardsNames,
  ExamFieldsNames,
  ExamObservationCardsDetails,
  ExamObservationDTO,
  ExamObservationFieldsDetails,
  InPersonExamCardsNames,
  InPersonExamFieldsNames,
  InPersonExamObservationCardsDetails,
  InPersonExamObservationFieldsDetails,
} from 'utils';
import { create } from 'zustand';

type ExamObservationsState = { [field in ExamFieldsNames | ExamCardsNames]: ExamObservationDTO };

export const EXAM_OBSERVATIONS_CARDS: { [field in ExamCardsNames]: ExamObservationDTO } = Object.values(
  ExamObservationCardsDetails
).reduce(
  (previousValue, currentValue) => {
    previousValue[currentValue.field] = { field: currentValue.field, note: currentValue.defaultValue };
    return previousValue;
  },
  {} as { [field in ExamCardsNames]: ExamObservationDTO }
);

export const EXAM_OBSERVATIONS_FIELDS: { [field in ExamFieldsNames]: ExamObservationDTO } = Object.values(
  ExamObservationFieldsDetails
).reduce(
  (previousValue, currentValue) => {
    previousValue[currentValue.field] = { field: currentValue.field, value: currentValue.defaultValue };
    return previousValue;
  },
  {} as { [field in ExamFieldsNames]: ExamObservationDTO }
);

export const EXAM_OBSERVATIONS_INITIAL: ExamObservationsState = {
  ...EXAM_OBSERVATIONS_CARDS,
  ...EXAM_OBSERVATIONS_FIELDS,
};

export const useExamObservationsStore = create<ExamObservationsState>()(() => ({
  ...EXAM_OBSERVATIONS_INITIAL,
}));

// in-person

type InPersonExamObservationsState = {
  [field in InPersonExamCardsNames | InPersonExamFieldsNames]: ExamObservationDTO;
};

export const IN_PERSON_EXAM_OBSERVATIONS_CARDS: { [field in InPersonExamCardsNames]: ExamObservationDTO } =
  Object.values(InPersonExamObservationCardsDetails).reduce(
    (previousValue, currentValue) => {
      previousValue[currentValue.field] = { field: currentValue.field, note: currentValue.defaultValue };
      return previousValue;
    },
    {} as { [field in InPersonExamCardsNames]: ExamObservationDTO }
  );

export const IN_PERSON_EXAM_OBSERVATIONS_FIELDS: { [field in InPersonExamFieldsNames]: ExamObservationDTO } =
  Object.values(InPersonExamObservationFieldsDetails).reduce(
    (previousValue, currentValue) => {
      previousValue[currentValue.field] = { field: currentValue.field, value: currentValue.defaultValue };
      return previousValue;
    },
    {} as { [field in InPersonExamFieldsNames]: ExamObservationDTO }
  );

export const IN_PERSON_EXAM_OBSERVATIONS_INITIAL: InPersonExamObservationsState = {
  ...IN_PERSON_EXAM_OBSERVATIONS_CARDS,
  ...IN_PERSON_EXAM_OBSERVATIONS_FIELDS,
};

export const useInPersonExamObservationsStore = create<InPersonExamObservationsState>()(() => ({
  ...IN_PERSON_EXAM_OBSERVATIONS_INITIAL,
}));
