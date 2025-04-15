import { checkOrCreateM2MClientToken, createOystehrClient, topLevelCatch, ZambdaInput } from '../../../shared';
import { APIGatewayProxyResult } from 'aws-lambda';
import {
  FHIR_RESOURCE_NOT_FOUND,
  getServiceModeFromScheduleOwner,
  getServiceModeFromSlot,
  GetSlotDetailsParams,
  GetSlotDetailsResponse,
  getSlotIsWalkin,
  getTimezone,
  INVALID_INPUT_ERROR,
  isValidUUID,
  MISSING_REQUEST_BODY,
  MISSING_REQUIRED_PARAMETERS,
  SCHEDULE_NOT_FOUND_CUSTOM_ERROR,
  ScheduleOwnerFhirResource,
  Secrets,
  ServiceMode,
} from 'utils';
import Oystehr from '@oystehr/sdk';
import { Appointment, Schedule, Slot } from 'fhir/r4b';

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

    const slotDetails = performEffect(effectInput);

    return {
      statusCode: 200,
      body: JSON.stringify(slotDetails),
    };
  } catch (error: any) {
    console.log('Error: ', JSON.stringify(error.message));
    return topLevelCatch('get-slot-details', error, input.secrets);
  }
};

const performEffect = (input: EffectInput): GetSlotDetailsResponse => {
  const { slot, schedule, scheduleOwner, appointmentId } = input;

  const startISO = slot.start;
  const endISO = slot.end;
  let serviceMode = getServiceModeFromSlot(slot) ?? getServiceModeFromScheduleOwner(scheduleOwner);
  if (!serviceMode) {
    serviceMode = ServiceMode['in-person'];
  }
  const ownerType = scheduleOwner.resourceType;
  const ownerId = scheduleOwner.id!;
  const isWalkin = getSlotIsWalkin(slot);

  // how to handle timezone is fairly context/use case specific
  // here we're defaulting to the schedule's timezone if it exists, else the schedule owner's timezone
  const timezoneForDisplay = getTimezone(schedule) ?? getTimezone(scheduleOwner);

  return {
    startISO,
    endISO,
    serviceMode,
    ownerType,
    ownerId,
    isWalkin,
    appointmentId,
    comment: slot.comment,
    timezoneForDisplay,
  };
};

interface BasicInput extends GetSlotDetailsParams {
  secrets: Secrets | null;
}

const validateRequestParameters = (input: ZambdaInput): BasicInput => {
  if (!input.body) {
    throw MISSING_REQUEST_BODY;
  }

  const { slotId } = JSON.parse(input.body);

  if (!slotId) {
    throw MISSING_REQUIRED_PARAMETERS(['slotId']);
  }
  if (isValidUUID(slotId) === false) {
    throw INVALID_INPUT_ERROR('"slotId" must be a valid UUID');
  }
  return {
    secrets: input.secrets,
    slotId,
  };
};

interface EffectInput {
  slot: Slot;
  schedule: Schedule;
  scheduleOwner: ScheduleOwnerFhirResource;
  appointmentId?: string;
}

const complexValidation = async (input: BasicInput, oystehr: Oystehr): Promise<EffectInput> => {
  const { slotId } = input;
  // query up the schedule that owns the slot
  const slotAndChainedResources = (
    await oystehr.fhir.search<Slot | Appointment | Schedule | ScheduleOwnerFhirResource>({
      resourceType: 'Slot',
      params: [
        { name: '_id', value: slotId },
        { name: '_revinclude', value: 'Appointment:slot' },
        { name: '_include', value: 'Slot:schedule' },
        { name: '_include:iterate', value: 'Schedule:actor' },
      ],
    })
  ).unbundle();
  const slot = slotAndChainedResources.find((s): s is Slot => s.resourceType === 'Slot' && s.id === slotId);
  if (!slot) {
    throw FHIR_RESOURCE_NOT_FOUND('Slot');
  }
  const schedule = slotAndChainedResources.find(
    (s): s is Schedule => s.resourceType === 'Schedule' && `Schedule/${s.id}` === slot.schedule?.reference
  );
  if (!schedule) {
    throw FHIR_RESOURCE_NOT_FOUND('Schedule');
  }
  const [scheduleOwnerType, scheduleOwnerId] = (schedule.actor?.[0]?.reference ?? '').split('/');

  const scheduleOwner = slotAndChainedResources.find(
    (s): s is ScheduleOwnerFhirResource => s.resourceType === scheduleOwnerType && s.id === scheduleOwnerId
  );
  if (!scheduleOwner) {
    const scheduleOwnerNotFoundError = SCHEDULE_NOT_FOUND_CUSTOM_ERROR(
      `The schedule resoure owning this slot, Schedule/${schedule.id}, could not be connected to any resource referenced by its "actor" field. Please ensure that Schedule.actor[0] references an existing Practitioner, Location, or HealthcareService resource.`
    );
    throw scheduleOwnerNotFoundError;
  }
  const appointment = slotAndChainedResources.find((s): s is Appointment => s.resourceType === 'Appointment');

  return { slot, schedule, scheduleOwner, appointmentId: appointment?.id };
};
