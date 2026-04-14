import Oystehr from '@oystehr/sdk';
import { Encounter } from 'fhir/r4b';
import { ExamObservationDTO, PRIVATE_EXTENSION_BASE_URL } from 'utils';
import { makeExamObservationResource } from '..';

export const EXAM_MIGRATION_VERSION_URL = `${PRIVATE_EXTENSION_BASE_URL}/exam-migration-version`;
export const CURRENT_EXAM_MIGRATION_VERSION = 1;

/**
 * Gets the current exam migration version from an encounter's extensions.
 * Returns 0 if no version is stamped (pre-migration encounter).
 */
export function getExamMigrationVersion(encounter: Encounter): number {
  const ext = encounter.extension?.find((e) => e.url === EXAM_MIGRATION_VERSION_URL);
  return ext?.valueInteger ?? 0;
}

/**
 * Migration 0 → 1: Convert standalone multi-select observations to component-based storage.
 *
 * Old format: each selected option is its own Observation (e.g., wheezing-left-upper)
 * New format: options are stored as component[] on a parent Observation (e.g., wheezing)
 */

// Map of old standalone field names → { parent field name, label for the component }
export const MIGRATION_V1_FIELD_MAP: Record<string, { parent: string; groupLabel: string; label: string }> = {
  // Heart - Murmur
  'murmur-i': { parent: 'murmur-grade', groupLabel: 'Grade', label: 'Grade I' },
  'murmur-ii': { parent: 'murmur-grade', groupLabel: 'Grade', label: 'Grade II' },
  'murmur-iii': { parent: 'murmur-grade', groupLabel: 'Grade', label: 'Grade III' },
  'murmur-iv': { parent: 'murmur-grade', groupLabel: 'Grade', label: 'Grade IV' },
  'murmur-v': { parent: 'murmur-grade', groupLabel: 'Grade', label: 'Grade V' },
  'murmur-vi': { parent: 'murmur-grade', groupLabel: 'Grade', label: 'Grade VI' },

  // Lungs - Wheezing
  'wheezing-left-upper': { parent: 'wheezing', groupLabel: 'Location', label: 'Left upper' },
  'wheezing-left-lower': { parent: 'wheezing', groupLabel: 'Location', label: 'Left lower' },
  'wheezing-right-upper': { parent: 'wheezing', groupLabel: 'Location', label: 'Right upper' },
  'wheezing-right-middle': { parent: 'wheezing', groupLabel: 'Location', label: 'Right middle' },
  'wheezing-right-lower': { parent: 'wheezing', groupLabel: 'Location', label: 'Right lower' },

  // Lungs - Crackles
  'crackles-left-upper': { parent: 'crackles', groupLabel: 'Location', label: 'Left upper' },
  'crackles-left-lower': { parent: 'crackles', groupLabel: 'Location', label: 'Left lower' },
  'crackles-right-upper': { parent: 'crackles', groupLabel: 'Location', label: 'Right upper' },
  'crackles-right-middle': { parent: 'crackles', groupLabel: 'Location', label: 'Right middle' },
  'crackles-right-lower': { parent: 'crackles', groupLabel: 'Location', label: 'Right lower' },

  // Lungs - Decreased breath sounds
  'breath-sounds-left-upper': { parent: 'breath-sounds', groupLabel: 'Location', label: 'Left upper' },
  'breath-sounds-left-lower': { parent: 'breath-sounds', groupLabel: 'Location', label: 'Left lower' },
  'breath-sounds-right-upper': { parent: 'breath-sounds', groupLabel: 'Location', label: 'Right upper' },
  'breath-sounds-right-middle': { parent: 'breath-sounds', groupLabel: 'Location', label: 'Right middle' },
  'breath-sounds-right-lower': { parent: 'breath-sounds', groupLabel: 'Location', label: 'Right lower' },

  // Lungs - Retractions
  subcostal: { parent: 'retractions', groupLabel: 'Type', label: 'Subcostal' },
  suprasternal: { parent: 'retractions', groupLabel: 'Type', label: 'Suprasternal' },
  intercostal: { parent: 'retractions', groupLabel: 'Type', label: 'Intercostal' },

  // Abdomen - Tender
  diffusely: { parent: 'tender', groupLabel: 'Location', label: 'Diffusely' },
  ruq: { parent: 'tender', groupLabel: 'Location', label: 'RUQ' },
  rlq: { parent: 'tender', groupLabel: 'Location', label: 'RLQ' },
  luq: { parent: 'tender', groupLabel: 'Location', label: 'LUQ' },
  'r-cva': { parent: 'tender', groupLabel: 'Location', label: 'R CVA' },
  'l-cva': { parent: 'tender', groupLabel: 'Location', label: 'L CVA' },

  // Skin - old rash multi-select
  'cw-viral-exam': { parent: 'common-skin-findings', groupLabel: 'Rashes & Eruptions', label: 'Viral exanthem' },
  'cw-insect-bites': { parent: 'common-skin-findings', groupLabel: 'Rashes & Eruptions', label: 'Insect bites' },
  'cw-urticaria': { parent: 'common-skin-findings', groupLabel: 'Rashes & Eruptions', label: 'Urticaria' },
  'cw-coxsackievirus': { parent: 'common-skin-findings', groupLabel: 'Pediatric-Specific', label: 'Coxsackievirus' },
  'cw-irritant-diaper-rash': {
    parent: 'common-skin-findings',
    groupLabel: 'Pediatric-Specific',
    label: 'Irritant diaper rash',
  },
  'cw-ringworm': { parent: 'common-skin-findings', groupLabel: 'Rashes & Eruptions', label: 'Tinea' },
  'cw-impetigo': { parent: 'common-skin-findings', groupLabel: 'Rashes & Eruptions', label: 'Impetigo' },
  'cw-fifths-disease': { parent: 'common-skin-findings', groupLabel: 'Pediatric-Specific', label: "Fifth's disease" },
  'cw-atopic-dermatitis': {
    parent: 'common-skin-findings',
    groupLabel: 'Rashes & Eruptions',
    label: 'Eczema (atopic dermatitis)',
  },
  'cw-paronychia': { parent: 'common-skin-findings', groupLabel: 'Pediatric-Specific', label: 'Paronychia' },
  'cw-poison-ivy-contact-dermatitis': {
    parent: 'common-skin-findings',
    groupLabel: 'Rashes & Eruptions',
    label: 'Poison ivy contact dermatitis',
  },
  'cw-tinea-capitis': { parent: 'common-skin-findings', groupLabel: 'Pediatric-Specific', label: 'Tinea capitis' },
  'cw-pityriasis-rosea': {
    parent: 'common-skin-findings',
    groupLabel: 'Rashes & Eruptions',
    label: 'Pityriasis rosea',
  },
  'cw-lyme-ecm': { parent: 'common-skin-findings', groupLabel: 'Rashes & Eruptions', label: 'Erythema migrans' },

  // Skin - old rash parent (was multi-select parent)
  rash: { parent: 'common-skin-findings', groupLabel: '', label: 'Rash' }, // todo sarah fix this
};

export interface MigrationResult {
  migrated: boolean;
  observations: ExamObservationDTO[];
}

export function migrateV0ToV1(observations: ExamObservationDTO[]): MigrationResult {
  const standaloneToMigrate: ExamObservationDTO[] = [];
  const keepAsIs: ExamObservationDTO[] = [];

  // Separate observations that need migration from those that don't
  for (const obs of observations) {
    if (obs.value === true && MIGRATION_V1_FIELD_MAP[obs.field]) {
      standaloneToMigrate.push(obs);
    } else {
      keepAsIs.push(obs);
    }
  }

  if (standaloneToMigrate.length === 0) {
    return { migrated: false, observations };
  }

  // Group standalone observations by their parent
  const parentGroups: Record<
    string,
    { components: { code: string; label: string; groupLabel: string; value: boolean }[]; resourceIds: string[] }
  > = {};

  for (const obs of standaloneToMigrate) {
    const mapping = MIGRATION_V1_FIELD_MAP[obs.field];
    if (!parentGroups[mapping.parent]) {
      parentGroups[mapping.parent] = { components: [], resourceIds: [] };
    }
    parentGroups[mapping.parent].components.push({
      code: obs.field,
      label: mapping.label,
      groupLabel: mapping.groupLabel,
      value: true,
    });
    if (obs.resourceId) {
      parentGroups[mapping.parent].resourceIds.push(obs.resourceId);
    }
  }

  // Check if parent observations already exist in keepAsIs
  const result = [...keepAsIs];

  for (const [parentField, group] of Object.entries(parentGroups)) {
    const existingParent = result.find((obs) => obs.field === parentField);
    if (existingParent) {
      // Merge components into existing parent
      const existingComponents = existingParent.components ?? [];
      existingParent.components = [...existingComponents, ...group.components];
      existingParent.value = true;
    } else {
      // Create new parent observation
      result.push({
        field: parentField,
        value: true,
        components: group.components,
      });
    }
  }

  return { migrated: true, observations: result };
}

/**
 * Run all pending exam migrations for an encounter.
 * Returns the migrated observations and list of old resource IDs to delete.
 */
export async function runExamMigrations(
  oystehr: Oystehr,
  encounter: Encounter,
  patientId: string,
  encounterId: string,
  examObservations: ExamObservationDTO[]
): Promise<ExamObservationDTO[]> {
  const currentVersion = getExamMigrationVersion(encounter);

  if (currentVersion >= CURRENT_EXAM_MIGRATION_VERSION) {
    return examObservations;
  }

  let result = examObservations;
  let didMigrate = false;

  // Run migration 0 → 1
  if (currentVersion < 1) {
    const migration = migrateV0ToV1(result);
    if (migration.migrated) {
      didMigrate = true;
      result = migration.observations;
    }
  }

  // Persist if any migration ran
  if (didMigrate) {
    console.log(`Running exam migration from version ${currentVersion} to ${CURRENT_EXAM_MIGRATION_VERSION}`);

    try {
      // Collect old standalone observation IDs to delete
      const oldResourceIds: string[] = [];
      for (const obs of examObservations) {
        if (obs.value === true && MIGRATION_V1_FIELD_MAP[obs.field] && obs.resourceId) {
          oldResourceIds.push(obs.resourceId);
        }
      }

      const requests: any[] = [];

      // Delete old standalone observations
      for (const resourceId of oldResourceIds) {
        requests.push({
          method: 'DELETE',
          url: `/Observation/${resourceId}`,
        });
      }

      // Create/update parent observations with components
      for (const obs of result) {
        // Only persist observations that were part of migration (have components from migrated data)
        if (obs.components && obs.components.length > 0) {
          const fhirObs = makeExamObservationResource(encounterId, patientId, obs, undefined, obs.label || obs.field);
          if (obs.resourceId) {
            requests.push({ method: 'PUT', url: `/Observation/${obs.resourceId}`, resource: fhirObs });
          } else {
            requests.push({ method: 'POST', url: '/Observation', resource: fhirObs });
          }
        }
      }

      // Update encounter with new migration version
      const updatedExtensions = (encounter.extension ?? []).filter((e) => e.url !== EXAM_MIGRATION_VERSION_URL);
      updatedExtensions.push({
        url: EXAM_MIGRATION_VERSION_URL,
        valueInteger: CURRENT_EXAM_MIGRATION_VERSION,
      });

      requests.push({
        method: 'PUT',
        url: `/Encounter/${encounterId}`,
        resource: {
          ...encounter,
          extension: updatedExtensions,
        },
      });

      if (requests.length > 0) {
        await oystehr.fhir.transaction({ requests });
        console.log(
          `Exam migration complete: deleted ${oldResourceIds.length} old observations, updated encounter version to ${CURRENT_EXAM_MIGRATION_VERSION}`
        );
      }
    } catch (error) {
      console.error('Exam migration failed, returning unmigrated data:', error);
      return examObservations;
    }
  } else {
    // No data needed migration but version needs updating
    try {
      const updatedExtensions = (encounter.extension ?? []).filter((e) => e.url !== EXAM_MIGRATION_VERSION_URL);
      updatedExtensions.push({
        url: EXAM_MIGRATION_VERSION_URL,
        valueInteger: CURRENT_EXAM_MIGRATION_VERSION,
      });
      await oystehr.fhir.update({
        ...encounter,
        extension: updatedExtensions,
      } as Encounter);
    } catch (error) {
      console.error('Failed to update encounter migration version:', error);
    }
  }

  return result;
}
