import { Questionnaire, QuestionnaireItem, QuestionnaireResponseItem, QuestionnaireResponseItemAnswer } from 'fhir/r4b';
import _ from 'lodash';
import patientRecordQuestionnaire from '../../../../../config/oystehr/ehr-insurance-update-questionnaire.json' assert { type: 'json' };
import { PATIENT_RECORD_OVERRIDES as OVERRIDES } from '../../../.ottehr_config';
import { makeAnswer, makePrepopulatedItemsFromPatientRecord, PrePopulationFromPatientRecordInput } from '../../main';
import { mergeAndFreezeConfigObjects } from '../helpers';

const PatientRecordQuestionnaire = Object.values(patientRecordQuestionnaire.fhirResources)![0]
  .resource as Questionnaire;

const ehrPatientRecordForm: {
  url: string | undefined;
  version: string | undefined;
  templateQuestionnaire: Questionnaire | undefined;
} = (() => {
  const templateResource = _.cloneDeep(PatientRecordQuestionnaire);
  return {
    url: templateResource?.url,
    version: templateResource?.version,
    templateQuestionnaire: templateResource as Questionnaire,
  };
})();

type PatientRecordFormLinkId = NonNullable<
  NonNullable<typeof PatientRecordQuestionnaire.item>[number]['item']
>[number]['linkId'];

const hiddenPatientRecordFields: PatientRecordFormLinkId[] = ['patient-ssn'];
const requiredPatientRecordFields: PatientRecordFormLinkId[] = [
  'patient-first-name',
  'patient-last-name',
  'patient-dob',
  //... add more as needed
];

const PATIENT_RECORD_DEFAULTS = {
  ehrPatientRecordForm,
  hiddenPatientRecordFields,
  requiredPatientRecordFields,
};

export const PATIENT_RECORD_CONFIG = mergeAndFreezeConfigObjects(PATIENT_RECORD_DEFAULTS, OVERRIDES);

const prepopulateLogicalFields = (questionnaire: Questionnaire): QuestionnaireResponseItem[] => {
  const shouldShowSSNField = !hiddenPatientRecordFields.includes('patient-ssn');
  const ssnRequired = shouldShowSSNField && requiredPatientRecordFields.includes('patient-ssn');

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

  return item;
};

export const prepopulatePatientRecordItems = (
  input: PrePopulationFromPatientRecordInput
): QuestionnaireResponseItem[] => {
  if (!input) {
    return [];
  }

  const q = input.questionnaire;
  const logicalFieldItems = prepopulateLogicalFields(q);
  const patientRecordItems = makePrepopulatedItemsFromPatientRecord({ ...input, overriddenItems: logicalFieldItems });

  return patientRecordItems;
};
