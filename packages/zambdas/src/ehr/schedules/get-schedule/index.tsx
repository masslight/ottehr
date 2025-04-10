import { checkOrCreateM2MClientToken, createOystehrClient, topLevelCatch, ZambdaInput } from '../../../shared';
import { APIGatewayProxyResult } from 'aws-lambda';
import {
  getScheduleDetails,
  getTimezone,
  INVALID_RESOURCE_ID_ERROR,
  isValidUUID,
  MISSING_REQUEST_BODY,
  MISSING_REQUIRED_PARAMETERS,
  MISSING_SCHEDULE_EXTENSION_ERROR,
  SCHEDULE_NOT_FOUND_ERROR,
  SCHEDULE_OWNER_NOT_FOUND_ERROR,
  ScheduleDTO,
  ScheduleDTOOwner,
  ScheduleExtension,
  Secrets,
} from 'utils';
import Oystehr from '@oystehr/sdk';
import { HealthcareService, Location, Practitioner, PractitionerRole, Schedule } from 'fhir/r4b';
import { getSlugForBookableResource } from '../../../patient/bookable/helpers';
import { addressStringFromAddress, getNameForOwner } from '../shared';

let m2mtoken: string;

export const index = async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    console.group('validateRequestParameters');
    const validatedParameters = validateRequestParameters(input);
    console.groupEnd();
    console.debug('validateRequestParameters success', JSON.stringify(validatedParameters));
    const { secrets } = validatedParameters;
    m2mtoken = await checkOrCreateM2MClientToken(m2mtoken, secrets);
    const oystehr = createOystehrClient(m2mtoken, secrets);
    const effectInput = await complexValidation(validatedParameters, oystehr);

    const scheduleDTO = performEffect(effectInput);

    return {
      statusCode: 200,
      body: JSON.stringify(scheduleDTO),
    };
  } catch (error: any) {
    console.log('Error: ', JSON.stringify(error.message));
    return topLevelCatch('get-patient-account', error, input.secrets);
  }
};

const performEffect = (input: EffectInput): ScheduleDTO => {
  const { scheduleExtension, scheduleId, timezone, owner: ownerResource } = input;

  let active = false;
  if (ownerResource.resourceType === 'Location') {
    active = (ownerResource as Location).status === 'active';
  } else {
    active = (ownerResource as Practitioner | HealthcareService | PractitionerRole).active ?? false;
  }

  let detailText: string | undefined = undefined;

  if (ownerResource.resourceType === 'Location') {
    const loc = ownerResource as Location;
    const address = loc.address;
    if (address) {
      detailText = addressStringFromAddress(address);
    }
  }

  const owner: ScheduleDTOOwner = {
    type: ownerResource.resourceType,
    id: ownerResource.id!,
    name: getNameForOwner(ownerResource),
    slug: getSlugForBookableResource(ownerResource) ?? '',
    active,
    detailText,
    infoMessage: '',
    hoursOfOperation: (ownerResource as Location)?.hoursOfOperation,
  };

  return {
    owner,
    id: scheduleId,
    timezone: timezone,
    schema: scheduleExtension,
    bookingLink: '',
  };
};

interface BasicInput {
  scheduleId: string;
  secrets: Secrets | null;
}

const validateRequestParameters = (input: ZambdaInput): BasicInput => {
  if (!input.body) {
    throw MISSING_REQUEST_BODY;
  }

  console.log('input', JSON.stringify(input, null, 2));
  const { secrets } = input;
  const { scheduleId } = JSON.parse(input.body);

  if (!scheduleId) {
    throw MISSING_REQUIRED_PARAMETERS(['scheduleId']);
  }

  if (isValidUUID(scheduleId) === false) {
    throw INVALID_RESOURCE_ID_ERROR('scheduleId');
  }

  return {
    secrets,
    scheduleId,
  };
};

interface EffectInput {
  scheduleId: string;
  scheduleExtension: ScheduleExtension;
  timezone: string;
  owner: Location | Practitioner | HealthcareService | PractitionerRole;
}

type QueryType = Schedule | Location | Practitioner | HealthcareService | PractitionerRole;

const complexValidation = async (input: BasicInput, oystehr: Oystehr): Promise<EffectInput> => {
  const { scheduleId } = input;
  const scheduleAndOwner = (
    await oystehr.fhir.search<QueryType>({
      resourceType: 'Schedule',
      params: [
        {
          name: '_id',
          value: scheduleId,
        },
        {
          name: '_include',
          value: 'Schedule:actor:Location',
        },
        {
          name: '_include',
          value: 'Schedule:actor:Practitioner',
        },
        {
          name: '_include',
          value: 'Schedule:actor:HealthcareService',
        },
        {
          name: '_include',
          value: 'Schedule:actor:PractitionerRole',
        },
      ],
    })
  ).unbundle();

  const schedule = scheduleAndOwner.find((sched) => sched.resourceType === 'Schedule') as Schedule;
  if (!schedule || !schedule.id) {
    throw SCHEDULE_NOT_FOUND_ERROR;
  }

  const scheduleExtension = getScheduleDetails(schedule);
  if (!scheduleExtension) {
    throw MISSING_SCHEDULE_EXTENSION_ERROR;
  }

  const scheduleOwnerRef = schedule.actor?.[0]?.reference ?? '';
  const [schedulOwnerType, scheduleOwnerId] = scheduleOwnerRef.split('/');
  let owner: Location | Practitioner | HealthcareService | PractitionerRole | undefined = undefined;
  const permttedScheduleOwerTypes = ['Location', 'Practitioner', 'HealthcareService', 'PractitionerRole'];
  if (scheduleOwnerId !== undefined && permttedScheduleOwerTypes.includes(schedulOwnerType)) {
    owner = scheduleAndOwner.find((res) => {
      return `${res.resourceType}/${res.id}` === scheduleOwnerRef;
    }) as Location | Practitioner | HealthcareService | PractitionerRole;
  }

  if (!owner) {
    throw SCHEDULE_OWNER_NOT_FOUND_ERROR;
  }

  return {
    scheduleId: schedule.id,
    scheduleExtension,
    timezone: getTimezone(schedule),
    owner,
  };
};
