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
  return `/in-person/${appointmentId}/external-lab-orders/order-details/${orderId}`;
};
