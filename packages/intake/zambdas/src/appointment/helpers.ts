import Oystehr from '@oystehr/sdk';
import { Coding, Extension, Questionnaire } from 'fhir/r4b';
import {
  OtherParticipantsExtension,
  Secrets,
  SecretsKeys,
  ServiceMode,
  TELEMED_VIDEO_ROOM_CODE,
  getSecret,
} from 'utils';

export const getCurrentQuestionnaireForServiceType = async (
  serviceType: ServiceMode,
  secrets: Secrets | null,
  oystehrClient: Oystehr
): Promise<Questionnaire> => {
  const { url: questionnaireURL, version: questionnaireVersion } = getCanonicalUrlForPrevisitQuestionnaire(
    serviceType,
    secrets
  );
  // todo: move this into some kind of util function
  const questionnaireSearch = (
    await oystehrClient.fhir.search<Questionnaire>({
      resourceType: 'Questionnaire',
      params: [
        {
          name: 'url',
          value: questionnaireURL,
        },
        {
          name: 'version',
          value: questionnaireVersion,
        },
      ],
    })
  ).unbundle();
  // if we do not get exactly one result, throw an error
  if (questionnaireSearch.length < 1) {
    throw new Error(`Could not find questionnaire with canonical url ${questionnaireURL}|${questionnaireVersion}`);
  } else if (questionnaireSearch.length > 1) {
    throw new Error(
      `Found multiple Questionnaires with same canonical url: ${questionnaireURL}|${questionnaireVersion}`
    );
  }
  console.log('questionnaire search', JSON.stringify(questionnaireSearch));
  const questionnaire: Questionnaire | undefined = questionnaireSearch[0];
  if (!questionnaire.id) {
    throw new Error('Questionnaire does not have ID');
  }
  if (!questionnaire.url) {
    throw new Error('Questionnaire does not have a url');
  }
  if (!questionnaire.version) {
    throw new Error('Questionnaire does not have a version');
  }
  return questionnaire;
};

export interface CanonicalUrl {
  canonical: string;
  url: string;
  version: string;
}

export const getCanonicalUrlForPrevisitQuestionnaire = (
  appointmentType: ServiceMode,
  secrets: Secrets | null
): CanonicalUrl => {
  let secretKey = '';
  if (appointmentType === 'in-person') {
    secretKey = SecretsKeys.IN_PERSON_PREVISIT_QUESTIONNAIRE;
  } else if (appointmentType === 'virtual') {
    secretKey = SecretsKeys.VIRTUAL_PREVISIT_QUESTIONNAIRE;
  }
  const questionnaireCanonURL = getSecret(secretKey, secrets);
  // todo: move this into some kind of util function
  const [questionnaireURL, questionnaireVersion] = questionnaireCanonURL.split('|');
  if (!questionnaireURL || !questionnaireVersion) {
    throw new Error('Questionnaire url secret missing or malformed');
  }
  return {
    canonical: questionnaireCanonURL,
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
