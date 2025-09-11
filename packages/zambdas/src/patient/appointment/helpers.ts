import Oystehr from '@oystehr/sdk';
import { Coding, DocumentReference, Extension, Practitioner, Questionnaire } from 'fhir/r4b';
import {
  CanonicalUrl,
  getCanonicalQuestionnaire,
  OtherParticipantsExtension,
  PatientAccountResponse,
  Secrets,
  ServiceMode,
  TELEMED_VIDEO_ROOM_CODE,
} from 'utils';
import ehrInsuranceUpdateQuestionnaireJson from 'utils/lib/deployed-resources/questionnaires/ehr-insurance-update-questionnaire.json';
import inPersonIntakeQuestionnaireJson from 'utils/lib/deployed-resources/questionnaires/in-person-intake-questionnaire.json';
import virtualIntakeQuestionnaireJson from 'utils/lib/deployed-resources/questionnaires/virtual-intake-questionnaire.json';
import { getAccountAndCoverageResourcesForPatient } from '../../ehr/shared/harvest';
export const getCurrentQuestionnaireForServiceType = async (
  serviceMode: ServiceMode,
  secrets: Secrets | null,
  oystehrClient: Oystehr
): Promise<Questionnaire> => {
  const canonical = getCanonicalUrlForPrevisitQuestionnaire(serviceMode);
  return getCanonicalQuestionnaire(canonical, oystehrClient);
};

export const getCanonicalUrlForPrevisitQuestionnaire = (serviceMode: ServiceMode): CanonicalUrl => {
  let url = '';
  let version = '';
  if (serviceMode === 'in-person') {
    url = inPersonIntakeQuestionnaireJson.resource.url;
    version = inPersonIntakeQuestionnaireJson.resource.version;
  } else if (serviceMode === 'virtual') {
    url = virtualIntakeQuestionnaireJson.resource.url;
    version = virtualIntakeQuestionnaireJson.resource.version;
  }
  if (!url || !version) {
    throw new Error('Questionnaire url missing or malformed');
  }
  return {
    url,
    version,
  };
};

export const getCanonicalUrlForInsuranceUpdateQuestionnaire = (): CanonicalUrl => {
  const { url, version } = ehrInsuranceUpdateQuestionnaireJson.resource;
  if (!url || !version) {
    throw new Error('Questionnaire url missing or malformed');
  }
  return {
    url,
    version,
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

    documents = docsResponse.unbundle();
    accountInfo = {
      ...insuranceResponse,
      primaryCarePhysician,
      coverageChecks: [], // these aren't needed here
    };
  }

  return { documents, accountInfo };
}
