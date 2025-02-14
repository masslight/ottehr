import Oystehr from '@oystehr/sdk';
import { Coding, Extension, Questionnaire } from 'fhir/r4b';
import {
  CanonicalUrl,
  OtherParticipantsExtension,
  ServiceMode,
  TELEMED_VIDEO_ROOM_CODE,
  getCanonicalQuestionnaire,
} from 'utils';
import { Secrets, SecretsKeys, getSecret } from 'zambda-utils';

export const getCurrentQuestionnaireForServiceType = async (
  serviceMode: ServiceMode,
  secrets: Secrets | null,
  oystehrClient: Oystehr
): Promise<Questionnaire> => {
  const canonical = getCanonicalUrlForPrevisitQuestionnaire(serviceMode, secrets);
  return getCanonicalQuestionnaire(canonical, oystehrClient);
};

export const getCanonicalUrlForPrevisitQuestionnaire = (
  serviceMode: ServiceMode,
  secrets: Secrets | null
): CanonicalUrl => {
  let secretKey = '';
  if (serviceMode === 'in-person') {
    secretKey = SecretsKeys.IN_PERSON_PREVISIT_QUESTIONNAIRE;
  } else if (serviceMode === 'virtual') {
    secretKey = SecretsKeys.VIRTUAL_PREVISIT_QUESTIONNAIRE;
  }
  const questionnaireCanonURL = getSecret(secretKey, secrets);
  // todo: move this into some kind of util function
  const [questionnaireURL, questionnaireVersion] = questionnaireCanonURL.split('|');
  if (!questionnaireURL || !questionnaireVersion) {
    throw new Error('Questionnaire url secret missing or malformed');
  }
  return {
    url: questionnaireURL,
    version: questionnaireVersion,
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
