import Oystehr from '@oystehr/sdk';
import { getRandomValues } from 'crypto';
import {
  Coverage,
  Encounter,
  Location,
  Organization,
  Patient,
  Practitioner,
  Questionnaire,
  QuestionnaireResponse,
  QuestionnaireResponseItem,
  QuestionnaireResponseItemAnswer,
  ServiceRequest,
} from 'fhir/r4b';
import { DateTime } from 'luxon';
import {
  DynamicAOEInput,
  EXTERNAL_LAB_ERROR,
  FHIR_IDENTIFIER_NPI,
  getFullestAvailableName,
  isPSCOrder,
  OYSTEHR_LAB_OI_CODE_SYSTEM,
  Secrets,
} from 'utils';
import { createExternalLabsOrderFormPDF } from '../../shared/pdf/external-labs-order-form-pdf';
import { makeLabPdfDocumentReference } from '../../shared/pdf/labs-results-form-pdf';
import { LABS_DATE_STRING_FORMAT } from '.';
export interface AOEDisplayForOrderForm {
  question: string;
  answer: any[];
}

export const populateQuestionnaireResponseItems = async (
  questionnaireResponse: QuestionnaireResponse,
  data: DynamicAOEInput,
  m2mToken: string
): Promise<{
  questionnaireResponseItems: QuestionnaireResponseItem[];
  questionsAndAnswersForFormDisplay: AOEDisplayForOrderForm[];
}> => {
  const questionnaireUrl = questionnaireResponse.questionnaire;

  if (!questionnaireUrl) {
    throw new Error('questionnaire is not found');
  }

  console.log(questionnaireUrl);

  const questionnaireRequest = await fetch(questionnaireUrl, {
    headers: {
      Authorization: `Bearer ${m2mToken}`,
    },
  });

  const questionnaire: Questionnaire = await questionnaireRequest.json();

  if (!questionnaire.item) {
    throw new Error('questionnaire item is not found');
  }

  const questionsAndAnswersForFormDisplay: AOEDisplayForOrderForm[] = [];

  const questionnaireResponseItems: QuestionnaireResponseItem[] = Object.keys(data).map((questionResponse) => {
    const question = questionnaire.item?.find((item) => item.linkId === questionResponse);
    if (!question) {
      throw new Error('question is not found');
    }

    let answer: QuestionnaireResponseItemAnswer[] | undefined = undefined;
    let answerForDisplay = data[questionResponse] !== undefined ? data[questionResponse] : 'UNKNOWN';

    const multiSelect = question.extension?.find(
      (currentExtension) =>
        currentExtension.url === 'https://fhir.zapehr.com/r4/StructureDefinitions/data-type' &&
        currentExtension.valueString === 'multi-select list'
    );
    if (question.type === 'text' || (question.type === 'choice' && !multiSelect)) {
      answer = [
        {
          valueString: data[questionResponse],
        },
      ];
    }
    if (multiSelect) {
      answer = data[questionResponse].map((item: string) => ({ valueString: item }));
      answerForDisplay = data[questionResponse].join(', ');
    }

    if (question.type === 'boolean') {
      answer = [
        {
          valueBoolean: data[questionResponse],
        },
      ];
      answerForDisplay = answerForDisplay === true ? 'Yes' : answerForDisplay === false ? 'No' : answerForDisplay;
    }

    if (question.type === 'date') {
      answer = [
        {
          valueDate: data[questionResponse],
        },
      ];
    }

    if (question.type === 'decimal') {
      answer = [
        {
          valueDecimal: data[questionResponse],
        },
      ];
    }

    if (question.type === 'integer') {
      answer = [
        {
          valueInteger: data[questionResponse],
        },
      ];
    }

    if (answer == undefined) {
      throw new Error('answer is undefined');
    }

    if (answerForDisplay !== undefined && answerForDisplay !== '')
      questionsAndAnswersForFormDisplay.push({
        question: question.text || 'UNKNOWN',
        answer: answerForDisplay,
      });

    return {
      linkId: questionResponse,
      answer: answer,
    };
  });

  return { questionnaireResponseItems, questionsAndAnswersForFormDisplay };
};

export function createOrderNumber(length: number): string {
  // https://sentry.io/answers/generate-random-string-characters-in-javascript/
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  const randomArray = new Uint8Array(length);
  getRandomValues(randomArray);
  randomArray.forEach((number) => {
    result += chars[number % chars.length];
  });
  return result;
}

interface HandleOttehrOrderFormParams {
  serviceRequest: ServiceRequest;
  timezone: string | undefined;
  coverage: Coverage | undefined;
  location: Location | undefined;
  labOrganization: Organization | undefined;
  accountNumber: string;
  orderID: string | undefined;
  provider: Practitioner;
  patient: Patient;
  oystehr: Oystehr;
  now: DateTime;
  mostRecentSampleCollectionDate: DateTime<boolean> | undefined;
  organization: Organization | undefined; // insurance
  coveragePatient: Patient | undefined;
  questionsAndAnswers: AOEDisplayForOrderForm[];
  manualOrder: boolean;
  encounter: Encounter;
  secrets: Secrets | null;
  m2mToken: string;
}

export async function handleOttehrOrderForm(input: HandleOttehrOrderFormParams): Promise<string> {
  const {
    serviceRequest,
    timezone,
    coverage,
    location,
    labOrganization,
    accountNumber,
    orderID,
    provider,
    patient,
    oystehr,
    now,
    mostRecentSampleCollectionDate,
    organization,
    coveragePatient,
    questionsAndAnswers,
    manualOrder,
    encounter,
    secrets,
    m2mToken,
  } = input;

  if (!serviceRequest.reasonCode) {
    throw EXTERNAL_LAB_ERROR(
      `Please ensure at least one diagnosis is recorded for this service request, ServiceRequest/${serviceRequest.id}, it should be recorded in serviceRequest.reasonCode`
    );
  }

  const orderCreateDate = serviceRequest.authoredOn
    ? DateTime.fromISO(serviceRequest.authoredOn).setZone(timezone).toFormat(LABS_DATE_STRING_FORMAT)
    : undefined;

  const ORDER_ITEM_UNKNOWN = 'UNKNOWN';

  // this is the same logic we use in oystehr to determine PV1-20
  const coverageType = coverage?.type?.coding?.[0]?.code; // assumption: we'll use the first code in the list
  const billClass = !coverage || coverageType === 'pay' ? 'Patient Bill (P)' : 'Third-Party Bill (T)';

  console.log('creating external lab order form');
  const orderFormPdfDetail = await createExternalLabsOrderFormPDF(
    {
      locationName: location?.name,
      locationStreetAddress: location?.address?.line?.join(','),
      locationCity: location?.address?.city,
      locationState: location?.address?.state,
      locationZip: location?.address?.postalCode,
      locationPhone: location?.telecom?.find((t) => t.system === 'phone')?.value,
      locationFax: location?.telecom?.find((t) => t.system === 'fax')?.value,
      labOrganizationName: labOrganization?.name || ORDER_ITEM_UNKNOWN,
      accountNumber,
      serviceRequestID: serviceRequest.id || ORDER_ITEM_UNKNOWN,
      orderNumber: orderID || ORDER_ITEM_UNKNOWN,
      providerName: getFullestAvailableName(provider) || ORDER_ITEM_UNKNOWN,
      providerNPI: provider.identifier?.find((id) => id?.system === FHIR_IDENTIFIER_NPI)?.value,
      patientFirstName: patient.name?.[0].given?.[0] || ORDER_ITEM_UNKNOWN,
      patientMiddleName: patient.name?.[0].given?.[1],
      patientLastName: patient.name?.[0].family || ORDER_ITEM_UNKNOWN,
      patientSex: patient.gender || ORDER_ITEM_UNKNOWN,
      patientDOB: patient.birthDate
        ? DateTime.fromFormat(patient.birthDate, 'yyyy-MM-dd').toFormat('MM/dd/yyyy')
        : ORDER_ITEM_UNKNOWN,
      patientId: patient.id!,
      patientAddress: patient.address?.[0] ? oystehr.fhir.formatAddress(patient.address[0]) : ORDER_ITEM_UNKNOWN,
      patientPhone: patient.telecom?.find((temp) => temp.system === 'phone')?.value || ORDER_ITEM_UNKNOWN,
      todayDate: now.setZone(timezone).toFormat(LABS_DATE_STRING_FORMAT),
      orderSubmitDate: now.setZone(timezone).toFormat(LABS_DATE_STRING_FORMAT),
      orderCreateDateAuthoredOn: serviceRequest.authoredOn || '',
      orderCreateDate: orderCreateDate || ORDER_ITEM_UNKNOWN,
      sampleCollectionDate:
        mostRecentSampleCollectionDate?.setZone(timezone).toFormat(LABS_DATE_STRING_FORMAT) || undefined,
      billClass,
      primaryInsuranceName: organization?.name,
      primaryInsuranceAddress: organization?.address
        ? oystehr.fhir.formatAddress(organization.address?.[0])
        : undefined,
      primaryInsuranceSubNum: coverage?.subscriberId,
      insuredName: coveragePatient?.name ? oystehr.fhir.formatHumanName(coveragePatient.name[0]) : undefined,
      insuredAddress: coveragePatient?.address ? oystehr.fhir.formatAddress(coveragePatient.address?.[0]) : undefined,
      aoeAnswers: questionsAndAnswers,
      orderName:
        serviceRequest.code?.coding?.find((coding) => coding.system === OYSTEHR_LAB_OI_CODE_SYSTEM)?.display ||
        ORDER_ITEM_UNKNOWN,
      orderAssessments: serviceRequest.reasonCode.map((code) => ({
        code: code.coding?.[0].code || ORDER_ITEM_UNKNOWN,
        name: code.text || ORDER_ITEM_UNKNOWN,
      })),
      orderPriority: serviceRequest.priority || ORDER_ITEM_UNKNOWN,
      isManualOrder: manualOrder,
      isPscOrder: isPSCOrder(serviceRequest),
    },
    patient.id!,
    secrets,
    m2mToken
  );

  console.log('making lab pdf document reference');
  await makeLabPdfDocumentReference({
    oystehr,
    type: 'order',
    pdfInfo: orderFormPdfDetail,
    patientID: patient.id!,
    encounterID: encounter.id!,
    serviceRequestID: serviceRequest.id,
  });

  return orderFormPdfDetail.uploadURL;
}
