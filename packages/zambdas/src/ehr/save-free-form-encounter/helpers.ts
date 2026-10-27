import Oystehr from '@oystehr/sdk';
import { Operation } from 'fast-json-patch';
import { Encounter, Extension } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { FOLLOWUP_SYSTEMS, FOLLOWUP_TYPES, isFreeFormEncounter } from 'utils/lib/fhir/encounter';
import { withVersionConflictRetries } from 'utils/lib/fhir/helpers';
import { addOrReplaceOperation } from 'utils/lib/helpers/operations';
import { FHIR_RESOURCE_NOT_FOUND, INVALID_INPUT_ERROR } from 'utils/lib/types/errors';
import { isFhirNotFoundError } from '../../shared/errors';
import { createEncounterResource } from '../save-followup-encounter/helpers';

export const assertFreeFormEncounterOfPatient = (encounter: Encounter, patientId: string): void => {
  if (!isFreeFormEncounter(encounter) || encounter.subject?.reference !== `Patient/${patientId}`) {
    throw INVALID_INPUT_ERROR(`Encounter ${encounter.id} is not a free-form encounter of patient ${patientId}`);
  }
};

export const buildFreeFormNotePatchOperations = (encounter: Encounter, note: string): Operation[] => {
  const messageExtension: Extension = { url: FOLLOWUP_SYSTEMS.messageUrl, valueString: note };
  if (!encounter.extension) {
    return [{ op: 'add', path: '/extension', value: [messageExtension] }];
  }

  const index = encounter.extension.findIndex((extension) => extension.url === FOLLOWUP_SYSTEMS.messageUrl);
  if (index === -1) {
    return [{ op: 'add', path: '/extension/-', value: messageExtension }];
  }

  const { valueString } = encounter.extension[index];
  if (valueString === note) return [];

  const guard: Operation = { op: 'test', path: `/extension/${index}/url`, value: FOLLOWUP_SYSTEMS.messageUrl };
  return [guard, addOrReplaceOperation(valueString, `/extension/${index}/valueString`, note)];
};

export const createFreeFormEncounter = async (
  oystehr: Oystehr,
  patientId: string,
  note: string
): Promise<Encounter> => {
  const now = DateTime.now().toUTC().toISO();
  return createEncounterResource(
    {
      patientId,
      followupType: FOLLOWUP_TYPES[0],
      followupSubtype: 'annotation',
      start: now,
      end: now,
      message: note,
      resolved: true,
    },
    oystehr
  );
};

export const updateFreeFormEncounterNote = async (
  oystehr: Oystehr,
  encounterId: string,
  patientId: string,
  note: string
): Promise<Encounter> =>
  withVersionConflictRetries(async () => {
    let encounter: Encounter;
    try {
      encounter = await oystehr.fhir.get<Encounter>({ resourceType: 'Encounter', id: encounterId });
    } catch (error) {
      if (isFhirNotFoundError(error)) throw FHIR_RESOURCE_NOT_FOUND('Encounter');
      throw error;
    }
    assertFreeFormEncounterOfPatient(encounter, patientId);

    const operations = buildFreeFormNotePatchOperations(encounter, note);
    if (!operations.length) return encounter;
    const versionId = encounter.meta?.versionId;
    return oystehr.fhir.patch<Encounter>(
      { resourceType: 'Encounter', id: encounterId, operations },
      versionId ? { optimisticLockingVersionId: versionId } : undefined
    );
  });
