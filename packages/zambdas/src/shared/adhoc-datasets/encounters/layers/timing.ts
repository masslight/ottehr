import { DateTime } from 'luxon';
import { appointmentTypeForAppointment } from 'utils/lib/fhir/appointments';
import { getVisitStatusHistory } from 'utils/lib/utils/visitUtils';
import { defineEncounterLayer } from '../context';
import { minutesBetween } from '../helpers';

// Per-visit KPI durations from the Ottehr status history. Nothing to fetch.
export const timingLayer = defineEncounterLayer<null>({
  id: 'timing',
  fetch: async () => null,
  map: ({ encounter, appointment }) => {
    const history = getVisitStatusHistory(encounter);

    const firstStart = (status: string): string | undefined => history.find((e) => e.status === status)?.period?.start;

    const arrived = firstStart('arrived') ?? firstStart('ready');
    const intake = firstStart('intake');
    const provider = firstStart('provider');
    const discharged = firstStart('discharged') ?? firstStart('completed') ?? encounter.period?.end;

    let timeWithProviderMinutes: number | null = null;

    for (const entry of history) {
      if (entry.status !== 'provider' || !entry.period.start || !entry.period.end) continue;
      const mins = minutesBetween(entry.period.start, entry.period.end);
      if (mins != null && mins >= 0) timeWithProviderMinutes = (timeWithProviderMinutes ?? 0) + mins;
    }

    return {
      timeWithProviderMinutes,
      arrivedToProviderMinutes: minutesBetween(arrived, provider),
      arrivedToIntakeMinutes: minutesBetween(arrived, intake),
      intakeToProviderMinutes: minutesBetween(intake, provider),
      providerToDischargedMinutes: minutesBetween(provider, discharged),
      totalCycleMinutes: minutesBetween(arrived, discharged),
      onTime:
        appointmentTypeForAppointment(appointment) === 'pre-booked' && arrived && appointment.start
          ? DateTime.fromISO(arrived) <= DateTime.fromISO(appointment.start)
          : null,
    };
  },
});
