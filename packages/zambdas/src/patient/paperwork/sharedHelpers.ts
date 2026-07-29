import Oystehr, { BatchInputRequest, User } from '@oystehr/sdk';
import { Appointment, Coding, Encounter, Flag, HealthcareService, Location, Patient, Practitioner } from 'fhir/r4b';
import {
  AppointmentSummary,
  AvailableLocationInformation,
  checkEncounterIsVirtual,
  Closure,
  formatPhoneNumberDisplay,
  getPatchBinary,
  getScheduleExtension,
  HealthcareServiceWithLocationContext,
  PaperworkSupportingInfo,
  PersonSex,
  ScheduleExtension,
  ScheduleType,
  ServiceMode,
  serviceModeForHealthcareService,
  SLUG_SYSTEM,
  VisitType,
} from 'utils';
import { getOtherOfficesForLocation } from '../../shared';

export async function createOrUpdateFlags(
  flagName: string,
  existingFlags: Flag[],
  patientID: string,
  encounterID: string,
  timestamp: string,
  oystehr: Oystehr,
  user?: User | undefined
): Promise<void> {
  if (!existingFlags || !existingFlags.length) {
    const metaTags: Coding[] = [{ code: flagName }];
    let formattedUserNumber: string | undefined;
    let paperworkStartedBy: string | undefined;
    let createdByTag: Coding | undefined;
    if (user) {
      formattedUserNumber = formatPhoneNumberDisplay(user?.name?.replace('+1', '') || '');
      paperworkStartedBy = `Patient${formattedUserNumber ? ` ${formattedUserNumber}` : ''}`;
    }
    if (formattedUserNumber && paperworkStartedBy) {
      createdByTag = { system: 'created-date-time', display: paperworkStartedBy, version: timestamp };
      metaTags.push(createdByTag);
    }

    // if no flags exist create one
    const flag = await oystehr.fhir.create({
      resourceType: 'Flag',
      status: 'active',
      code: {
        coding: [
          {
            system: 'https://fhir.zapehr.com/r4/StructureDefinitions/flag-code',
            code: flagName,
            display: flagName,
          },
        ],
      },
      category: [
        {
          coding: [
            {
              system: 'https://hl7.org/fhir/R4/codesystem-flag-category.html',
              code: 'admin',
              display: 'Administrative',
            },
          ],
        },
      ],
      subject: {
        type: 'Patient',
        reference: `Patient/${patientID}`,
      },
      period: {
        start: timestamp,
      },
      encounter: {
        reference: `Encounter/${encounterID}`,
      },
      meta: {
        tag: metaTags,
      },
    });
    console.log(`New flag created for ${flagName}`, flag);
  } else {
    // update the existing flags
    const requests: BatchInputRequest<Flag>[] = [];

    requests.push(
      getPatchBinary({
        resourceType: 'Flag',
        resourceId: existingFlags[0].id ?? '',
        patchOperations: [
          {
            op: 'replace',
            path: '/period/start',
            value: timestamp,
          },
        ],
      })
    );

    // deactivate any other active flags
    existingFlags.slice(1).forEach((flag) => {
      requests.push(
        getPatchBinary({
          resourceType: 'Flag',
          resourceId: flag.id ?? '',
          patchOperations: [
            {
              op: 'replace',
              path: '/status',
              value: 'inactive',
            },
          ],
        })
      );
    });

    await oystehr.fhir.batch({ requests: requests });
    console.log(`Updated flag ${flagName} period.start to ${timestamp}`);
  }
}

interface LocationSummaryInput {
  appointment: Appointment;
  location?: Location;
  hsResources?: HealthcareServiceWithLocationContext;
  practitioner?: Practitioner;
}
// todo: consider whether all the location config stuff needs to be on here
const makeLocationSummary = (input: LocationSummaryInput): AppointmentSummary['location'] => {
  const { appointment, location, hsResources, practitioner } = input;
  if (hsResources) {
    // do a thing
    const { hs, locations, coverageArea } = hsResources;
    const otherOffices: AvailableLocationInformation['otherOffices'] = [];
    const serviceMode = serviceModeForHealthcareService(hs);
    let scheduleExtension: ScheduleExtension | undefined = undefined;
    let loc: Location | undefined;
    // note there's not really any clear notion what to do here if the HS pools provider schedules
    // this is to be addressed in a future release
    if (serviceMode === ServiceMode['in-person']) {
      // this is most likely a fictional use case...
      loc = locations?.find((tempLoc) => {
        return appointment?.participant?.some((maybeLoc) => {
          const reference = maybeLoc.actor?.reference;
          if (reference) {
            return reference === `${tempLoc.resourceType}/${tempLoc.id}`;
          }
          return false;
        });
      });
      if (loc === undefined) {
        loc = locations?.length === 1 ? locations[0] : undefined;
      }
      if (loc) {
        scheduleExtension = getScheduleExtension(loc);
      }
    } else {
      loc = coverageArea?.length === 1 ? coverageArea[0] : undefined;
    }
    return {
      id: loc?.id,
      slug: loc?.identifier?.find((identifierTemp) => identifierTemp.system === SLUG_SYSTEM)?.value,
      name: loc?.name ?? hs?.name,
      description: loc?.description,
      address: loc?.address,
      telecom: loc?.telecom,
      timezone: loc?.extension?.find(
        (extensionTemp) => extensionTemp.url === 'http://hl7.org/fhir/StructureDefinition/timezone'
      )?.valueString,
      otherOffices,
      scheduleOwnerType: ScheduleType['group'],
      scheduleExtension,
    };
  } else if (practitioner) {
    // todo build out practitioner scheduling more
    return {
      id: practitioner?.id,
      slug: practitioner?.identifier?.find((identifierTemp) => identifierTemp.system === SLUG_SYSTEM)?.value,
      name: `${practitioner.name?.[0]?.given?.[0]} ${practitioner.name?.[0]?.family}`,
      description: undefined,
      address: undefined,
      telecom: [],
      timezone: practitioner?.extension?.find(
        (extensionTemp) => extensionTemp.url === 'http://hl7.org/fhir/StructureDefinition/timezone'
      )?.valueString,
      otherOffices: [],
      scheduleOwnerType: ScheduleType['provider'],
    };
  } else {
    const closures: Closure[] = [];
    if (location) {
      const schedule = getScheduleExtension(location);
      if (schedule && schedule.closures) {
        closures.push(...schedule.closures);
      }
    }
    return {
      id: location?.id,
      slug: location?.identifier?.find((identifierTemp) => identifierTemp.system === SLUG_SYSTEM)?.value,
      name: location?.name,
      description: location?.description,
      address: location?.address,
      telecom: location?.telecom,
      timezone: location?.extension?.find(
        (extensionTemp) => extensionTemp.url === 'http://hl7.org/fhir/StructureDefinition/timezone'
      )?.valueString,
      otherOffices: location ? getOtherOfficesForLocation(location) : [],
      scheduleOwnerType: ScheduleType['location'],
    };
  }
};

export interface GetPaperworkSupportingInfoInput {
  appointment: Appointment;
  encounter: Encounter;
  patient: Patient;
  location: Location | undefined;
  hsResources: { hs: HealthcareService; locations?: Location[]; serviceArea?: Location } | undefined;
  practitioner?: Practitioner;
}

export function getPaperworkSupportingInfoForUserWithAccess(
  input: GetPaperworkSupportingInfoInput
): PaperworkSupportingInfo {
  const { appointment, patient, location, hsResources, practitioner, encounter } = input;
  const serviceMode: ServiceMode = checkEncounterIsVirtual(encounter)
    ? ServiceMode['virtual']
    : ServiceMode['in-person'];

  return {
    appointment: {
      id: appointment?.id ?? 'Unknown', // i hate this
      start: appointment?.start || 'Unknown',
      location: makeLocationSummary({ appointment, location, hsResources, practitioner }),
      visitType: appointment?.appointmentType?.text as VisitType,
      status: appointment?.status,
      serviceMode: serviceMode,
    },
    patient: {
      id: patient.id,
      firstName: patient.name?.[0].given?.[0],
      dateOfBirth: patient.birthDate,
    },
  };
}

// gender must be saved in lower case on the patient resource but the paperwork sex fields consume the value with title case
export const formatPatientSexForPaperwork = (value: string): PersonSex | undefined => {
  const sex = Object.keys(PersonSex).find((key) => PersonSex[key as keyof typeof PersonSex] === value);
  return sex as PersonSex | undefined;
};
