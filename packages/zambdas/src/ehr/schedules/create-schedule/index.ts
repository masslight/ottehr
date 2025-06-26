import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Extension, Schedule } from 'fhir/r4b';
import {
  CreateScheduleParams,
  FHIR_RESOURCE_NOT_FOUND,
  getSecret,
  INVALID_INPUT_ERROR,
  MISSING_REQUEST_BODY,
  MISSING_REQUIRED_PARAMETERS,
  SCHEDULE_EXTENSION_URL,
  ScheduleExtension,
  Secrets,
  SecretsKeys,
  TIMEZONE_EXTENSION_URL,
} from 'utils';
import { checkOrCreateM2MClientToken, createOystehrClient, topLevelCatch, ZambdaInput } from '../../../shared';
import { validateUpdateScheduleParameters } from '../shared';

let m2mToken: string;

export const index = async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    console.group('validateRequestParameters');
    const validatedParameters = validateRequestParameters(input);
    console.groupEnd();
    console.debug('validateRequestParameters success', JSON.stringify(validatedParameters));
    const { secrets } = validatedParameters;
    m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
    const oystehr = createOystehrClient(m2mToken, secrets);
    const effectInput = await complexValidation(validatedParameters, oystehr);

    const updatedSchedule = await performEffect(effectInput, oystehr);

    return {
      statusCode: 200,
      body: JSON.stringify(updatedSchedule),
    };
  } catch (error: any) {
    console.log('Error: ', JSON.stringify(error.message));
    const ENVIRONMENT = getSecret(SecretsKeys.ENVIRONMENT, input.secrets);
    return topLevelCatch('create-schedule', error, ENVIRONMENT);
  }
};

const performEffect = async (input: EffectInput, oystehr: Oystehr): Promise<Schedule> => {
  const { schedule } = input;

  return oystehr.fhir.create<Schedule>(schedule);
};

interface BasicInput extends CreateScheduleParams {
  secrets: Secrets | null;
}

const validateRequestParameters = (input: ZambdaInput): BasicInput => {
  if (!input.body) {
    throw MISSING_REQUEST_BODY;
  }

  const { ownerId, ownerType } = JSON.parse(input.body);

  if (!ownerId) {
    throw MISSING_REQUIRED_PARAMETERS(['ownerId']);
  }
  if (!ownerType) {
    throw MISSING_REQUIRED_PARAMETERS(['ownerType']);
  }
  if (typeof ownerId !== 'string') {
    throw INVALID_INPUT_ERROR('"ownerId" must be a string');
  }
  if (typeof ownerType !== 'string' || !['Location', 'Practitioner', 'HealthcareService'].includes(ownerType)) {
    throw INVALID_INPUT_ERROR(
      '"ownerType" must be a string and one of: "Location", "Practitioner", "HealthcareService"'
    );
  }
  const { secrets, scheduleId, timezone, schedule, scheduleOverrides, closures } =
    validateUpdateScheduleParameters(input);

  if (!schedule) {
    throw MISSING_REQUIRED_PARAMETERS(['schedule']);
  }

  return {
    secrets,
    scheduleId,
    timezone,
    schedule,
    scheduleOverrides,
    closures,
    ownerId,
    ownerType: ownerType as 'Location' | 'Practitioner' | 'HealthcareService',
  };
};

interface EffectInput {
  schedule: Schedule;
}

const complexValidation = async (input: BasicInput, oystehr: Oystehr): Promise<EffectInput> => {
  const { schedule: scheduleInput, closures, active, timezone, scheduleOverrides, ownerId, ownerType } = input;

  const owner = oystehr.fhir.get({
    resourceType: ownerType,
    id: ownerId,
  });

  if (!owner) {
    throw FHIR_RESOURCE_NOT_FOUND(ownerType);
  }

  const scheduleExtension: ScheduleExtension = {
    schedule: scheduleInput,
    closures: closures ?? [],
    scheduleOverrides: scheduleOverrides ?? {},
  };
  const extension: Extension[] = [];
  // console.log('scheduleExtension', JSON.stringify(scheduleExtension, null, 2));
  const scheduleJson = JSON.stringify(scheduleExtension);
  extension.push({
    url: SCHEDULE_EXTENSION_URL,
    valueString: scheduleJson,
  });
  if (timezone) {
    extension.push({
      url: TIMEZONE_EXTENSION_URL,
      valueString: timezone,
    });
  }
  const schedule: Schedule = {
    resourceType: 'Schedule',
    active: active ?? true,
    extension,
    actor: [
      {
        reference: `${ownerType}/${ownerId}`,
      },
    ],
  };

  console.log('schedule to write:', JSON.stringify(schedule, null, 2));
  return {
    schedule,
  };
};
