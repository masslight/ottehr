import { FormFieldsDisplayItem, FormFieldsGroupItem, FormFieldsInputItem, FormFieldTrigger } from 'config-types';
import {
  Questionnaire,
  QuestionnaireItem,
  QuestionnaireResponseItem,
  QuestionnaireResponseItemAnswer,
  Reference,
} from 'fhir/r4b';
import { DateTime } from 'luxon';
import { getTaxID } from '../fhir/helpers';
import type { PrePopulationFromPatientRecordInput } from '../helpers';
import { makeAnswer, makePrepopulatedItemsFromPatientRecord } from '../helpers';
import { PATIENT_RECORD_CONFIG } from '../ottehr-config/patient-record';
import type { ServiceMode } from '../types';

export interface AppointmentContext {
  appointmentServiceCategory?: string;
  appointmentServiceMode?: ServiceMode;
  reasonForVisit?: string;
  encounterId?: string;
  /** When set (e.g. from Encounter extension), overrides Account occ-med employer for prepopulation. */
  visitOccupationalMedicineEmployerReference?: Reference;
}

interface Trigger extends Omit<FormFieldTrigger, 'effect'> {
  effect: string;
}

export interface TriggeredEffects {
  required: boolean;
  enabled: boolean | null;
  substituteText: string | undefined;
  filtered: boolean;
}

/**
 * Evaluates triggers for a field (or section, when called with a synthesized
 * `FormFieldsDisplayItem`) against current form values. Shared between the
 * EHR Patient Record form and the zambda PDF generators.
 */
export const evaluateFieldTriggers = (
  item: FormFieldsInputItem | FormFieldsDisplayItem | FormFieldsGroupItem,
  formValues: Record<string, any>,
  enableBehavior: 'any' | 'all' = 'any'
): TriggeredEffects => {
  const { triggers } = item;

  if (!triggers || triggers.length === 0) {
    return { required: false, enabled: true, substituteText: undefined, filtered: false };
  }

  const flattenedTriggers: Trigger[] = triggers.flatMap((trigger) =>
    trigger.effect.map((ef) => {
      return { ...trigger, effect: ef };
    })
  );

  const triggerConditionsWithOutcomes: (Trigger & { conditionMet: boolean })[] = flattenedTriggers.map((trigger) => {
    // Handle dotted notation in targetQuestionLinkId (e.g., 'patient-summary.appointment-service-category')
    // Try the full ID first, then try extracting just the field part after the dot
    let currentValue = formValues[trigger.targetQuestionLinkId];
    if (currentValue === undefined && trigger.targetQuestionLinkId.includes('.')) {
      const fieldKey = trigger.targetQuestionLinkId.split('.').pop();
      if (fieldKey) {
        currentValue = formValues[fieldKey];
      }
    }
    const { operator, answerBoolean, answerString, answerDateTime, substituteText } = trigger;
    let conditionMet = false;

    switch (operator) {
      case 'exists':
        if (answerBoolean === true) {
          conditionMet = currentValue !== undefined && currentValue !== null && currentValue !== '';
        } else if (answerBoolean === false) {
          conditionMet = currentValue === undefined || currentValue === null || currentValue === '';
        }
        break;
      case '=':
        if (answerBoolean !== undefined) {
          conditionMet = currentValue === answerBoolean;
        } else if (answerString !== undefined) {
          conditionMet = currentValue === answerString;
        } else if (answerDateTime !== undefined) {
          conditionMet = currentValue === answerDateTime;
        }
        break;
      case '!=':
        if (answerBoolean !== undefined) {
          conditionMet = currentValue !== answerBoolean;
        } else if (answerString !== undefined) {
          conditionMet = currentValue !== answerString;
        } else if (answerDateTime !== undefined) {
          conditionMet = currentValue !== answerDateTime;
        }
        break;
      case '>':
        if (
          answerDateTime !== undefined &&
          currentValue !== undefined &&
          currentValue !== null &&
          currentValue !== ''
        ) {
          const currentDate = DateTime.fromISO(currentValue);
          const answerDate = DateTime.fromISO(answerDateTime);
          if (currentDate.isValid && answerDate.isValid) {
            conditionMet = currentDate > answerDate;
          }
        }
        break;
      case '<':
        if (
          answerDateTime !== undefined &&
          currentValue !== undefined &&
          currentValue !== null &&
          currentValue !== ''
        ) {
          const currentDate = DateTime.fromISO(currentValue);
          const answerDate = DateTime.fromISO(answerDateTime);
          if (currentDate.isValid && answerDate.isValid) {
            conditionMet = currentDate < answerDate;
          }
        }
        break;
      case '>=':
        if (
          answerDateTime !== undefined &&
          currentValue !== undefined &&
          currentValue !== null &&
          currentValue !== ''
        ) {
          const currentDate = DateTime.fromISO(currentValue);
          const answerDate = DateTime.fromISO(answerDateTime);
          if (currentDate.isValid && answerDate.isValid) {
            conditionMet = currentDate >= answerDate;
          }
        }
        break;
      case '<=':
        if (
          answerDateTime !== undefined &&
          currentValue !== undefined &&
          currentValue !== null &&
          currentValue !== ''
        ) {
          const currentDate = DateTime.fromISO(currentValue);
          const answerDate = DateTime.fromISO(answerDateTime);
          if (currentDate.isValid && answerDate.isValid) {
            conditionMet = currentDate <= answerDate;
          }
        }
        break;
      default:
        console.warn(`Operator ${operator} not implemented in trigger processing`);
    }
    return { ...trigger, conditionMet, substituteText };
  });

  return triggerConditionsWithOutcomes.reduce(
    (acc, trigger) => {
      if (trigger.effect === 'enable' && trigger.conditionMet) {
        if (acc.enabled === null) {
          acc.enabled = true;
        } else if (enableBehavior === 'all') {
          acc.enabled = acc.enabled && true;
        } else {
          acc.enabled = true;
        }
      } else if (trigger.effect === 'enable' && !trigger.conditionMet) {
        if (acc.enabled === null) {
          acc.enabled = false;
        } else if (enableBehavior === 'all') {
          acc.enabled = false;
        }
      }
      // only 'enable' effect supports 'all' vs 'any' behavior for now; "any" is default for all other effects
      if (trigger.effect === 'require' && trigger.conditionMet) {
        acc.required = true;
      }
      if (trigger.effect === 'require' && !trigger.conditionMet) {
        acc.required = acc.required || false;
      }

      if (trigger.effect === 'sub-text' && trigger.conditionMet) {
        acc.substituteText = trigger.substituteText;
      }

      if (trigger.effect === 'filter' && trigger.conditionMet) {
        acc.filtered = true;
      }

      return acc;
    },
    {
      required: false as boolean,
      enabled: null as boolean | null,
      substituteText: undefined as undefined | string,
      filtered: false as boolean,
    }
  );
};

export interface PrePopulationFromPatientRecordInputWithContext extends PrePopulationFromPatientRecordInput {
  appointmentContext?: AppointmentContext;
}

export interface PatientRecordFormConfig {
  hiddenFields?: string[];
  requiredFields?: string[];
}

export const prepopulateLogicalFields = (
  questionnaire: Questionnaire,
  formConfig: PatientRecordFormConfig,
  appointmentContext?: AppointmentContext
): QuestionnaireResponseItem[] => {
  const shouldShowSSNField = !(formConfig.hiddenFields?.includes('patient-ssn') ?? false);
  const ssnRequired = shouldShowSSNField && (formConfig.requiredFields?.includes('patient-ssn') ?? false);

  const item: QuestionnaireResponseItem[] = (questionnaire.item ?? []).map((item) => {
    const populatedItem: QuestionnaireResponseItem[] = (() => {
      const itemItems = (item.item ?? []).filter((i: QuestionnaireItem) => i.type !== 'display');
      return itemItems.map((item) => {
        let answer: QuestionnaireResponseItemAnswer[] | undefined;
        const { linkId } = item;

        if (linkId === 'should-display-ssn-field') {
          answer = makeAnswer(shouldShowSSNField, 'Boolean');
        }
        if (linkId === 'ssn-field-required') {
          answer = makeAnswer(ssnRequired, 'Boolean');
        }
        if (linkId === 'appointment-service-category' && appointmentContext?.appointmentServiceCategory) {
          answer = makeAnswer(appointmentContext.appointmentServiceCategory);
        }
        if (linkId === 'appointment-service-mode' && appointmentContext?.appointmentServiceMode) {
          answer = makeAnswer(appointmentContext.appointmentServiceMode);
        }
        if (linkId === 'reason-for-visit' && appointmentContext?.reasonForVisit) {
          answer = makeAnswer(appointmentContext.reasonForVisit);
        }

        return {
          linkId,
          answer,
        };
      });
    })();
    return {
      linkId: item.linkId,
      item: populatedItem,
    };
  });

  return item.flatMap((i) => i.item ?? []).filter((i) => i.answer !== undefined);
};

export const prepopulatePatientRecordItems = (
  input: PrePopulationFromPatientRecordInputWithContext,
  formConfig: PatientRecordFormConfig = {
    hiddenFields: (PATIENT_RECORD_CONFIG as any).FormFields?.patientSummary?.hiddenFields,
    requiredFields: (PATIENT_RECORD_CONFIG as any).FormFields?.patientSummary?.requiredFields,
  }
): QuestionnaireResponseItem[] => {
  if (!input) {
    return [];
  }

  const q = input.questionnaire;
  const { appointmentContext, patient } = input;
  const prepopOverrides = prepopulateLogicalFields(q, formConfig, appointmentContext);
  // todo: this is exported from another util file, but only used here. probably want to move it and
  // consolidate the interface exposed to the rest of the system.
  if (prepopOverrides.some((item) => item.linkId === 'should-display-ssn-field' && item.answer?.[0]?.valueBoolean)) {
    const ssn = getTaxID(patient);
    if (ssn) {
      prepopOverrides.push({
        linkId: 'patient-ssn',
        answer: makeAnswer(ssn),
      });
    }
  }
  const patientRecordItems = makePrepopulatedItemsFromPatientRecord({
    ...input,
    visitOccupationalMedicineEmployerReference: appointmentContext?.visitOccupationalMedicineEmployerReference,
    appointmentServiceCategory: appointmentContext?.appointmentServiceCategory,
    overriddenItems: prepopOverrides,
  });

  return patientRecordItems;
};
