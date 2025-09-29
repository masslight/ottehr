import Oystehr from '@oystehr/sdk';
import { Coding, DocumentReference, Extension, Organization, Practitioner } from 'fhir/r4b';
import {
  CanonicalUrlSearchInput,
  OtherParticipantsExtension,
  PatientAccountResponse,
  ServiceMode,
  TELEMED_VIDEO_ROOM_CODE,
} from 'utils';
import ehrInsuranceUpdateQuestionnaireJson from '../../../../../config/oystehr/ehr-insurance-update-questionnaire.json';
import inPersonIntakeQuestionnaireJson from '../../../../../config/oystehr/in-person-intake-questionnaire.json';
import virtualIntakeQuestionnaireJson from '../../../../../config/oystehr/virtual-intake-questionnaire.json';
import { getAccountAndCoverageResourcesForPatient, PATIENT_CONTAINED_PHARMACY_ID } from '../../ehr/shared/harvest';

export const getCanonicalUrlForPrevisitQuestionnaire = (
  serviceMode: ServiceMode,
  language?: 'en' | 'es'
): CanonicalUrlSearchInput => {
  let url = '';
  let version = '';
  if (serviceMode === 'in-person') {
    url = inPersonIntakeQuestionnaireJson.fhirResources['questionnaire-in-person-previsit'].resource.url;
    version = inPersonIntakeQuestionnaireJson.fhirResources['questionnaire-in-person-previsit'].resource.version;
  } else if (serviceMode === 'virtual') {
    url = virtualIntakeQuestionnaireJson.fhirResources['questionnaire-virtual-previsit'].resource.url;
    version = virtualIntakeQuestionnaireJson.fhirResources['questionnaire-virtual-previsit'].resource.version;
  }
  if (!url || !version) {
    throw new Error('Questionnaire url missing or malformed');
  }
  return {
    url,
    version,
    language: language === 'en' ? 'en' : 'es', // dodo: reverse default to 'en'
  };
};

export const getCanonicalUrlForInsuranceUpdateQuestionnaire = (language?: 'en' | 'es'): CanonicalUrlSearchInput => {
  const { url, version } =
    ehrInsuranceUpdateQuestionnaireJson.fhirResources['questionnaire-ehr-insurance-update'].resource;
  if (!url || !version) {
    throw new Error('Questionnaire url missing or malformed');
  }
  return {
    url,
    version,
    language: language === 'es' ? 'es' : 'en',
  };
};

export const getTelemedRequiredAppointmentEncounterExtensions = (
  patientRef: string,
  dateTimeNow: string
): {
  apptExtensions: Extension[];
  encExtensions: Extension[];
} => {
  const apptVirtualServiceExtension: Extension = {
    url: 'https://extensions.fhir.zapehr.com/appointment-virtual-service-pre-release',
    extension: [
      {
        url: 'channelType',
        valueCoding: {
          system: 'https://fhir.zapehr.com/virtual-service-type',
          code: TELEMED_VIDEO_ROOM_CODE,
          display: 'Twilio Video Group Rooms',
        },
      },
    ],
  };
  const encExtensions: Extension[] = [
    {
      ...apptVirtualServiceExtension,
      url: 'https://extensions.fhir.zapehr.com/encounter-virtual-service-pre-release',
    },
    {
      url: 'https://extensions.fhir.zapehr.com/encounter-other-participants',
      extension: [
        {
          url: 'https://extensions.fhir.zapehr.com/encounter-other-participant',
          extension: [
            {
              url: 'period',
              valuePeriod: {
                start: dateTimeNow,
              },
            },
            {
              url: 'reference',
              valueReference: {
                reference: patientRef,
              },
            },
          ],
        },
      ],
    } as OtherParticipantsExtension,
  ];

  return {
    apptExtensions: [apptVirtualServiceExtension],
    encExtensions,
  };
};

export const getEncounterClass = (serviceType: ServiceMode): Coding => {
  return serviceType === 'virtual'
    ? {
        system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
        code: 'VR',
        display: 'virtual',
      }
    : {
        system: 'http://hl7.org/fhir/R4/v3/ActEncounterCode/vs.html',
        code: 'ACUTE',
        display: 'inpatient acute',
      };
};

export async function getRelatedResources(
  oystehr: Oystehr,
  patientId?: string
): Promise<{
  documents: DocumentReference[];
  accountInfo: PatientAccountResponse | undefined;
}> {
  let documents: DocumentReference[] = [];
  let accountInfo: PatientAccountResponse | undefined = undefined;

  if (patientId) {
    console.log('get related resources to pre-populate paperwork');
    const [docsResponse, insuranceResponse] = await Promise.all([
      oystehr.fhir.search<DocumentReference>({
        resourceType: 'DocumentReference',
        params: [
          {
            name: 'related',
            value: `Patient/${patientId}`,
          },
          {
            name: 'status',
            value: 'current',
          },
        ],
      }),
      getAccountAndCoverageResourcesForPatient(patientId, oystehr),
    ]);

    const primaryCarePhysician = insuranceResponse.patient?.contained?.find(
      (resource) => resource.resourceType === 'Practitioner' && resource.active === true
    ) as Practitioner;
    const pharmacy = insuranceResponse.patient?.contained?.find(
      (resource) => resource.resourceType === 'Organization' && resource.id === PATIENT_CONTAINED_PHARMACY_ID
    ) as Organization;

    documents = docsResponse.unbundle();
    accountInfo = {
      ...insuranceResponse,
      primaryCarePhysician,
      coverageChecks: [], // these aren't needed here
      pharmacy,
    };
  }

  return { documents, accountInfo };
}
