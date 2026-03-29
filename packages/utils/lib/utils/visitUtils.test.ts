import { Appointment, Encounter } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { describe, expect, it } from 'vitest';
import {
  formatMinutes,
  getDurationOfStatus,
  getInPersonVisitStatus,
  getVisitTotalTime,
  NON_LOS_STATUSES,
} from './visitUtils';

describe('visitUtils', () => {
  describe('getDurationOfStatus', () => {
    const now = DateTime.fromISO('2025-06-15T14:00:00Z');

    it('should compute duration between start and end', () => {
      const entry = {
        status: 'intake' as const,
        period: {
          start: '2025-06-15T13:00:00Z',
          end: '2025-06-15T13:30:00Z',
        },
      };
      expect(getDurationOfStatus(entry, now)).toBe(30);
    });

    it('should compute duration from start to now when no end', () => {
      const entry = {
        status: 'provider' as const,
        period: {
          start: '2025-06-15T13:15:00Z',
        },
      };
      // 14:00 - 13:15 = 45 minutes
      expect(getDurationOfStatus(entry, now)).toBe(45);
    });

    it('should return 0 when no start time', () => {
      const entry = {
        status: 'pending' as const,
        period: {},
      };
      expect(getDurationOfStatus(entry, now)).toBe(0);
    });

    it('should floor fractional minutes', () => {
      const entry = {
        status: 'intake' as const,
        period: {
          start: '2025-06-15T13:00:00Z',
          end: '2025-06-15T13:07:45Z', // 7.75 minutes
        },
      };
      expect(getDurationOfStatus(entry, now)).toBe(7);
    });
  });

  describe('formatMinutes', () => {
    it('should format whole numbers without decimals', () => {
      expect(formatMinutes(45)).toBe('45');
      expect(formatMinutes(0)).toBe('0');
    });

    it('should round fractional minutes', () => {
      expect(formatMinutes(30.7)).toBe('31');
      expect(formatMinutes(30.3)).toBe('30');
    });

    it('should format large numbers with locale separators', () => {
      expect(formatMinutes(1500)).toBe('1,500');
    });
  });

  describe('getVisitTotalTime', () => {
    const now = DateTime.fromISO('2025-06-15T14:00:00Z');

    it('should sum durations of LOS statuses only', () => {
      const appointment = { start: '2025-06-15T12:00:00Z' } as Appointment;
      const history = [
        {
          status: 'pending' as const, // NON_LOS
          period: { start: '2025-06-15T12:00:00Z', end: '2025-06-15T12:10:00Z' },
        },
        {
          status: 'intake' as const, // LOS
          period: { start: '2025-06-15T12:10:00Z', end: '2025-06-15T12:30:00Z' },
        },
        {
          status: 'provider' as const, // LOS
          period: { start: '2025-06-15T12:30:00Z', end: '2025-06-15T13:00:00Z' },
        },
      ];
      // intake: 20 min + provider: 30 min = 50 min (pending excluded as NON_LOS)
      expect(getVisitTotalTime(appointment, history, now)).toBe(50);
    });

    it('should return 0 when appointment has no start', () => {
      const appointment = {} as Appointment;
      const history = [
        {
          status: 'intake' as const,
          period: { start: '2025-06-15T12:10:00Z', end: '2025-06-15T12:30:00Z' },
        },
      ];
      expect(getVisitTotalTime(appointment, history, now)).toBe(0);
    });

    it('should exclude all NON_LOS_STATUSES', () => {
      const appointment = { start: '2025-06-15T12:00:00Z' } as Appointment;
      // Build a history with only NON_LOS statuses
      const history = NON_LOS_STATUSES.map((status) => ({
        status,
        period: { start: '2025-06-15T12:00:00Z', end: '2025-06-15T12:10:00Z' },
      }));
      expect(getVisitTotalTime(appointment, history, now)).toBe(0);
    });
  });

  describe('getInPersonVisitStatus', () => {
    it('should return "pending" for booked appointment', () => {
      const appt = { status: 'booked' } as Appointment;
      const enc = { status: 'planned' } as Encounter;
      expect(getInPersonVisitStatus(appt, enc)).toBe('pending');
    });

    it('should return "arrived" for arrived appointment', () => {
      const appt = { status: 'arrived' } as Appointment;
      const enc = { status: 'arrived' } as Encounter;
      expect(getInPersonVisitStatus(appt, enc)).toBe('arrived');
    });

    it('should return "intake" when checked-in and encounter in-progress', () => {
      const appt = { status: 'checked-in' } as Appointment;
      const enc = { status: 'in-progress' } as Encounter;
      expect(getInPersonVisitStatus(appt, enc)).toBe('intake');
    });

    it('should return "ready" when checked-in but encounter not in-progress', () => {
      const appt = { status: 'checked-in' } as Appointment;
      const enc = { status: 'arrived' } as Encounter;
      expect(getInPersonVisitStatus(appt, enc)).toBe('ready');
    });

    it('should return "provider" when encounter in-progress with attender started but not ended', () => {
      const appt = { status: 'fulfilled' } as Appointment;
      const enc = {
        status: 'in-progress',
        participant: [
          {
            type: [{ coding: [{ code: 'ATND' }] }],
            period: { start: '2025-06-15T12:00:00Z' },
          },
        ],
      } as unknown as Encounter;
      expect(getInPersonVisitStatus(appt, enc)).toBe('provider');
    });

    it('should return "discharged" when encounter in-progress with attender ended', () => {
      const appt = { status: 'fulfilled' } as Appointment;
      const enc = {
        status: 'in-progress',
        participant: [
          {
            type: [{ coding: [{ code: 'ATND' }] }],
            period: { start: '2025-06-15T12:00:00Z', end: '2025-06-15T12:30:00Z' },
          },
        ],
      } as unknown as Encounter;
      expect(getInPersonVisitStatus(appt, enc)).toBe('discharged');
    });

    it('should return "ready for provider" when admitter ended but no attender', () => {
      const appt = { status: 'fulfilled' } as Appointment;
      const enc = {
        status: 'in-progress',
        participant: [
          {
            type: [{ coding: [{ code: 'ADM' }] }],
            period: { start: '2025-06-15T12:00:00Z', end: '2025-06-15T12:20:00Z' },
          },
        ],
      } as unknown as Encounter;
      expect(getInPersonVisitStatus(appt, enc)).toBe('ready for provider');
    });

    it('should return "cancelled" for cancelled appointment', () => {
      const appt = { status: 'cancelled' } as Appointment;
      const enc = { status: 'planned' } as Encounter;
      expect(getInPersonVisitStatus(appt, enc)).toBe('cancelled');
    });

    it('should return "cancelled" for cancelled encounter', () => {
      const appt = { status: 'fulfilled' } as Appointment;
      const enc = { status: 'cancelled' } as Encounter;
      expect(getInPersonVisitStatus(appt, enc)).toBe('cancelled');
    });

    it('should return "no show" for noshow appointment', () => {
      const appt = { status: 'noshow' } as Appointment;
      const enc = { status: 'planned' } as Encounter;
      expect(getInPersonVisitStatus(appt, enc)).toBe('no show');
    });

    it('should return "completed" for finished encounter', () => {
      const appt = { status: 'fulfilled' } as Appointment;
      const enc = { status: 'finished' } as Encounter;
      expect(getInPersonVisitStatus(appt, enc)).toBe('completed');
    });

    it('should return "awaiting supervisor approval" when enabled and extension present', () => {
      const appt = { status: 'fulfilled' } as Appointment;
      const enc = {
        status: 'finished',
        extension: [{ url: 'awaiting-supervisor-approval', valueBoolean: true }],
      } as unknown as Encounter;
      expect(getInPersonVisitStatus(appt, enc, true)).toBe('awaiting supervisor approval');
    });

    it('should return "completed" when supervisor approval not enabled even if extension present', () => {
      const appt = { status: 'fulfilled' } as Appointment;
      const enc = {
        status: 'finished',
        extension: [{ url: 'awaiting-supervisor-approval', valueBoolean: true }],
      } as unknown as Encounter;
      expect(getInPersonVisitStatus(appt, enc, false)).toBe('completed');
    });
  });
});
