export const getNewOrderUrl = (appointmentId: string): string => {
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

export const getExternalLabOrderEditUrl = (appointmentId: string, orderId: string): string => {
  return `/in-person/${appointmentId}/external-lab-orders/${orderId}/order-details`;
};

export const getRadiologyUrl = (appointmentId: string): string => {
  return `/in-person/${appointmentId}/radiology`;
};

export const getRadiologyOrderEditUrl = (appointmentId: string, orderId: string): string => {
  return `/in-person/${appointmentId}/radiology/${orderId}/order-details`;
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
