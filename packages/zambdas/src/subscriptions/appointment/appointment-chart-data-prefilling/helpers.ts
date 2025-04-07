import { QuestionnaireResponse } from 'fhir/r4b';
import {
  AdditionalBooleanQuestionsFieldsNames,
  convertToBoolean,
  ExamCardsNames,
  ExamFieldsNames,
  ExamObservationDTO,
  ExamObservationFieldsDetails,
  getQuestionnaireResponseByLinkId,
  InPersonExamFieldsNames,
  InPersonExamObservationFieldsDetails,
  ObservationDTO,
} from 'utils';

type ExamRecord = { [field in ExamCardsNames | ExamFieldsNames]?: ExamObservationDTO };

const objectToArray: (object: ExamRecord) => ExamObservationDTO[] = (object) => Object.values(object);

export const createAdditionalQuestions = (questionnaireResponse: QuestionnaireResponse): ObservationDTO[] => {
  return Object.values(AdditionalBooleanQuestionsFieldsNames)
    .filter((field) => {
      const response = getQuestionnaireResponseByLinkId(field, questionnaireResponse);
      const valueString = response?.answer?.[0]?.valueString;
      return valueString !== undefined;
    })
    .map((field) => {
      const response = getQuestionnaireResponseByLinkId(field, questionnaireResponse);
      const valueString = response?.answer?.[0]?.valueString;
      return {
        field,
        value: convertToBoolean(valueString) || false,
      };
    });
};

export function createExamObservations(isInPersonAppointment?: boolean): ExamObservationDTO[] {
  const examObservations = Object.values(
    isInPersonAppointment ? InPersonExamObservationFieldsDetails : ExamObservationFieldsDetails
  ).reduce(
    (previousValue, currentValue) => {
      previousValue[currentValue.field] = { field: currentValue.field, value: currentValue.defaultValue };
      return previousValue;
    },
    isInPersonAppointment
      ? ({} as { [field in InPersonExamFieldsNames]: ExamObservationDTO })
      : ({} as { [field in ExamFieldsNames]: ExamObservationDTO })
  );

  return objectToArray(examObservations);
}
