import Oystehr from '@oystehr/sdk';
import { Operation } from 'fast-json-patch';
import { Encounter, Extension } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { FHIR_EXTENSION } from 'utils';

export async function addUserToVideoEncounterIfNeeded(
  encounter: Encounter,
  fhirOtherParticipantRef: string | undefined,
  fhirRelatedPersonRefs: string[],
  oystehr: Oystehr
): Promise<Encounter> {
  try {
    const otherParticipantsIdx = (encounter.extension ?? []).findIndex(
      (ext) => ext.url === FHIR_EXTENSION.Encounter.otherParticipants.url
    );

    const otherParticipantExt = otherParticipantsIdx >= 0 ? encounter.extension?.[otherParticipantsIdx] : undefined;
    const otherParticipantRefs = getOtherParticipantRefs(otherParticipantExt);

    const updateOperations: Operation[] = [];

    if (fhirOtherParticipantRef) {
      const newOtherParticipantEntry = {
        url: FHIR_EXTENSION.Encounter.otherParticipants.extension.otherParticipant.url,
        extension: [
          {
            url: 'period',
            valuePeriod: {
              start: DateTime.now().toUTC().toISO(),
            },
          },
          {
            url: 'reference',
            valueReference: {
              reference: fhirOtherParticipantRef,
            },
          },
        ],
      };

      if (otherParticipantRefs.includes(fhirOtherParticipantRef)) {
        console.log(`User '${fhirOtherParticipantRef}' is already added to the participant list.`);
      } else if (otherParticipantsIdx >= 0) {
        // Targeted patch into the existing container avoids the lost-update race of replacing /extension.
        updateOperations.push({
          op: 'add',
          path: `/extension/${otherParticipantsIdx}/extension/-`,
          value: newOtherParticipantEntry,
        });
      } else {
        const newOtherParticipants = {
          url: FHIR_EXTENSION.Encounter.otherParticipants.url,
          extension: [newOtherParticipantEntry],
        };

        updateOperations.push({
          op: 'add',
          path: encounter.extension ? '/extension/-' : '/extension',
          value: encounter.extension ? newOtherParticipants : [newOtherParticipants],
        });
      }
    } else {
      console.log('Encounter other-participants extension will not be updated.');
    }

    const existingParticipantRefs = new Set(
      (encounter.participant ?? []).map((p) => p.individual?.reference).filter((r): r is string => !!r)
    );

    const refsToAdd = fhirRelatedPersonRefs.filter((ref) => !existingParticipantRefs.has(ref));

    if (!refsToAdd.length) {
      console.log('Encounter.participant list will not be updated.');
    } else {
      console.log(`Adding ${refsToAdd.join(', ')} to Encounter.participant.`);

      if (encounter.participant) {
        refsToAdd.forEach((ref) => {
          updateOperations.push({
            op: 'add',
            path: '/participant/-',
            value: { individual: { reference: ref } },
          });
        });
      } else {
        updateOperations.push({
          op: 'add',
          path: '/participant',
          value: refsToAdd.map((ref) => ({ individual: { reference: ref } })),
        });
      }
    }

    if (updateOperations.length > 0) {
      console.log(JSON.stringify(updateOperations, null, 4));

      const updatedEncounter = await oystehr.fhir.patch<Encounter>({
        resourceType: 'Encounter',
        id: encounter.id ?? '',
        operations: updateOperations,
      });

      return updatedEncounter;
    } else {
      console.log('Nothing to update for the encounter.');
      return encounter;
    }
  } catch (err) {
    console.error('Error while trying to update video encounter with user participant', err);
    throw err;
  }
}

function getOtherParticipantRefs(otherParticipantExt: Extension | undefined): string[] {
  return (otherParticipantExt?.extension ?? [])
    .filter((ext) => ext.url === FHIR_EXTENSION.Encounter.otherParticipants.extension.otherParticipant.url)
    .map((ext) => ext.extension?.find((innerExt) => innerExt.url === 'reference')?.valueReference?.reference)
    .filter((ref): ref is string => Boolean(ref));
}
