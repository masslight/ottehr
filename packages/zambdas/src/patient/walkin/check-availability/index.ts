import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { PractitionerRole, Schedule } from 'fhir/r4b';
import {
  createOystehrClient,
  FHIR_RESOURCE_NOT_FOUND,
  getScheduleDetails,
  getSecret,
  getServiceModeFromScheduleOwner,
  GetWalkinStartParams,
  INVALID_INPUT_ERROR,
  isValidUUID,
  MISSING_REQUEST_BODY,
  MISSING_REQUIRED_PARAMETERS,
  MISSING_SCHEDULE_EXTENSION_ERROR,
  ScheduleExtension,
  ScheduleOwnerFhirResource,
  SecretsKeys,
  ServiceMode,
} from 'utils';
import { ZambdaInput, getAuth0Token, topLevelCatch } from '../../../shared';

let zapehrToken: string;
export const index = async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    const fhirAPI = getSecret(SecretsKeys.FHIR_API, input.secrets);
    const projectAPI = getSecret(SecretsKeys.PROJECT_API, input.secrets);
    const basicInput = validateRequestParameters(input);

    if (!zapehrToken) {
      console.log('getting m2m token for service calls');
      zapehrToken = await getAuth0Token(input.secrets);
    } else {
      console.log('already have a token, no need to update');
    }

    const oystehr = createOystehrClient(zapehrToken, fhirAPI, projectAPI);

    const effectInput = await complexValidation(basicInput, oystehr);

    const response = performEffect(effectInput);

    return {
      statusCode: 200,
      body: JSON.stringify(response),
    };
  } catch (error: any) {
    console.error('Failed to get bookables', error);
    return topLevelCatch('list-bookables', error, input.secrets);
  }
};

const performEffect = (input: EffectInput): any => {
  const { scheduleExtension, serviceMode } = input;
  // grab everything that is needed to perform the walkin availability check

  return {};
};

type BasicInput = GetWalkinStartParams;
const validateRequestParameters = (input: ZambdaInput): BasicInput => {
  if (!input.body) {
    throw MISSING_REQUEST_BODY;
  }

  const { scheduleId } = JSON.parse(input.body);

  if (!scheduleId) {
    throw MISSING_REQUIRED_PARAMETERS(['scheduleId']);
  }

  if (isValidUUID(scheduleId) === false) {
    throw INVALID_INPUT_ERROR('"scheduleId" must be a valid UUID');
  }

  return { scheduleId };
};

interface EffectInput {
  scheduleExtension: ScheduleExtension;
  serviceMode?: ServiceMode;
}
const complexValidation = async (input: BasicInput, oystehr: Oystehr): Promise<EffectInput> => {
  const { scheduleId } = input;

  const params = [
    {
      name: '_id',
      value: scheduleId,
    },
    {
      name: '_include',
      value: 'Schedule:actor',
    },
  ];

  const scheduleAndOwnerResults = (
    await oystehr.fhir.search<Schedule | PractitionerRole | ScheduleOwnerFhirResource>({
      resourceType: 'Schedule',
      params,
    })
  ).unbundle();

  let scheduleOwner: ScheduleOwnerFhirResource | undefined;

  const schedule = scheduleAndOwnerResults.find((res) => {
    return res.resourceType === 'Schedule' && res.id === scheduleId;
  }) as Schedule;
  if (!schedule) {
    throw FHIR_RESOURCE_NOT_FOUND('Schedule');
  }
  const scheduleOwnerRef = schedule.actor?.[0]?.reference ?? '';
  const [scheduleOwnerType, scheduleOwnerId] = scheduleOwnerRef.split('/');
  if (scheduleOwnerType && scheduleOwnerId) {
    scheduleOwner = scheduleAndOwnerResults.find((res) => {
      return `${res.resourceType}/${res.id}` === scheduleOwnerRef;
    }) as ScheduleOwnerFhirResource;
  }

  let serviceMode: ServiceMode | undefined = undefined;

  if (scheduleOwner) {
    serviceMode = getServiceModeFromScheduleOwner(scheduleOwner);
  }

  const scheduleExtension = getScheduleDetails(schedule);

  if (!scheduleExtension) {
    throw MISSING_SCHEDULE_EXTENSION_ERROR;
  }

  return { scheduleExtension, serviceMode };
};
