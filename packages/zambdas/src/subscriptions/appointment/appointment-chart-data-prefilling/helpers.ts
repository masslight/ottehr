import { CodeableConcept, QuestionnaireResponse } from 'fhir/r4b';
import {
  convertToBoolean,
  ExamCardComponent,
  examConfig,
  ExamObservationDTO,
  getQuestionnaireResponseByLinkId,
  ObservationDTO,
  patientScreeningQuestionsConfig,
} from 'utils';

export const createAdditionalQuestions = (questionnaireResponse: QuestionnaireResponse): ObservationDTO[] => {
  const questionnaireFields = patientScreeningQuestionsConfig.fields.filter((field) => field.existsInQuestionnaire);

  return questionnaireFields
    .filter((field) => {
      const response = getQuestionnaireResponseByLinkId(field.fhirField, questionnaireResponse);
      const valueString = response?.answer?.[0]?.valueString;
      return valueString !== undefined;
    })
    .map((field) => {
      const response = getQuestionnaireResponseByLinkId(field.fhirField, questionnaireResponse);
      const valueString = response?.answer?.[0]?.valueString;

      // Convert value based on field type
      let value: any;
      switch (field.type) {
        case 'radio':
        case 'select': {
          // For radio/select, convert to boolean ONLY if it has EXACTLY yes/no options (like COVID questions)
          const hasOnlyYesNoOptions =
            field.options &&
            field.options.length === 2 &&
            field.options.every((opt) => opt.fhirValue === 'yes' || opt.fhirValue === 'no');

          if (hasOnlyYesNoOptions) {
            value = convertToBoolean(valueString) || false;
          } else {
            value = valueString;
          }
          break;
        }
        case 'dateRange':
          // For dateRange, expect comma-separated values or array
          if (valueString?.includes(',')) {
            value = valueString.split(',').map((s) => s.trim());
          } else {
            value = valueString;
          }
          break;
        case 'text':
        case 'textarea':
          value = valueString;
          break;
        default:
          // Fallback: try to convert to boolean for backwards compatibility
          value = convertToBoolean(valueString) || false;
      }

      return {
        field: field.fhirField,
        value,
      };
    });
};

export function createExamObservations(isInPersonAppointment?: boolean): (ExamObservationDTO & {
  code?: CodeableConcept;
  bodySite?: CodeableConcept;
  label?: string;
})[] {
  const config = examConfig[isInPersonAppointment ? 'inPerson' : 'telemed'].default.components;

  const observations: (ExamObservationDTO & {
    code?: CodeableConcept;
    bodySite?: CodeableConcept;
    label: string;
  })[] = [];

  const extractObservationsFromComponents = (
    components: Record<string, ExamCardComponent>,
    section: 'normal' | 'abnormal' | 'comment'
  ): void => {
    Object.entries(components).forEach(([fieldName, component]) => {
      if (component.type === 'checkbox') {
        observations.push({
          field: fieldName,
          value: component.defaultValue || false,
          label: component.label,
          code: component.code,
          bodySite: component.bodySite,
        });
      } else if (component.type === 'dropdown') {
        Object.entries(component.components).forEach(([optionName, option]: [string, any]) => {
          observations.push({
            field: optionName,
            value: option.defaultValue || false,
            label: option.label,
            code: option.code,
            bodySite: option.bodySite,
          });
        });
      } else if (component.type === 'column') {
        extractObservationsFromComponents(component.components, section);
      } else if (component.type === 'form') {
        Object.entries(component.components).forEach(([elementName, element]: [string, any]) => {
          observations.push({
            field: elementName,
            value: element.defaultValue || false,
            label: element.label,
            code: element.code,
            bodySite: element.bodySite,
          });
        });
      } else if (component.type === 'multi-select') {
        Object.entries(component.options).forEach(([optionName, option]: [string, any]) => {
          observations.push({
            field: optionName,
            value: option.defaultValue || false,
            label: option.label,
            code: option.code,
            bodySite: option.bodySite,
          });
        });
      }
    });
  };

  Object.values(config).forEach((examItem) => {
    extractObservationsFromComponents(examItem.components.normal, 'normal');
    extractObservationsFromComponents(examItem.components.abnormal, 'abnormal');
  });

  return observations;
}

export const createExamObservationComments = (
  isInPersonAppointment?: boolean
): (ObservationDTO & { label: string })[] => {
  const config = examConfig[isInPersonAppointment ? 'inPerson' : 'telemed'].default.components;

  const comments: (ObservationDTO & { label: string })[] = [];

  Object.values(config).forEach((examItem) => {
    Object.keys(examItem.components.comment).forEach((fieldName) => {
      comments.push({ field: fieldName, label: examItem.components.comment[fieldName].label });
    });
  });

  return comments;
};
