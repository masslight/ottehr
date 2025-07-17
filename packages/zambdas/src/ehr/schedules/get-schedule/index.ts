import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { HealthcareService, Location, Practitioner, PractitionerRole, Schedule } from 'fhir/r4b';
import {
  BLANK_SCHEDULE_JSON_TEMPLATE,
  getScheduleExtension,
  getSecret,
  getSlugForBookableResource,
  getTimezone,
  INVALID_INPUT_ERROR,
  INVALID_RESOURCE_ID_ERROR,
  isLocationVirtual,
  isValidUUID,
  MISSING_REQUEST_BODY,
  MISSING_REQUIRED_PARAMETERS,
  MISSING_SCHEDULE_EXTENSION_ERROR,
  SCHEDULE_NOT_FOUND_ERROR,
  SCHEDULE_OWNER_NOT_FOUND_ERROR,
  ScheduleDTO,
  ScheduleDTOOwner,
  ScheduleExtension,
  ScheduleOwnerFhirResource,
  Secrets,
  SecretsKeys,
  TIMEZONES,
} from 'utils';
import {
  checkOrCreateM2MClientToken,
  createOystehrClient,
  topLevelCatch,
  wrapHandler,
  ZambdaInput,
} from '../../../shared';
import { addressStringFromAddress, getNameForOwner } from '../shared';

let m2mToken: string;

const ZAMBDA_NAME = 'get-schedule';

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    console.group('validateRequestParameters');
    const validatedParameters = validateRequestParameters(input);
    console.groupEnd();
    console.debug('validateRequestParameters success', JSON.stringify(validatedParameters));
    const { secrets } = validatedParameters;
    m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
    const oystehr = createOystehrClient(m2mToken, secrets);
    const effectInput = await complexValidation(validatedParameters, oystehr);

    const scheduleDTO = performEffect(effectInput);

    return {
      statusCode: 200,
      body: JSON.stringify(scheduleDTO),
    };
  } catch (error: any) {
    console.log('Error: ', JSON.stringify(error.message));
    const ENVIRONMENT = getSecret(SecretsKeys.ENVIRONMENT, input.secrets);
    return topLevelCatch('ehr-get-schedule', error, ENVIRONMENT);
  }
});

const performEffect = (input: EffectInput): ScheduleDTO => {
  const { scheduleExtension, scheduleId, timezone, owner: ownerResource, scheduleActive } = input;

  let active = false;
  if (ownerResource.resourceType === 'Location') {
    active = (ownerResource as Location).status === 'active';
  } else {
    active = (ownerResource as Practitioner | HealthcareService).active ?? false;
  }

  let detailText: string | undefined = undefined;
  let isVirtual: boolean | undefined = undefined;

  if (ownerResource.resourceType === 'Location') {
    const loc = ownerResource as Location;
    const address = loc.address;
    if (address) {
      detailText = addressStringFromAddress(address);
    }
    isVirtual = isLocationVirtual(loc);
  }

  const owner: ScheduleDTOOwner = {
    type: ownerResource.resourceType,
    id: ownerResource.id!,
    name: getNameForOwner(ownerResource),
    slug: getSlugForBookableResource(ownerResource) ?? '',
    timezone: getTimezone(ownerResource),
    active,
    detailText,
    infoMessage: '',
    hoursOfOperation: (ownerResource as Location)?.hoursOfOperation,
    isVirtual,
  };

  return {
    owner,
    id: scheduleId,
    timezone: timezone,
    schema: scheduleExtension,
    bookingLink: '',
    active: scheduleActive,
  };
};

interface BasicInput {
  scheduleId?: string;
  owner?: {
    ownerType: ScheduleOwnerFhirResource['resourceType'];
    ownerId: string;
  };
  secrets: Secrets | null;
}

const validateRequestParameters = (input: ZambdaInput): BasicInput => {
  if (!input.body) {
    throw MISSING_REQUEST_BODY;
  }

  console.log('input', JSON.stringify(input, null, 2));
  const { secrets } = input;
  const { scheduleId, ownerId, ownerType } = JSON.parse(input.body);

  const createMode = Boolean(ownerId) && Boolean(ownerType);

  if (scheduleId && (ownerId || ownerType)) {
    INVALID_INPUT_ERROR('If scheduleId is provided, ownerId and ownerType must not be provided');
  }

  if (!scheduleId && !ownerId && !ownerType) {
    throw MISSING_REQUIRED_PARAMETERS(['scheduleId']);
  }

  if (ownerId && !ownerType) {
    throw MISSING_REQUIRED_PARAMETERS(['ownerType']);
  }

  if (ownerType && !ownerId) {
    throw MISSING_REQUIRED_PARAMETERS(['ownerId']);
  }

  if (scheduleId && isValidUUID(scheduleId) === false && !createMode) {
    throw INVALID_RESOURCE_ID_ERROR('scheduleId');
  }

  if (ownerId && isValidUUID(ownerId) === false && createMode) {
    console.log('ownerId', ownerId);
    throw INVALID_RESOURCE_ID_ERROR('ownerId');
  }
  if (createMode && !['Location', 'Practitioner', 'HealthcareService'].includes(ownerType)) {
    throw INVALID_INPUT_ERROR(
      '"ownerType" must be a string and one of: "Location", "Practitioner", "HealthcareService"'
    );
  }

  const bi: BasicInput = {
    secrets,
  };
  if (scheduleId) {
    bi.scheduleId = scheduleId;
  } else if (ownerId && ownerType) {
    bi.owner = {
      ownerId,
      ownerType,
    };
  }
  console.log('bi', JSON.stringify(bi, null, 2));
  return bi;
};

interface EffectInput {
  scheduleId: string;
  scheduleExtension: ScheduleExtension;
  timezone: string;
  scheduleActive: boolean;
  owner: ScheduleOwnerFhirResource;
}

type QueryType = Schedule | ScheduleOwnerFhirResource;

const complexValidation = async (input: BasicInput, oystehr: Oystehr): Promise<EffectInput> => {
  const { scheduleId, owner } = input;
  if (scheduleId) {
    return getEffectInputFromSchedule(scheduleId, oystehr);
  }
  if (owner) {
    return getEffectInputFromOwner(owner, oystehr);
  }
  throw new Error('Input validation produced unexpected undefined values');
};

const getEffectInputFromSchedule = async (scheduleId: string, oystehr: Oystehr): Promise<EffectInput> => {
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
      ],
    })
  ).unbundle();

  const schedule = scheduleAndOwner.find((scheduleToFind) => scheduleToFind.resourceType === 'Schedule') as Schedule;
  if (!schedule || !schedule.id) {
    throw SCHEDULE_NOT_FOUND_ERROR;
  }

  const scheduleExtension = getScheduleExtension(schedule);
  if (!scheduleExtension) {
    throw MISSING_SCHEDULE_EXTENSION_ERROR;
  }

  const scheduleOwnerRef = schedule.actor?.[0]?.reference ?? '';
  const [scheduleOwnerType, scheduleOwnerId] = scheduleOwnerRef.split('/');
  let owner: Location | Practitioner | HealthcareService | PractitionerRole | undefined = undefined;
  const permittedScheduleOwnerTypes = ['Location', 'Practitioner', 'HealthcareService'];
  if (scheduleOwnerId !== undefined && permittedScheduleOwnerTypes.includes(scheduleOwnerType)) {
    owner = scheduleAndOwner.find((res) => {
      return `${res.resourceType}/${res.id}` === scheduleOwnerRef;
    }) as ScheduleOwnerFhirResource;
  }

  if (!owner) {
    throw SCHEDULE_OWNER_NOT_FOUND_ERROR;
  }

  return {
    scheduleId: schedule.id,
    scheduleExtension,
    timezone: getTimezone(schedule),
    owner,
    scheduleActive: schedule.active ?? true,
  };
};

const getEffectInputFromOwner = async (
  ownerDef: { ownerId: string; ownerType: ScheduleOwnerFhirResource['resourceType'] },
  oystehr: Oystehr
): Promise<EffectInput> => {
  const { ownerId, ownerType } = ownerDef;
  const scheduleAndOwner = (
    await oystehr.fhir.search<QueryType>({
      resourceType: ownerType,
      params: [
        {
          name: '_id',
          value: ownerId,
        },
        {
          name: '_revinclude',
          value: `Schedule:actor:${ownerType}`,
        },
      ],
    })
  ).unbundle();

  let scheduleId = 'new-schedule';
  let scheduleExtension: ScheduleExtension = BLANK_SCHEDULE_JSON_TEMPLATE;
  const schedule = scheduleAndOwner.find((scheduleToFind) => scheduleToFind.resourceType === 'Schedule') as Schedule;
  if (schedule && schedule.id) {
    scheduleId = schedule.id;
    scheduleExtension = getScheduleExtension(schedule) ?? BLANK_SCHEDULE_JSON_TEMPLATE;
  }

  console.log('scheduleExtension', JSON.stringify(scheduleExtension, null, 2));

  const scheduleOwnerRef = schedule?.actor?.[0]?.reference ?? '';
  const [scheduleOwnerType, scheduleOwnerId] = scheduleOwnerRef.split('/');
  let owner: ScheduleOwnerFhirResource | undefined = undefined;
  const permittedScheduleOwnerTypes = ['Location', 'Practitioner', 'HealthcareService'];
  if (scheduleOwnerId !== undefined && permittedScheduleOwnerTypes.includes(scheduleOwnerType)) {
    owner = scheduleAndOwner.find((res) => {
      return `${res.resourceType}/${res.id}` === scheduleOwnerRef;
    }) as ScheduleOwnerFhirResource;
  } else {
    owner = scheduleAndOwner.find((res) => {
      return `${res.resourceType}/${res.id}` === `${ownerType}/${ownerId}`;
    }) as ScheduleOwnerFhirResource;
  }
  if (!owner) {
    throw SCHEDULE_OWNER_NOT_FOUND_ERROR;
  }

  return {
    scheduleId,
    scheduleExtension,
    timezone: schedule ? getTimezone(schedule) : TIMEZONES[0],
    owner,
    scheduleActive: schedule ? schedule.active ?? true : true,
  };
};
