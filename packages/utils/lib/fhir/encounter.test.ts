import Oystehr from '@oystehr/sdk';
import { Encounter } from 'fhir/r4b';
import { describe, expect, it, vi } from 'vitest';
import { FHIR_ENCOUNTER_ERX_PATIENT_SYNC_TAG } from './constants';
import {
  EncounterVisitType,
  FOLLOWUP_SUBTYPE_SYSTEM,
  FOLLOWUP_SYSTEMS,
  getEncounterDateTime,
  getEncounterVisitType,
  getFollowupSubtype,
  isAnnotationFollowupEncounter,
  isEncounterErxSynced,
  isFollowupEncounter,
  isScheduledFollowupEncounter,
  tagEncounterAsErxSynced,
} from './encounter';

const makeEncounter = (overrides: Partial<Encounter> = {}): Encounter => ({
  resourceType: 'Encounter',
  status: 'in-progress',
  class: { system: 'http://hl7.org/fhir/R4/v3/ActEncounterCode/vs.html', code: 'ACUTE' },
  ...overrides,
});

const makeFollowupType = (subtype?: string): Encounter['type'] => [
  {
    coding: [
      {
        system: FOLLOWUP_SYSTEMS.type.url,
        code: FOLLOWUP_SYSTEMS.type.code,
        display: 'Follow-up Encounter',
      },
      ...(subtype
        ? [
            {
              system: FOLLOWUP_SUBTYPE_SYSTEM,
              code: subtype,
              display: subtype,
            },
          ]
        : []),
    ],
    text: 'Follow-up Encounter',
  },
];

describe('Encounter follow-up helpers', () => {
  describe('isFollowupEncounter', () => {
    it('returns false for a regular encounter', () => {
      expect(isFollowupEncounter(makeEncounter())).toBe(false);
    });

    it('returns true for an annotation follow-up', () => {
      expect(isFollowupEncounter(makeEncounter({ type: makeFollowupType('annotation') }))).toBe(true);
    });

    it('returns true for a scheduled follow-up', () => {
      expect(isFollowupEncounter(makeEncounter({ type: makeFollowupType('scheduled') }))).toBe(true);
    });

    it('returns true for a follow-up without subtype coding', () => {
      expect(isFollowupEncounter(makeEncounter({ type: makeFollowupType() }))).toBe(true);
    });
  });

  describe('getFollowupSubtype', () => {
    it('returns undefined for a regular encounter', () => {
      expect(getFollowupSubtype(makeEncounter())).toBeUndefined();
    });

    it('returns "annotation" for an annotation follow-up', () => {
      expect(getFollowupSubtype(makeEncounter({ type: makeFollowupType('annotation') }))).toBe('annotation');
    });

    it('returns "scheduled" for a scheduled follow-up', () => {
      expect(getFollowupSubtype(makeEncounter({ type: makeFollowupType('scheduled') }))).toBe('scheduled');
    });

    it('defaults to "annotation" when follow-up has no subtype coding', () => {
      expect(getFollowupSubtype(makeEncounter({ type: makeFollowupType() }))).toBe('annotation');
    });
  });

  describe('isScheduledFollowupEncounter', () => {
    it('returns false for a regular encounter', () => {
      expect(isScheduledFollowupEncounter(makeEncounter())).toBe(false);
    });

    it('returns false for an annotation follow-up', () => {
      expect(isScheduledFollowupEncounter(makeEncounter({ type: makeFollowupType('annotation') }))).toBe(false);
    });

    it('returns true for a scheduled follow-up', () => {
      expect(isScheduledFollowupEncounter(makeEncounter({ type: makeFollowupType('scheduled') }))).toBe(true);
    });

    it('returns false for a follow-up without subtype coding', () => {
      expect(isScheduledFollowupEncounter(makeEncounter({ type: makeFollowupType() }))).toBe(false);
    });
  });

  describe('isAnnotationFollowupEncounter', () => {
    it('returns false for a regular encounter', () => {
      expect(isAnnotationFollowupEncounter(makeEncounter())).toBe(false);
    });

    it('returns true for an annotation follow-up', () => {
      expect(isAnnotationFollowupEncounter(makeEncounter({ type: makeFollowupType('annotation') }))).toBe(true);
    });

    it('returns false for a scheduled follow-up', () => {
      expect(isAnnotationFollowupEncounter(makeEncounter({ type: makeFollowupType('scheduled') }))).toBe(false);
    });

    it('returns true for a follow-up without subtype coding (defaults to annotation)', () => {
      expect(isAnnotationFollowupEncounter(makeEncounter({ type: makeFollowupType() }))).toBe(true);
    });
  });

  describe('getEncounterDateTime', () => {
    const appointmentStart = '2025-01-01T09:00:00Z';
    const appointmentStartMap = { 'appt-1': appointmentStart };

    it('returns appointment start for a main encounter', () => {
      const enc = makeEncounter({ appointment: [{ reference: 'Appointment/appt-1' }] });
      expect(getEncounterDateTime(enc, appointmentStartMap)).toBe(appointmentStart);
    });

    it('returns appointment start for a scheduled follow-up (has its own appointment)', () => {
      const enc = makeEncounter({
        type: makeFollowupType('scheduled'),
        appointment: [{ reference: 'Appointment/appt-1' }],
      });
      expect(getEncounterDateTime(enc, appointmentStartMap)).toBe(appointmentStart);
    });

    it('ignores shared appointment and returns period.start for an annotation follow-up', () => {
      const annotationStart = '2025-01-01T11:30:00Z';
      const enc = makeEncounter({
        type: makeFollowupType('annotation'),
        // same appointment as the main encounter
        appointment: [{ reference: 'Appointment/appt-1' }],
        period: { start: annotationStart },
      });
      expect(getEncounterDateTime(enc, appointmentStartMap)).toBe(annotationStart);
    });

    it('falls back to statusHistory when annotation follow-up has no period.start', () => {
      const historyStart = '2025-01-01T11:45:00Z';
      const enc = makeEncounter({
        type: makeFollowupType('annotation'),
        appointment: [{ reference: 'Appointment/appt-1' }],
        statusHistory: [{ status: 'in-progress', period: { start: historyStart } }],
      });
      expect(getEncounterDateTime(enc, appointmentStartMap)).toBe(historyStart);
    });
  });

  describe('getEncounterVisitType', () => {
    it('returns "main" for a regular encounter', () => {
      expect(getEncounterVisitType(makeEncounter())).toBe('main' as EncounterVisitType);
    });

    it('returns "main" for undefined encounter', () => {
      expect(getEncounterVisitType(undefined)).toBe('main' as EncounterVisitType);
    });

    it('returns "follow-up" for an annotation follow-up', () => {
      expect(getEncounterVisitType(makeEncounter({ type: makeFollowupType('annotation') }))).toBe(
        'follow-up' as EncounterVisitType
      );
    });

    it('returns "scheduled-follow-up" for a scheduled follow-up', () => {
      expect(getEncounterVisitType(makeEncounter({ type: makeFollowupType('scheduled') }))).toBe(
        'scheduled-follow-up' as EncounterVisitType
      );
    });

    it('returns "follow-up" for a follow-up without subtype (defaults to annotation)', () => {
      expect(getEncounterVisitType(makeEncounter({ type: makeFollowupType() }))).toBe(
        'follow-up' as EncounterVisitType
      );
    });
  });
});

describe('eRx sync tag helpers', () => {
  const syncedTag = {
    system: FHIR_ENCOUNTER_ERX_PATIENT_SYNC_TAG.system,
    code: FHIR_ENCOUNTER_ERX_PATIENT_SYNC_TAG.code,
  };

  describe('isEncounterErxSynced', () => {
    it('returns false for an encounter with no tags', () => {
      expect(isEncounterErxSynced(makeEncounter())).toBe(false);
    });

    it('returns false when the eRx sync tag is absent', () => {
      const encounter = makeEncounter({
        meta: {
          tag: [
            {
              system: 'some-other-system',
              code: 'SOMETHING_ELSE',
            },
          ],
        },
      });
      expect(isEncounterErxSynced(encounter)).toBe(false);
    });

    it('returns true when the eRx sync tag is present', () => {
      const encounter = makeEncounter({
        meta: {
          tag: [syncedTag],
        },
      });
      expect(isEncounterErxSynced(encounter)).toBe(true);
    });
  });

  describe('tagEncounterAsErxSynced', () => {
    it('throws when the encounter has no id', async () => {
      const oystehr = {
        fhir: {
          patch: vi.fn(),
          get: vi.fn(),
        },
      } as unknown as Oystehr;
      await expect(tagEncounterAsErxSynced(oystehr, makeEncounter())).rejects.toThrow();
      expect(oystehr.fhir.patch).not.toHaveBeenCalled();
    });

    it('patches the encounter with the sync tag when not yet synced', async () => {
      const patch = vi.fn().mockResolvedValue(undefined);
      const get = vi.fn();
      const oystehr = {
        fhir: {
          patch,
          get,
        },
      } as unknown as Oystehr;

      await tagEncounterAsErxSynced(
        oystehr,
        makeEncounter({
          id: 'enc-1',
          meta: {
            versionId: 'v1',
          },
        })
      );

      expect(patch).toHaveBeenCalledTimes(1);
      expect(patch).toHaveBeenCalledWith(
        expect.objectContaining({
          resourceType: 'Encounter',
          id: 'enc-1',
        }),
        { optimisticLockingVersionId: 'v1' }
      );
      expect(get).not.toHaveBeenCalled();
    });

    it('patches without optimistic locking when disabled', async () => {
      const patch = vi.fn().mockResolvedValue(undefined);
      const get = vi.fn();
      const oystehr = {
        fhir: {
          patch,
          get,
        },
      } as unknown as Oystehr;

      await tagEncounterAsErxSynced(
        oystehr,
        makeEncounter({
          id: 'enc-1',
          meta: {
            versionId: 'v1',
          },
        }),
        {
          useOptimisticLocking: false,
        }
      );

      expect(patch).toHaveBeenCalledTimes(1);
      expect(patch).toHaveBeenCalledWith(
        expect.objectContaining({
          resourceType: 'Encounter',
          id: 'enc-1',
        }),
        {}
      );
      expect(get).not.toHaveBeenCalled();
    });

    it('does not refresh or retry on failure when optimistic locking is disabled', async () => {
      const patch = vi.fn().mockRejectedValue(new Error('patch failed'));
      const get = vi.fn();
      const oystehr = {
        fhir: {
          patch,
          get,
        },
      } as unknown as Oystehr;

      await tagEncounterAsErxSynced(
        oystehr,
        makeEncounter({
          id: 'enc-1',
          meta: { versionId: 'v1' },
        }),
        {
          useOptimisticLocking: false,
        }
      );

      expect(patch).toHaveBeenCalledTimes(1);
      expect(get).not.toHaveBeenCalled();
    });

    it('does nothing when the encounter is already synced', async () => {
      const patch = vi.fn();
      const oystehr = {
        fhir: {
          patch,
          get: vi.fn(),
        },
      } as unknown as Oystehr;

      await tagEncounterAsErxSynced(
        oystehr,
        makeEncounter({
          id: 'enc-1',
          meta: {
            tag: [syncedTag],
          },
        })
      );

      expect(patch).not.toHaveBeenCalled();
    });

    it('refreshes and retries on a version conflict, then succeeds', async () => {
      const patch = vi.fn().mockRejectedValueOnce(new Error('version conflict')).mockResolvedValueOnce(undefined);
      const get = vi.fn().mockResolvedValue(
        makeEncounter({
          id: 'enc-1',
          meta: {
            versionId: 'v2',
          },
        })
      );
      const oystehr = {
        fhir: {
          patch,
          get,
        },
      } as unknown as Oystehr;

      await tagEncounterAsErxSynced(
        oystehr,
        makeEncounter({
          id: 'enc-1',
          meta: {
            versionId: 'v1',
          },
        })
      );

      expect(patch).toHaveBeenCalledTimes(2);
      expect(get).toHaveBeenCalledTimes(1);
    });

    it('stops retrying once a refresh shows the encounter is already synced', async () => {
      const patch = vi.fn().mockRejectedValue(new Error('version conflict'));
      const get = vi.fn().mockResolvedValue(
        makeEncounter({
          id: 'enc-1',
          meta: {
            tag: [syncedTag],
          },
        })
      );
      const oystehr = {
        fhir: {
          patch,
          get,
        },
      } as unknown as Oystehr;

      await tagEncounterAsErxSynced(oystehr, makeEncounter({ id: 'enc-1', meta: { versionId: 'v1' } }));

      expect(patch).toHaveBeenCalledTimes(1);
      expect(get).toHaveBeenCalledTimes(1);
    });

    it('gives up after the retry limit without throwing', async () => {
      const patch = vi.fn().mockRejectedValue(new Error('version conflict'));
      const get = vi.fn().mockResolvedValue(
        makeEncounter({
          id: 'enc-1',
          meta: {
            versionId: 'v1',
          },
        })
      );
      const oystehr = {
        fhir: {
          patch,
          get,
        },
      } as unknown as Oystehr;

      await expect(
        tagEncounterAsErxSynced(
          oystehr,
          makeEncounter({
            id: 'enc-1',
            meta: {
              versionId: 'v1',
            },
          })
        )
      ).resolves.toBeUndefined();

      expect(patch).toHaveBeenCalledTimes(5);
    });
  });
});
