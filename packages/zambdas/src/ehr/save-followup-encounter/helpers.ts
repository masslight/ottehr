import { Oystehr } from '@oystehr/sdk/dist/cjs/resources/classes';
import { Operation } from 'fast-json-patch';
import { CodeableConcept, Coding, Encounter, EncounterParticipant, Location, Reference } from 'fhir/r4b';
import {
  FOLLOWUP_SYSTEMS,
  FollowupReason,
  formatFhirEncounterToPatientFollowupDetails,
  PatientFollowupDetails,
} from 'utils';

export async function createEncounterResource(
  encounterDetails: PatientFollowupDetails,
  oystehr: Oystehr
): Promise<Encounter> {
  const encounterResource: Encounter = {
    resourceType: 'Encounter',
    class: {
      system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
      code: 'VR',
      display: 'virtual', // todo not sure if this type is applicable to non-billable
    },
    subject: {
      reference: `Patient/${encounterDetails.patientId}`,
    },
    status: encounterDetails.resolved ? 'finished' : 'in-progress',
    period: {
      start: encounterDetails.start,
      end: encounterDetails?.end,
    },
    type: createEncounterType(encounterDetails.followupType),
  };

  if (encounterDetails.location) {
    encounterResource.location = [
      {
        location: { reference: `Location/${encounterDetails.location.id}` },
      },
    ];
  }

  if (encounterDetails.reason) {
    encounterResource.reasonCode = createEncounterReasonCode(encounterDetails.reason);
  }

  const encounterParticipant: EncounterParticipant[] = [];
  if (encounterDetails.answered) {
    encounterParticipant.push(createEncounterParticipant(FOLLOWUP_SYSTEMS.answeredUrl, encounterDetails.answered));
  }
  if (encounterDetails.caller) {
    encounterParticipant.push(createEncounterParticipant(FOLLOWUP_SYSTEMS.callerUrl, encounterDetails.caller));
  }
  if (encounterDetails.provider) {
    encounterParticipant.push(
      createEncounterParticipant(FOLLOWUP_SYSTEMS.providerUrl, encounterDetails.provider.name, {
        type: 'Practitioner',
        reference: `Practitioner/${encounterDetails.provider.practitionerId}`,
      })
    );
  }
  if (encounterParticipant.length) encounterResource.participant = encounterParticipant;

  if (encounterDetails.message) {
    encounterResource.extension = [
      {
        url: FOLLOWUP_SYSTEMS.messageUrl,
        valueString: encounterDetails.message,
      },
    ];
  }

  return await oystehr.fhir.create(encounterResource);
}

export async function updateEncounterResource(
  encounterId: string,
  encounterDetails: PatientFollowupDetails,
  oystehr: Oystehr
): Promise<Encounter> {
  const fhirResources = (
    await oystehr.fhir.search<Encounter | Location>({
      resourceType: 'Encounter',
      params: [
        {
          name: '_id',
          value: encounterId,
        },
        {
          name: '_include',
          value: 'Encounter:location',
        },
      ],
    })
  ).unbundle();
  const curFhirEncounter = fhirResources.find((resource) => resource.resourceType === 'Encounter') as Encounter;
  const curFhirLocation = fhirResources.find((resource) => resource.resourceType === 'Location') as Location;
  const patientId = curFhirEncounter?.subject?.reference?.split('/')[1];
  if (!curFhirEncounter || !patientId)
    throw new Error('Could not find the encounter or patient id when updating the follow up encounter');
  const curEncounterDetails = formatFhirEncounterToPatientFollowupDetails(curFhirEncounter, patientId, curFhirLocation);
  console.log('current encounter details', curEncounterDetails);
  const operations: Operation[] = [];

  // if the encounter has been marked resolved, add an end time and update the status to finished
  if (encounterDetails.end) {
    operations.push(
      {
        op: 'add',
        path: '/period/end',
        value: encounterDetails?.end,
      },
      {
        op: 'replace',
        path: '/status',
        value: 'finished',
      }
    );
  }

  // check for deltas
  // answered & date/time are read only after initial save so they should never be updated

  // followupType is required, it will only ever be replaced
  if (encounterDetails.followupType !== curEncounterDetails.followupType) {
    operations.push({
      op: 'replace',
      path: '/type',
      value: createEncounterType(encounterDetails.followupType),
    });
  }

  if (encounterDetails.reason !== curEncounterDetails.reason) {
    if (encounterDetails.reason) {
      operations.push({
        op: `${curEncounterDetails.reason ? 'replace' : 'add'}`,
        path: '/reasonCode',
        value: createEncounterReasonCode(encounterDetails.reason),
      });
    } else if (curEncounterDetails.reason) {
      operations.push({
        op: 'remove',
        path: '/reasonCode',
      });
    }
  }

  const locationId = encounterDetails?.location?.id;
  if (locationId !== curEncounterDetails?.location?.id) {
    // location is updating or being added
    if (locationId) {
      operations.push({
        op: curEncounterDetails?.location?.id ? 'replace' : 'add',
        path: '/location',
        value: [
          {
            location: {
              reference: `Location/${locationId}`,
            },
          },
        ],
      });
    } else if (curEncounterDetails?.location?.id) {
      // location is being removed
      operations.push({
        op: 'remove',
        path: '/location',
      });
    }
  }

  if (encounterDetails.message !== curEncounterDetails.message) {
    // message is being updated
    if (encounterDetails.message && curEncounterDetails.message && curFhirEncounter.extension) {
      const messageIdx = curFhirEncounter.extension.findIndex((ext) => ext.url === FOLLOWUP_SYSTEMS.messageUrl);
      operations.push({
        op: 'replace',
        path: `/extension/${messageIdx}/valueString`,
        value: encounterDetails.message,
      });
    }
    // message is being added
    if (encounterDetails.message && !curEncounterDetails.message) {
      const messageExtVal = {
        url: FOLLOWUP_SYSTEMS.messageUrl,
        valueString: encounterDetails.message,
      };
      // either being added to an exiting extension array
      // or is the first value in the array
      operations.push({
        op: 'add',
        path: `/extension${curFhirEncounter.extension ? '/-' : ''}`,
        value: curFhirEncounter.extension ? messageExtVal : [messageExtVal],
      });
    }
    // message is being removed
    if (!encounterDetails.message && curEncounterDetails.message && curFhirEncounter.extension) {
      curFhirEncounter.extension = curFhirEncounter.extension.filter((ext) => ext.url !== FOLLOWUP_SYSTEMS.messageUrl);
      operations.push({
        op: 'replace',
        path: '/extension',
        value: curFhirEncounter.extension,
      });
    }
  }

  let participantOp: Operation['op'] | undefined = undefined;
  if (encounterDetails.caller !== curEncounterDetails.caller) {
    // caller is being updated
    if (encounterDetails.caller && curEncounterDetails.caller && curFhirEncounter?.participant) {
      participantOp = 'replace';
      curFhirEncounter.participant = updateParticipant(
        curFhirEncounter.participant,
        FOLLOWUP_SYSTEMS.callerUrl,
        encounterDetails.caller
      );
    }
    // caller is being added
    if (encounterDetails.caller && !curEncounterDetails.caller) {
      const callerParticipant = createEncounterParticipant(FOLLOWUP_SYSTEMS.callerUrl, encounterDetails.caller);
      // either being added to an exiting participant array
      if (curFhirEncounter.participant) {
        participantOp = 'replace';
        curFhirEncounter.participant.push(callerParticipant);
      } else {
        // or is the first val in the participant array
        participantOp = 'add';
        curFhirEncounter.participant = [callerParticipant];
      }
    }
    // caller is being removed
    if (!encounterDetails.caller && curEncounterDetails.caller && curFhirEncounter.participant) {
      curFhirEncounter.participant = updateParticipant(curFhirEncounter.participant, FOLLOWUP_SYSTEMS.callerUrl);
      participantOp = curFhirEncounter.participant.length ? 'replace' : 'remove';
    }
  }
  if (encounterDetails?.provider?.practitionerId !== curEncounterDetails?.provider?.practitionerId) {
    // provider is updating
    if (
      encounterDetails?.provider?.practitionerId &&
      curEncounterDetails?.provider?.practitionerId &&
      curFhirEncounter?.participant
    ) {
      participantOp = 'replace';
      curFhirEncounter.participant = updateParticipant(
        curFhirEncounter.participant,
        FOLLOWUP_SYSTEMS.providerUrl,
        encounterDetails.provider.name,
        {
          type: 'Practitioner',
          reference: `Practitioner/${encounterDetails.provider.practitionerId}`,
        }
      );
    }
    // provider is being added
    if (encounterDetails?.provider?.practitionerId && !curEncounterDetails?.provider?.practitionerId) {
      const providerParticipant = createEncounterParticipant(
        FOLLOWUP_SYSTEMS.providerUrl,
        encounterDetails.provider.name,
        {
          type: 'Practitioner',
          reference: `Practitioner/${encounterDetails.provider.practitionerId}`,
        }
      );
      // either being added to an exiting participant array
      if (curFhirEncounter.participant) {
        participantOp = 'replace';
        curFhirEncounter.participant.push(providerParticipant);
      } else {
        // or is the first val in the participant array
        participantOp = 'add';
        curFhirEncounter.participant = [providerParticipant];
      }
    }
    // provider is being removed
    if (
      !encounterDetails?.provider?.practitionerId &&
      curEncounterDetails?.provider?.practitionerId &&
      curFhirEncounter.participant
    ) {
      curFhirEncounter.participant = updateParticipant(curFhirEncounter.participant, FOLLOWUP_SYSTEMS.providerUrl);
      participantOp = curFhirEncounter.participant.length ? 'replace' : 'remove';
    }
  }
  if (participantOp === 'add' || participantOp === 'replace') {
    console.log('updating participant to', JSON.stringify(curFhirEncounter.participant));
    operations.push({
      op: participantOp,
      path: '/participant',
      value: curFhirEncounter.participant,
    });
  } else if (participantOp === 'remove') {
    console.log('removing participant');
    operations.push({
      op: participantOp,
      path: '/participant',
    });
  }

  if (operations.length) {
    return await oystehr.fhir.patch<Encounter>({
      id: encounterId,
      resourceType: 'Encounter',
      operations,
    });
  } else {
    console.log('nothing was updated for this follow up encounter');
    return curFhirEncounter;
  }
}

const createEncounterType = (type: string): Encounter['type'] => {
  return [
    {
      coding: [
        {
          system: FOLLOWUP_SYSTEMS.type.url,
          code: FOLLOWUP_SYSTEMS.type.code,
          display: type,
        },
      ],
      text: type,
    },
  ];
};

const createEncounterReasonCode = (reason: FollowupReason): Encounter['reasonCode'] => {
  return [
    {
      coding: [
        {
          system: FOLLOWUP_SYSTEMS.reasonUrl,
          display: reason,
        },
      ],
      text: reason,
    },
  ];
};

const createEncounterParticipant = (system: string, display: string, individual?: Reference): EncounterParticipant => {
  const participant: EncounterParticipant = {
    type: [
      {
        coding: [
          {
            system,
            display,
          },
        ],
      },
    ],
  };
  if (individual) participant['individual'] = individual;
  return participant;
};

const updateParticipant = (
  participants: EncounterParticipant[],
  system: string,
  updatedValue?: string,
  individual?: Reference
): EncounterParticipant[] => {
  return participants
    .map((participant: EncounterParticipant) => {
      participant?.type?.forEach((type: CodeableConcept) => {
        type?.coding?.forEach((coding: Coding) => {
          if (coding.system === system) {
            if (updatedValue === undefined) {
              type.coding = type?.coding?.filter((c: Coding) => c.system !== system);
            } else if (coding.display !== updatedValue) {
              coding.display = updatedValue;
              if (individual) participant.individual = individual;
            }
          }
        });
      });
      return participant;
    })
    .filter((p: EncounterParticipant) => p?.type?.every((t: CodeableConcept) => t?.coding && t.coding.length > 0));
};
