import { ApptTelemedTab, TelemedAppointmentInformation } from 'utils';
import { compareAppointments } from './appointments';

// Mock telemed appointment data for testing
const createMockTelemedAppointment = (
  overrides: Partial<TelemedAppointmentInformation>
): TelemedAppointmentInformation => ({
  id: 'test-id',
  start: '2024-01-01T10:00:00Z',
  reasonForVisit: 'test visit',
  appointmentStatus: 'fulfilled',
  locationVirtual: { state: 'CA' },
  encounter: {
    resourceType: 'Encounter',
    id: 'encounter-1',
    status: 'finished',
    statusHistory: [
      {
        status: 'planned',
        period: { start: '2024-01-01T09:30:00Z' },
      },
      {
        status: 'arrived',
        period: { start: '2024-01-01T09:35:00Z' },
      },
      {
        status: 'finished',
        period: { start: '2024-01-01T10:30:00Z' },
      },
    ],
  },
  status: 'pre-video',
  statusHistory: [],
  cancellationReason: undefined,
  next: false,
  visitStatusHistory: [],
  practitioner: undefined,
  telemedStatus: 'complete',
  telemedStatusHistory: [
    {
      status: 'complete',
      start: '2024-01-01T10:30:00Z',
      end: '2024-01-01T10:30:00Z',
    },
  ],
  provider: [],
  group: [],
  appointmentType: 'walk-in',
  ...overrides,
});

describe('compareAppointments for complete tab (discharged patients)', () => {
  describe('Current behavior (after implementing proper sorting)', () => {
    test('should sort walk-in appointments by their arrival time for complete tab', () => {
      const appointment1 = createMockTelemedAppointment({
        id: 'appt-1',
        start: '2024-01-01T10:00:00Z', // earlier start time
        appointmentType: 'walk-in',
        encounter: {
          ...createMockTelemedAppointment({}).encounter,
          statusHistory: [
            {
              status: 'arrived',
              period: { start: '2024-01-01T09:30:00Z' }, // earlier arrival
            },
          ],
        },
      });

      const appointment2 = createMockTelemedAppointment({
        id: 'appt-2',
        start: '2024-01-01T11:00:00Z', // later start time
        appointmentType: 'walk-in',
        encounter: {
          ...createMockTelemedAppointment({}).encounter,
          statusHistory: [
            {
              status: 'arrived',
              period: { start: '2024-01-01T09:40:00Z' }, // later arrival
            },
          ],
        },
      });

      const result = compareAppointments(false, appointment1, appointment2, ApptTelemedTab.complete);
      // With new implementation, should sort by arrival time for walk-ins (earlier first)
      expect(result).toBeLessThan(0); // appointment1 should come before appointment2 (arrived earlier)
    });
  });

  describe('Desired behavior for complete tab', () => {
    test('should prioritize pre-booked over walk-in appointments', () => {
      const walkinAppointment = createMockTelemedAppointment({
        id: 'walkin-1',
        start: '2024-01-01T10:00:00Z',
        appointmentType: 'walk-in',
      });

      const prebookedAppointment = createMockTelemedAppointment({
        id: 'prebooked-1',
        start: '2024-01-01T11:00:00Z', // later start time
        appointmentType: 'pre-booked',
      });

      // Pre-booked should come first despite later start time
      const result = compareAppointments(false, prebookedAppointment, walkinAppointment, ApptTelemedTab.complete);
      expect(result).toBeLessThan(0); // prebooked should come before walkin
    });

    test('should sort pre-booked appointments by start time (most recent first)', () => {
      const prebookedEarlier = createMockTelemedAppointment({
        id: 'prebooked-1',
        start: '2024-01-01T10:00:00Z',
        appointmentType: 'pre-booked',
      });

      const prebookedLater = createMockTelemedAppointment({
        id: 'prebooked-2',
        start: '2024-01-01T11:00:00Z',
        appointmentType: 'pre-booked',
      });

      const result = compareAppointments(false, prebookedEarlier, prebookedLater, ApptTelemedTab.complete);
      // Later appointment should come first for pre-booked (most recent first)
      expect(result).toBeGreaterThan(0); // prebookedLater should come before prebookedEarlier
    });

    test('should sort walk-in appointments by arrival time (earliest first)', () => {
      const walkinArrivedEarlier = createMockTelemedAppointment({
        id: 'walkin-1',
        start: '2024-01-01T10:00:00Z',
        appointmentType: 'walk-in',
        encounter: {
          ...createMockTelemedAppointment({}).encounter,
          statusHistory: [
            {
              status: 'arrived',
              period: { start: '2024-01-01T09:30:00Z' }, // arrived earlier
            },
          ],
        },
      });

      const walkinArrivedLater = createMockTelemedAppointment({
        id: 'walkin-2',
        start: '2024-01-01T10:00:00Z',
        appointmentType: 'walk-in',
        encounter: {
          ...createMockTelemedAppointment({}).encounter,
          statusHistory: [
            {
              status: 'arrived',
              period: { start: '2024-01-01T09:40:00Z' }, // arrived later
            },
          ],
        },
      });

      const result = compareAppointments(false, walkinArrivedEarlier, walkinArrivedLater, ApptTelemedTab.complete);
      // Earlier arrival should come first for walk-ins
      expect(result).toBeLessThan(0); // walkinArrivedEarlier should come before walkinArrivedLater
    });
  });
});
