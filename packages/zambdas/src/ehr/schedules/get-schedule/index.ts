import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { HealthcareService, Location, Practitioner, PractitionerRole, Schedule } from 'fhir/r4b';
import {
  BLANK_SCHEDULE_JSON_TEMPLATE,
  getScheduleExtension,
  getSlugForBookableResource,
  getTimezone,
  INVALID_INPUT_ERROR,
  INVALID_RESOURCE_ID_ERROR,
  isLocationVirtual,
  isValidUUID,
  LOCATION_REVIEW_LINK_EXTENSION_URL,
  MISSING_REQUEST_BODY,
  MISSING_REQUIRED_PARAMETERS,
  MISSING_SCHEDULE_EXTENSION_ERROR,
  RoleType,
  ROOM_EXTENSION_URL,
  SCHEDULE_NOT_FOUND_ERROR,
  SCHEDULE_OWNER_ADVAPACS_LOCATION_EXTENSION_URL,
  SCHEDULE_OWNER_NOT_FOUND_ERROR,
  SCHEDULE_OWNER_STRIPE_ACCOUNT_EXTENSION_URL,
  ScheduleDTO,
  ScheduleDTOOwner,
  ScheduleExtension,
  ScheduleOwnerFhirResource,
  Secrets,
  TIMEZONES,
  userMe,
} from 'utils';
import { checkOrCreateM2MClientToken, createOystehrClient, wrapHandler, ZambdaInput } from '../../../shared';
import { addressStringFromAddress, getNameForOwner } from '../shared';

let m2mToken: string;

const ZAMBDA_NAME = 'get-schedule';

const PAYMENT_FIELD_VIEWER_ROLES: ReadonlyArray<string> = [RoleType.Administrator, RoleType.CustomerSupport];

const callerCanViewPaymentFields = async (
  authorizationHeader: string | undefined,
  secrets: ZambdaInput['secrets']
): Promise<boolean> => {
  if (!authorizationHeader) return false;
  const token = authorizationHeader.replace(/^Bearer\s+/i, '');
  if (!token) return false;
  try {
    const caller = await userMe(token, secrets);
    const callerRoles = (caller.roles ?? []).map((role) => role.name);
    return callerRoles.some((role) => PAYMENT_FIELD_VIEWER_ROLES.includes(role));
  } catch (err) {
    console.error('Failed to resolve caller from Authorization header:', err);
    return false;
  }
};

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  console.group('validateRequestParameters');
  const validatedParameters = validateRequestParameters(input);
  console.groupEnd();
  console.debug('validateRequestParameters success', JSON.stringify(validatedParameters));
  const { secrets } = validatedParameters;
  m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
  const oystehr = createOystehrClient(m2mToken, secrets);
  const [effectInput, includePaymentFields] = await Promise.all([
    complexValidation(validatedParameters, oystehr),
    callerCanViewPaymentFields(input.headers?.Authorization, secrets),
  ]);

  const scheduleDTO = performEffect(effectInput, { includePaymentFields });

  return {
    statusCode: 200,
    body: JSON.stringify(scheduleDTO),
  };
});

const performEffect = (input: EffectInput, options: { includePaymentFields: boolean }): ScheduleDTO => {
  const { scheduleExtension, scheduleId, timezone, owner: ownerResource, scheduleActive } = input;

  let active = false;
  if (ownerResource.resourceType === 'Location') {
    active = (ownerResource as Location).status === 'active';
  } else {
    active = (ownerResource as Practitioner | HealthcareService).active ?? false;
  }

  let detailText: string | undefined = undefined;
  let isVirtual: boolean | undefined = undefined;
  let stripeAccountId: string | undefined = undefined;
  let advapacsLocationId: string | undefined = undefined;
  let rooms: string[] | undefined = undefined;
  let description: string | undefined = undefined;
  let address: Location['address'] | undefined = undefined;
  let telecom: Location['telecom'] | undefined = undefined;
  let reviewLink: string | undefined = undefined;

  if (ownerResource.resourceType === 'Location') {
    const loc = ownerResource as Location;
    address = loc.address;
    if (address) {
      detailText = addressStringFromAddress(address);
    }
    description = loc.description;
    telecom = loc.telecom;
    isVirtual = isLocationVirtual(loc);
    reviewLink = loc.extension?.find((ext) => ext.url === LOCATION_REVIEW_LINK_EXTENSION_URL)?.valueUrl;
    if (options.includePaymentFields) {
      stripeAccountId = loc.extension?.find((ext) => ext.url === SCHEDULE_OWNER_STRIPE_ACCOUNT_EXTENSION_URL)
        ?.valueString;
      advapacsLocationId = loc.extension?.find((ext) => ext.url === SCHEDULE_OWNER_ADVAPACS_LOCATION_EXTENSION_URL)
        ?.valueString;
    }
    rooms = loc.extension
      ?.filter((ext) => ext.url === ROOM_EXTENSION_URL)
      .map((ext) => ext.valueString)
      .filter((value): value is string => typeof value === 'string');
  }

  const owner: ScheduleDTOOwner = {
    type: ownerResource.resourceType,
    id: ownerResource.id!,
    name: getNameForOwner(ownerResource),
    slug: getSlugForBookableResource(ownerResource) ?? '',
    timezone: getTimezone(ownerResource),
    active,
    detailText,
    hoursOfOperation: (ownerResource as Location)?.hoursOfOperation,
    isVirtual,
    stripeAccountId,
    advapacsLocationId,
    rooms,
    description,
    address,
    telecom,
    reviewLink,
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
