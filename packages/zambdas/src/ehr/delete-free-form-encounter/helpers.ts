import Oystehr from '@oystehr/sdk';
import { Encounter } from 'fhir/r4b';
import { withVersionConflictRetries } from 'utils/lib/fhir/helpers';
import { getFreeFormEncounterOfPatient } from '../save-free-form-encounter/helpers';

export const deleteFreeFormEncounter = async (
  oystehr: Oystehr,
  encounterId: string,
  patientId: string
): Promise<void> =>
  withVersionConflictRetries(async () => {
    const encounter = await getFreeFormEncounterOfPatient(oystehr, encounterId, patientId);
    if (encounter.status === 'entered-in-error') return;

    const versionId = encounter.meta?.versionId;
    await oystehr.fhir.patch<Encounter>(
      {
        resourceType: 'Encounter',
        id: encounterId,
        operations: [{ op: 'replace', path: '/status', value: 'entered-in-error' }],
      },
      versionId ? { optimisticLockingVersionId: versionId } : undefined
    );
  });
