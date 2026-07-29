import { AppointmentHistoryRow, InPersonAppointmentInformation } from 'utils';

export const getNewMedicationOrderUrl = (appointmentId: string): string => {
  return `/in-person/${appointmentId}/in-house-medication/order/new`;
};

export const getEditOrderUrl = (appointmentId: string, orderId: string): string => {
  return `/in-person/${appointmentId}/in-house-medication/order/edit/${orderId}`;
};

export const getInHouseMedicationMARUrl = (appointmentId: string): string => {
  return `/in-person/${appointmentId}/in-house-medication/mar`;
};

export const getInHouseMedicationDetailsUrl = (appointmentId: string): string => {
  return `/in-person/${appointmentId}/in-house-medication/medication-details`;
};

export const getAssessmentUrl = (appointmentId: string): string => {
  return `/in-person/${appointmentId}/assessment`;
};

export const getExternalLabOrdersUrl = (appointmentId: string): string => {
  return `/in-person/${appointmentId}/external-lab-orders/`;
};

export const getExternalLabOrderCreateUrl = (appointmentId: string): string => {
  return `/in-person/${appointmentId}/external-lab-orders/create`;
};

export const getExternalLabOrderEditUrl = (appointmentId: string, orderId: string): string => {
  return `/in-person/${appointmentId}/external-lab-orders/${orderId}/order-details`;
};

export const getDrExternalLabEditUrl = (appointmentId: string, diagnosticReportId: string): string => {
  return `/in-person/${appointmentId}/external-lab-orders/report/${diagnosticReportId}/order-details`;
};

export const getRadiologyUrl = (appointmentId: string): string => {
  return `/in-person/${appointmentId}/radiology`;
};

export const getRadiologyOrderEditUrl = (appointmentId: string, orderId: string): string => {
  return `/in-person/${appointmentId}/radiology/${orderId}/order-details`;
};

export const getRadiologyOrderCreateUrl = (appointmentId: string): string => {
  return `/in-person/${appointmentId}/radiology/create`;
};

export const getRadiologyExternalOrderDetailsUrl = (appointmentId: string, serviceRequestId: string): string => {
  return `/in-person/${appointmentId}/radiology/${serviceRequestId}/external-order-details`;
};

export const getRadiologyExternalOrderEditUrl = (appointmentId: string, serviceRequestId: string): string => {
  return `/in-person/${appointmentId}/radiology/${serviceRequestId}/edit-external`;
};

export const getInHouseLabsUrl = (appointmentId: string): string => {
  return `/in-person/${appointmentId}/in-house-lab-orders`;
};

export const getInHouseLabOrderCreateUrl = (appointmentId: string): string => {
  return `/in-person/${appointmentId}/in-house-lab-orders/create`;
};

export const getInHouseLabOrderDetailsUrl = (appointmentId: string, serviceRequestId: string): string => {
  return `/in-person/${appointmentId}/in-house-lab-orders/${serviceRequestId}/order-details`;
};

export const getNursingOrdersUrl = (appointmentId: string): string => {
  return `/in-person/${appointmentId}/nursing-orders`;
};

export const getNursingOrderCreateUrl = (appointmentId: string): string => {
  return `/in-person/${appointmentId}/nursing-orders/create`;
};

export const getNursingOrderDetailsUrl = (appointmentId: string, serviceRequestId: string): string => {
  return `/in-person/${appointmentId}/nursing-orders/${serviceRequestId}/order-details`;
};

export const getImmunizationMARUrl = (appointmentId: string): string => {
  return `/in-person/${appointmentId}/immunization/mar`;
};

export const getImmunizationVaccineDetailsUrl = (appointmentId: string): string => {
  return `/in-person/${appointmentId}/immunization/vaccine-details`;
};

export const getImmunizationOrderEditUrl = (appointmentId: string, orderId: string): string => {
  return `/in-person/${appointmentId}/immunization/order/${orderId}`;
};

export const getImmunizationNewOrderUrl = (appointmentId: string): string => {
  return `/in-person/${appointmentId}/immunization/order`;
};

export const getInPersonVisitDetailsUrl = (appointmentId: string): string => {
  return `/visit/${appointmentId}`;
};

export const getInPersonUrlByAppointmentType = (
  appointment: Pick<InPersonAppointmentInformation, 'id' | 'parentAppointmentId' | 'encounterId' | 'isFollowUp'>,
  targetUrl?: string
): string => {
  let baseVisitUrl = `/in-person/${appointment.parentAppointmentId || appointment.id}`;
  if (targetUrl) {
    baseVisitUrl = `${baseVisitUrl}/${targetUrl}`;
  }
  return withFollowUpEncounterId(baseVisitUrl, appointment);
};

export const withFollowUpEncounterId = (
  url: string,
  appointment: Pick<InPersonAppointmentInformation, 'isFollowUp' | 'encounterId'>
): string => {
  if (!appointment.isFollowUp || !appointment.encounterId) return url;
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}encounterId=${appointment.encounterId}`;
};

export type FollowUpAppointmentLookup = Record<string, { parentAppointmentId: string; encounterId: string }>;

export const buildFollowUpAppointmentLookup = (
  visits: AppointmentHistoryRow[] | undefined
): FollowUpAppointmentLookup => {
  const lookup: FollowUpAppointmentLookup = {};
  if (!visits) return lookup;
  for (const visit of visits) {
    if (!visit.followUps) continue;
    for (const followUp of visit.followUps) {
      if (followUp.appointmentId && followUp.originalAppointmentId) {
        lookup[followUp.appointmentId] = {
          parentAppointmentId: followUp.originalAppointmentId,
          encounterId: followUp.encounterId,
        };
      }
    }
  }
  return lookup;
};

export const resolveOrderRoutingFromFollowUpLookup = (
  orderAppointmentId: string,
  lookup: FollowUpAppointmentLookup | undefined
): { appointmentId: string; encounterIdQuery: string | undefined } => {
  const followUpInfo = lookup?.[orderAppointmentId];
  if (followUpInfo) {
    return { appointmentId: followUpInfo.parentAppointmentId, encounterIdQuery: followUpInfo.encounterId };
  }
  return { appointmentId: orderAppointmentId, encounterIdQuery: undefined };
};

export const getChiefComplaintUrl = (appointmentId: string): string => {
  return `/in-person/${appointmentId}/cc-and-intake-notes`;
};

export const getHPIUrl = (appointmentId: string): string => {
  return `/in-person/${appointmentId}/history-of-present-illness-and-templates`;
};

export const getErxUrl = (appointmentId: string): string => {
  return `/in-person/${appointmentId}/erx`;
};

export const getProceduresUrl = (appointmentId: string): string => {
  return `/in-person/${appointmentId}/procedures`;
};

export const getNewProceduresUrl = (appointmentId: string): string => {
  return `/in-person/${appointmentId}/procedures/new`;
};

export const getProcedureDetailsUrl = (appointmentId: string, procedureId: string): string => {
  return `${getProceduresUrl(appointmentId)}/${procedureId}`;
};

export const getVitalsUrl = (appointmentId: string): string => {
  return `/in-person/${appointmentId}/vitals`;
};
