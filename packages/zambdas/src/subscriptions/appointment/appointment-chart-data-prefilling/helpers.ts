import type { ExamCardComponent } from 'config-types';
import { Operation } from 'fast-json-patch';
import { Account, CodeableConcept, Encounter, QuestionnaireResponse } from 'fhir/r4b';
import {
  convertToBoolean,
  examConfig,
  ExamObservationDTO,
  getQuestionnaireResponseByLinkId,
  ObservationDTO,
  patientScreeningQuestionsConfig,
} from 'utils';
import { mergeEncounterAccounts } from '../../../ehr/shared/harvest';

export const createAdditionalQuestions = (questionnaireResponse: QuestionnaireResponse): ObservationDTO[] => {
  const questionnaireFields = patientScreeningQuestionsConfig.fields.filter((field) => field.existsInQuestionnaire);

  return questionnaireFields
    .filter((field) => {
      const response = getQuestionnaireResponseByLinkId(field.fhirField, questionnaireResponse);
      const valueString = response?.answer?.[0]?.valueString;
      return valueString !== undefined;
    })
    .map((field) => {
      if (field.type !== 'radio') {
        throw Error('Only radio fields are supported. No options found for field: ' + field.fhirField);
      }

      const response = getQuestionnaireResponseByLinkId(field.fhirField, questionnaireResponse);
      const valueString = response?.answer?.[0]?.valueString;

      const hasOnlyYesNoOptions =
        field.options &&
        field.options.length === 2 &&
        field.options.every((opt) => {
          const lowerCaseValueString = opt.fhirValue.toLowerCase();
          return lowerCaseValueString === 'yes' || lowerCaseValueString === 'no';
        });

      if (!hasOnlyYesNoOptions) {
        throw Error(
          'Only radio fields with Yes/No options are supported. No options found for field: ' + field.fhirField
        );
      }

      const value = convertToBoolean(valueString);

      if (typeof value !== 'boolean') {
        throw Error('Invalid value for field: ' + field.fhirField);
      }

      return {
        field: field.fhirField,
        value,
      };
    });
};

export function getAllExamFieldsMetadata(): (ExamObservationDTO & {
  code?: CodeableConcept;
  bodySite?: CodeableConcept;
  label?: string;
})[] {
  const config = examConfig.default.components;

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
        observations.push({
          field: fieldName,
          value: component.defaultValue || false,
          label: component.label,
          code: component.code,
          bodySite: component.bodySite,
        });
        Object.entries(component.options).forEach(([optionName, option]: [string, any]) => {
          observations.push({
            field: optionName,
            value: option.defaultValue || false,
            label: option.label,
            code: option.code,
            bodySite: option.bodySite,
          });
        });
      } else if (component.type === 'checkbox-with-modal') {
        observations.push({
          field: fieldName,
          value: component.defaultValue || false,
          label: component.label,
          code: component.code,
          bodySite: component.bodySite,
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

export function createExamObservations(): (ExamObservationDTO & {
  code?: CodeableConcept;
  bodySite?: CodeableConcept;
  label?: string;
})[] {
  const config = examConfig.default.components;

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
        if (component.defaultValue === true) {
          observations.push({
            field: fieldName,
            value: true,
            label: component.label,
            code: component.code,
            bodySite: component.bodySite,
          });
        }
      } else if (component.type === 'dropdown') {
        Object.entries(component.components).forEach(([optionName, option]: [string, any]) => {
          if (option.defaultValue === true) {
            observations.push({
              field: optionName,
              value: true,
              label: option.label,
              code: option.code,
              bodySite: option.bodySite,
            });
          }
        });
      } else if (component.type === 'column') {
        extractObservationsFromComponents(component.components, section);
      } else if (component.type === 'form') {
        Object.entries(component.components).forEach(([elementName, element]: [string, any]) => {
          if (element.defaultValue === true) {
            observations.push({
              field: elementName,
              value: true,
              label: element.label,
              code: element.code,
              bodySite: element.bodySite,
            });
          }
        });
      } else if (component.type === 'multi-select') {
        if (component.defaultValue === true) {
          observations.push({
            field: fieldName,
            value: true,
            label: component.label,
            code: component.code,
            bodySite: component.bodySite,
          });
        }
        Object.entries(component.options).forEach(([optionName, option]: [string, any]) => {
          if (option.defaultValue === true) {
            observations.push({
              field: optionName,
              value: true,
              label: option.label,
              code: option.code,
              bodySite: option.bodySite,
            });
          }
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

export const createExamObservationComments = (): (ObservationDTO & { label: string })[] => {
  const config = examConfig.default.components;

  const comments: (ObservationDTO & { label: string })[] = [];

  Object.values(config).forEach((examItem) => {
    Object.keys(examItem.components.comment).forEach((fieldName) => {
      comments.push({ field: fieldName, label: examItem.components.comment[fieldName].label });
    });
  });

  return comments;
};

// accounts should be on the encounter, needed for ordering labs for workers comp visits
// if no paperwork is updated, harvest does not run and the account is never added
// so doing it initially via this subscription
export const makeEncounterAccountPatchOp = (
  currentEncounter: Encounter,
  account: Account | undefined,
  workersCompAccount: Account | undefined
): Operation[] => {
  if (!account && !workersCompAccount) return [];

  const ops: Operation[] = [];

  const patientAccountReference = account?.id ? `Account/${account.id}` : undefined;
  const workersCompAccountReference = workersCompAccount?.id ? `Account/${workersCompAccount.id}` : undefined;

  const { accounts: updatedEncounterAccounts, changed: accountsChanged } = mergeEncounterAccounts(
    currentEncounter.account,
    [patientAccountReference, workersCompAccountReference]
  );

  if (accountsChanged && updatedEncounterAccounts) {
    ops.push({
      op: currentEncounter.account ? 'replace' : 'add',
      path: '/account',
      value: updatedEncounterAccounts,
    });
  }

  return ops;
};
