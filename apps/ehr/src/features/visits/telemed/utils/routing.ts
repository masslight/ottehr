export const getTelemedVisitDetailsUrl = (appointmentId: string): string => {
  return `/telemed/appointments/${appointmentId}/visit-details`;
};

export const getTelemedAppointmentUrl = (appointmentId: string): string => {
  return `/telemed/appointments/${appointmentId}`;
};
