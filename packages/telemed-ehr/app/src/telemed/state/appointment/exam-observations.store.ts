import { create } from 'zustand';
import { ExamCardsNames, ExamFieldsNames, ExamObservationDTO } from 'ehr-utils';
import { ExamObservationCardsDetails, ExamObservationFieldsDetails } from '../../utils';

type ExamObservationsState = { [field in ExamFieldsNames | ExamCardsNames]: ExamObservationDTO };

export const EXAM_OBSERVATIONS_CARDS: { [field in ExamCardsNames]: ExamObservationDTO } = Object.values(
  ExamObservationCardsDetails
).reduce((previousValue, currentValue) => {
  previousValue[currentValue.field] = { field: currentValue.field, note: currentValue.defaultValue };
  return previousValue;
}, {} as { [field in ExamCardsNames]: ExamObservationDTO });

export const EXAM_OBSERVATIONS_FIELDS: { [field in ExamFieldsNames]: ExamObservationDTO } = Object.values(
  ExamObservationFieldsDetails
).reduce((previousValue, currentValue) => {
  previousValue[currentValue.field] = { field: currentValue.field, value: currentValue.defaultValue };
  return previousValue;
}, {} as { [field in ExamFieldsNames]: ExamObservationDTO });

export const EXAM_OBSERVATIONS_INITIAL: ExamObservationsState = {
  ...EXAM_OBSERVATIONS_CARDS,
  ...EXAM_OBSERVATIONS_FIELDS,
};

export const useExamObservationsStore = create<ExamObservationsState>()(() => ({
  ...EXAM_OBSERVATIONS_INITIAL,
}));
