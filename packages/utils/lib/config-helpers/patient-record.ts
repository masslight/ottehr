import { Questionnaire, QuestionnaireItem, QuestionnaireResponseItem, QuestionnaireResponseItemAnswer } from 'fhir/r4b';
import { getTaxID } from '../fhir/helpers';
import type { PrePopulationFromPatientRecordInput } from '../helpers';
import { makeAnswer, makePrepopulatedItemsFromPatientRecord } from '../helpers';
import type { ServiceMode } from '../types';

export interface AppointmentContext {
  appointmentServiceCategory?: string;
  appointmentServiceMode?: ServiceMode;
  reasonForVisit?: string;
  encounterId?: string;
}

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
  formConfig: PatientRecordFormConfig
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
  const patientRecordItems = makePrepopulatedItemsFromPatientRecord({ ...input, overriddenItems: prepopOverrides });

  return patientRecordItems;
};
