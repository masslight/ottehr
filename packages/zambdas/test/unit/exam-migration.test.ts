import { Observation } from 'fhir/r4b';
import { ExamObservationDTO } from 'utils';
import { describe, expect, it } from 'vitest';
import { makeExamObservationDTO } from '../../src/shared';
import {
  migrateNormalExternalGenitalExam,
  migrateV0ToV1,
  MIGRATION_V1_FIELD_MAP,
  NORMAL_EXTERNAL_GENITAL_EXAM_FIELD,
} from '../../src/shared/chart-data/migrations/index';

describe('Exam migration V0 to V1', () => {
  describe('MIGRATION_V1_FIELD_MAP', () => {
    it('should contain expected legacy skin field names', () => {
      expect(MIGRATION_V1_FIELD_MAP['cw-viral-exam']).toBeDefined();
      expect(MIGRATION_V1_FIELD_MAP['cw-urticaria']).toBeDefined();
      expect(MIGRATION_V1_FIELD_MAP['cw-impetigo']).toBeDefined();
      expect(MIGRATION_V1_FIELD_MAP['cw-insect-bites']).toBeDefined();
      expect(MIGRATION_V1_FIELD_MAP['cw-coxsackievirus']).toBeDefined();
      expect(MIGRATION_V1_FIELD_MAP['cw-irritant-diaper-rash']).toBeDefined();
      expect(MIGRATION_V1_FIELD_MAP['cw-ringworm']).toBeDefined();
      expect(MIGRATION_V1_FIELD_MAP['cw-fifths-disease']).toBeDefined();
      expect(MIGRATION_V1_FIELD_MAP['cw-atopic-dermatitis']).toBeDefined();
      expect(MIGRATION_V1_FIELD_MAP['cw-paronychia']).toBeDefined();
      expect(MIGRATION_V1_FIELD_MAP['cw-poison-ivy-contact-dermatitis']).toBeDefined();
      expect(MIGRATION_V1_FIELD_MAP['cw-tinea-capitis']).toBeDefined();
      expect(MIGRATION_V1_FIELD_MAP['cw-pityriasis-rosea']).toBeDefined();
      expect(MIGRATION_V1_FIELD_MAP['cw-lyme-ecm']).toBeDefined();
      expect(MIGRATION_V1_FIELD_MAP['rash']).toBeDefined();
    });

    it('should contain expected legacy heart (murmur) field names', () => {
      expect(MIGRATION_V1_FIELD_MAP['murmur-i']).toEqual({
        parent: 'murmur-grade',
        groupLabel: 'Grade',
        label: 'Grade I',
      });
      expect(MIGRATION_V1_FIELD_MAP['murmur-vi']).toEqual({
        parent: 'murmur-grade',
        groupLabel: 'Grade',
        label: 'Grade VI',
      });
    });

    it('should contain expected legacy lung field names', () => {
      expect(MIGRATION_V1_FIELD_MAP['wheezing-left-upper']).toBeDefined();
      expect(MIGRATION_V1_FIELD_MAP['wheezing-right-lower']).toBeDefined();
      expect(MIGRATION_V1_FIELD_MAP['crackles-left-upper']).toBeDefined();
      expect(MIGRATION_V1_FIELD_MAP['breath-sounds-right-middle']).toBeDefined();
      expect(MIGRATION_V1_FIELD_MAP['subcostal']).toEqual({
        parent: 'retractions',
        groupLabel: 'Type',
        label: 'Subcostal',
      });
      expect(MIGRATION_V1_FIELD_MAP['intercostal']).toEqual({
        parent: 'retractions',
        groupLabel: 'Type',
        label: 'Intercostal',
      });
    });

    it('should contain expected legacy abdomen field names', () => {
      expect(MIGRATION_V1_FIELD_MAP['diffusely']).toEqual({
        parent: 'tender',
        groupLabel: 'Location',
        label: 'Diffusely',
      });
      expect(MIGRATION_V1_FIELD_MAP['ruq']).toEqual({ parent: 'tender', groupLabel: 'Location', label: 'RUQ' });
      expect(MIGRATION_V1_FIELD_MAP['rlq']).toBeDefined();
      expect(MIGRATION_V1_FIELD_MAP['luq']).toBeDefined();
      expect(MIGRATION_V1_FIELD_MAP['r-cva']).toBeDefined();
      expect(MIGRATION_V1_FIELD_MAP['l-cva']).toBeDefined();
    });

    it('should map all skin legacy fields to common-skin-findings parent', () => {
      const skinFields = [
        'cw-viral-exam',
        'cw-insect-bites',
        'cw-urticaria',
        'cw-coxsackievirus',
        'cw-irritant-diaper-rash',
        'cw-ringworm',
        'cw-impetigo',
        'cw-fifths-disease',
        'cw-atopic-dermatitis',
        'cw-paronychia',
        'cw-poison-ivy-contact-dermatitis',
        'cw-tinea-capitis',
        'cw-pityriasis-rosea',
        'cw-lyme-ecm',
      ];

      for (const field of skinFields) {
        expect(MIGRATION_V1_FIELD_MAP[field].parent).toBe('common-skin-findings');
      }
    });
  });

  describe('migrateV0ToV1 converts standalone observations to components', () => {
    it('should convert standalone observations with mapped field names into parent with components', () => {
      const observations: ExamObservationDTO[] = [
        { field: 'cw-viral-exam', value: true, resourceId: 'obs-1' },
        { field: 'cw-urticaria', value: true, resourceId: 'obs-2' },
      ];

      const result = migrateV0ToV1(observations);

      expect(result.migrated).toBe(true);
      expect(result.observations).toHaveLength(1);

      const parent = result.observations[0];
      expect(parent.field).toBe('common-skin-findings');
      expect(parent.value).toBe(true);
      expect(parent.components).toBeDefined();
      expect(parent.components).toHaveLength(2);

      const componentCodes = parent.components!.map((c) => c.code);
      expect(componentCodes).toContain('cw-viral-exam');
      expect(componentCodes).toContain('cw-urticaria');
    });

    it('should group observations by their parent field', () => {
      const observations: ExamObservationDTO[] = [
        { field: 'murmur-i', value: true },
        { field: 'murmur-iii', value: true },
        { field: 'wheezing-left-upper', value: true },
      ];

      const result = migrateV0ToV1(observations);

      expect(result.migrated).toBe(true);

      const murmurParent = result.observations.find((o) => o.field === 'murmur-grade');
      const wheezingParent = result.observations.find((o) => o.field === 'wheezing');

      expect(murmurParent).toBeDefined();
      expect(murmurParent!.components).toHaveLength(2);

      expect(wheezingParent).toBeDefined();
      expect(wheezingParent!.components).toHaveLength(1);
    });

    it('should set correct labels on migrated components', () => {
      const observations: ExamObservationDTO[] = [
        { field: 'subcostal', value: true },
        { field: 'intercostal', value: true },
      ];

      const result = migrateV0ToV1(observations);

      expect(result.migrated).toBe(true);
      const parent = result.observations.find((o) => o.field === 'retractions');
      expect(parent).toBeDefined();

      const labels = parent!.components!.map((c) => c.label);
      expect(labels).toContain('Subcostal');
      expect(labels).toContain('Intercostal');
    });
  });

  describe('migrateV0ToV1 preserves unmatched fields', () => {
    it('should pass through observations with unknown field names unchanged', () => {
      const observations: ExamObservationDTO[] = [
        { field: 'some-unknown-field', value: true },
        { field: 'another-custom-field', value: false },
      ];

      const result = migrateV0ToV1(observations);

      expect(result.migrated).toBe(false);
      expect(result.observations).toEqual(observations);
    });

    it('should preserve unmatched fields alongside migrated ones', () => {
      const observations: ExamObservationDTO[] = [
        { field: 'some-unknown-field', value: true },
        { field: 'murmur-i', value: true },
      ];

      const result = migrateV0ToV1(observations);

      expect(result.migrated).toBe(true);
      expect(result.observations).toHaveLength(2);

      const unknown = result.observations.find((o) => o.field === 'some-unknown-field');
      expect(unknown).toBeDefined();
      expect(unknown!.value).toBe(true);

      const murmur = result.observations.find((o) => o.field === 'murmur-grade');
      expect(murmur).toBeDefined();
    });

    it('should not migrate observations with value: false even if field name is in the map', () => {
      const observations: ExamObservationDTO[] = [{ field: 'cw-viral-exam', value: false }];

      const result = migrateV0ToV1(observations);

      expect(result.migrated).toBe(false);
      expect(result.observations).toEqual(observations);
    });
  });

  describe('migrateV0ToV1 is idempotent', () => {
    it('should not modify already-migrated data (parent with components)', () => {
      const alreadyMigrated: ExamObservationDTO[] = [
        {
          field: 'common-skin-findings',
          value: true,
          components: [
            { code: 'cw-viral-exam', groupLabel: 'Rashes & Eruptions', label: 'Viral exanthem', value: true },
            { code: 'cw-urticaria', groupLabel: 'Rashes & Eruptions', label: 'Urticaria', value: true },
          ],
        },
      ];

      const result = migrateV0ToV1(alreadyMigrated);

      expect(result.migrated).toBe(false);
      expect(result.observations).toEqual(alreadyMigrated);
    });

    it('should not modify data that was previously migrated with additional unmapped fields', () => {
      const alreadyMigrated: ExamObservationDTO[] = [
        {
          field: 'murmur-grade',
          value: true,
          components: [{ code: 'murmur-i', groupLabel: 'Grade', label: 'Grade I', value: true }],
        },
        { field: 'some-other-finding', value: true },
      ];

      const result = migrateV0ToV1(alreadyMigrated);

      expect(result.migrated).toBe(false);
      expect(result.observations).toEqual(alreadyMigrated);
    });

    it('should merge into existing parent if standalone and parent both exist', () => {
      // Edge case: an observation with a mapped field AND the parent already exists
      const observations: ExamObservationDTO[] = [
        {
          field: 'retractions',
          value: true,
          components: [{ code: 'subcostal', groupLabel: 'Type', label: 'Subcostal', value: true }],
        },
        { field: 'intercostal', value: true },
      ];

      const result = migrateV0ToV1(observations);

      expect(result.migrated).toBe(true);
      const parent = result.observations.find((o) => o.field === 'retractions');
      expect(parent).toBeDefined();
      expect(parent!.components).toHaveLength(2);

      const codes = parent!.components!.map((c) => c.code);
      expect(codes).toContain('subcostal');
      expect(codes).toContain('intercostal');
    });
  });
});

describe('migrateNormalExternalGenitalExam', () => {
  const legacyObs: Observation = {
    resourceType: 'Observation',
    subject: {
      reference: 'Patient/patient-id',
    },
    encounter: {
      reference: 'Encounter/encounter-id',
    },
    status: 'final',
    valueBoolean: true,
    code: {
      text: 'Normal external genital exam, no lesions / redness / discharge',
    },
    meta: {
      tag: [
        {
          code: 'normal-external-genital-exam',
          system: 'https://fhir.zapehr.com/r4/StructureDefinitions/exam-observation-field',
        },
      ],
      versionId: '123',
      lastUpdated: '2026-04-20T16:00:49.994Z',
    },
    id: 'obs-genital-1',
  };

  const legacyExamDTO = makeExamObservationDTO(legacyObs);

  it('renames the field to the male target when sex is male', () => {
    const result = migrateNormalExternalGenitalExam([legacyExamDTO], 'male');

    expect(result.migrated).toBe(true);
    expect(result.observations).toHaveLength(1);
    expect(result.observations[0].field).toBe('normal-external-genital-testicular-exam');
    expect(result.observations[0].label).toBe('Normal external genital/testicular exam');
  });

  it('renames the field to the female target when sex is female', () => {
    const result = migrateNormalExternalGenitalExam([legacyExamDTO], 'female');

    expect(result.migrated).toBe(true);
    expect(result.observations).toHaveLength(1);
    expect(result.observations[0].field).toBe('normal-external-genital-exam-female');
    expect(result.observations[0].label).toBe('Normal external genital exam');
  });

  it('returns the resourceId of the migrated observation', () => {
    const result = migrateNormalExternalGenitalExam([legacyExamDTO], 'male');

    expect(result.migratedResourceId).toBe('obs-genital-1');
  });

  it('returns migratedResourceId as undefined when the observation has no resourceId', () => {
    const obs: ExamObservationDTO = { field: NORMAL_EXTERNAL_GENITAL_EXAM_FIELD, value: true };
    const result = migrateNormalExternalGenitalExam([obs], 'female');

    expect(result.migrated).toBe(true);
    expect(result.migratedResourceId).toBeUndefined();
  });

  it('preserves all other properties on the migrated observation', () => {
    const result = migrateNormalExternalGenitalExam([legacyExamDTO], 'male');

    expect(result.observations[0]).toMatchObject({ value: true, resourceId: 'obs-genital-1' });
  });

  it('leaves unrelated observations unchanged', () => {
    const other: ExamObservationDTO = { field: 'some-other-field', value: false };
    const result = migrateNormalExternalGenitalExam([legacyExamDTO, other], 'female');

    expect(result.observations).toHaveLength(2);
    const unchanged = result.observations.find((o) => o.field === 'some-other-field');
    expect(unchanged).toEqual(other);
  });

  it('returns migrated=false and observations unchanged when the legacy field is absent', () => {
    const observations: ExamObservationDTO[] = [
      { field: 'normal-external-genital-testicular-exam', value: true },
      { field: 'some-other-field', value: false },
    ];

    const result = migrateNormalExternalGenitalExam(observations, 'male');

    expect(result.migrated).toBe(false);
    expect(result.migratedResourceId).toBeUndefined();
    expect(result.observations).toEqual(observations);
  });

  it('handles an empty observations array without error', () => {
    const result = migrateNormalExternalGenitalExam([], 'female');

    expect(result.migrated).toBe(false);
    expect(result.observations).toEqual([]);
    expect(result.migratedResourceId).toBeUndefined();
  });
});
