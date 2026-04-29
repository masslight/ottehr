import Oystehr from '@oystehr/sdk';
import { Coding, DocumentReference, Extension, Organization, Practitioner, Questionnaire } from 'fhir/r4b';
import {
  CanonicalUrl,
  getCanonicalQuestionnaire,
  IN_PERSON_INTAKE_PAPERWORK_CANONICAL,
  OtherParticipantsExtension,
  PatientAccountResponse,
  ServiceMode,
  TELEMED_VIDEO_ROOM_CODE,
  VIRTUAL_INTAKE_PAPERWORK_CANONICAL,
} from 'utils';
import { getAccountAndCoverageResourcesForPatient, PATIENT_CONTAINED_PHARMACY_ID } from '../../ehr/shared/harvest';
export const getCurrentQuestionnaireForServiceType = async (
  serviceMode: ServiceMode,
  oystehrClient: Oystehr
): Promise<Questionnaire> => {
  const canonical = getCanonicalUrlForPrevisitQuestionnaire(serviceMode);
  return getCanonicalQuestionnaire(canonical, oystehrClient);
};

export const getCanonicalUrlForPrevisitQuestionnaire = (serviceMode: ServiceMode): CanonicalUrl => {
  switch (serviceMode) {
    case ServiceMode['in-person']:
      return IN_PERSON_INTAKE_PAPERWORK_CANONICAL;
    case ServiceMode.virtual:
      return VIRTUAL_INTAKE_PAPERWORK_CANONICAL;
    default:
      throw new Error(`Unsupported service mode for previsit questionnaire: ${serviceMode}`);
  }
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
