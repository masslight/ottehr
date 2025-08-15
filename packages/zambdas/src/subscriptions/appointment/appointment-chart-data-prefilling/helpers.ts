import { CodeableConcept, QuestionnaireResponse } from 'fhir/r4b';
import {
  AdditionalBooleanQuestionsFieldsNames,
  convertToBoolean,
  ExamCardComponent,
  ExamDef,
  ExamObservationDTO,
  getQuestionnaireResponseByLinkId,
  ObservationDTO,
} from 'utils';

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

export function createExamObservations(isInPersonAppointment?: boolean): (ExamObservationDTO & {
  code?: CodeableConcept;
  bodySite?: CodeableConcept;
  label?: string;
})[] {
  const config = ExamDef()[isInPersonAppointment ? 'inPerson' : 'telemed'].default.components;

  const observations: (ExamObservationDTO & {
    code?: CodeableConcept;
    bodySite?: CodeableConcept;
    label: string;
  })[] = [];

  // Helper function to recursively extract observations from components
  const extractObservationsFromComponents = (
    components: Record<string, ExamCardComponent>,
    section: 'normal' | 'abnormal' | 'comment'
  ): void => {
    Object.entries(components).forEach(([fieldName, component]) => {
      if (component.type === 'checkbox') {
        // Checkbox component - direct observation
        observations.push({
          field: fieldName,
          value: component.defaultValue || false,
          label: component.label,
          code: component.code,
          bodySite: component.bodySite,
        });
      } else if (component.type === 'dropdown') {
        // Dropdown component - extract from nested options
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
        // Column component - recursive traversal
        extractObservationsFromComponents(component.components, section);
      } else if (component.type === 'form') {
        // Form component - extract from form elements
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
        // Multi-select component - extract from options
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
      // Note: text components don't have observations to extract
    });
  };

  // Process each exam item
  Object.values(config).forEach((examItem) => {
    // Process normal components
    extractObservationsFromComponents(examItem.components.normal, 'normal');
    // Process abnormal components
    extractObservationsFromComponents(examItem.components.abnormal, 'abnormal');
    // Note: comment components are text-only, no observations to extract
  });

  return observations;
}
