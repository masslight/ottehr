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

export const getExternalLabOrderEditUrl = (appointmentId: string, orderId: string): string => {
  return `/in-person/${appointmentId}/external-lab-orders/${orderId}/order-details`;
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
