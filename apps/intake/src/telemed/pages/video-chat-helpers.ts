export function getVideoCallAppointmentId(searchParams: URLSearchParams): string | undefined {
  return searchParams.get('appointmentID') ?? searchParams.get('appointment_id') ?? undefined;
}
