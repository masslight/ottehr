import {
  AppointmentTypeCount,
  DailyVisitCount,
  LocationVisitCount,
  PractitionerVisitCount,
  VisitsByTypeCount,
  VisitsOverviewReportZambdaOutput,
} from '../types/api/visits-overview-report.types';

const APPOINTMENT_TYPES: AppointmentTypeCount['type'][] = ['In-Person', 'Telemed'];
const UNKNOWN_PROVIDER = 'Unknown Provider';

export function mergeVisitsOverviewReports(
  reports: VisitsOverviewReportZambdaOutput[],
  dateRange: VisitsOverviewReportZambdaOutput['dateRange']
): VisitsOverviewReportZambdaOutput {
  const totalAppointments = reports.reduce((sum, report) => sum + report.totalAppointments, 0);

  const typeCounts = new Map<AppointmentTypeCount['type'], number>(APPOINTMENT_TYPES.map((type) => [type, 0]));
  const dailyVisitsMap = new Map<string, DailyVisitCount>();
  const locationVisitsMap = new Map<string, LocationVisitCount>();
  const practitionerVisitsMap = new Map<string, PractitionerVisitCount>();
  const visitsByTypeMap = new Map<string, VisitsByTypeCount>();

  reports.forEach((report) => {
    report.appointmentTypes.forEach(({ type, count }) => {
      typeCounts.set(type, (typeCounts.get(type) ?? 0) + count);
    });

    report.dailyVisits.forEach((day) => {
      const entry = dailyVisitsMap.get(day.date) ?? { date: day.date, inPerson: 0, telemed: 0, unknown: 0, total: 0 };
      entry.inPerson += day.inPerson;
      entry.telemed += day.telemed;
      entry.unknown += day.unknown;
      entry.total += day.total;
      dailyVisitsMap.set(day.date, entry);
    });

    report.locationVisits.forEach((location) => {
      const entry = locationVisitsMap.get(location.locationName) ?? {
        locationName: location.locationName,
        locationId: location.locationId,
        inPerson: 0,
        telemed: 0,
        total: 0,
      };
      entry.inPerson += location.inPerson;
      entry.telemed += location.telemed;
      entry.total += location.total;
      locationVisitsMap.set(location.locationName, entry);
    });

    report.practitionerVisits.forEach((practitioner) => {
      const key = `${practitioner.practitionerId}-${practitioner.role}`;
      const entry = practitionerVisitsMap.get(key) ?? { ...practitioner, inPerson: 0, telemed: 0, total: 0 };
      if (entry.practitionerName === UNKNOWN_PROVIDER && practitioner.practitionerName !== UNKNOWN_PROVIDER) {
        entry.practitionerName = practitioner.practitionerName;
      }
      entry.inPerson += practitioner.inPerson;
      entry.telemed += practitioner.telemed;
      entry.total += practitioner.total;
      practitionerVisitsMap.set(key, entry);
    });

    report.visitsByTypeCount.forEach((row) => {
      const key = `${row.locationId}-${row.serviceCategory}`;
      const entry = visitsByTypeMap.get(key) ?? { ...row, inPerson: 0, telemed: 0, total: 0 };
      entry.inPerson += row.inPerson;
      entry.telemed += row.telemed;
      entry.total += row.total;
      visitsByTypeMap.set(key, entry);
    });
  });

  const appointmentTypes: AppointmentTypeCount[] = APPOINTMENT_TYPES.map((type) => {
    const count = typeCounts.get(type) ?? 0;

    return {
      type,
      count,
      percentage: totalAppointments > 0 ? Math.round((count / totalAppointments) * 100) : 0,
    };
  });

  const inPersonCount = typeCounts.get('In-Person') ?? 0;
  const telemedCount = typeCounts.get('Telemed') ?? 0;

  return {
    message:
      totalAppointments > 0
        ? `Found ${totalAppointments} appointments: ${inPersonCount} in-person, ${telemedCount} telemed`
        : 'No active appointments found for the specified date range',
    totalAppointments,
    appointmentTypes,
    dailyVisits: Array.from(dailyVisitsMap.values()).sort((a, b) => a.date.localeCompare(b.date)),
    locationVisits: Array.from(locationVisitsMap.values()).sort((a, b) => a.locationName.localeCompare(b.locationName)),
    practitionerVisits: Array.from(practitionerVisitsMap.entries())
      .sort(([keyA], [keyB]) => keyA.localeCompare(keyB))
      .map(([_key, practitioner]) => practitioner),
    visitsByTypeCount: Array.from(visitsByTypeMap.values()),
    dateRange,
  };
}
