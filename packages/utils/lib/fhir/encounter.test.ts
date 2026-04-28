import { Encounter } from 'fhir/r4b';
import { describe, expect, it } from 'vitest';
import {
  EncounterVisitType,
  FOLLOWUP_SUBTYPE_SYSTEM,
  FOLLOWUP_SYSTEMS,
  getEncounterDateTime,
  getEncounterVisitType,
  getFollowupSubtype,
  isAnnotationFollowupEncounter,
  isFollowupEncounter,
  isScheduledFollowupEncounter,
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
