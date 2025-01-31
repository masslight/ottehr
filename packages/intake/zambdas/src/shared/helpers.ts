import Oystehr, { OystehrConfig } from '@oystehr/sdk';
import {
  Appointment,
  Attachment,
  Encounter,
  HealthcareService,
  Location,
  LocationHoursOfOperation,
  Practitioner,
  QuestionnaireResponse,
} from 'fhir/r4b';
import { DateTime } from 'luxon';
import {
  AvailableLocationInformation,
  findQuestionnaireResponseItemLinkId,
  getScheduleDetails,
  HOURS_OF_OPERATION_FORMAT,
  OVERRIDE_DATE_FORMAT,
  pickFirstValueFromAnswerItem,
  ScheduleType,
  SLUG_SYSTEM,
} from 'utils';
import { getSecret, Secrets, SecretsKeys } from 'zambda-utils';

export function createOystehrClient(token: string, secrets: Secrets | null): Oystehr {
  const FHIR_API = getSecret(SecretsKeys.FHIR_API, secrets).replace(/\/r4/g, '');
  const PROJECT_API = getSecret(SecretsKeys.PROJECT_API, secrets);
  const CLIENT_CONFIG: OystehrConfig = {
    accessToken: token,
    fhirApiUrl: FHIR_API,
    projectApiUrl: PROJECT_API,
  };
  console.log('creating oystehr client');
  return new Oystehr(CLIENT_CONFIG);
}

export function getParticipantFromAppointment(appointment: Appointment, participant: string): string {
  const participantTemp = appointment.participant
    .find((currentParticipant: any) => currentParticipant.actor?.reference?.startsWith(participant))
    ?.actor?.reference?.replace(`${participant}/`, '');

  if (!participantTemp) {
    throw new Error('Participant not found in list of appointment participants');
  }

  return participantTemp;
}

export function checkValidBookingTime(slotTime: string): boolean {
  const slotDate = DateTime.fromISO(slotTime);

  const currentDate = DateTime.now().setZone('UTC');

  return slotDate > currentDate;
}

export function getBucketAndObjectFromZ3URL(z3URL: string, projectAPI: string): { bucket: string; object: string } {
  const updatedPhotoIdFrontUrl = z3URL.replace(`${projectAPI}/z3/object/`, '');
  const photoIdFrontItems = updatedPhotoIdFrontUrl.split('/');
  const bucket = photoIdFrontItems[0];
  const object = photoIdFrontItems.slice(1).join('/');
  return { bucket, object };
}

export function getOtherOfficesForLocation(location: Location): { display: string; url: string }[] {
  const rawExtensionValue = location?.extension?.find(
    (extensionTemp) => extensionTemp.url === 'https://fhir.zapehr.com/r4/StructureDefinitions/other-offices'
  )?.valueString;
  if (!rawExtensionValue) {
    console.log("Location doesn't have other-offices extension");
    return [];
  }

  let parsedExtValue: { display: string; url: string }[] = [];
  try {
    parsedExtValue = JSON.parse(rawExtensionValue);
  } catch (_) {
    console.log('Location other-offices extension is formatted incorrectly');
    return [];
  }

  return parsedExtValue;
}

export function getLocationInformation(
  oystehr: Oystehr,
  scheduleResource: Location | Practitioner | HealthcareService,
  currentDate: DateTime = DateTime.now()
): AvailableLocationInformation {
  const slug = scheduleResource.identifier?.find((identifierTemp) => identifierTemp.system === SLUG_SYSTEM)?.value;
  const timezone = scheduleResource.extension?.find(
    (extensionTemp) => extensionTemp.url === 'http://hl7.org/fhir/StructureDefinition/timezone'
  )?.valueString;

  const schedule = getScheduleDetails(scheduleResource);
  const scheduleOverrides = schedule?.scheduleOverrides || {};

  let scheduleType: ScheduleType;
  switch (scheduleResource?.resourceType) {
    case 'Location':
      scheduleType = ScheduleType['location'];
      break;
    case 'HealthcareService':
      scheduleType = ScheduleType['group'];
      break;
    case 'Practitioner':
      scheduleType = ScheduleType['provider'];
      break;
  }

  // Modify hours of operation returned based on schedule overrides
  let hoursOfOperation: LocationHoursOfOperation[] | undefined = undefined;
  if (scheduleResource.resourceType === 'Location') {
    hoursOfOperation = scheduleResource.hoursOfOperation;
    currentDate = currentDate.setZone(timezone);
    const overrideDate = Object.keys(scheduleOverrides).find((date) => {
      return currentDate.toFormat(OVERRIDE_DATE_FORMAT) === date;
    });
    if (overrideDate) {
      const dayOfWeek = currentDate.toFormat('EEE').toLowerCase();
      const override = scheduleOverrides[overrideDate];
      const dayIndex = hoursOfOperation?.findIndex((hour) => (hour.daysOfWeek as string[])?.includes(dayOfWeek));
      if (hoursOfOperation && typeof dayIndex !== 'undefined' && dayIndex >= 0) {
        hoursOfOperation[dayIndex].openingTime = DateTime.fromFormat(override.open.toString(), 'h')
          .set({
            year: currentDate.year,
            month: currentDate.month,
            day: currentDate.day,
          })
          .toFormat(HOURS_OF_OPERATION_FORMAT);
        hoursOfOperation[dayIndex].closingTime = DateTime.fromFormat(override.close.toString(), 'h')
          .set({
            year: currentDate.year,
            month: currentDate.month,
            day: currentDate.day,
          })
          .toFormat(HOURS_OF_OPERATION_FORMAT);
      }
    }
  }

  return {
    id: scheduleResource.id,
    slug: slug,
    name: getName(oystehr, scheduleResource),
    description: undefined,
    address: undefined,
    telecom: scheduleResource.telecom,
    hoursOfOperation: hoursOfOperation,
    timezone: timezone,
    closures: schedule?.closures ?? [],
    otherOffices: [], // todo
    scheduleType,
  };
}

function getName(oystehrClient: Oystehr, item: Location | Practitioner | HealthcareService): string {
  if (!item.name) {
    return 'Unknown';
  }
  if (item.resourceType === 'Location') {
    return item.name;
  }
  if (item.resourceType === 'HealthcareService') {
    return item.name;
  }
  return oystehrClient.fhir.formatHumanName(item.name[0]);
}

export function getEncounterStatusHistoryIdx(encounter: Encounter, status: string): number {
  if (encounter.statusHistory) {
    return encounter.statusHistory.findIndex((history) => history.status === status && !history.period.end);
  } else {
    throw new Error('Encounter status history not found');
  }
}

export function checkPaperworkComplete(questionnaireResponse: QuestionnaireResponse): boolean {
  if (questionnaireResponse?.status === 'completed' || questionnaireResponse?.status === 'amended') {
    let photoIdFront: Attachment | undefined;
    const photoIdFrontItem = findQuestionnaireResponseItemLinkId('photo-id-front', questionnaireResponse?.item ?? []);
    if (photoIdFrontItem) {
      photoIdFront = pickFirstValueFromAnswerItem(photoIdFrontItem, 'attachment');
    }
    if (photoIdFront) {
      return true;
    }
  }
  return false;
}
